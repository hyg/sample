/**
 * utils/logging_config.py 的 Node.js 移植
 * 
 * Python 源文件：python/scripts/utils/logging_config.py
 * 分析报告：doc/scripts/utils/logging_config.py/py.md
 * 蒸馏数据：doc/scripts/utils/logging_config.py/py.json
 * 
 * 应用日志工具，支持按天轮换和保留策略
 */

const fs = require('fs');
const path = require('path');

// 导入 config 模块
const { defaultDataDir } = require('./config.js');

// 常量定义
const LOG_FILE_PREFIX = 'awiki-agent';
const MAX_RETENTION_DAYS = 15;
const MAX_TOTAL_SIZE_BYTES = 15 * 1024 * 1024; // 15 MiB

const _DEFAULT_FORMAT = '%(asctime)s [%(levelname)s] %(name)s: %(message)s';
const _DEFAULT_DATE_FORMAT = '%Y-%m-%d %H:%M:%S';
const _FILE_HANDLER_NAME = 'awiki_daily_file_handler';
const _CONSOLE_HANDLER_NAME = 'awiki_console_handler';
const _STDIO_LOGGER_NAME = 'awiki_stdio';

/**
 * 获取默认日志目录
 * 
 * @param {Object} config - SDKConfig 实例（可选）
 * @returns {string} 日志目录路径
 */
function getLogDir(config = null) {
  const resolvedConfig = config || { dataDir: defaultDataDir() };
  const logDir = path.join(resolvedConfig.dataDir, 'logs');
  
  // 创建目录（如果不存在）
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  return logDir;
}

/**
 * 获取日志文件路径
 * 
 * @param {string} logDir - 日志目录
 * @param {Date} now - 当前时间
 * @param {string} prefix - 文件前缀
 * @returns {string} 日志文件路径
 */
function getLogFilePath(logDir = null, now = new Date(), prefix = LOG_FILE_PREFIX) {
  const resolvedLogDir = logDir || getLogDir();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(resolvedLogDir, `${prefix}-${dateStr}.log`);
}

/**
 * 解析日志文件日期
 * 
 * @param {string} filePath - 文件路径
 * @param {string} prefix - 文件前缀
 * @returns {Date|null} 解析的日期，失败返回 null
 */
function extractLogDate(filePath, prefix) {
  const fileName = path.basename(filePath);
  const expectedPrefix = `${prefix}-`;
  
  if (!fileName.startsWith(expectedPrefix) || !fileName.endsWith('.log')) {
    return null;
  }
  
  const datePart = fileName.slice(expectedPrefix.length, -4);
  const parsedDate = new Date(datePart);
  
  if (isNaN(parsedDate.getTime())) {
    return null;
  }
  
  return parsedDate;
}

/**
 * 列出管理的日志文件
 * 
 * @param {string} logDir - 日志目录
 * @param {string} prefix - 文件前缀
 * @returns {string[]} 按日期排序的文件路径列表
 */
function listManagedLogFiles(logDir, prefix = LOG_FILE_PREFIX) {
  if (!fs.existsSync(logDir)) {
    return [];
  }
  
  const files = fs.readdirSync(logDir)
    .filter(name => name.startsWith(`${prefix}-`) && name.endsWith('.log'))
    .map(name => {
      const filePath = path.join(logDir, name);
      const fileDate = extractLogDate(filePath, prefix);
      return { path: filePath, date: fileDate };
    })
    .filter(item => item.date !== null)
    .sort((a, b) => a.date - b.date)
    .map(item => item.path);
  
  return files;
}

/**
 * 查找最新的日志文件
 * 
 * @param {string} logDir - 日志目录
 * @param {string} prefix - 文件前缀
 * @returns {string|null} 最新日志文件路径，无文件返回 null
 */
function findLatestLogFile(logDir = null, prefix = LOG_FILE_PREFIX) {
  const resolvedLogDir = logDir || getLogDir();
  const files = listManagedLogFiles(resolvedLogDir, prefix);
  return files.length > 0 ? files[files.length - 1] : null;
}

