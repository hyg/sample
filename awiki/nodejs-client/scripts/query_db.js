#!/usr/bin/env node
/**
 * Read-only SQL query CLI against local SQLite database.
 *
 * Usage:
 *     node scripts/query_db.js "SELECT * FROM threads LIMIT 10"
 *     node scripts/query_db.js "SELECT * FROM messages WHERE credential_name='alice' LIMIT 10"
 *
 * [INPUT]: local_store (SQLite connection + execute_sql)
 * [OUTPUT]: JSON query results to stdout
 * [POS]: CLI entry point for ad-hoc local database queries
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { get_connection, ensure_schema, execute_sql } from './utils/local_store.js';
import { parseArgs } from 'util';

const args = parseArgs({
    allowPositionals: true,
    options: {
        credential: { type: 'string' }
    }
});

if (args.positionals.length === 0) {
    console.error('Usage: node scripts/query_db.js <SQL_QUERY> [--credential <name>]');
    process.exit(1);
}

const sql = args.positionals[0].replace(/"/g, '');
console.log(`query_db CLI started sql=${sql}`);

const conn = get_connection();
ensure_schema(conn);

try {
    const result = execute_sql(sql);
    console.log(JSON.stringify(result, null, 2));
    console.error(`query_db completed rows=${Array.isArray(result) ? result.length : 1}`);
} catch (error) {
    console.error(`query_db rejected sql: ${error.message}`);
    process.exit(1);
} finally {
    conn.close();
}
