"""E2EE end-to-end encryption client (wraps ANP e2e_encryption_hpke).

[INPUT]: ANP E2eeHpkeSession / HpkeKeyManager / detect_message_type, local_did,
         signing_pem (secp256r1 key-2), x25519_pem (key-3)
[OUTPUT]: E2eeClient class providing high-level API for one-step initialization,
          encryption, decryption, and state export/restore
[POS]: Wraps ANP's underlying HPKE E2EE protocol (RFC 9180 + Chain Ratchet) to provide
       a simple encrypt/decrypt interface for upper-layer applications;
       supports cross-process state persistence

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updates
"""

from __future__ import annotations

import base64
import logging
import time
from typing import Any

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    load_pem_private_key,
)

from anp.e2e_encryption_hpke import (
    E2eeHpkeSession,
    SessionState,
    HpkeKeyManager,
    MessageType,
    detect_message_type,
    extract_x25519_public_key_from_did_document,
    extract_signing_public_key_from_did_document,
)
from anp.authentication import resolve_did_wba_document

logger = logging.getLogger(__name__)

# State version marker, used to distinguish from old formats
_STATE_VERSION = "hpke_v1"


class E2eeClient:
    """E2EE end-to-end encryption client (HPKE scheme).

    Wraps ANP ``E2eeHpkeSession`` and ``HpkeKeyManager``, providing:
    - One-step session initialization (no multi-step handshake)
    - Message encryption and decryption (Chain Ratchet forward secrecy)
    - Expired session cleanup

    Key design: E2EE uses two independent key pairs --
    - key-2 secp256r1: proof signing (identity verification)
    - key-3 X25519: HPKE key agreement
    Both are separate from the DID identity key (secp256k1 key-1).
    """

    def __init__(
        self,
        local_did: str,
        *,
        signing_pem: str | None = None,
        x25519_pem: str | None = None,
    ) -> None:
        """Initialize E2EE client.

        Args:
            local_did: Local DID identifier.
            signing_pem: secp256r1 signing key PEM string (key-2).
            x25519_pem: X25519 agreement key PEM string (key-3).
        """
        self.local_did = local_did
        self._signing_pem = signing_pem
        self._x25519_pem = x25519_pem

        # Load key objects
        self._signing_key: ec.EllipticCurvePrivateKey | None = None
        if signing_pem is not None:
            key = load_pem_private_key(signing_pem.encode("utf-8"), password=None)
            if isinstance(key, ec.EllipticCurvePrivateKey):
                self._signing_key = key

        self._x25519_key: X25519PrivateKey | None = None
        if x25519_pem is not None:
            key = load_pem_private_key(x25519_pem.encode("utf-8"), password=None)
            if isinstance(key, X25519PrivateKey):
                self._x25519_key = key

        self._key_manager = HpkeKeyManager()

    async def initiate_handshake(
        self, peer_did: str
    ) -> tuple[str, dict[str, Any]]:
        """Initiate an E2EE session (one-step initialization).

        Retrieves the peer's X25519 public key from their DID document, then creates
        a session and sends e2ee_init. The session becomes ACTIVE immediately after
        sending, no response from the peer is needed.

        Args:
            peer_did: Peer DID identifier.

        Returns:
            ``(msg_type, content_dict)`` tuple, where msg_type is ``"e2ee_init"``.

        Raises:
            RuntimeError: Missing required keys or unable to retrieve peer DID document.
        """
        if self._signing_key is None or self._x25519_key is None:
            raise RuntimeError("Missing E2EE keys (signing_pem or x25519_pem), please recreate identity")

        # Retrieve peer DID document
        peer_doc = await resolve_did_wba_document(peer_did)
        if peer_doc is None:
            raise RuntimeError(f"Unable to retrieve peer DID document: {peer_did}")

        # Extract peer X25519 public key
        peer_pk, peer_key_id = extract_x25519_public_key_from_did_document(peer_doc)

        # Determine local signing verification method ID
        signing_vm = f"{self.local_did}#key-2"

        # Determine local X25519 key ID
        local_x25519_key_id = f"{self.local_did}#key-3"

        session = E2eeHpkeSession(
            local_did=self.local_did,
            peer_did=peer_did,
            local_x25519_private_key=self._x25519_key,
            local_x25519_key_id=local_x25519_key_id,
            signing_private_key=self._signing_key,
            signing_verification_method=signing_vm,
        )

        msg_type, content = session.initiate_session(peer_pk, peer_key_id)

        # One-step initialization: ACTIVE immediately after sending
        self._key_manager.register_session(session)

        return msg_type, content

    async def process_e2ee_message(
        self, msg_type: str, content: dict[str, Any]
    ) -> list[tuple[str, dict[str, Any]]]:
        """Process a received E2EE protocol message.

        Args:
            msg_type: Message type (``e2ee_init`` / ``e2ee_rekey`` / ``e2ee_error``).
            content: Message content dict.

        Returns:
            List of messages to send (in HPKE scheme, usually an empty list
            since init/rekey do not require a reply).
        """
        detected = detect_message_type(msg_type)
        if detected is None:
            logger.warning("Unrecognized E2EE message type: %s", msg_type)
            return []

        if detected == MessageType.E2EE_INIT:
            return await self._handle_init(content)
        elif detected == MessageType.E2EE_REKEY:
            return await self._handle_rekey(content)
        elif detected == MessageType.E2EE_ERROR:
            return await self._handle_error(content)
        elif detected == MessageType.E2EE_MSG:
            logger.warning("process_e2ee_message does not handle encrypted messages, use decrypt_message instead")
            return []
        else:
            logger.warning("Unhandled E2EE message subtype: %s", detected)
            return []

    def has_active_session(self, peer_did: str) -> bool:
        """Check whether an active encryption session exists with the specified peer."""
        session = self._key_manager.get_active_session(self.local_did, peer_did)
        return session is not None

    async def ensure_active_session(
        self, peer_did: str
    ) -> list[tuple[str, dict[str, Any]]]:
        """Ensure an active session exists with the peer, auto-handshake if needed.

        If a valid session already exists, returns an empty list.
        If the session is missing or expired, initiates a new handshake and returns
        the handshake message(s) that must be sent to the peer.

        Args:
            peer_did: Peer DID identifier.

        Returns:
            List of ``(msg_type, content_dict)`` messages to send (empty if session
            is already active, ``[("e2ee_init", ...)]`` if a handshake was initiated).

        Raises:
            RuntimeError: Missing required keys or unable to retrieve peer DID document.
        """
        if self.has_active_session(peer_did):
            return []
        msg_type, content = await self.initiate_handshake(peer_did)
        logger.info("Auto-handshake initiated for expired/missing session: peer=%s", peer_did[:20])
        return [(msg_type, content)]

    def encrypt_message(
        self, peer_did: str, plaintext: str, original_type: str = "text"
    ) -> tuple[str, dict[str, Any]]:
        """Encrypt a message.

        Args:
            peer_did: Peer DID identifier.
            plaintext: Plaintext content.
            original_type: Original message type (default ``"text"``).

        Returns:
            ``(msg_type, content_dict)`` tuple, where msg_type is ``"e2ee_msg"``.

        Raises:
            RuntimeError: No active session with the peer.
        """
        session = self._key_manager.get_active_session(self.local_did, peer_did)
        if session is None:
            raise RuntimeError(f"No active E2EE session with {peer_did}")
        return session.encrypt_message(original_type, plaintext)

    def decrypt_message(self, content: dict[str, Any]) -> tuple[str, str]:
        """Decrypt a message.

        Finds the corresponding session by ``session_id`` and decrypts.

        Args:
            content: Encrypted message content dict (contains ``session_id``, ``ciphertext``, etc.).

        Returns:
            ``(original_type, plaintext)`` tuple.

        Raises:
            RuntimeError: Cannot find the corresponding session.
        """
        session_id = content.get("session_id")
        if not session_id:
            raise RuntimeError("Message missing session_id")

        session = self._key_manager.get_session_by_id(session_id)
        if session is None:
            raise RuntimeError(f"Cannot find session for session_id={session_id}")
        return session.decrypt_message(content)

    def cleanup_expired(self) -> None:
        """Clean up expired sessions."""
        self._key_manager.cleanup_expired()

    # ------------------------------------------------------------------
    # State export / restore
    # ------------------------------------------------------------------

    def export_state(self) -> dict[str, Any]:
        """Export client state (keys + ACTIVE sessions).

        Returns:
            JSON-serializable dict for persistence.
        """
        sessions: list[dict[str, Any]] = []
        for session in self._key_manager._sessions_by_did_pair.values():
            if session.state == SessionState.ACTIVE and not session.is_expired():
                exported = self._export_session(session)
                if exported is not None:
                    sessions.append(exported)
        return {
            "version": _STATE_VERSION,
            "local_did": self.local_did,
            "signing_pem": self._signing_pem,
            "x25519_pem": self._x25519_pem,
            "sessions": sessions,
        }

    @classmethod
    def from_state(cls, state: dict[str, Any]) -> E2eeClient:
        """Restore a complete client from an exported dict.

        Args:
            state: Dict generated by ``export_state()``.

        Returns:
            Restored ``E2eeClient`` instance.
        """
        # Detect old format: no version marker or version mismatch
        if state.get("version") != _STATE_VERSION:
            logger.info("Detected old E2EE state format, creating new client")
            return cls(
                state["local_did"],
                signing_pem=state.get("signing_pem"),
                x25519_pem=state.get("x25519_pem"),
            )

        client = cls(
            state["local_did"],
            signing_pem=state.get("signing_pem"),
            x25519_pem=state.get("x25519_pem"),
        )
        for session_data in state.get("sessions", []):
            session = cls._restore_session(session_data)
            if session is not None:
                client._key_manager.register_session(session)
        return client

    @staticmethod
    def _export_session(session: E2eeHpkeSession) -> dict[str, Any] | None:
        """Serialize a single ACTIVE session."""
        if session.state != SessionState.ACTIVE:
            return None
        send_chain_key = session._send_chain_key
        recv_chain_key = session._recv_chain_key
        if send_chain_key is None or recv_chain_key is None:
            return None
        return {
            "session_id": session.session_id,
            "local_did": session.local_did,
            "peer_did": session.peer_did,
            "is_initiator": session._is_initiator,
            "send_chain_key": base64.b64encode(send_chain_key).decode("ascii"),
            "recv_chain_key": base64.b64encode(recv_chain_key).decode("ascii"),
            "send_seq": session._seq_manager._send_seq,
            "recv_seq": session._seq_manager._recv_seq,
            "expires_at": session._expires_at,
            "created_at": session._created_at,
            "active_at": session._active_at,
        }

    @staticmethod
    def _restore_session(data: dict[str, Any]) -> E2eeHpkeSession | None:
        """Restore a single ACTIVE session from a dict.

        Uses ``object.__new__()`` to bypass ``__init__`` and directly set internal attributes.
        """
        expires_at = data.get("expires_at")
        if expires_at is not None and time.time() > expires_at:
            return None

        session = object.__new__(E2eeHpkeSession)
        session.local_did = data["local_did"]
        session.peer_did = data["peer_did"]
        session._session_id = data["session_id"]
        session._state = SessionState.ACTIVE
        session._is_initiator = data.get("is_initiator", True)
        session._send_chain_key = base64.b64decode(data["send_chain_key"])
        session._recv_chain_key = base64.b64decode(data["recv_chain_key"])
        session._expires_at = expires_at
        session._created_at = data.get("created_at", time.time())
        session._active_at = data.get("active_at")

        # Restore SeqManager
        from anp.e2e_encryption_hpke.session import SeqManager, SeqMode
        seq_mgr = object.__new__(SeqManager)
        seq_mgr._mode = SeqMode.STRICT
        seq_mgr._send_seq = data.get("send_seq", 0)
        seq_mgr._recv_seq = data.get("recv_seq", 0)
        seq_mgr._max_skip = 256
        seq_mgr._used_seqs = {}
        seq_mgr._skip_key_ttl = 300
        session._seq_manager = seq_mgr

        # Attributes not needed in ACTIVE state, set to None to prevent AttributeError
        session._local_x25519_private_key = None
        session._local_x25519_key_id = ""
        session._signing_private_key = None
        session._signing_verification_method = ""
        session._default_expires = data.get("expires_at", 86400)

        return session

    # ------------------------------------------------------------------
    # Internal handler methods
    # ------------------------------------------------------------------

    async def _handle_init(
        self, content: dict[str, Any]
    ) -> list[tuple[str, dict[str, Any]]]:
        """Handle e2ee_init: retrieve sender DID document to verify proof, create and activate session."""
        if self._signing_key is None or self._x25519_key is None:
            logger.error("Missing E2EE keys, cannot process e2ee_init")
            return []

        sender_did = content.get("sender_did", "")
        if not sender_did:
            logger.warning("e2ee_init message missing sender_did")
            return []

        # Retrieve sender DID document
        sender_doc = await resolve_did_wba_document(sender_did)
        if sender_doc is None:
            logger.warning("Unable to retrieve sender DID document: %s", sender_did)
            return []

        # Extract sender signing public key (for proof verification)
        proof = content.get("proof", {})
        vm_id = proof.get("verificationMethod", "")
        try:
            sender_signing_pk = extract_signing_public_key_from_did_document(
                sender_doc, vm_id
            )
        except ValueError as e:
            logger.warning("Unable to extract sender signing public key: %s", e)
            return []

        # Determine local key IDs
        signing_vm = f"{self.local_did}#key-2"
        local_x25519_key_id = f"{self.local_did}#key-3"

        session = E2eeHpkeSession(
            local_did=self.local_did,
            peer_did=sender_did,
            local_x25519_private_key=self._x25519_key,
            local_x25519_key_id=local_x25519_key_id,
            signing_private_key=self._signing_key,
            signing_verification_method=signing_vm,
        )

        try:
            session.process_init(content, sender_signing_pk)
        except (ValueError, RuntimeError) as e:
            logger.warning("Failed to process e2ee_init: %s", e)
            return []

        # Register session (immediately ACTIVE)
        self._key_manager.register_session(session)
        logger.info(
            "E2EE session activated (receiver): %s <-> %s (session_id=%s)",
            session.local_did, session.peer_did, session.session_id,
        )

        # HPKE scheme: init does not require a reply
        return []

    async def _handle_rekey(
        self, content: dict[str, Any]
    ) -> list[tuple[str, dict[str, Any]]]:
        """Handle e2ee_rekey: rebuild session."""
        if self._signing_key is None or self._x25519_key is None:
            logger.error("Missing E2EE keys, cannot process e2ee_rekey")
            return []

        sender_did = content.get("sender_did", "")
        if not sender_did:
            logger.warning("e2ee_rekey message missing sender_did")
            return []

        # Retrieve sender DID document
        sender_doc = await resolve_did_wba_document(sender_did)
        if sender_doc is None:
            logger.warning("Unable to retrieve sender DID document: %s", sender_did)
            return []

        # Extract sender signing public key
        proof = content.get("proof", {})
        vm_id = proof.get("verificationMethod", "")
        try:
            sender_signing_pk = extract_signing_public_key_from_did_document(
                sender_doc, vm_id
            )
        except ValueError as e:
            logger.warning("Unable to extract sender signing public key: %s", e)
            return []

        signing_vm = f"{self.local_did}#key-2"
        local_x25519_key_id = f"{self.local_did}#key-3"

        # Try to get existing session for rekey
        session = self._key_manager.get_active_session(self.local_did, sender_did)
        if session is not None:
            try:
                session.process_rekey(content, sender_signing_pk)
                self._key_manager.register_session(session)
                logger.info(
                    "E2EE session rekey successful: %s <-> %s", self.local_did, sender_did
                )
                return []
            except (ValueError, RuntimeError) as e:
                logger.warning("Rekey of existing session failed, attempting to create new session: %s", e)

        # No existing session or rekey failed, create new session
        session = E2eeHpkeSession(
            local_did=self.local_did,
            peer_did=sender_did,
            local_x25519_private_key=self._x25519_key,
            local_x25519_key_id=local_x25519_key_id,
            signing_private_key=self._signing_key,
            signing_verification_method=signing_vm,
        )
        try:
            session.process_rekey(content, sender_signing_pk)
        except (ValueError, RuntimeError) as e:
            logger.warning("Failed to process e2ee_rekey: %s", e)
            return []

        self._key_manager.register_session(session)
        logger.info(
            "E2EE session rekey (new): %s <-> %s", self.local_did, sender_did
        )
        return []

    async def _handle_error(
        self, content: dict[str, Any]
    ) -> list[tuple[str, dict[str, Any]]]:
        """Handle E2EE Error: log, remove the corresponding session, and auto re-handshake for recoverable errors."""
        error_code = content.get("error_code", "unknown")
        session_id = content.get("session_id", "")
        logger.warning(
            "Received E2EE error: code=%s, session_id=%s", error_code, session_id
        )
        peer_did: str | None = None
        if session_id:
            session = self._key_manager.get_session_by_id(session_id)
            if session is not None:
                peer_did = session.peer_did
                self._key_manager.remove_session(session.local_did, session.peer_did)

        # Auto re-handshake for recoverable errors
        _recoverable = {"session_not_found", "session_expired", "decryption_failed"}
        if error_code in _recoverable and peer_did is not None:
            try:
                msg_type, init_content = await self.initiate_handshake(peer_did)
                logger.info(
                    "Auto re-handshake initiated after E2EE error: peer=%s", peer_did[:20]
                )
                return [(msg_type, init_content)]
            except Exception:
                logger.exception("Auto re-handshake failed: peer=%s", peer_did)
        return []


__all__ = ["E2eeClient"]
