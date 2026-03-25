/**
 * Migrate the local SQLite database to the owner_did-aware schema.
 *
 * Node.js implementation based on Python version:
 * python/scripts/migrate_local_database.py
 *
 * [INPUT]: database_migration
 * [OUTPUT]: JSON migration summary with listener stop/restart coordination
 * [POS]: Standalone local database migration CLI for explicit upgrade runs
 */

const { configureLogging } = require('./utils/logging');
const { ensure_local_database_ready_for_upgrade } = require('./database_migration');

/**
 * CLI entry point.
 * @returns {void}
 */
function main() {
  // 配置日志
  configureLogging({
    consoleLevel: 'INFO',
    mirrorStdio: true
  });

  console.log('migrate_local_database CLI started');
  
  // 执行数据库迁移
  const result = ensure_local_database_ready_for_upgrade();
  
  // 输出 JSON 结果
  console.log(JSON.stringify(result, null, 2));
}

// CLI 入口
if (require.main === module) {
  main();
}

module.exports = {
  main
};
