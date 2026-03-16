# logging_config 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/logging_config.py`  
**JavaScript 目标文件**: `module/src/logging.js`  
**功能**: 日志配置，每日轮转文件处理器

---

## 2. 依赖关系

### 2.1 Python 依赖

```python
import logging
from logging.handlers import TimedRotatingFileHandler
```

### 2.2 JavaScript 依赖

```javascript
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
// 或使用 winston, pino 等日志库
```

---

## 3. 接口设计

### 3.1 常量

```javascript
const LOG_FILE_PREFIX = 'awiki-agent';
const MAX_RETENTION_DAYS = 15;
const MAX_TOTAL_SIZE_BYTES = 15 * 1024 * 1024;  // 15MB
const DEFAULT_FORMAT = '%(timestamp)s [%(level)s] %(name)s: %(message)s';
```

### 3.2 `getLogDir` 函数

```javascript
/**
 * 获取日志目录
 * @param {SDKConfig} [config] - SDK 配置
 * @returns {string}
 */
function getLogDir(config = null) {
    const resolvedConfig = config || new SDKConfig();
    const logDir = path.join(resolvedConfig.dataDir, 'logs');
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    return logDir;
}
```

### 3.3 `getLogFilePath` 函数

```javascript
/**
 * 获取日志文件路径
 * @param {string} [logDir] - 日志目录
 * @param {Object} options - 选项
 * @param {Date} [options.now] - 当前日期
 * @param {string} [options.prefix=LOG_FILE_PREFIX] - 文件前缀
 * @returns {string}
 */
function getLogFilePath(logDir = null, options = {}) {
    const {
        now = new Date(),
        prefix = LOG_FILE_PREFIX,
    } = options;
    
    const resolvedLogDir = logDir || getLogDir();
    const date = now.toISOString().split('T')[0];  // YYYY-MM-DD
    
    return path.join(resolvedLogDir, `${prefix}-${date}.log`);
}
```

### 3.4 `DailyRotationStream` 类

```javascript
/**
 * 每日轮转文件流
 */
class DailyRotationStream extends stream.Writable {
    constructor(options = {}) {
        super();
        
        this.logDir = options.logDir || getLogDir();
        this.prefix = options.prefix || LOG_FILE_PREFIX;
        this.maxRetentionDays = options.maxRetentionDays || MAX_RETENTION_DAYS;
        this.maxTotalSizeBytes = options.maxTotalSizeBytes || MAX_TOTAL_SIZE_BYTES;
        
        this.currentPath = null;
        this.currentStream = null;
        this.nextCleanupAt = null;
        
        this._openIfNeeded();
    }

    _write(chunk, encoding, callback) {
        this._openIfNeeded();
        
        if (this.currentStream) {
            this.currentStream.write(chunk, encoding, callback);
        } else {
            callback();
        }
        
        this._runCleanup();
    }

    _openIfNeeded() {
        const now = new Date();
        const newPath = getLogFilePath(this.logDir, { now, prefix: this.prefix });
        
        if (newPath === this.currentPath && this.currentStream) {
            return;
        }
        
        if (this.currentStream) {
            this.currentStream.end();
        }
        
        this.currentStream = fs.createWriteStream(newPath, { flags: 'a', encoding: 'utf8' });
        this.currentPath = newPath;
    }

    _runCleanup(force = false) {
        const now = new Date();
        
        if (!force && this.nextCleanupAt && now < this.nextCleanupAt) {
            return;
        }
        
        cleanupLogFiles(this.logDir, {
            now,
            prefix: this.prefix,
            maxRetentionDays: this.maxRetentionDays,
            maxTotalSizeBytes: this.maxTotalSizeBytes,
        });
        
        // 下次清理时间：60 秒后
        this.nextCleanupAt = new Date(now.getTime() + 60000);
    }
}
```

### 3.5 `cleanupLogFiles` 函数

