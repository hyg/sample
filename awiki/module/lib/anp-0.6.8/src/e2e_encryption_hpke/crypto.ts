/**
 * AES-128-GCM 加解密
 */

import * as aes from "@noble/ciphers/aes.js";

export function encryptAes128GcmSync(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array = new Uint8Array()
): string {
  const cipher = aes.gcm(key, nonce, aad);
  const ciphertext = cipher.encrypt(plaintext);
  return toBase64(ciphertext);
}

export function decryptAes128GcmSync(
  ciphertextB64: string,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array = new Uint8Array()
): Uint8Array {
  const ciphertext = fromBase64(ciphertextB64);
  const cipher = aes.gcm(key, nonce, aad);
  return cipher.decrypt(ciphertext);
}

export async function encryptAes128Gcm(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array = new Uint8Array()
): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM", length: 128 },
      false,
      ["encrypt"]
    );

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aad,
      },
      cryptoKey,
      plaintext
    );

    return toBase64(new Uint8Array(ciphertext));
  }

  return encryptAes128GcmSync(plaintext, key, nonce, aad);
}

export async function decryptAes128Gcm(
  ciphertextB64: string,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array = new Uint8Array()
): Promise<Uint8Array> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const ciphertext = fromBase64(ciphertextB64);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM", length: 128 },
      false,
      ["decrypt"]
    );

    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: nonce,
          additionalData: aad,
        },
        cryptoKey,
        ciphertext
      );

      return new Uint8Array(plaintext);
    } catch {
      throw new Error("Decryption failed: invalid tag or corrupted ciphertext");
    }
  }

  return decryptAes128GcmSync(ciphertextB64, key, nonce, aad);
}

function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
