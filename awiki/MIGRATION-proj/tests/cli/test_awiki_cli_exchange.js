/**
 * CLI test for two-way awiki message exchange using actual command-line scripts
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

// Configuration
const PROJECT_ROOT = resolve(process.cwd());
const NODEJS_CLIENT = resolve(PROJECT_ROOT, 'nodejs-client');
const PYTHON_CLIENT = resolve(PROJECT_ROOT, 'python-client');

console.log('='.repeat(80));
console.log('AWIKI CLI MESSAGE EXCHANGE TEST');
console.log('='.repeat(80));
console.log(`Project Root: ${PROJECT_ROOT}`);
console.log(`Node.js Client: ${NODEJS_CLIENT}`);
console.log(`Python Client: ${PYTHON_CLIENT}`);
console.log('='.repeat(80));

// Helper function to run a command
function runCommand(command, args, cwd, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n▶️  ${description}`);
        console.log(`   Command: ${command} ${args.join(' ')}`);

        const proc = spawn(command, args, { cwd, shell: true });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data);
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });

        proc.on('close', (code) => {
            console.log(`   Exit code: ${code}`);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });
    });
}

// Test scenarios
async function runTests() {
    try {
        // Scenario 1: Check status with Node.js
        await runCommand(
            'node',
            ['scripts/check_status.js', '--credential', 'test_alice'],
            NODEJS_CLIENT,
            'Check Alice status with Node.js'
        );

        // Scenario 2: Check status with Python
        await runCommand(
            'python',
            ['scripts/check_status.py', '--credential', 'test_bob', '--no-auto-e2ee'],
            PYTHON_CLIENT,
            'Check Bob status with Python'
        );

        // Scenario 3: Query database with Node.js
        await runCommand(
            'node',
            ['scripts/query_db.js', 'SELECT * FROM messages LIMIT 5'],
            NODEJS_CLIENT,
            'Query messages with Node.js'
        );

        // Scenario 4: Migrate credentials with Node.js
        await runCommand(
            'node',
            ['scripts/migrate_credentials.js'],
            NODEJS_CLIENT,
            'Migrate credentials with Node.js'
        );

        // Scenario 5: Check service status
        await runCommand(
            'node',
            ['scripts/service_manager.js', 'status'],
            NODEJS_CLIENT,
            'Check service status'
        );

        console.log('\n' + '='.repeat(80));
        console.log('CLI TEST COMPLETED SUCCESSFULLY');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests
runTests();
