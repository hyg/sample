/**
 * query_db.py 的 Node.js 移植
 *
 * 本地 SQLite 数据库的只读 SQL 查询 CLI。用于临时本地数据库查询的 CLI 入口点。
 *
 * Python 源文件：python/scripts/query_db.py
 * 分析报告：doc/scripts/query_db.py/py.md
 * 蒸馏数据：doc/scripts/query_db.py/py.json
 *
 * 使用说明:
 *   node scripts/query-db.js "SELECT * FROM threads LIMIT 10"
 *   node scripts/query-db.js "SELECT * FROM messages WHERE credential_name='alice' LIMIT 10"
 *   node scripts/query-db.js "SELECT * FROM groups ORDER BY last_message_at DESC LIMIT 10"
 *   node scripts/query-db.js "SELECT * FROM group_members WHERE group_id='grp_xxx' LIMIT 20"
 *   node scripts/query-db.js "SELECT * FROM relationship_events WHERE status='pending' ORDER BY created_at DESC LIMIT 20"
 */

const { get_connection, ensure_schema, execute_sql } = require('./local-store');
const { SDKConfig } = require('./utils/config');

/**
 * 规范化 shell 风格的 SQL 续行
 * @param {string} sql - SQL 语句
 * @returns {string} 规范化后的 SQL
 */
function _normalizeSqlInput(sql) {
  return sql.replace(/\s*\\\r?\n\s*/g, ' ');
}

/**
 * 格式化 CLI 错误消息
 * @param {Error} exc - 异常对象
 * @returns {string} 格式化的错误消息
 */
function _formatCliError(exc) {
  const maxErrorLength = 240;
  let message = exc.message || String(exc);
  
  // 折叠空白并修剪过长的消息
  const normalized = message.split(/\s+/).join(' ').trim();
  if (normalized.length <= maxErrorLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxErrorLength - 1).trimEnd()}…`;
}

/**
 * 记录错误并退出
 * @param {Object} options - 选项
 * @param {Error} options.exc - 异常对象
 * @param {Object} options.logger - 日志记录器
 * @param {string} options.context - 上下文
 * @param {number} [options.exitCode=1] - 退出码
 * @param {boolean} [options.logTraceback=true] - 是否记录堆栈跟踪
 */
function _exitWithCliError({ exc, logger, context, exitCode = 1, logTraceback = true }) {
  const message = _formatCliError(exc);
  
  if (logTraceback) {
    logger.error(`${context}: ${message}`);
  } else {
    logger.warn(`${context}: ${message}`);
  }
  
  console.error(`Error: ${message}`);
  process.exit(exitCode);
}

/**
 * CLI 入口点
 */
function main() {
  const logger = {
    info: (msg, ...args) => {
      const formatted = typeof msg === 'string' 
        ? msg.replace(/%s/g, () => args.shift() || '')
        : msg;
      console.log(`[INFO] ${formatted}`);
    },
    warn: (msg, ...args) => {
      const formatted = typeof msg === 'string' 
        ? msg.replace(/%s/g, () => args.shift() || '')
        : msg;
      console.warn(`[WARN] ${formatted}`);
    },
    error: (msg, ...args) => {
      const formatted = typeof msg === 'string' 
        ? msg.replace(/%s/g, () => args.shift() || '')
        : msg;
      console.error(`[ERROR] ${formatted}`);
    },
    debug: (msg, ...args) => {
      const formatted = typeof msg === 'string' 
        ? msg.replace(/%s/g, () => args.shift() || '')
        : msg;
      console.log(`[DEBUG] ${formatted}`);
    }
  };
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node query-db.js <sql> [--credential <name>]');
    console.error('Error: Missing SQL query argument');
    process.exit(1);
  }
  
  // 解析参数
  let sql = null;
  let credential = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--credential') {
      if (i + 1 < args.length) {
        credential = args[i + 1];
        i++;
      }
    } else if (sql === null) {
      sql = args[i];
    }
  }
  
  if (!sql) {
    console.error('Usage: node query-db.js <sql> [--credential <name>]');
    console.error('Error: Missing SQL query argument');
    process.exit(1);
  }
  
  const normalizedSql = _normalizeSqlInput(sql);
  logger.info('query_db CLI started sql=%s', normalizedSql);
  
  // 获取数据库连接
  const conn = get_connection();
  ensure_schema(conn);
  
  try {
    const result = execute_sql(conn, normalizedSql);
    console.log(JSON.stringify(result, null, 2, (key, value) => 
      value === undefined ? null : value
    ));
    
    const rowCount = Array.isArray(result) ? result.length : 1;
    logger.info('query_db completed rows=%d', rowCount);
  } catch (exc) {
    if (exc instanceof Error && exc.message.includes('Forbidden SQL operation')) {
      _exitWithCliError({
        exc,
        logger,
        context: 'query_db rejected sql',
        exitCode: 1,
        logTraceback: false
      });
    } else if (exc instanceof Error && exc.message.includes('SQLITE')) {
      _exitWithCliError({
        exc,
        logger,
        context: 'query_db execution failed',
        exitCode: 1,
        logTraceback: true
      });
    } else {
      _exitWithCliError({
        exc,
        logger,
        context: 'query_db CLI failed',
        exitCode: 1,
        logTraceback: true
      });
    }
  } finally {
    conn.close();
  }
}

// 导出模块
module.exports = {
  query_db: main,
  main,
  _normalizeSqlInput
};

// CLI 入口
if (require.main === module) {
  main();
}
