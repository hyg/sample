#!/usr/bin/env node

/**
 * Main test runner for awiki-agent-id-message.
 * 
 * Runs all test categories:
 * 1. Unit tests
 * 2. Integration tests
 * 3. Cross-platform tests
 * 4. Performance tests
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dirname, 'reports');

// Test configuration
const TEST_CONFIG = {
    python: {
        enabled: true,
        path: '../scripts',
        credentials: ['python1', 'python2']
    },
    nodejs: {
        enabled: true,
        path: './scripts',
        credentials: ['node1', 'node2']
    }
};

// Test results
const TEST_RESULTS = {
    startTime: new Date().toISOString(),
    categories: {},
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
    }
};

/**
 * Run a test script.
 */
function runTest(name, script, args = [], options = {}) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Running: ${name}`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Script: ${script}`);
        console.log(`Args: ${args.join(' ')}`);
        
        const [cmd, ...scriptArgs] = script.endsWith('.py') 
            ? ['python', ...args] 
            : ['node', ...args];
        
        const child = spawn(cmd, [...scriptArgs, ...args], {
            stdio: 'inherit',
            shell: true,
            cwd: options.cwd || __dirname
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            const result = {
                name,
                script,
                exitCode: code,
                success: code === 0,
                stdout,
                stderr,
                timestamp: new Date().toISOString()
            };
            
            if (code === 0) {
                console.log(`✓ PASS: ${name}`);
                TEST_RESULTS.summary.passed++;
            } else {
                console.log(`✗ FAIL: ${name} (exit code: ${code})`);
                TEST_RESULTS.summary.failed++;
            }
            
            TEST_RESULTS.summary.total++;
            resolve(result);
        });
        
        child.on('error', (error) => {
            console.log(`✗ ERROR: ${name} - ${error.message}`);
            TEST_RESULTS.summary.failed++;
            TEST_RESULTS.summary.total++;
            resolve({
                name,
                script,
                exitCode: -1,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        });
    });
}

/**
 * Run unit tests.
 */
async function runUnitTests() {
    console.log('\n' + '='.repeat(60));
    console.log('UNIT TESTS');
    console.log('='.repeat(60));
    
    TEST_RESULTS.categories.unit = {
        startTime: new Date().toISOString(),
        tests: []
    };
    
    // Identity tests
    const identityResult = await runTest(
        'Identity Management',
        './tests/unit/test_identity.js',
        []
    );
    TEST_RESULTS.categories.unit.tests.push(identityResult);
    
    // Message tests
    const messageResult = await runTest(
        'Message Operations',
        './tests/unit/test_message.js',
        []
    );
    TEST_RESULTS.categories.unit.tests.push(messageResult);
    
    // E2EE tests
    const e2eeResult = await runTest(
        'E2EE Encryption',
        './tests/unit/test_e2ee.js',
        []
    );
    TEST_RESULTS.categories.unit.tests.push(e2eeResult);
    
    // Ratchet tests
    const ratchetResult = await runTest(
        'Ratchet Algorithm',
        './tests/unit/test_ratchet.js',
        []
    );
    TEST_RESULTS.categories.unit.tests.push(ratchetResult);
    
    TEST_RESULTS.categories.unit.endTime = new Date().toISOString();
}

/**
 * Run integration tests.
 */
async function runIntegrationTests() {
    console.log('\n' + '='.repeat(60));
    console.log('INTEGRATION TESTS');
    console.log('='.repeat(60));
    
    TEST_RESULTS.categories.integration = {
        startTime: new Date().toISOString(),
        tests: []
    };
    
    // RPC calls test
    const rpcResult = await runTest(
        'RPC API Calls',
        './tests/integration/test_rpc_calls.js',
        ['--credential', 'node1']
    );
    TEST_RESULTS.categories.integration.tests.push(rpcResult);
    
    // API endpoints test
    const apiResult = await runTest(
        'API Endpoints',
        './tests/integration/test_api_endpoints.js',
        ['--credential', 'node1']
    );
    TEST_RESULTS.categories.integration.tests.push(apiResult);
    
    TEST_RESULTS.categories.integration.endTime = new Date().toISOString();
}

/**
 * Run cross-platform tests.
 */
