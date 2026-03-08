#!/usr/bin/env node

/**
 * Resolve a handle to a DID.
 *
 * Compatible with Python's resolve_handle.py.
 *
 * Usage:
 *   node scripts/resolve_handle.js --handle "myhandle"
 */


const HANDLE_RPC = '/user-service/handle/rpc';

/**
 * Resolve a handle to DID.
 */
async function resolveHandle(handle, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);

    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }

    const client = createUserServiceClient(config);

    try {
        const result = await authenticatedRpcCall(
            client,
            HANDLE_RPC,
            'lookup',
            { handle },
            1,
            { auth: null, credentialName }
        );

        console.log(`Handle '${handle}' resolves to:`);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// CLI
const args = process.argv.slice(2);
const handleIndex = args.indexOf('--handle');
const handle = handleIndex >= 0 ? args[handleIndex + 1] : null;

if (!handle) {
    console.log('Usage: node scripts/resolve_handle.js --handle <handle>');
    process.exit(1);
}

resolveHandle(handle);
