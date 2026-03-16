/**
 * logging_config 模块测试
 *
 * 基于 distill.json 中的测试用例设计
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  LOG_FILE_PREFIX,
  MAX_RETENTION_DAYS,
  MAX_TOTAL_SIZE_BYTES,
  getLogDir,
  getLogFilePath,
  cleanupLogFiles,
  findLatestLogFile,
  DailyRetentionFileHandler,
  configureLogging,
} from '../logging.js';
import type { SDKConfig } from '../types.js';

// Helper to create a temp directory
function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logging-test-'));
  return tempDir;
}

// Helper to clean up temp directory
function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Helper to create test log files
function createTestLogFile(dir: string, dateStr: string, content: string = ''): string {
  const filePath = path.join(dir, `${LOG_FILE_PREFIX}-${dateStr}.log`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Mock SDKConfig for testing
class MockSDKConfig implements SDKConfig {
  readonly data_dir: string;
  readonly credentials_dir: string;
  readonly user_service_url: string;
  readonly molt_message_url: string;
  readonly molt_message_ws_url: string | null;
  readonly did_domain: string;

  constructor(dataDir: string) {
    this.data_dir = dataDir;
    this.credentials_dir = '/tmp/creds';
    this.user_service_url = 'https://awiki.ai';
    this.molt_message_url = 'https://awiki.ai';
    this.molt_message_ws_url = null;
    this.did_domain = 'awiki.ai';
  }
}

describe('logging_config', () => {
  describe('getLogDir', () => {
    let tempDir: string;
    let testConfig: SDKConfig;

    before(() => {
      tempDir = createTempDir();
      testConfig = new MockSDKConfig(tempDir);
    });

    after(() => {
      cleanupTempDir(tempDir);
    });

    it('should create log directory with default config', () => {
      const logDir = getLogDir(testConfig);
      assert.ok(logDir.endsWith('logs'), 'Log dir should end with /logs');
      assert.ok(fs.existsSync(logDir), 'Log directory should be created');
    });

    it('should return existing directory', () => {
      const logDir = getLogDir(testConfig);
      const logDir2 = getLogDir(testConfig);
      assert.strictEqual(logDir, logDir2, 'Should return same directory');
    });
  });

  describe('getLogFilePath', () => {
    let tempDir: string;

    before(() => {
      tempDir = createTempDir();
    });

    after(() => {
      cleanupTempDir(tempDir);
    });

    it('should generate path with current date', () => {
      const now = new Date('2026-03-16T10:30:00Z');
      const logPath = getLogFilePath(tempDir, { now, prefix: LOG_FILE_PREFIX });
      assert.ok(logPath.includes('awiki-agent-2026-03-16.log'), 'Should contain correct filename');
    });

    it('should use custom prefix', () => {
      const now = new Date('2026-03-16T10:30:00Z');
      const logPath = getLogFilePath(tempDir, { now, prefix: 'custom-prefix' });
      assert.ok(logPath.includes('custom-prefix-2026-03-16.log'), 'Should use custom prefix');
    });
  });

  describe('cleanupLogFiles', () => {
    let tempDir: string;

    before(() => {
      tempDir = createTempDir();
    });

    after(() => {
      cleanupTempDir(tempDir);
    });

    it('should delete expired files', () => {
      // Create files: one expired, one valid
      createTestLogFile(tempDir, '2026-02-01', 'old content');
      createTestLogFile(tempDir, '2026-03-15', 'new content');
      
      const now = new Date('2026-03-16T10:00:00Z');
      const deleted = cleanupLogFiles(tempDir, {
        now,
        maxRetentionDays: 15,
      });
      
      assert.strictEqual(deleted.length, 1, 'Should delete one file');
      assert.ok(deleted[0].includes('2026-02-01'), 'Should delete old file');
    });

    it('should delete oldest files when size exceeds limit', () => {
      // Clean up first
      cleanupTempDir(tempDir);
      tempDir = createTempDir();
      
      // Create files that exceed size limit
      const content60 = 'x'.repeat(60);
      createTestLogFile(tempDir, '2026-03-14', content60);
      createTestLogFile(tempDir, '2026-03-15', content60);
      createTestLogFile(tempDir, '2026-03-16', content60);
      
      const now = new Date('2026-03-16T10:00:00Z');
      const deleted = cleanupLogFiles(tempDir, {
        now,
        maxRetentionDays: 15,
        maxTotalSizeBytes: 100,
      });
      
      assert.strictEqual(deleted.length, 2, 'Should delete two files');
      
      // Latest file should remain
      const remaining = fs.readdirSync(tempDir);
      assert.strictEqual(remaining.length, 1, 'Should have one file remaining');
      assert.ok(remaining[0].includes('2026-03-16'), 'Latest file should remain');
    });

    it('should keep files within retention period', () => {
      // Clean up first
      cleanupTempDir(tempDir);
      tempDir = createTempDir();
      
      // Create file within retention period
      createTestLogFile(tempDir, '2026-03-10', 'content');
      
      const now = new Date('2026-03-16T10:00:00Z');
      const deleted = cleanupLogFiles(tempDir, {
        now,
        maxRetentionDays: 15,
      });
      
      assert.strictEqual(deleted.length, 0, 'Should not delete any files');
    });
  });

  describe('findLatestLogFile', () => {
    let tempDir: string;

    before(() => {
      tempDir = createTempDir();
    });

    after(() => {
      cleanupTempDir(tempDir);
    });

    it('should return latest log file', () => {
      createTestLogFile(tempDir, '2026-03-15', 'old');
      createTestLogFile(tempDir, '2026-03-16', 'new');
      
      const latest = findLatestLogFile(tempDir);
      assert.ok(latest !== null, 'Should find a file');
      assert.ok(latest!.includes('2026-03-16'), 'Should return latest file');
    });

    it('should return null when no files exist', () => {
      cleanupTempDir(tempDir);
      tempDir = createTempDir();
      
      const latest = findLatestLogFile(tempDir);
      assert.strictEqual(latest, null, 'Should return null');
    });
  });

  describe('DailyRetentionFileHandler', () => {
    let tempDir: string;
    let handler: DailyRetentionFileHandler | null = null;

    before(() => {
      tempDir = createTempDir();
    });

    after(() => {
      if (handler) {
        handler.close();
        handler.destroy();
      }
      // Give some time for async operations to complete
      setTimeout(() => {
        cleanupTempDir(tempDir);
      }, 100);
    });

    it('should create log file on initialization', () => {
      const clock = () => new Date('2026-03-16T10:00:00Z');
      handler = new DailyRetentionFileHandler({
        logDir: tempDir,
        prefix: LOG_FILE_PREFIX,
        clock,
      });
      
      // Give time for file to be created
      const startTime = Date.now();
      while (!fs.existsSync(handler.currentPath) && Date.now() - startTime < 100) {
        // Wait for file creation
      }
      
      assert.ok(handler.currentPath.includes('2026-03-16'), 'Should create file for current date');
      assert.ok(fs.existsSync(handler.currentPath), 'File should exist');
    });

    it('should write to log file', () => {
      if (!handler) return;
      
      handler.write('Test message 1\n');
      handler.write('Test message 2\n');
      handler.flush();
      
      // Give time for write to complete
      const startTime = Date.now();
      while (Date.now() - startTime < 50) {
        // Wait for write
      }
      
      // Read file content
      const content = fs.readFileSync(handler.currentPath, 'utf-8');
      assert.ok(content.includes('Test message 1'), 'Should contain first message');
      assert.ok(content.includes('Test message 2'), 'Should contain second message');
    });

    it('should roll over to new file on date change', () => {
      if (!handler) return;
      
      const oldPath = handler.currentPath;
      
      // Simulate date change
      const clock = () => new Date('2026-03-17T00:00:01Z');
      handler.close();
      
      handler = new DailyRetentionFileHandler({
        logDir: tempDir,
        prefix: LOG_FILE_PREFIX,
        clock,
      });
      
      assert.ok(handler.currentPath.includes('2026-03-17'), 'Should create new file for new date');
      assert.notStrictEqual(handler.currentPath, oldPath, 'Path should change');
    });
  });

  describe('configureLogging', () => {
    let tempDir: string;
    let testConfig: SDKConfig;

    before(() => {
      tempDir = createTempDir();
      testConfig = new MockSDKConfig(tempDir);
    });

    after(() => {
      setTimeout(() => {
        cleanupTempDir(tempDir);
      }, 100);
    });

    it('should configure logging and return log file path', () => {
      const logPath = configureLogging({
        config: testConfig,
        level: 'info',
        consoleLevel: 'info',
      });
      
      // Give time for file creation
      const startTime = Date.now();
      while (!fs.existsSync(logPath) && Date.now() - startTime < 100) {
        // Wait for file creation
      }
      
      assert.ok(logPath, 'Should return log file path');
      assert.ok(fs.existsSync(logPath), 'Log file should exist');
    });

    it('should force reconfigure', () => {
      const logPath1 = configureLogging({
        config: testConfig,
        level: 'info',
      });
      
      const logPath2 = configureLogging({
        config: testConfig,
        level: 'info',
        force: true,
      });
      
      assert.ok(logPath2, 'Should return new log file path');
    });
  });

  describe('Constants', () => {
    it('should have correct constant values', () => {
      assert.strictEqual(LOG_FILE_PREFIX, 'awiki-agent', 'Prefix should be awiki-agent');
      assert.strictEqual(MAX_RETENTION_DAYS, 15, 'Retention days should be 15');
      assert.strictEqual(MAX_TOTAL_SIZE_BYTES, 15 * 1024 * 1024, 'Max size should be 15MB');
    });
  });
});
