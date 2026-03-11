#!/usr/bin/env node
/**
 * Migrate legacy flat-file credentials into the indexed directory layout.
 *
 * Usage:
 *     node scripts/migrate_credentials.js
 *     node scripts/migrate_credentials.js --credential default
 *
 * [INPUT]: credential_migration
 * [OUTPUT]: JSON migration summary
 * [POS]: Standalone migration CLI for upgrading local credential storage
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { migrateLegacyCredentials } from './utils/credential_migration.js';
import { parseArgs } from 'util';

const args = parseArgs({
    options: {
        credential: { type: 'string' }
    }
});

console.log(`migrate_credentials CLI started credential=${args.values.credential || 'all'}`);

const result = migrateLegacyCredentials(args.values.credential);
console.log(JSON.stringify(result, null, 2));
