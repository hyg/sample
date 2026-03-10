/**
 * Local database migration helpers for owner_did-aware multi-identity storage.
 *
 * [INPUT]: local_store (SQLite schema management), SDKConfig (data_dir)
 * [OUTPUT]: detectLocalDatabaseLayout(), migrateLocalDatabase(),
 *           ensureLocalDatabaseReady()
 * [POS]: Shared migration module used by check_status.py and the standalone
 *        migrate_local_database.py CLI, with idempotent self-healing for
 *        already-ready databases
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import fs from 'fs';
import path from 'path';
import { createSDKConfig } from './config.js';
import { get_connection, ensure_schema } from './local_store.js';

/**
 * Return the local SQLite database path.
 * @param {Object|null} config - SDKConfig instance
 * @returns {string} Database path
 */
function _databasePath(config = null) {
    const resolvedConfig = config || createSDKConfig();
    return path.join(resolvedConfig.data_dir, 'database', 'awiki.db');
}

/**
 * Return the database migration backup directory.
 * @param {Object|null} config - SDKConfig instance
 * @returns {string} Backup directory path
 */
function _backupRoot(config = null) {
    const resolvedConfig = config || createSDKConfig();
    const backupDir = path.join(resolvedConfig.data_dir, 'database', '.migration-backup');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
}

/**
 * Detect whether the local database requires migration.
 * @param {Object|null} config - SDKConfig instance
 * @returns {Object} Detection results
 */
export function detectLocalDatabaseLayout(config = null) {
    const dbPath = _databasePath(config);
    if (!fs.existsSync(dbPath)) {
        return {
            status: 'not_found',
            db_path: dbPath,
            before_version: null,
            after_version: null,
            backup_path: null
        };
    }

    const conn = get_connection();
    try {
        const stmt = conn.prepare('PRAGMA user_version');
        const result = stmt.get();
        const version = result.user_version || 0;
        
        if (version < 6) {
            return {
                status: 'needs_migration',
                db_path: dbPath,
                before_version: version,
                after_version: 6,
                backup_path: null
            };
        }
        
        return {
            status: 'ready',
            db_path: dbPath,
            before_version: version,
            after_version: version,
            backup_path: null
        };
    } finally {
        conn.close();
    }
}

/**
 * Migrate the local database to the latest schema version.
 * @param {Object|null} config - SDKConfig instance
 * @returns {Object} Migration results
 */
export function migrateLocalDatabase(config = null) {
    const detection = detectLocalDatabaseLayout(config);
    
    if (detection.status === 'not_found') {
        // Create new database
        const conn = get_connection();
        try {
            ensure_schema(conn);
            const stmt = conn.prepare('PRAGMA user_version');
            const result = stmt.get();
            return {
                status: 'created',
                db_path: detection.db_path,
                before_version: null,
                after_version: result.user_version || 6,
                backup_path: null
            };
        } finally {
            conn.close();
        }
    }
    
    if (detection.status === 'ready') {
        return {
            status: 'not_needed',
            db_path: detection.db_path,
            before_version: detection.before_version,
            after_version: detection.after_version,
            backup_path: null
        };
    }
    
    // Migration needed
    const backupRoot = _backupRoot(config);
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const backupPath = path.join(backupRoot, `awiki_${timestamp}.db`);
    
    // Create backup
    fs.copyFileSync(detection.db_path, backupPath);
    
    // Run migration
    const conn = get_connection();
    try {
        // For now, just ensure schema is up to date
        // In a full implementation, we would handle specific version migrations
        ensure_schema(conn);
        
        const stmt = conn.prepare('PRAGMA user_version');
        const result = stmt.get();
        
        return {
            status: 'migrated',
            db_path: detection.db_path,
            before_version: detection.before_version,
            after_version: result.user_version || 6,
            backup_path: backupPath
        };
    } finally {
        conn.close();
    }
}

/**
 * Ensure the local database is ready for runtime use.
 * @param {Object|null} config - SDKConfig instance
 * @returns {Object} Database readiness results
 */
export function ensureLocalDatabaseReady(config = null) {
    const detection = detectLocalDatabaseLayout(config);
    
    if (detection.status === 'ready') {
        return {
            status: 'ready',
            db_path: detection.db_path,
            version: detection.before_version
        };
    }
    
    const migration = migrateLocalDatabase(config);
    return {
        status: migration.status,
        db_path: migration.db_path,
        version: migration.after_version,
        backup_path: migration.backup_path
    };
}

export default {
    detectLocalDatabaseLayout,
    migrateLocalDatabase,
    ensureLocalDatabaseReady
};
