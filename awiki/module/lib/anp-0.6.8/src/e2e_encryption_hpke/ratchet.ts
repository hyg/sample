/**
 * 链式 ratchet 密钥派生
 */

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

export function deriveChainKeys(rootSeed: Uint8Array): {
  initChainKey: Uint8Array;
  respChainKey: Uint8Array;
} {
  const initChainKey = hkdf(
    sha256,
    new TextEncoder().encode("anp-e2ee-init"),
    rootSeed,
    new Uint8Array(),
    32
  );

  const respChainKey = hkdf(
    sha256,
    new TextEncoder().encode("anp-e2ee-resp"),
    rootSeed,
    new Uint8Array(),
    32
  );

  return { initChainKey, respChainKey };
}

export function determineDirection(localDid: string, peerDid: string): boolean {
  const localBytes = new TextEncoder().encode(localDid);
  const peerBytes = new TextEncoder().encode(peerDid);

  for (let i = 0; i < Math.min(localBytes.length, peerBytes.length); i++) {
    if (localBytes[i] < peerBytes[i]) return true;
    if (localBytes[i] > peerBytes[i]) return false;
  }

  return localBytes.length < peerBytes.length;
}

export function assignChainKeys(
  initChainKey: Uint8Array,
  respChainKey: Uint8Array,
  isInitiator: boolean
): { sendChainKey: Uint8Array; recvChainKey: Uint8Array } {
  if (isInitiator) {
    return { sendChainKey: initChainKey, recvChainKey: respChainKey };
  } else {
    return { sendChainKey: respChainKey, recvChainKey: initChainKey };
  }
}

export function deriveMessageKey(
  chainKey: Uint8Array,
  seq: number
): { encKey: Uint8Array; nonce: Uint8Array; newChainKey: Uint8Array } {
  const seqBytes = new Uint8Array(8);
  new DataView(seqBytes.buffer).setBigUint64(0, BigInt(seq));

  const msgKey = hmac(
    sha256,
    chainKey,
    concatBytes(new TextEncoder().encode("msg"), seqBytes)
  );

  const newChainKey = hmac(sha256, chainKey, new TextEncoder().encode("ck"));

  const encKeyFull = hmac(sha256, msgKey, new TextEncoder().encode("key"));
  const encKey = encKeyFull.slice(0, 16);

  const nonceFull = hmac(sha256, msgKey, new TextEncoder().encode("nonce"));
  const nonce = nonceFull.slice(0, 12);

  return { encKey, nonce, newChainKey };
}

export function deriveGroupMessageKey(
  senderChainKey: Uint8Array,
  seq: number
): { encKey: Uint8Array; nonce: Uint8Array; newChainKey: Uint8Array } {
  const seqBytes = new Uint8Array(8);
  new DataView(seqBytes.buffer).setBigUint64(0, BigInt(seq));

  const msgKey = hmac(
    sha256,
    senderChainKey,
    concatBytes(new TextEncoder().encode("gmsg"), seqBytes)
  );

  const newChainKey = hmac(
    sha256,
    senderChainKey,
    new TextEncoder().encode("gck")
  );

  const encKeyFull = hmac(sha256, msgKey, new TextEncoder().encode("key"));
  const encKey = encKeyFull.slice(0, 16);

  const nonceFull = hmac(sha256, msgKey, new TextEncoder().encode("nonce"));
  const nonce = nonceFull.slice(0, 12);

  return { encKey, nonce, newChainKey };
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
