"""Credential persistence: save/load private keys, DID, JWT to local files.

[INPUT]: DIDIdentity object, DIDWbaAuthHeader (ANP SDK), SDKConfig (credentials_dir)
[OUTPUT]: save_identity(), load_identity(), list_identities(), delete_identity(),
         extract_auth_files(), create_authenticator()
[POS]: Core credential management module supporting cross-session identity reuse and DIDWbaAuthHeader factory

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

from __future__ import annotations

import json
import os
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils.config import SDKConfig


def _get_credentials_dir() -> Path:
    """Get the credentials directory from SDKConfig."""
    return SDKConfig().credentials_dir


def _ensure_credentials_dir() -> Path:
    """Ensure credentials directory exists with proper permissions."""
    cred_dir = _get_credentials_dir()
    cred_dir.mkdir(parents=True, exist_ok=True)
    # Set directory permissions to 700 (only current user can access)
    os.chmod(cred_dir, stat.S_IRWXU)
    return cred_dir


def _credential_path(name: str) -> Path:
    """Get credential file path."""
    return _ensure_credentials_dir() / f"{name}.json"


def save_identity(
    did: str,
    unique_id: str,
    user_id: str | None,
    private_key_pem: bytes,
    public_key_pem: bytes,
    jwt_token: str | None = None,
    display_name: str | None = None,
    name: str = "default",
    did_document: dict[str, Any] | None = None,
    e2ee_signing_private_pem: bytes | None = None,
    e2ee_agreement_private_pem: bytes | None = None,
) -> Path:
    """Save a DID identity to a local file.

    Args:
        did: DID identifier
        unique_id: Unique ID extracted from the DID
        user_id: User ID after registration
        private_key_pem: PEM-encoded private key
        public_key_pem: PEM-encoded public key
        jwt_token: JWT token
        display_name: Display name
        name: Credential name (default "default")
        did_document: DID document (for DIDWbaAuthHeader)
        e2ee_signing_private_pem: key-2 secp256r1 signing private key PEM
        e2ee_agreement_private_pem: key-3 X25519 agreement private key PEM

    Returns:
        Credential file path
    """
    credential_data: dict[str, Any] = {
        "did": did,
        "unique_id": unique_id,
        "user_id": user_id,
        "private_key_pem": private_key_pem.decode("utf-8")
            if isinstance(private_key_pem, bytes) else private_key_pem,
        "public_key_pem": public_key_pem.decode("utf-8")
            if isinstance(public_key_pem, bytes) else public_key_pem,
        "jwt_token": jwt_token,
        "name": display_name,
        "did_document": did_document,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if e2ee_signing_private_pem is not None:
        credential_data["e2ee_signing_private_pem"] = (
            e2ee_signing_private_pem.decode("utf-8")
            if isinstance(e2ee_signing_private_pem, bytes)
            else e2ee_signing_private_pem
        )
    if e2ee_agreement_private_pem is not None:
        credential_data["e2ee_agreement_private_pem"] = (
            e2ee_agreement_private_pem.decode("utf-8")
            if isinstance(e2ee_agreement_private_pem, bytes)
            else e2ee_agreement_private_pem
        )

    path = _credential_path(name)
    path.write_text(json.dumps(credential_data, indent=2, ensure_ascii=False))
    # Set private key file permissions to 600 (only current user can read/write)
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    return path


def load_identity(name: str = "default") -> dict[str, Any] | None:
    """Load a DID identity from a local file.

    Args:
        name: Credential name (default "default")

    Returns:
        Credential data dict, or None if not found
    """
    path = _credential_path(name)
    if path.exists():
        return json.loads(path.read_text())

    return None


def list_identities() -> list[dict[str, Any]]:
    """List all saved identities.

    Returns:
        List of identities, each containing name, did, created_at, etc.
    """
    identities: list[dict[str, Any]] = []

    cred_dir = _ensure_credentials_dir()
    for path in sorted(cred_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
            identities.append({
                "credential_name": path.stem,
                "did": data.get("did", ""),
                "unique_id": data.get("unique_id", ""),
                "name": data.get("name", ""),
                "user_id": data.get("user_id", ""),
                "created_at": data.get("created_at", ""),
                "has_jwt": bool(data.get("jwt_token")),
            })
        except (json.JSONDecodeError, OSError):
            continue

    return identities


def delete_identity(name: str) -> bool:
    """Delete a saved identity.

    Args:
        name: Credential name

    Returns:
        Whether deletion was successful
    """
    path = _credential_path(name)
    if path.exists():
        path.unlink()
        return True
    return False


def update_jwt(name: str, jwt_token: str) -> bool:
    """Update the JWT token of a saved identity.

    Args:
        name: Credential name
        jwt_token: New JWT token

    Returns:
        Whether update was successful
    """
    data = load_identity(name)
    if data is None:
        return False
    data["jwt_token"] = jwt_token
    path = _credential_path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    return True


def extract_auth_files(name: str = "default") -> tuple[Path, Path] | None:
    """Extract DID document and private key files from credential for DIDWbaAuthHeader.

    Args:
        name: Credential name

    Returns:
        (did_doc_path, key_path) tuple, or None if credential is missing or has no DID document
    """
    data = load_identity(name)
    if data is None or not data.get("did_document"):
        return None

    cred_dir = _ensure_credentials_dir()

    # Write DID document JSON
    did_doc_path = cred_dir / f"{name}_did_document.json"
    did_doc_path.write_text(json.dumps(data["did_document"], indent=2, ensure_ascii=False))

    # Write private key PEM
    key_path = cred_dir / f"{name}_private_key.pem"
    private_key_pem = data["private_key_pem"]
    if isinstance(private_key_pem, str):
        private_key_pem = private_key_pem.encode("utf-8")
    key_path.write_bytes(private_key_pem)
    os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)

    return (did_doc_path, key_path)


def create_authenticator(
    name: str = "default",
    config: Any = None,
) -> tuple[Any, dict[str, Any]] | None:
    """Create a DIDWbaAuthHeader instance.

    Args:
        name: Credential name
        config: SDKConfig instance (used to pre-populate token cache)

    Returns:
        (authenticator, identity_data) tuple, or None if unavailable
    """
    from anp.authentication import DIDWbaAuthHeader

    data = load_identity(name)
    if data is None:
        return None

    auth_files = extract_auth_files(name)
    if auth_files is None:
        return None

    did_doc_path, key_path = auth_files
    auth = DIDWbaAuthHeader(str(did_doc_path), str(key_path))

    # If a saved JWT exists, pre-populate it into token cache (avoid re-authenticating via DIDWba on first request)
    if data.get("jwt_token") and config is not None:
        server_url = config.user_service_url
        auth.update_token(server_url, {"Authorization": f"Bearer {data['jwt_token']}"})
        # Pre-populate molt-message as well
        if hasattr(config, "molt_message_url"):
            auth.update_token(
                config.molt_message_url,
                {"Authorization": f"Bearer {data['jwt_token']}"},
            )

    return (auth, data)
