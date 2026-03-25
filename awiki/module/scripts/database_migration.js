/**
 * Local database migration helpers for owner_did-aware multi-identity storage.
 *
 * Node.js implementation based on Python version:
 * python/scripts/database_migration.py
 *
 * [INPUT]: local_store (SQLite schema management), SDKConfig (data_dir),
 *          service_manager (listener stop/start coordination for explicit upgrade flows)
 * [OUTPUT]: detect_local_database_layout(), migrate_local_database(),
 *          ensure_local_database_ready(), ensure_local_database_ready_for_upgrade()
 * [POS]: Shared migration module used by check_status.js and the standalone
 *       migrate_local_database.js CLI, with idempotent self-healing for
 *       already-ready databases
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const local_store = require('./local-store');

/**
 * Return the local SQLite database path
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {string} Database path
 * @private
 */
function _databasePath(config = null) {
  const resolvedConfig = config || SDKConfig.load();
  return path.join(resolvedConfig.data_dir, 'database', 'awiki.db');
}

/**
 * Return the database migration backup directory
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {string} Backup directory path
 * @private
 */
function _backupRoot(config = null) {
  const resolvedConfig = config || SDKConfig.load();
  const backupDir = path.join(resolvedConfig.data_dir, 'database', '.migration-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Detect whether the local database requires migration
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {Object} Detection result
 */
function detect_local_database_layout(config = null) {
  const dbPath = _databasePath(config);
  
  if (!fs.existsSync(dbPath)) {
    return {
      status: 'not_found',
      db_path: dbPath,
      before_version: null
    };
  }

  const conn = local_store.get_connection();
  try {
    const result = conn.execute('PRAGMA user_version').get();
    const version = result ? result.user_version : 0;
    return {
      status: version < local_store.SCHEMA_VERSION ? 'legacy' : 'ready',
      db_path: dbPath,
      before_version: version
    };
  } finally {
    conn.close();
  }
}

/**
 * Create a SQLite backup before migration
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {string} Backup path
 * @private
 */
function _backupDatabase(config = null) {
  const dbPath = _databasePath(config);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, 'T').slice(0, -5) + 'Z';
  const backupPath = path.join(_backupRoot(config), `awiki-${timestamp}.db`);

  // Use better-sqlite3 backup - access raw db via _db property
  const sourceConn = local_store.get_connection();
  try {
    const sourceDb = sourceConn._db;
    // better-sqlite3 backup is synchronous
    sourceDb.backup(backupPath);
  } finally {
    sourceConn.close();
  }

  return backupPath;
}

/**
 * Run idempotent schema repair and return the migration summary
 * @param {Object} options - Options
 * @param {string} options.dbPath - Database path
 * @param {string} options.status - Status
 * @param {string|null} options.backupPath - Backup path
 * @returns {Object} Migration summary
 * @private
 */
function _ensureDatabaseSchema({ dbPath, status, backupPath }) {
  const conn = local_store.get_connection();
  try {
    const beforeResult = conn.execute('PRAGMA user_version').get();
    const beforeVersion = beforeResult ? beforeResult.user_version : 0;
    local_store.ensure_schema(conn);
    const afterResult = conn.execute('PRAGMA user_version').get();
    const afterVersion = afterResult ? afterResult.user_version : 0;

    const result = {
      status: status,
      db_path: dbPath,
      before_version: beforeVersion,
      after_version: afterVersion,
      backup_path: backupPath
    };
    return result;
  } finally {
    conn.close();
  }
}

/**
 * Migrate the local SQLite database to the latest schema
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {Object} Migration result
 */
function migrate_local_database(config = null) {
  const detection = detect_local_database_layout(config);
  
  if (detection.status === 'not_found') {
    return {
      status: 'not_needed',
      db_path: detection.db_path,
      before_version: null,
      after_version: null,
      backup_path: null
    };
  }

  if (detection.status === 'ready') {
    return _ensureDatabaseSchema({
      dbPath: detection.db_path,
      status: 'ready',
      backupPath: null
    });
  }

  const backupPath = _backupDatabase(config);
  return _ensureDatabaseSchema({
    dbPath: detection.db_path,
    status: 'migrated',
    backupPath: backupPath
  });
}

/**
 * Ensure the local database is ready for multi-identity use
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {Object} Database status
 */
function ensure_local_database_ready(config = null) {
  const detection = detect_local_database_layout(config);
  
  if (detection.status === 'not_found') {
    return detection;
  }
  
  return migrate_local_database(config);
}

/**
 * Return the default listener-coordination report payload
 * @returns {Object} Listener upgrade report
 * @private
 */
function _buildListenerUpgradeReport() {
  return {
    checked: true,
    was_running: false,
    stop_attempted: false,
    stop_result: null,
    restarted: false,
    restart_result: null
  };
}

/**
 * Ensure the local database is ready, coordinating with listener restart
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {Object} Database status with listener coordination
 */
function ensure_local_database_ready_for_upgrade(config = null) {
  const detection = detect_local_database_layout(config);
  
  if (detection.status === 'not_found') {
    return {
      ...detection,
      listener: _buildListenerUpgradeReport()
    };
  }
  
  const result = migrate_local_database(config);
  result.listener = _buildListenerUpgradeReport();
  return result;
}

module.exports = {
  detect_local_database_layout,
  migrate_local_database,
  ensure_local_database_ready,
  ensure_local_database_ready_for_upgrade,
  _databasePath,
  _backupRoot
};
