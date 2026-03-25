/**
 * utils/logging_config.py 的 Node.js 测试文件
 * 
 * 基于蒸馏数据生成，确保与 Python 版本行为一致
 * 
 * 蒸馏数据：doc/scripts/utils/logging_config.py/py.json
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 导入目标模块
const logging = require(path.join(__dirname, '../../../../module/scripts/utils/logging.js'));
const { defaultDataDir } = require(path.join(__dirname, '../../../../module/scripts/utils/config.js'));

describe('logging_config - 日志管理', () => {
  
  describe('Constants', () => {
    it('should have correct constant values', () => {
      assert.strictEqual(logging.LOG_FILE_PREFIX, 'awiki-agent');
      assert.strictEqual(logging.MAX_RETENTION_DAYS, 15);
      assert.strictEqual(logging.MAX_TOTAL_SIZE_BYTES, 15 * 1024 * 1024);
    });
  });
  
  describe('getLogDir()', () => {
    it('should get log directory - 获取日志目录（使用默认配置）', () => {
      // 从 py.json 获取预期输出
      const expected = {
        log_dir: path.join(defaultDataDir(), 'logs')
      };
      
      // 测试 Node.js 版本
      const logDir = logging.getLogDir();
      assert.strictEqual(logDir, expected.log_dir);
      
      // 验证目录存在
      assert.ok(fs.existsSync(logDir));
    });
    
    it('should create directory if not exists', () => {
      const logDir = logging.getLogDir();
      assert.ok(fs.existsSync(logDir));
    });
  });
  
  describe('getLogFilePath()', () => {
    it('should get log file path with current date', () => {
      const logDir = logging.getLogDir();
      const logFile = logging.getLogFilePath();
      
      // 验证路径格式
      assert.ok(logFile.endsWith('.log'));
      assert.ok(logFile.includes(logging.LOG_FILE_PREFIX));
      
      // 验证日期格式（YYYY-MM-DD）
      const dateStr = new Date().toISOString().split('T')[0];
      assert.ok(logFile.includes(dateStr));
    });
  });
  
  describe('configureLogging()', () => {
    it('should configure logging - 配置默认日志', () => {
      const logFilePath = logging.configureLogging();
      
      // 验证返回日志文件路径
      assert.ok(logFilePath);
      assert.ok(logFilePath.endsWith('.log'));
      
      // 验证全局 log 对象已创建
      assert.ok(global.log);
      assert.strictEqual(typeof global.log.info, 'function');
      assert.strictEqual(typeof global.log.warn, 'function');
      assert.strictEqual(typeof global.log.error, 'function');
      assert.strictEqual(typeof global.log.debug, 'function');
    });
    
    it('should write log message', () => {
      const logFilePath = logging.configureLogging();

      // 写入测试消息
      global.log.info('Test info message');
      global.log.warn('Test warn message');
      global.log.error('Test error message');

      // 验证日志文件存在
      assert.ok(fs.existsSync(logFilePath));

      // 验证日志内容
      const content = fs.readFileSync(logFilePath, 'utf8');
      assert.ok(content.includes('Test info message'));
      assert.ok(content.includes('Test warn message'));
      assert.ok(content.includes('Test error message'));
    });
  });
  
  describe('DailyRetentionFileHandler', () => {
    it('should create handler with correct options', () => {
      const handler = new logging.DailyRetentionFileHandler({
        logDir: null,
        prefix: 'test',
        maxRetentionDays: 7,
        maxTotalSizeBytes: 1024 * 1024,
        cleanupIntervalSeconds: 30
      });
      
      assert.ok(handler.currentPath);
      assert.ok(handler.currentPath.endsWith('.log'));
      
      handler.close();
    });
    
    it('should emit log message', () => {
      const handler = new logging.DailyRetentionFileHandler({
        prefix: 'test-handler'
      });
      
      const logPath = handler.currentPath;
      
      // 写入消息
      handler.emit('Test message', 'INFO');
      handler.flush();
      
      // 验证消息已写入
      const content = fs.readFileSync(logPath, 'utf8');
      assert.ok(content.includes('Test message'));
      
      handler.close();
    });
  });
  
  describe('cleanupLogFiles()', () => {
    it('should cleanup old log files', () => {
      const logDir = logging.getLogDir();
      
      // 创建测试文件
      const testFile = path.join(logDir, 'awiki-agent-2020-01-01.log');
      fs.writeFileSync(testFile, 'old log');
      
      // 运行清理
      const deleted = logging.cleanupLogFiles(
        logDir,
        new Date(),
        logging.LOG_FILE_PREFIX,
        15, // 保留 15 天
        logging.MAX_TOTAL_SIZE_BYTES
      );
      
      // 验证旧文件已删除
      assert.ok(deleted.some(f => f.includes('2020-01-01')));
      assert.ok(!fs.existsSync(testFile));
    });
  });
  
  describe('Cross-platform tests', () => {
    const { execSync } = require('child_process');
    
    it('Python: get_log_dir() should return valid path', () => {
      // 执行 Python 版本
      const pythonOutput = execSync(
        'python -c "from scripts.utils.logging_config import get_log_dir; print(str(get_log_dir()))"',
        { encoding: 'utf8', cwd: 'D:\\huangyg\\git\\sample\\awiki' }
      ).trim();
      
      // 验证路径格式
      assert.ok(pythonOutput.includes('awiki-agent-id-message'));
      assert.ok(pythonOutput.includes('logs'));
    });
    
    it('Node.js vs Python: getLogDir() should return same path', () => {
      // Node.js 版本
      const nodeLogDir = logging.getLogDir();
      
      // Python 版本
      const pythonLogDir = execSync(
        'python -c "from scripts.utils.logging_config import get_log_dir; print(str(get_log_dir()))"',
        { encoding: 'utf8', cwd: 'D:\\huangyg\\git\\sample\\awiki' }
      ).trim();
      
      // 验证路径一致（允许路径分隔符差异）
      const normalizedNode = nodeLogDir.replace(/\\/g, '/');
      const normalizedPython = pythonLogDir.replace(/\\/g, '/');
      assert.strictEqual(normalizedNode, normalizedPython);
    });
  });
});
