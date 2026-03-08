import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

console.log("=== Python Signature S Value Analysis ===\n");

// From step 7 (DER format, before normalization)
const derHex = py.step7_signature.der_hex;
const derSig = Buffer.from(derHex, 'hex');

// Parse DER to get S
// 30 46 - SEQUENCE, length 70
// 02 21 00 [33 bytes R] - INTEGER, length 33 (with leading zero)
// 02 21 00 [33 bytes S] - INTEGER, length 33 (with leading zero)

const rLen = derSig[3];
const r = derSig.slice(4, 4 + rLen);
const sOffset = 4 + rLen + 2;
const sLen = derSig[sOffset - 1];
const sFromDer = derSig.slice(sOffset, sOffset + sLen);

console.log("From DER (step 7):");
console.log("  R (hex):", r.toString('hex'));
console.log("  S (hex):", sFromDer.toString('hex'));
console.log("  S length:", sFromDer.length, "bytes");

// From step 9 (base64url, after normalization)
const normalizedSig = decodeBase64Url(py.step9_final_signature.base64url);
const rNormalized = normalizedSig.slice(0, 32);
const sNormalized = normalizedSig.slice(32, 64);

console.log("\nFrom base64url (step 9, after normalization):");
console.log("  R (hex):", rNormalized.toString('hex'));
console.log("  S (hex):", sNormalized.toString('hex'));

// Compare
console.log("\n=== Comparison ===");
console.log("R match:", r.toString('hex') === rNormalized.toString('hex'));
console.log("S match:", sFromDer.toString('hex') === sNormalized.toString('hex'));

// Check if S was normalized
const sFromDerBigInt = BigInt(`0x${sFromDer.toString('hex')}`);
const sNormalizedBigInt = BigInt(`0x${sNormalized.toString('hex')}`);
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

console.log("\n=== Low-S Check ===");
console.log("S from DER:", sFromDerBigInt.toString());
console.log("S normalized:", sNormalizedBigInt.toString());
console.log("CURVE_ORDER - S_from_DER:", (CURVE_ORDER - sFromDerBigInt).toString());
console.log("S_from_DER > CURVE_ORDER/2:", sFromDerBigInt > CURVE_ORDER / BigInt(2));
console.log("S_normalized > CURVE_ORDER/2:", sNormalizedBigInt > CURVE_ORDER / BigInt(2));

// The normalized S should be CURVE_ORDER - S if S was high
const expectedNormalizedS = sFromDerBigInt > CURVE_ORDER / BigInt(2) 
    ? CURVE_ORDER - sFromDerBigInt 
    : sFromDerBigInt;

console.log("\nExpected normalized S:", expectedNormalizedS.toString());
console.log("Actual normalized S:", sNormalizedBigInt.toString());
console.log("Match:", expectedNormalizedS === sNormalizedBigInt);

// Also check step 8 info
console.log("\n=== Python Step 8 Info ===");
console.log("Original S:", py.step8_low_s_normalization.original_s);
console.log("Normalized S:", py.step8_low_s_normalization.normalized_s);
console.log("Was normalized:", py.step8_low_s_normalization.was_normalized);