/**
 * 清理过期的日志文件
 * 
 * @param {string} logDir - 日志目录
 * @param {Date} now - 当前时间
 * @param {string} prefix - 文件前缀
 * @param {number} maxRetentionDays - 最大保留天数
 * @param {number} maxTotalSizeBytes - 最大总大小（字节）
 * @returns {string[]} 已删除的文件路径列表
 */
function cleanupLogFiles(
  logDir = null,
  now = new Date(),
  prefix = LOG_FILE_PREFIX,
  maxRetentionDays = MAX_RETENTION_DAYS,
  maxTotalSizeBytes = MAX_TOTAL_SIZE_BYTES
) {
  const resolvedLogDir = logDir || getLogDir();
  
  // 确保目录存在
  if (!fs.existsSync(resolvedLogDir)) {
    fs.mkdirSync(resolvedLogDir, { recursive: true });
    return [];
  }
  
  const deletedFiles = [];
  const keepAfter = new Date(now);
  keepAfter.setDate(keepAfter.getDate() - (maxRetentionDays - 1));
  
  // 删除超过保留期的文件
  const keptFiles = [];
  const files = listManagedLogFiles(resolvedLogDir, prefix);
  
  for (const filePath of files) {
    const fileDate = extractLogDate(filePath, prefix);
    if (fileDate === null) continue;
    
    if (fileDate < keepAfter) {
      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
      } catch (e) {
        // 文件不存在或其他错误
      }
    } else {
      keptFiles.push(filePath);
    }
  }
  
  // 如果总大小超过限制，删除最旧的文件
  let totalSize = keptFiles.reduce((sum, f) => {
    try {
      return sum + fs.statSync(f).size;
    } catch {
      return sum;
    }
  }, 0);
  
  while (totalSize > maxTotalSizeBytes && keptFiles.length > 1) {
    const oldestPath = keptFiles.shift();
    try {
      const oldestSize = fs.statSync(oldestPath).size;
      fs.unlinkSync(oldestPath);
      deletedFiles.push(oldestPath);
      totalSize -= oldestSize;
    } catch {
      // 忽略错误
    }
  }
  
  return deletedFiles;
}

/**
 * 按天轮换的文件日志处理器
 */
class DailyRetentionFileHandler {
  /**
   * 创建日志处理器
   *
   * @param {Object} options - 配置选项
   * @param {string} options.logDir - 日志目录
   * @param {string} options.prefix - 文件前缀
   * @param {number} options.maxRetentionDays - 最大保留天数
   * @param {number} options.maxTotalSizeBytes - 最大总大小
   * @param {number} options.cleanupIntervalSeconds - 清理间隔（秒）
   * @param {string} options.encoding - 文件编码
   */
  constructor({
    logDir = null,
    prefix = LOG_FILE_PREFIX,
    maxRetentionDays = MAX_RETENTION_DAYS,
    maxTotalSizeBytes = MAX_TOTAL_SIZE_BYTES,
    cleanupIntervalSeconds = 60,
    encoding = 'utf-8'
  } = {}) {
    this._logDir = logDir || getLogDir();
    this._prefix = prefix;
    this._maxRetentionDays = maxRetentionDays;
    this._maxTotalSizeBytes = maxTotalSizeBytes;
    this._cleanupInterval = Math.max(1, cleanupIntervalSeconds) * 1000; // 转换为毫秒
    this._encoding = encoding;
    this._currentPath = null;
    this._fd = null; // 文件描述符
    this._nextCleanupAt = null;

    // 确保目录存在
    if (!fs.existsSync(this._logDir)) {
      fs.mkdirSync(this._logDir, { recursive: true });
    }

    this._openIfNeeded();
    this._runCleanup(true);
  }

  /**
   * 获取当前日志文件路径
   */
  get currentPath() {
    this._openIfNeeded();
    return this._currentPath;
  }

  /**
   * 写入日志记录
   *
   * @param {string} message - 日志消息
   * @param {string} level - 日志级别
   */
  emit(message, level = 'INFO') {
    try {
      this._openIfNeeded();
      if (this._fd === null) return;

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const logLine = `${timestamp} [${level}] awiki: ${message}\n`;

      fs.writeSync(this._fd, logLine);
      this._runCleanup();
    } catch (e) {
      console.error('Failed to write log:', e);
    }
  }