```javascript
/**
 * 清理日志文件
 * @param {string} logDir - 日志目录
 * @param {Object} options - 选项
 * @returns {string[]} 已删除的文件列表
 */
function cleanupLogFiles(logDir, options = {}) {
    const {
        now = new Date(),
        prefix = LOG_FILE_PREFIX,
        maxRetentionDays = MAX_RETENTION_DAYS,
        maxTotalSizeBytes = MAX_TOTAL_SIZE_BYTES,
    } = options;
    
    const deletedFiles = [];
    const keepAfter = new Date(now.getTime() - maxRetentionDays * 24 * 60 * 60 * 1000);
    
    // 列出所有日志文件
    const files = fs.readdirSync(logDir)
        .filter(name => name.startsWith(`${prefix}-`) && name.endsWith('.log'))
        .map(name => ({
            name,
            path: path.join(logDir, name),
            date: new Date(name.replace(`${prefix}-`, '').replace('.log', '')),
        }))
        .sort((a, b) => a.date - b.date);
    
    // 删除过期文件
    for (const file of files) {
        if (file.date < keepAfter) {
            fs.unlinkSync(file.path);
            deletedFiles.push(file.path);
        }
    }
    
    // 检查总大小
    const remainingFiles = files.filter(f => !deletedFiles.includes(f.path));
    let totalSize = remainingFiles.reduce((sum, f) => {
        try {
            return sum + fs.statSync(f.path).size;
        } catch {
            return sum;
        }
    }, 0);
    
    // 删除最旧的文件直到总大小在限制内
    while (totalSize > maxTotalSizeBytes && remainingFiles.length > 1) {
        const oldest = remainingFiles.shift();
        fs.unlinkSync(oldest.path);
        deletedFiles.push(oldest.path);
        totalSize -= fs.statSync(oldest.path).size;
    }
    
    return deletedFiles;
}
```

### 3.6 `configureLogging` 函数

```javascript
/**
 * 配置日志
 * @param {Object} options - 选项
 * @param {string} [options.level='info'] - 日志级别
 * @param {string} [options.consoleLevel='info'] - 控制台级别
 * @param {boolean} [options.force=false] - 强制重新配置
 * @param {SDKConfig} [options.config] - SDK 配置
 * @param {boolean} [options.mirrorStdio=false] - 镜像标准输出
 * @returns {string} 当前日志文件路径
 */
function configureLogging(options = {}) {
    const {
        level = 'info',
        consoleLevel = 'info',
        force = false,
        config = null,
        mirrorStdio = false,
    } = options;
    
    const logDir = getLogDir(config);
    const logFilePath = getLogFilePath(logDir);
    
    // 创建日志器
    const logger = createLogger({
        level,
        transports: [
            new DailyRotationStream({ logDir }),
            ...(consoleLevel ? [new ConsoleTransport({ level: consoleLevel })] : []),
        ],
        format: combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            printf(({ timestamp, level, name, message }) => {
                return `${timestamp} [${level}] ${name}: ${message}`;
            })
        ),
    });
    
    // 镜像 stdio
    if (mirrorStdio) {
        mirrorStdioToLogger(logger);
    }
    
    return logFilePath;
}
```

---

## 4. 导出接口

```javascript
export {
    LOG_FILE_PREFIX,
    MAX_RETENTION_DAYS,
    MAX_TOTAL_SIZE_BYTES,
    getLogDir,
    getLogFilePath,
    cleanupLogFiles,
    DailyRotationStream,
    configureLogging,
};
```

---

## 5. 使用示例

```javascript
import { configureLogging } from './logging.js';

// 配置日志
const logFile = configureLogging({
    level: 'debug',
    consoleLevel: 'info',
    mirrorStdio: true,  // 捕获 console.log
});

console.log(`Logging to: ${logFile}`);

// 使用日志器
const logger = getLogger('my-module');
logger.info('Application started');
logger.debug('Debug information');
```

---

## 6. 迁移检查清单

- [ ] 实现 `getLogDir` 函数
- [ ] 实现 `getLogFilePath` 函数
- [ ] 实现 `cleanupLogFiles` 函数
- [ ] 实现 `DailyRotationStream` 类
- [ ] 实现 `configureLogging` 函数
- [ ] 选择日志库（winston/pino）
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
