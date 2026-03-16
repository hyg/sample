/**
 * EcdsaSecp256r1Signature2019 proof 签名与校验
 */

import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PROOF_TYPE } from "./types";

export const DEFAULT_MAX_FUTURE_SKEW_SECONDS = 300;
export const DEFAULT_MAX_PAST_AGE_SECONDS = 86400;

export class ProofValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProofValidationError";
    this.code = code;
  }
}

function b64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  // 修复：正确处理 base64url 填充
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripProofValue(content: Record<string, unknown>): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(content));
  if (result.proof && typeof result.proof === "object" && "proof_value" in result.proof) {
    delete (result.proof as Record<string, unknown>).proof_value;
  }
  return result;
}

function signSecp256r1(privateKey: Uint8Array, data: Uint8Array): Uint8Array {
  // p256.sign 返回 64 字节紧凑格式签名
  const signature = p256.sign(data, privateKey);
  return signature;
}

function verifySecp256r1(
  publicKey: Uint8Array,
  data: Uint8Array,
  signature: Uint8Array
): boolean {
  try {
    // p256.verify 接受压缩 (33 字节) 或未压缩 (65 字节) 公钥
    // 签名必须是 64 字节紧凑格式
    if (signature.length !== 64) {
      return false;
    }
    return p256.verify(signature, data, publicKey);
  } catch {
    return false;
  }
}

function jcsCanonicalize(obj: unknown): Uint8Array {
  const canonical = JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(value).sort();
      for (const k of keys) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  });
  return new TextEncoder().encode(canonical);
}

export function generateProof(
  content: Record<string, unknown>,
  privateKey: Uint8Array,
  verificationMethod: string,
  created?: string
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(content));
  const createdValue = created || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  result.proof = {
    type: PROOF_TYPE,
    created: createdValue,
    verification_method: verificationMethod,
  };

  const canonical = jcsCanonicalize(result);
  const signature = signSecp256r1(privateKey, sha256(canonical));
  (result.proof as Record<string, unknown>).proof_value = b64urlEncode(signature);

  return result;
}

export function validateProof(
  content: Record<string, unknown>,
  publicKey: Uint8Array,
  options?: {
    maxPastAgeSeconds?: number | null;
    maxFutureSkewSeconds?: number;
  }
): void {
  const {
    maxPastAgeSeconds = DEFAULT_MAX_PAST_AGE_SECONDS,
    maxFutureSkewSeconds = DEFAULT_MAX_FUTURE_SKEW_SECONDS,
  } = options || {};

  const proof = content.proof as Record<string, unknown> | undefined;
  if (!proof) {
    throw new ProofValidationError("proof_missing", "Content has no proof field");
  }

  const proofValue = proof.proof_value as string | undefined;
  if (!proofValue) {
    throw new ProofValidationError("proof_value_missing", "Proof has no proof_value");
  }

  const proofType = proof.type as string | undefined;
  if (proofType !== PROOF_TYPE) {
    throw new ProofValidationError(
      "proof_type_invalid",
      `Unsupported proof type: ${proofType}`
    );
  }

  const created = proof.created as string | undefined;
  if (created) {
    try {
      const createdTime = new Date(created.replace("Z", "+00:00")).getTime() / 1000;
      const now = Date.now() / 1000;

      const futureSkew = createdTime - now;
      if (maxFutureSkewSeconds >= 0 && futureSkew > maxFutureSkewSeconds) {
        throw new ProofValidationError(
          "proof_from_future",
          `Proof timestamp is too far in the future (${futureSkew.toFixed(0)}s)`
        );
      }

      if (maxPastAgeSeconds !== null && maxPastAgeSeconds > 0) {
        const pastAge = now - createdTime;
        if (pastAge > maxPastAgeSeconds) {
          throw new ProofValidationError(
            "proof_expired",
            `Proof has expired (${pastAge.toFixed(0)}s > ${maxPastAgeSeconds}s)`
          );
        }
      }
    } catch (e) {
      if (e instanceof ProofValidationError) {
        throw e;
      }
      throw new ProofValidationError(
        "proof_invalid_timestamp",
        `Invalid proof timestamp: ${created}`
      );
    }
  }

  const contentWithoutProofValue = stripProofValue(content);
  const canonical = jcsCanonicalize(contentWithoutProofValue);
  const signature = b64urlDecode(proofValue);

  if (!verifySecp256r1(publicKey, sha256(canonical), signature)) {
    throw new ProofValidationError("invalid_signature", "Proof signature verification failed");
  }
}

export function verifyProof(
  content: Record<string, unknown>,
  publicKey: Uint8Array,
  options?: {
    maxPastAgeSeconds?: number | null;
    maxFutureSkewSeconds?: number;
  }
): boolean {
  try {
    validateProof(content, publicKey, options);
    return true;
  } catch {
    return false;
  }
}
