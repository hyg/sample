/**
 * X25519 密钥对管理和 DID 文档公钥提取
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { base58 } from "@scure/base";
import { DidDocument, ExtractPublicKeyResult } from "./types";

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

export function publicKeyToMultibase(pk: Uint8Array): string {
  return "z" + base58.encode(pk);
}

export function publicKeyFromMultibase(multibase: string): Uint8Array {
  if (!multibase.startsWith("z")) {
    throw new Error(`Unsupported multibase prefix: '${multibase[0]}'`);
  }
  const raw = base58.decode(multibase.slice(1));
  return publicKeyFromBytes(raw);
}

export function extractX25519PublicKeyFromDidDocument(
  doc: DidDocument,
  keyId?: string
): ExtractPublicKeyResult {
  const kaRefs = doc.keyAgreement || [];
  const vms = doc.verificationMethod || [];

  const vmMap = new Map<string, typeof vms[0]>();
  for (const vm of vms) {
    if (vm && typeof vm === "object" && "id" in vm) {
      vmMap.set(vm.id, vm);
    }
  }

  const candidates: Array<typeof vms[0]> = [];
  for (const ref of kaRefs) {
    let vm: typeof vms[0] | undefined;
    if (typeof ref === "string") {
      vm = vmMap.get(ref);
    } else if (ref && typeof ref === "object") {
      vm = ref;
    }

    if (vm && vm.type === "X25519KeyAgreementKey2019") {
      candidates.push(vm);
    }
  }

  if (candidates.length === 0) {
    throw new Error("DID document has no X25519KeyAgreementKey2019 in keyAgreement");
  }

  let target: typeof vms[0] | undefined;
  if (keyId) {
    target = candidates.find((vm) => vm.id === keyId);
    if (!target) {
      throw new Error(`keyAgreement entry not found: ${keyId}`);
    }
  } else {
    target = candidates[0];
  }

  const multibase = target.publicKeyMultibase;
  if (!multibase) {
    throw new Error("keyAgreement entry missing publicKeyMultibase");
  }

  const pk = publicKeyFromMultibase(multibase);
  return { publicKey: pk, keyId: target.id };
}

export function extractSigningPublicKeyFromDidDocument(
  doc: DidDocument,
  vmId: string
): Uint8Array {
  const vms = doc.verificationMethod || [];
  const target = vms.find((vm) => vm && typeof vm === "object" && vm.id === vmId);

  if (!target) {
    throw new Error(`verificationMethod not found: ${vmId}`);
  }

  const expectedType = "EcdsaSecp256r1VerificationKey2019";
  if (target.type !== expectedType) {
    throw new Error(
      `Expected type ${expectedType}, got '${target.type}' for ${vmId}`
    );
  }

  const jwk = target.publicKeyJwk;
  if (jwk) {
    const x = b64urlDecode(jwk.x);
    const y = b64urlDecode(jwk.y);

    const publicKey = new Uint8Array(65);
    publicKey[0] = 0x04;
    publicKey.set(x, 1);
    publicKey.set(y, 33);

    return publicKey;
  }

  const hexKey = target.publicKeyHex || (target as any).public_key_hex as string | undefined;
  if (hexKey) {
    const keyBytes = hexToBytes(hexKey);
    return keyBytes;
  }

  throw new Error(`Cannot extract public key from verificationMethod: ${vmId}`);
}

function b64urlDecode(s: string): Uint8Array {
  const padding = "=".repeat((-s.length) % 4);
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}
