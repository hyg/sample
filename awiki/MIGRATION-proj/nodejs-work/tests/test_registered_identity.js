#!/usr/bin/env node

/**
 * Test awiki.ai JWT verification using registered PythonAgent identity.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Test awiki.ai JWT Verification (Using Registered PythonAgent Identity)');
console.log('='.repeat(80));

// Load PythonAgent credential (successfully registered)
const credPath = join(__dirname, '..', 'scripts', 'tests', 'python_output', 'python_registration_request.json');
const credData = JSON.parse(readFileSync(credPath, 'utf-8'));

const didDocument = credData.params.did_document;
const did = didDocument.id;

console.log('\n[1] Load Registered Identity');
console.log('-'.repeat(80));
console.log(`DID: ${did}`);

// We don't have the private key from this file, so we can't sign
// This test shows what data was sent to awiki.ai

console.log('\n[2] Original Registration Request');
console.log('-'.repeat(80));
console.log(JSON.stringify(credData, null, 2));

console.log('\nNote: This test shows the registration request, but we cannot test');
console.log('JWT verification without the private key.');
console.log('\nTo test JWT verification, we need to:');
console.log('1. Use the PythonAgent credential from ~/.openclaw/credentials/');
console.log('2. Or register a new identity with Node.js');

console.log('\n' + '='.repeat(80));