  /**
   * 刷新流
   */
  flush() {
    if (this._fd !== null) {
      fs.fsyncSync(this._fd);
    }
  }

  /**
   * 关闭流
   */
  close() {
    if (this._fd !== null) {
      try {
        fs.closeSync(this._fd);
      } catch (e) {
        // 忽略关闭错误
      }
      this._fd = null;
      this._currentPath = null;
    }
  }

  /**
   * 打开或轮换日志文件
   */
  _openIfNeeded() {
    const nextPath = getLogFilePath(this._logDir, new Date(), this._prefix);

    if (nextPath === this._currentPath && this._fd !== null) {
      return;
    }

    if (this._fd !== null) {
      try {
        fs.closeSync(this._fd);
      } catch (e) {
        // 忽略关闭错误
      }
    }

    // 确保目录存在
    const dir = path.dirname(nextPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 以追加模式打开文件
    this._fd = fs.openSync(nextPath, 'a');
    this._currentPath = nextPath;
  }
  
  /**
   * 运行清理
   * 
   * @param {boolean} force - 是否强制清理
   */
  _runCleanup(force = false) {
    const current = new Date();
    
    if (!force && this._nextCleanupAt !== null && current < this._nextCleanupAt) {
      return;
    }
    
    cleanupLogFiles(
      this._logDir,
      current,
      this._prefix,
      this._maxRetentionDays,
      this._maxTotalSizeBytes
    );
    
    this._nextCleanupAt = new Date(current.getTime() + this._cleanupInterval);
  }
}

/**
 * 配置日志
 *
 * @param {Object} options - 配置选项
 * @param {string} options.level - 日志级别
 * @param {string} options.consoleLevel - 控制台日志级别
 * @param {boolean} options.force - 是否强制重新配置
 * @param {Object} options.config - SDKConfig 实例
 * @param {string} options.prefix - 文件前缀
 * @param {boolean} options.mirrorStdio - 是否镜像标准输出
 * @returns {string} 日志文件路径
 */
function configureLogging({
  level = 'INFO',
  consoleLevel = 'INFO',
  force = false,
  config = null,
  prefix = LOG_FILE_PREFIX,
  mirrorStdio = false
} = {}) {
  const logDir = getLogDir(config);

  // 创建文件处理器
  const fileHandler = new DailyRetentionFileHandler({
    logDir,
    prefix,
    maxRetentionDays: MAX_RETENTION_DAYS,
    maxTotalSizeBytes: MAX_TOTAL_SIZE_BYTES
  });

  // 配置控制台输出
  const consoleHandler = {
    emit: (message, lvl) => {
      if (lvl === 'ERROR' || lvl === 'CRITICAL') {
        console.error(message);
      } else if (lvl === 'WARN') {
        console.warn(message);
      } else {
        console.log(message);
      }
    }
  };

  // 全局日志函数
  global.log = {
    info: (msg) => {
      fileHandler.emit(msg, 'INFO');
      fileHandler.flush();
      consoleHandler.emit(msg, 'INFO');
    },
    warn: (msg) => {
      fileHandler.emit(msg, 'WARN');
      fileHandler.flush();
      consoleHandler.emit(msg, 'WARN');
    },
    error: (msg) => {
      fileHandler.emit(msg, 'ERROR');
      fileHandler.flush();
      consoleHandler.emit(msg, 'ERROR');
    },
    debug: (msg) => {
      fileHandler.emit(msg, 'DEBUG');
      fileHandler.flush();
      consoleHandler.emit(msg, 'DEBUG');
    }
  };

  // 返回实际的文件处理器路径
  return fileHandler.currentPath;
}

module.exports = {
  // 常量
  LOG_FILE_PREFIX,
  MAX_RETENTION_DAYS,
  MAX_TOTAL_SIZE_BYTES,
  
  // 函数
  getLogDir,
  getLogFilePath,
  extractLogDate,
  listManagedLogFiles,
  findLatestLogFile,
  cleanupLogFiles,
  configureLogging,
  
  // 类
  DailyRetentionFileHandler
};
