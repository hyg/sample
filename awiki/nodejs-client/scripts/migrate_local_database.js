#!/usr/bin/env node
/**
 * Migrate the local SQLite database to the owner_did-aware schema.
 *
 * Usage:
 *     node scripts/migrate_local_database.js
 *
 * [INPUT]: database_migration
 * [OUTPUT]: JSON migration summary
 * [POS]: Standalone local database migration CLI
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { migrateLocalDatabase } from './utils/database_migration.js';

console.log('migrate_local_database CLI started');
const result = migrateLocalDatabase();
console.log(JSON.stringify(result, null, 2));
