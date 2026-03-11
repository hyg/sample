#!/usr/bin/env node
/**
 * Resolve a Handle to DID or look up Handle by DID.
 *
 * Usage:
 *     # Resolve handle to DID
 *     node scripts/resolve_handle.js --handle alice
 *
 *     # Look up handle by DID
 *     node scripts/resolve_handle.js --did "did:wba:awiki.ai:alice:k1_abc123"
 *
 * [INPUT]: SDK (handle resolution), user-service RPC, logging_config
 * [OUTPUT]: Handle/DID mapping information
 * [POS]: CLI for Handle resolution and reverse lookup
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { parseArgs } from 'util';
import { createSDKConfig } from './utils/config.js';
import { createUserServiceClient } from '../src/utils/client.js';
import { resolveHandle, lookupHandle } from '../src/utils/handle.js';

const args = parseArgs({
    options: {
        handle: { type: 'string' },
        did: { type: 'string' }
    }
});

if (!args.values.handle && !args.values.did) {
    console.error('Usage: node scripts/resolve_handle.js --handle <handle> | --did <did>');
    process.exit(1);
}

async function main() {
    const config = createSDKConfig();
    const client = await createUserServiceClient(config);
    
    try {
        let result;
        if (args.values.handle) {
            console.log(`Resolving handle: ${args.values.handle}`);
            result = await resolveHandle(client, args.values.handle);
        } else {
            console.log(`Looking up handle for DID: ${args.values.did}`);
            result = await lookupHandle(client, args.values.did);
        }
        
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

main();
