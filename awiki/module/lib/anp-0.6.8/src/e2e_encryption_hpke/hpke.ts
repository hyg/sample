/**
 * HPKE Base 模式封装（RFC 9180 手动实现）
 */

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes } from "@noble/hashes/utils.js";
import { x25519 } from "@noble/curves/ed25519.js";
import * as aes from "@noble/ciphers/aes.js";

// ─── RFC 9180 常量 ──────────────────────────────────────────────────────────────

const KEM_ID = new Uint8Array([0x00, 0x20]);
const KDF_ID = new Uint8Array([0x00, 0x01]);
const AEAD_ID = new Uint8Array([0x00, 0x01]);

const KEM_SUITE_ID = concatBytes(new TextEncoder().encode("KEM"), KEM_ID);
const HPKE_SUITE_ID = concatBytes(
  new TextEncoder().encode("HPKE"),
  KEM_ID,
  KDF_ID,
  AEAD_ID
);

const N_SECRET = 32;
const NK = 16;
const NN = 12;

/**
 * LabeledExtract(salt, label, ikm) per RFC 9180 Section 4
 */
function labeledExtract(
  salt: Uint8Array | null,
  label: Uint8Array,
  ikm: Uint8Array,
  suiteId: Uint8Array
): Uint8Array {
  const labeledIkm = concatBytes(
    new TextEncoder().encode("HPKE-v1"),
    suiteId,
    label,
    ikm
  );
  return hkdf(sha256, labeledIkm, salt || new Uint8Array(), new Uint8Array(), 32);
}

/**
 * LabeledExpand(prk, label, info, L) per RFC 9180 Section 4
 */
function labeledExpand(
  prk: Uint8Array,
  label: Uint8Array,
  infoData: Uint8Array,
  length: number,
  suiteId: Uint8Array
): Uint8Array {
  const labeledInfo = concatBytes(
    new Uint8Array([length >>> 8, length & 0xff]),
    new TextEncoder().encode("HPKE-v1"),
    suiteId,
    label,
    infoData
  );
  return hkdf(sha256, labeledInfo, prk, new Uint8Array(), length);
}

/**
 * ExtractAndExpand per RFC 9180 Section 4.1
 */
function extractAndExpand(dh: Uint8Array, kemContext: Uint8Array): Uint8Array {
  const suiteId = KEM_SUITE_ID;
  const prk = labeledExtract(
    new Uint8Array(),
    new TextEncoder().encode("shared_secret"),
    dh,
    suiteId
  );
  return labeledExpand(
    prk,
    new TextEncoder().encode("shared_secret"),
    kemContext,
    N_SECRET,
    suiteId
  );
}

/**
 * Encap(pkR) -> (sharedSecret, enc)
 */
function encap(recipientPk: Uint8Array): {
  sharedSecret: Uint8Array;
  enc: Uint8Array;
} {
  const ekPrivate = x25519.utils.randomSecretKey();
  const ekPublic = x25519.getPublicKey(ekPrivate);
  const dh = x25519.getSharedSecret(ekPrivate, recipientPk);

  const enc = ekPublic;
  const pkR = recipientPk;
  const kemContext = concatBytes(enc, pkR);

  const sharedSecret = extractAndExpand(dh, kemContext);
  return { sharedSecret, enc };
}

/**
 * Decap(enc, skR) -> sharedSecret
 */
function decap(enc: Uint8Array, recipientSk: Uint8Array): Uint8Array {
  const ekPublic = enc;
  const dh = x25519.getSharedSecret(recipientSk, ekPublic);
  const pkR = x25519.getPublicKey(recipientSk);
  const kemContext = concatBytes(enc, pkR);

  return extractAndExpand(dh, kemContext);
}

/**
 * KeyScheduleS
 */
function keyScheduleS(
  sharedSecret: Uint8Array,
  info: Uint8Array
): { key: Uint8Array; baseNonce: Uint8Array } {
  const mode = new Uint8Array([0x00]);
  const suiteId = HPKE_SUITE_ID;

  const pskIdHash = labeledExtract(
    new Uint8Array(),
    new TextEncoder().encode("psk_id_hash"),
    new Uint8Array(),
    suiteId
  );
  const infoHash = labeledExtract(
    new Uint8Array(),
    new TextEncoder().encode("info_hash"),
    info,
    suiteId
  );
  const ksContext = concatBytes(mode, pskIdHash, infoHash);

  const secret = labeledExtract(
    sharedSecret,
    new TextEncoder().encode("secret"),
    new Uint8Array(),
    suiteId
  );
  const key = labeledExpand(secret, new TextEncoder().encode("key"), ksContext, NK, suiteId);
  const baseNonce = labeledExpand(
    secret,
    new TextEncoder().encode("base_nonce"),
    ksContext,
    NN,
    suiteId
  );

  return { key, baseNonce };
}

// ─── 公开 API ───────────────────────────────────────────────────────────────────

export function hpkeSeal(
  recipientPk: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(),
  info: Uint8Array = new Uint8Array()
): { enc: Uint8Array; ciphertext: Uint8Array } {
  const { sharedSecret, enc } = encap(recipientPk);
  const { key, baseNonce } = keyScheduleS(sharedSecret, info);
  const cipher = aes.gcm(key, baseNonce, aad);
  const ciphertext = cipher.encrypt(plaintext);
  return { enc, ciphertext };
}

export function hpkeOpen(
  recipientSk: Uint8Array,
  enc: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array = new Uint8Array(),
  info: Uint8Array = new Uint8Array()
): Uint8Array {
  const sharedSecret = decap(enc, recipientSk);
  const { key, baseNonce } = keyScheduleS(sharedSecret, info);
  const cipher = aes.gcm(key, baseNonce, aad);
  return cipher.decrypt(ciphertext);
}

export function generateX25519KeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export function publicKeyToBytes(pk: Uint8Array): Uint8Array {
  return pk;
}

export function publicKeyFromBytes(data: Uint8Array): Uint8Array {
  if (data.length !== 32) {
    throw new Error("Invalid public key length: expected 32 bytes");
  }
  return data;
}

export function privateKeyToBytes(sk: Uint8Array): Uint8Array {
  return sk;
}

export function privateKeyFromBytes(data: Uint8Array): Uint8Array {
  if (data.length !== 32) {
    throw new Error("Invalid private key length: expected 32 bytes");
  }
  return data;
}
