#!/usr/bin/env node

/**
 * Run all MQTT E2EE Chat integration tests
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test files to run
const testFiles = [
    'test-identity.js',
    'test-hpke.js',
    'test-cross-did.js',
    'test-private-chat.js',
    'test-group-chat.js',
    'test-mqtt.js'
];

// Results tracking
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;

function runTest(testFile) {
    return new Promise((resolve) => {
        const testPath = join(__dirname, testFile);
        const testName = testFile.replace('.js', '').replace('test-', '').replace('-', ' ');
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Running: ${testName.toUpperCase()}`);
        console.log('='.repeat(60));
        
        const child = spawn('node', [testPath], {
            stdio: 'inherit',
            env: process.env
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✓ ${testName} completed successfully`);
                totalPassed++;
            } else {
                console.error(`✗ ${testName} failed with code ${code}`);
                totalFailed++;
            }
            totalTests++;
            resolve(code);
        });
        
        child.on('error', (err) => {
            console.error(`✗ ${testName} error: ${err.message}`);
            totalFailed++;
            totalTests++;
            resolve(1);
        });
    });
}

async function runAllTests() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   MQTT E2EE Chat - Integration Test Suite            ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    console.log('Test Environment:');
    console.log(`  Broker: ${process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883'}`);
    console.log(`  Topic: psmd/e2ee/chat`);
    console.log(`  Tests: ${testFiles.length}\n`);
    
    console.log('Starting test suite...\n');
    
    for (const testFile of testFiles) {
        await runTest(testFile);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUITE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(60));
    
    if (totalFailed > 0) {
        console.log('\n❌ Some tests failed. Please check the output above for details.\n');
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!\n');
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nTest suite interrupted. Cleaning up...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\nTest suite terminated. Cleaning up...');
    process.exit(0);
});

// Run the test suite
runAllTests().catch(err => {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
});
