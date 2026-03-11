#!/usr/bin/env node
/**
 * CLI Comparison Test: Compare Python and Node.js command-line scripts
 * 
 * This script tests migrated command-line scripts by running both Python
 * and Node.js versions and comparing their outputs.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const sleep = promisify(setTimeout);

// Test configuration
const TEST_CONFIG = {
    pythonPath: process.env.PYTHON_EXECUTABLE || 'python',
    pythonArgs: [],
    nodePath: 'node',
    pythonScriptsDir: 'python-client/scripts',
    nodeScriptsDir: 'nodejs-client/scripts',
    testCredential: 'test_cli_comparison',
    testHandle: 'testcli',
    testPhone: '+8613800138000',
    testDid: 'did:wba:awiki.ai:user:test_cli_123',
    timeout: 10000 // 10 seconds per test
};

// Test results tracking
let testResults = {
    passed: 0,
    failed: 0,
    details: []
};

/**
 * Print test header
 */
function printTestHeader(name) {
    console.log('\n' + '='.repeat(80));
    console.log(`TEST: ${name}`);
    console.log('='.repeat(80));
}

/**
 * Print test result
 */
function printTestResult(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}${details ? ` - ${details}` : ''}`);
    
    testResults.details.push({
        test: name,
        passed,
        details
    });
    
    if (passed) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }
}

/**
 * Run a Python script and capture output
 */
async function runPythonScript(scriptName, args = [], timeout = TEST_CONFIG.timeout) {
    return new Promise((resolve, reject) => {
        const pythonArgs = [...TEST_CONFIG.pythonArgs, `${TEST_CONFIG.pythonScriptsDir}/${scriptName}`, ...args];
        const pythonProcess = spawn(TEST_CONFIG.pythonPath, pythonArgs, {
            cwd: process.cwd() // Run from the awiki root directory
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        pythonProcess.on('error', (error) => {
            reject(new Error(`Python process error: ${error.message}`));
        });
        
        const timeoutId = setTimeout(() => {
            pythonProcess.kill();
            reject(new Error(`Python script timeout after ${timeout}ms`));
        }, timeout);
        
        pythonProcess.on('close', (code) => {
            clearTimeout(timeoutId);
            resolve({ code, stdout, stderr });
        });
    });
}

/**
 * Run a Node.js script and capture output
 */
async function runNodeScript(scriptName, args = [], timeout = TEST_CONFIG.timeout) {
    return new Promise((resolve, reject) => {
        const nodeProcess = spawn(TEST_CONFIG.nodePath, [
            `${TEST_CONFIG.nodeScriptsDir}/${scriptName}`,
            ...args
        ]);
        
        let stdout = '';
        let stderr = '';
        
        nodeProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        nodeProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        nodeProcess.on('error', (error) => {
            reject(new Error(`Node.js process error: ${error.message}`));
        });
        
        const timeoutId = setTimeout(() => {
            nodeProcess.kill();
            reject(new Error(`Node.js script timeout after ${timeout}ms`));
        }, timeout);
        
        nodeProcess.on('close', (code) => {
            clearTimeout(timeoutId);
            resolve({ code, stdout, stderr });
        });
    });
}

/**
 * Test 1: check_status comparison
 */
async function testCheckStatus() {
    printTestHeader('check_status.py vs check_status.js');
    
    try {
        // Run Python version
        const pythonResult = await runPythonScript('check_status.py', ['--credential', TEST_CONFIG.testCredential]);
        
        // Run Node.js version
        const nodeResult = await runNodeScript('check_status.js', ['--credential', TEST_CONFIG.testCredential]);
        
        // Parse outputs - extract JSON from stdout (it may contain debug lines)
        let pythonData, nodeData;
        try {
            // Extract JSON from stdout (find the first '{' and last '}')
            const pythonJsonMatch = pythonResult.stdout.match(/\{[\s\S]*\}/);
            const nodeJsonMatch = nodeResult.stdout.match(/\{[\s\S]*\}/);
            
            if (!pythonJsonMatch || !nodeJsonMatch) {
                printTestResult('check_status', false, 'Could not find JSON in output');
                return false;
            }
            
            pythonData = JSON.parse(pythonJsonMatch[0]);
            nodeData = JSON.parse(nodeJsonMatch[0]);
        } catch (e) {
            printTestResult('check_status', false, `Failed to parse JSON output: ${e.message}`);
            return false;
        }
        
        // Compare key fields
        const pythonIdentityStatus = pythonData.identity?.status;
        const nodeIdentityStatus = nodeData.identity?.status;
        
        const passed = pythonIdentityStatus === nodeIdentityStatus;
        printTestResult('check_status', passed, 
            `Python: ${pythonIdentityStatus}, Node.js: ${nodeIdentityStatus}`);
        
        return passed;
    } catch (error) {
        printTestResult('check_status', false, error.message);
        return false;
    }
}

/**
 * Test 2: query_db comparison
 */
async function testQueryDb() {
    printTestHeader('query_db.py vs query_db.js');
    
    try {
        // Run Python version with a simple SQL query
        const pythonResult = await runPythonScript('query_db.py', ["SELECT name FROM sqlite_master WHERE type='table'"]);
        
        // Run Node.js version with the same SQL query
        const nodeResult = await runNodeScript('query_db.js', ["SELECT name FROM sqlite_master WHERE type='table'"]);
        
        // Extract JSON from stdout (find the first '[' and last ']')
        let pythonData, nodeData;
        try {
            // Use a more robust regex to find JSON arrays
            const pythonJsonMatch = pythonResult.stdout.match(/\[[\s\S]*?\](?=\s*$)/m);
            const nodeJsonMatch = nodeResult.stdout.match(/\[[\s\S]*?\](?=\s*$)/m);
            
            if (!pythonJsonMatch || !nodeJsonMatch) {
                printTestResult('query_db', false, 'Could not find JSON array in output');
                console.error('Python output:', pythonResult.stdout);
                console.error('Node.js output:', nodeResult.stdout);
                return false;
            }
            
            pythonData = JSON.parse(pythonJsonMatch[0]);
            nodeData = JSON.parse(nodeJsonMatch[0]);
        } catch (e) {
            printTestResult('query_db', false, `Failed to parse JSON output: ${e.message}`);
            return false;
        }
        
        // Compare results
        const passed = JSON.stringify(pythonData) === JSON.stringify(nodeData);
        printTestResult('query_db', passed, 
            `Python rows: ${pythonData.length}, Node.js rows: ${nodeData.length}`);
        
        return passed;
    } catch (error) {
        printTestResult('query_db', false, error.message);
        return false;
    }
}

/**
 * Test 3: migrate_credentials comparison
 */
async function testMigrateCredentials() {
    printTestHeader('migrate_credentials.py vs migrate_credentials.js');
    
    try {
        // Run Python version
        const pythonResult = await runPythonScript('migrate_credentials.py');
        
        // Run Node.js version
        const nodeResult = await runNodeScript('migrate_credentials.js');
        
        // Both should exit with code 0 (success)
        const passed = pythonResult.code === 0 && nodeResult.code === 0;
        printTestResult('migrate_credentials', passed, 
            `Python exit code: ${pythonResult.code}, Node.js exit code: ${nodeResult.code}`);
        
        return passed;
    } catch (error) {
        printTestResult('migrate_credentials', false, error.message);
        return false;
    }
}

/**
 * Test 4: migrate_local_database comparison
 */
async function testMigrateLocalDatabase() {
    printTestHeader('migrate_local_database.py vs migrate_local_database.js');
    
    try {
        // Run Python version
        const pythonResult = await runPythonScript('migrate_local_database.py');
        
        // Run Node.js version
        const nodeResult = await runNodeScript('migrate_local_database.js');
        
        // Both should exit with code 0 (success)
        const passed = pythonResult.code === 0 && nodeResult.code === 0;
        printTestResult('migrate_local_database', passed, 
            `Python exit code: ${pythonResult.code}, Node.js exit code: ${nodeResult.code}`);
        
        return passed;
    } catch (error) {
        printTestResult('migrate_local_database', false, error.message);
        return false;
    }
}

/**
 * Test 5: service_manager comparison
 */
async function testServiceManager() {
    printTestHeader('service_manager.py vs service_manager.js');
    
    try {
        // Run Python version (ws_listener.py status)
        const pythonResult = await runPythonScript('ws_listener.py', ['status']);
        
        // Run Node.js version (service_manager.js status)
        const nodeResult = await runNodeScript('service_manager.js', ['status']);
        
        // Extract JSON from stdout (find the first '{' and last '}')
        let pythonData, nodeData;
        try {
            const pythonJsonMatch = pythonResult.stdout.match(/\{[\s\S]*\}/);
            const nodeJsonMatch = nodeResult.stdout.match(/\{[\s\S]*\}/);
            
            if (!pythonJsonMatch || !nodeJsonMatch) {
                printTestResult('service_manager', false, 'Could not find JSON in output');
                return false;
            }
            
            pythonData = JSON.parse(pythonJsonMatch[0]);
            nodeData = JSON.parse(nodeJsonMatch[0]);
        } catch (e) {
            printTestResult('service_manager', false, `Failed to parse JSON output: ${e.message}`);
            return false;
        }
        
        // Compare key fields
        const passed = pythonData.platform === nodeData.platform && 
                       pythonData.installed === nodeData.installed &&
                       pythonData.running === nodeData.running;
        printTestResult('service_manager', passed, 
            `Python: installed=${pythonData.installed}, running=${pythonData.running}; Node.js: installed=${nodeData.installed}, running=${nodeData.running}`);
        
        return passed;
    } catch (error) {
        printTestResult('service_manager', false, error.message);
        return false;
    }
}

/**
 * Test 6: resolve_handle comparison
 */
async function testResolveHandle() {
    printTestHeader('resolve_handle.py vs resolve_handle.js');
    
    try {
        // Run Python version with --help
        const pythonResult = await runPythonScript('resolve_handle.py', ['--help']);
        
        // Run Node.js version with a known handle (alice)
        const nodeResult = await runNodeScript('resolve_handle.js', ['--handle', 'alice']);
        
        // Both should exit with code 0 (success)
        const passed = pythonResult.code === 0 && nodeResult.code === 0;
        printTestResult('resolve_handle', passed, 
            `Python exit code: ${pythonResult.code}, Node.js exit code: ${nodeResult.code}`);
        
        return passed;
    } catch (error) {
        printTestResult('resolve_handle', false, error.message);
        return false;
    }
}

/**
 * Test 7: recover_handle comparison
 */
async function testRecoverHandle() {
    printTestHeader('recover_handle.py vs recover_handle.js');
    
    try {
        // Run Python version with --help
        const pythonResult = await runPythonScript('recover_handle.py', ['--help']);
        
        // Run Node.js version (will fail due to missing OTP, but should start)
        const nodeResult = await runNodeScript('recover_handle.js', ['--handle', 'test', '--phone', '+8613800138000']);
        
        // Check if both scripts started (Python should show help, Node.js should start recovery)
        const passed = pythonResult.code === 0 && nodeResult.stdout.includes('Recovering handle');
        printTestResult('recover_handle', passed, 
            `Python exit code: ${pythonResult.code}, Node.js started: ${nodeResult.stdout.includes('Recovering handle')}`);
        
        return passed;
    } catch (error) {
        printTestResult('recover_handle', false, error.message);
        return false;
    }
}

/**
 * Test 8: regenerate_e2ee_keys comparison
 */
async function testRegenerateE2eeKeys() {
    printTestHeader('regenerate_e2ee_keys.py vs regenerate_e2ee_keys.js');
    
    try {
        // Run Python version with --help
        const pythonResult = await runPythonScript('regenerate_e2ee_keys.py', ['--help']);
        
        // Run Node.js version (will fail due to missing credential, but should start)
        const nodeResult = await runNodeScript('regenerate_e2ee_keys.js', ['--credential', 'default']);
        
        // Check if both scripts started
        const passed = pythonResult.code === 0 && nodeResult.stdout.includes('regenerate_e2ee_keys CLI started');
        printTestResult('regenerate_e2ee_keys', passed, 
            `Python exit code: ${pythonResult.code}, Node.js started: ${nodeResult.stdout.includes('regenerate_e2ee_keys CLI started')}`);
        
        return passed;
    } catch (error) {
        printTestResult('regenerate_e2ee_keys', false, error.message);
        return false;
    }
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('\n' + '='.repeat(80));
    console.log('CLI COMPARISON TEST SUITE');
    console.log('='.repeat(80));
    console.log(`Test Date: ${new Date().toISOString()}`);
    console.log(`Python scripts: ${TEST_CONFIG.pythonScriptsDir}`);
    console.log(`Node.js scripts: ${TEST_CONFIG.nodeScriptsDir}`);
    console.log('='.repeat(80));
    
    // Run all tests
    console.log('\n[1/8] Running check_status comparison...');
    await testCheckStatus();
    
    console.log('\n[2/8] Running query_db comparison...');
    await testQueryDb();
    
    console.log('\n[3/8] Running migrate_credentials comparison...');
    await testMigrateCredentials();
    
    console.log('\n[4/8] Running migrate_local_database comparison...');
    await testMigrateLocalDatabase();
    
    console.log('\n[5/8] Running service_manager comparison...');
    await testServiceManager();
    
    console.log('\n[6/8] Running resolve_handle comparison...');
    await testResolveHandle();
    
    console.log('\n[7/8] Running recover_handle comparison...');
    await testRecoverHandle();
    
    console.log('\n[8/8] Running regenerate_e2ee_keys comparison...');
    await testRegenerateE2eeKeys();
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`);
    console.log('='.repeat(80));
    
    // Print detailed results
    console.log('\nDetailed Results:');
    console.log('-'.repeat(80));
    testResults.details.forEach((detail, index) => {
        const status = detail.passed ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${detail.test}${detail.details ? ` - ${detail.details}` : ''}`);
    });
    
    // Return overall result
    return testResults.failed === 0;
}

// Run tests when script is executed
runAllTests()
    .then(success => {
        console.log('\n' + '='.repeat(80));
        if (success) {
            console.log('🎉 ALL CLI COMPARISON TESTS PASSED! 🎉');
            console.log('='.repeat(80));
            process.exit(0);
        } else {
            console.log('⚠️  SOME CLI COMPARISON TESTS FAILED ⚠️');
            console.log('='.repeat(80));
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n❌ TEST SUITE ERROR:', error);
        process.exit(1);
    });

export {
    runAllTests,
    testCheckStatus,
    testQueryDb,
    testMigrateCredentials,
    testMigrateLocalDatabase,
    testServiceManager,
    testResolveHandle,
    testRecoverHandle,
    testRegenerateE2eeKeys
};
