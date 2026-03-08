#!/usr/bin/env node

/**
 * Check JWT token expiration and attempt refresh.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Check JWT Token Expiration');
console.log('='.repeat(80));

// Load credential
const credPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'testfresh.json');
const cred = JSON.parse(readFileSync(credPath, 'utf-8'));
const jwtToken = cred.jwt_token;

console.log(`\nJWT Token: ${jwtToken?.substring(0, 50)}...`);

// Decode JWT payload
const parts = jwtToken.split('.');
if (parts.length !== 3) {
    console.log('Invalid JWT format');
    process.exit(1);
}

const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

console.log('\nJWT Payload:');
console.log(JSON.stringify(payload, null, 2));

// Check expiration
const expDate = new Date(payload.exp * 1000);
const iatDate = new Date(payload.iat * 1000);
const now = new Date();

console.log('\nToken Timeline:');
console.log(`  Issued at:  ${iatDate.toISOString()} (${iatDate.toLocaleString()})`);
console.log(`  Expires at: ${expDate.toISOString()} (${expDate.toLocaleString()})`);
console.log(`  Current:    ${now.toISOString()} (${now.toLocaleString()})`);

const ttlSeconds = payload.exp - payload.iat;
const elapsedSeconds = Math.floor((now.getTime() - iatDate.getTime()) / 1000);
const remainingSeconds = payload.exp - Math.floor(now.getTime() / 1000);

console.log(`\nToken Validity:`);
console.log(`  TTL:         ${ttlSeconds} seconds (${Math.floor(ttlSeconds / 60)} minutes)`);
console.log(`  Elapsed:     ${elapsedSeconds} seconds (${Math.floor(elapsedSeconds / 60)} minutes)`);
console.log(`  Remaining:   ${remainingSeconds} seconds (${Math.floor(remainingSeconds / 60)} minutes)`);

if (remainingSeconds > 0) {
    console.log('\nStatus: VALID (not expired)');
} else {
    console.log('\nStatus: EXPIRED');
    console.log(`  Expired ${Math.abs(remainingSeconds)} seconds ago (${Math.floor(Math.abs(remainingSeconds) / 60)} minutes)`);
}

console.log('\n' + '='.repeat(80));