async function runCrossPlatformTests() {
    console.log('\n' + '='.repeat(60));
    console.log('CROSS-PLATFORM TESTS');
    console.log('='.repeat(60));
    
    TEST_RESULTS.categories.crossPlatform = {
        startTime: new Date().toISOString(),
        tests: []
    };
    
    // Plain text messages Python -> Node.js
    const plainPyToNode = await runTest(
        'Plain Message: Python -> Node.js',
        './tests/cross_platform/test_plain_messages.js',
        ['--from', 'python1', '--to', 'node1']
    );
    TEST_RESULTS.categories.crossPlatform.tests.push(plainPyToNode);
    
    // Plain text messages Node.js -> Python
    const plainNodeToPy = await runTest(
        'Plain Message: Node.js -> Python',
        './tests/cross_platform/test_plain_messages.js',
        ['--from', 'node1', '--to', 'python1']
    );
    TEST_RESULTS.categories.crossPlatform.tests.push(plainNodeToPy);
    
    // E2EE messages Python -> Node.js
    const e2eePyToNode = await runTest(
        'E2EE Message: Python -> Node.js',
        './tests/cross_platform/test_e2ee_messages.js',
        ['--from', 'python1', '--to', 'node1']
    );
    TEST_RESULTS.categories.crossPlatform.tests.push(e2eePyToNode);
    
    // E2EE messages Node.js -> Python
    const e2eeNodeToPy = await runTest(
        'E2EE Message: Node.js -> Python',
        './tests/cross_platform/test_e2ee_messages.js',
        ['--from', 'node1', '--to', 'python1']
    );
    TEST_RESULTS.categories.crossPlatform.tests.push(e2eeNodeToPy);
    
    TEST_RESULTS.categories.crossPlatform.endTime = new Date().toISOString();
}

/**
 * Run performance tests.
 */
async function runPerformanceTests() {
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE TESTS');
    console.log('='.repeat(60));
    
    TEST_RESULTS.categories.performance = {
        startTime: new Date().toISOString(),
        tests: []
    };
    
    // Benchmark test
    const benchmarkResult = await runTest(
        'Performance Benchmark',
        './tests/performance/test_benchmarks.js',
        ['--credential', 'node1']
    );
    TEST_RESULTS.categories.performance.tests.push(benchmarkResult);
    
    TEST_RESULTS.categories.performance.endTime = new Date().toISOString();
}

/**
 * Generate test report.
 */
function generateReport() {
    TEST_RESULTS.endTime = new Date().toISOString();
    TEST_RESULTS.duration = new Date(TEST_RESULTS.endTime) - new Date(TEST_RESULTS.startTime);
    
    // Ensure report directory exists
    if (!existsSync(REPORT_DIR)) {
        mkdirSync(REPORT_DIR, { recursive: true });
    }
    
    // Generate JSON report
    const reportPath = join(REPORT_DIR, `test_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(reportPath, JSON.stringify(TEST_RESULTS, null, 2));
    
    // Generate summary
    const passRate = TEST_RESULTS.summary.total > 0 
        ? ((TEST_RESULTS.summary.passed / TEST_RESULTS.summary.total) * 100).toFixed(1) 
        : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:    ${TEST_RESULTS.summary.total}`);
    console.log(`Passed:         ${TEST_RESULTS.summary.passed}`);
    console.log(`Failed:         ${TEST_RESULTS.summary.failed}`);
    console.log(`Skipped:        ${TEST_RESULTS.summary.skipped}`);
    console.log(`Pass Rate:      ${passRate}%`);
    console.log(`Duration:       ${(TEST_RESULTS.duration / 1000).toFixed(1)}s`);
    console.log('='.repeat(60));
    console.log(`Report saved to: ${reportPath}`);
    
    if (TEST_RESULTS.summary.failed === 0 && passRate >= 95) {
        console.log('\n✓ ALL TESTS PASSED!');
        console.log('Package is ready for release.');
    } else if (passRate >= 90) {
        console.log('\n⚠ MOST TESTS PASSED');
        console.log('Some issues need attention before release.');
    } else {
        console.log('\n✗ TESTS FAILED');
        console.log('Critical issues found. Please fix before release.');
    }
}

/**
 * Main test runner.
 */
async function runAllTests() {
    console.log('='.repeat(60));
    console.log('awiki-agent-id-message');
    console.log('Complete Test Suite');
    console.log('='.repeat(60));
    console.log(`Start Time: ${TEST_RESULTS.startTime}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    console.log('='.repeat(60));
    
    // Run test categories
    if (TEST_CONFIG.nodejs.enabled) {
        await runUnitTests();
        await runIntegrationTests();
        await runCrossPlatformTests();
        await runPerformanceTests();
    }
    
    // Generate report
    generateReport();
    
    // Exit with appropriate code
    process.exit(TEST_RESULTS.summary.failed > 0 ? 1 : 0);
}

// Run all tests
await runAllTests();
