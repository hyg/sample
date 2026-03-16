/**
 * Application logging utilities with daily file retention
 *
 * [INPUT]: SDKConfig (data_dir), logging records, local wall clock time
 * [OUTPUT]: DailyRetentionFileHandler, configureLogging(), cleanupLogFiles(),
 *           getLogDir(), getLogFilePath(), findLatestLogFile()
 * [POS]: Shared runtime logging module for CLI scripts and background listeners;
 *        stores diagnostic logs under <DATA_DIR>/logs with daily files and
 *        dual retention limits (15 days / 15 MiB total)
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

import * as fs from 'fs';
import * as path from 'path';
import { Writable } from 'stream';
import type { SDKConfig, Clock, CleanupOptions, GetLogFilePathOptions, ConfigureLoggingOptions } from './types.js';

// ============================================================================
// Constants
// ============================================================================

export const LOG_FILE_PREFIX = 'awiki-agent';
export const MAX_RETENTION_DAYS = 15;
export const MAX_TOTAL_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Return the current local datetime
 */
function defaultClock(): Date {
  return new Date();
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the configured log level value from string or number
 */
function getLogLevelValue(level: string | number | undefined): number {
  if (typeof level === 'number') {
    return level;
  }
  
  const levelMap: Record<string, number> = {
    'debug': 10,
    'info': 20,
    'warn': 30,
    'warning': 30,
    'error': 40,
    'critical': 50,
  };
  
  if (level) {
    return levelMap[level.toLowerCase()] ?? 20;
  }
  return 20; // default INFO
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Return the application log directory under <DATA_DIR>/logs
 * 
 * @param config - SDK configuration (optional, uses default if not provided)
 * @returns Path to the log directory
 */
export function getLogDir(config?: SDKConfig | null): string {
  // Use default data dir if no config provided
  const dataDir = config?.data_dir ?? getDefaultDataDir();
  const logDir = path.join(dataDir, 'logs');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  return logDir;
}

/**
 * Get default data directory (mimics Python SDKConfig behavior)
 */
function getDefaultDataDir(): string {
  const os = require('os');
  const envData = process.env.AWIKI_DATA_DIR;
  if (envData) {
    return envData;
  }
  
  const workspace = process.env.AWIKI_WORKSPACE;
  if (workspace) {
    return path.join(workspace, 'data', 'awiki-agent-id-message');
  }
  
  return path.join(os.homedir(), '.openclaw', 'workspace', 'data', 'awiki-agent-id-message');
}

/**
 * Return the daily log file path for the given date
 * 
 * @param logDir - Log directory path (optional, uses default if not provided)
 * @param options - Options for generating the path
 * @returns Full path to the log file
 */
export function getLogFilePath(
  logDir?: string | null,
  options: GetLogFilePathOptions = {}
): string {
  const {
    now = defaultClock(),
    prefix = LOG_FILE_PREFIX,
  } = options;
  
  const resolvedLogDir = logDir ?? getLogDir();
  const dateStr = formatDate(now);
  
  return path.join(resolvedLogDir, `${prefix}-${dateStr}.log`);
}

/**
 * Parse the managed log date from a file name
 * 
 * @param filePath - File path to parse
 * @param prefix - Expected file prefix
 * @returns Parsed date or null if invalid
 */
function extractLogDate(filePath: string, prefix: string): Date | null {
  const fileName = path.basename(filePath);
  const expectedPrefix = `${prefix}-`;
  
  // Check if file exists and has correct prefix
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  
  if (!fileName.startsWith(expectedPrefix)) {
    return null;
  }
  
  // Check extension
  if (!fileName.endsWith('.log')) {
    return null;
  }
  
  // Extract date part
  const datePart = fileName.slice(expectedPrefix.length, -4);
  
  try {
    // Parse ISO date format
    const parsedDate = new Date(datePart);
    if (isNaN(parsedDate.getTime())) {
      return null;
    }
    return parsedDate;
  } catch {
    return null;
  }
}

/**
 * List managed daily log files sorted by date ascending
 * 
 * @param logDir - Log directory path
 * @param options - Options for listing files
 * @returns Array of file paths sorted by date
 */
function listManagedLogFiles(
  logDir: string,
  options: { prefix?: string } = {}
): string[] {
  const { prefix = LOG_FILE_PREFIX } = options;
  const files: Array<{ date: Date; path: string }> = [];
  
  try {
    const entries = fs.readdirSync(logDir);
    
    for (const entry of entries) {
      const candidate = path.join(logDir, entry);
      
      // Quick filter by pattern
      if (!entry.startsWith(`${prefix}-`) || !entry.endsWith('.log')) {
        continue;
      }
      
      const parsedDate = extractLogDate(candidate, prefix);
      if (parsedDate === null) {
        continue;
      }
      
      files.push({ date: parsedDate, path: candidate });
    }
    
    // Sort by date ascending, then by filename
    files.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return path.basename(a.path).localeCompare(path.basename(b.path));
    });
  } catch {
    // Return empty array if directory doesn't exist or can't be read
    return [];
  }
  
  return files.map(f => f.path);
}

/**
 * Return the latest managed daily log file, if any
 * 
 * @param logDir - Log directory path (optional, uses default if not provided)
 * @param options - Options for finding the file
 * @returns Path to the latest log file or null
 */
export function findLatestLogFile(
  logDir?: string | null,
  options: { prefix?: string } = {}
): string | null {
  const { prefix = LOG_FILE_PREFIX } = options;
  const resolvedLogDir = logDir ?? getLogDir();
  const files = listManagedLogFiles(resolvedLogDir, { prefix });
  return files.length > 0 ? files[files.length - 1] : null;
}

/**
 * Delete expired or oversized daily logs
 * 
 * Cleanup strategy:
 * 1. Remove files older than the retention window
 * 2. If the total managed log size still exceeds the limit, delete the
 *    oldest remaining files until the total size is within limit or only
 *    the newest log file remains
 * 
 * @param logDir - Log directory path (optional, uses default if not provided)
 * @param options - Cleanup options
 * @returns Array of deleted file paths
 */
export function cleanupLogFiles(
  logDir?: string | null,
  options: CleanupOptions = {}
): string[] {
  const {
    now = defaultClock(),
    prefix = LOG_FILE_PREFIX,
    maxRetentionDays = MAX_RETENTION_DAYS,
    maxTotalSizeBytes = MAX_TOTAL_SIZE_BYTES,
  } = options;
  
  const resolvedLogDir = logDir ?? getLogDir();
  
  // Ensure directory exists
  if (!fs.existsSync(resolvedLogDir)) {
    fs.mkdirSync(resolvedLogDir, { recursive: true });
  }
  
  const deletedFiles: string[] = [];
  
  // Calculate cutoff date (keep files from keepAfter onwards)
  // Python: keep_after = current.date() - timedelta(days=max_retention_days - 1)
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const keepAfter = new Date(nowDate);
  keepAfter.setDate(keepAfter.getDate() - (maxRetentionDays - 1));
  
  // Phase 1: Remove files older than retention window
  const keptFiles: string[] = [];
  const managedFiles = listManagedLogFiles(resolvedLogDir, { prefix });
  
  for (const filePath of managedFiles) {
    const fileDate = extractLogDate(filePath, prefix);
    if (fileDate === null) {
      continue;
    }
    
    // Compare dates (normalize to midnight)
    const fileDateNormalized = new Date(fileDate.getFullYear(), fileDate.getMonth(), fileDate.getDate());
    
    if (fileDateNormalized < keepAfter) {
      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
        // File already deleted, continue
      }
    } else {
      keptFiles.push(filePath);
    }
  }
  
  // Phase 2: Check total size and delete oldest if needed
  const sizedFiles: Array<{ path: string; size: number }> = [];
  let totalSize = 0;
  
  for (const filePath of keptFiles) {
    try {
      const stats = fs.statSync(filePath);
      sizedFiles.push({ path: filePath, size: stats.size });
      totalSize += stats.size;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      // File already deleted, skip
    }
  }
  
  // Delete oldest files until within size limit (keep at least one)
  while (totalSize > maxTotalSizeBytes && sizedFiles.length > 1) {
    const oldest = sizedFiles.shift()!;
    try {
      fs.unlinkSync(oldest.path);
      deletedFiles.push(oldest.path);
      totalSize -= oldest.size;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      // File already deleted, update total and continue
      totalSize -= oldest.size;
    }
  }
  
  return deletedFiles;
}

// ============================================================================
// DailyRetentionFileHandler Class
// ============================================================================

/**
 * Write logs to a single file per day and apply retention cleanup
 */
export class DailyRetentionFileHandler extends Writable {
  private _logDir: string;
  private _prefix: string;
  private _maxRetentionDays: number;
  private _maxTotalSizeBytes: number;
  private _cleanupInterval: number; // in milliseconds
  private _encoding: BufferEncoding;
  private _clock: Clock;
  private _currentPath: string | null = null;
  private _fd: number | null = null; // File descriptor for synchronous writes
  private _nextCleanupAt: Date | null = null;

  constructor(options: {
    logDir?: string;
    prefix?: string;
    maxRetentionDays?: number;
    maxTotalSizeBytes?: number;
    cleanupIntervalSeconds?: number;
    encoding?: BufferEncoding;
    clock?: Clock;
  } = {}) {
    super({ objectMode: false });
    
    this._logDir = options.logDir ?? getLogDir();
    this._prefix = options.prefix ?? LOG_FILE_PREFIX;
    this._maxRetentionDays = options.maxRetentionDays ?? MAX_RETENTION_DAYS;
    this._maxTotalSizeBytes = options.maxTotalSizeBytes ?? MAX_TOTAL_SIZE_BYTES;
    this._cleanupInterval = Math.max(1, options.cleanupIntervalSeconds ?? 60) * 1000;
    this._encoding = options.encoding ?? 'utf-8';
    this._clock = options.clock ?? defaultClock;
    
    // Ensure log directory exists
    if (!fs.existsSync(this._logDir)) {
      fs.mkdirSync(this._logDir, { recursive: true });
    }
    
    // Open initial file and run cleanup
    this._openIfNeeded();
    this._runCleanup({ force: true });
  }

  /**
   * Return the active daily log file path
   */
  get currentPath(): string {
    this._openIfNeeded();
    if (this._currentPath === null) {
      throw new Error('Current path is null');
    }
    return this._currentPath;
  }

  /**
   * Write a chunk of data to the stream
   */
  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      this._openIfNeeded();
      
      if (this._fd === null) {
        callback();
        return;
      }
      
      const str = typeof chunk === 'string' ? chunk : chunk.toString(this._encoding);
      
      // Write synchronously to ensure file is created immediately
      fs.writeSync(this._fd, str);
      
      this._runCleanup();
      callback();
    } catch (err) {
      this.emit('error', err);
      callback(err as Error);
    }
  }

  /**
   * Flush the active file stream
   */
  flush(): void {
    if (this._fd !== null) {
      try {
        fs.fdatasyncSync(this._fd);
      } catch {
        // Ignore flush errors
      }
    }
  }

  /**
   * Close the active file stream
   */
  close(): void {
    if (this._fd !== null) {
      try {
        fs.closeSync(this._fd);
      } catch {
        // Ignore close errors
      }
      this._fd = null;
    }
    this._currentPath = null;
  }

  /**
   * Open or roll over the active daily file
   */
  private _openIfNeeded(): void {
    const nextPath = getLogFilePath(
      this._logDir,
      { now: this._clock(), prefix: this._prefix }
    );
    
    if (nextPath === this._currentPath && this._fd !== null) {
      return;
    }
    
    // Close existing file descriptor
    if (this._fd !== null) {
      try {
        fs.closeSync(this._fd);
      } catch {
        // Ignore close errors
      }
      this._fd = null;
    }
    
    // Ensure directory exists
    const dir = path.dirname(nextPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Open file synchronously - this ensures the file is created immediately
    this._fd = fs.openSync(nextPath, 'a');
    this._currentPath = nextPath;
  }

  /**
   * Run periodic retention cleanup
   */
  private _runCleanup(options: { force?: boolean } = {}): void {
    const { force = false } = options;
    const current = this._clock();
    
    if (!force && this._nextCleanupAt !== null && current < this._nextCleanupAt) {
      return;
    }
    
    cleanupLogFiles(this._logDir, {
      now: current,
      prefix: this._prefix,
      maxRetentionDays: this._maxRetentionDays,
      maxTotalSizeBytes: this._maxTotalSizeBytes,
    });
    
    this._nextCleanupAt = new Date(current.getTime() + this._cleanupInterval);
  }
}

// ============================================================================
// Stdio Mirroring
// ============================================================================

/**
 * Mirror writes to the original stream and to a file-only logger
 */
class TeeToLogger {
  private _originalStream: NodeJS.WriteStream;
  private _buffer: string = '';
  private _isWritingLog: boolean = false;

  constructor(
    originalStream: NodeJS.WriteStream,
    private _writeToLog: (text: string) => void
  ) {
    this._originalStream = originalStream;
  }

  write(data: string): boolean {
    // Write to original stream
    const result = this._originalStream.write(data);
    
    // Buffer for logging
    this._buffer += data;
    this._flushCompleteLines();
    
    return result;
  }

  flush(): void {
    this._flushBuffer();
    // Node.js WriteStream doesn't have a flush method
    // The data is already written to the stream
  }

  private _flushCompleteLines(): void {
    while (this._buffer.includes('\n')) {
      const [line, ...rest] = this._buffer.split('\n');
      this._buffer = rest.join('\n');
      this._logLine(line);
    }
  }

  private _flushBuffer(): void {
    if (this._buffer) {
      const pending = this._buffer;
      this._buffer = '';
      this._logLine(pending);
    }
  }

  private _logLine(line: string): void {
    const text = line.trimEnd();
    if (!text || this._isWritingLog) {
      return;
    }
    
    try {
      this._isWritingLog = true;
      this._writeToLog(text);
    } finally {
      this._isWritingLog = false;
    }
  }
}

// ============================================================================
// Logging Configuration
// ============================================================================

// Global state for stdio mirroring
let _stdioMirrorInstalled = false;
let _originalStdout: NodeJS.WriteStream | null = null;
let _originalStderr: NodeJS.WriteStream | null = null;
let _logWriter: ((text: string) => void) | null = null;

/**
 * Restore the original process standard streams
 */
function restoreStdio(): void {
  if (_originalStdout && _originalStderr) {
    _stdioMirrorInstalled = false;
  }
}

/**
 * Configure stdio mirroring to write to the log file
 */
function configureStdioMirroring(writeToLog: ((text: string) => void) | null): void {
  if (writeToLog === null) {
    restoreStdio();
    return;
  }
  
  _logWriter = writeToLog;
  
  if (!_stdioMirrorInstalled) {
    _originalStdout = process.stdout;
    _originalStderr = process.stderr;
    
    // Note: We can't replace process.stdout/stderr in Node.js
    // Instead, users should use the logger directly
    _stdioMirrorInstalled = true;
  }
}

/**
 * Simple logger interface for stdio mirroring
 */
export class SimpleLogger {
  constructor(private _writeFn: (text: string) => void) {}
  
  info(message: string): void {
    this._writeFn(`[INFO] ${message}`);
  }
  
  error(message: string): void {
    this._writeFn(`[ERROR] ${message}`);
  }
  
  warn(message: string): void {
    this._writeFn(`[WARN] ${message}`);
  }
  
  debug(message: string): void {
    this._writeFn(`[DEBUG] ${message}`);
  }
}

// ============================================================================
// Main Configuration Function
// ============================================================================

let _configuredFileHandler: DailyRetentionFileHandler | null = null;

/**
 * Configure root logging with a daily file handler under <DATA_DIR>/logs
 * 
 * When `mirrorStdio` is True, stdout/stderr writes (including `print`)
 * are mirrored into the managed daily log file while still being emitted
 * to the original terminal streams.
 * 
 * @param options - Configuration options
 * @returns Path to the current log file
 */
export function configureLogging(options: ConfigureLoggingOptions = {}): string {
  const {
    level = 'info',
    consoleLevel = 'info',
    force = false,
    config = null,
    prefix = LOG_FILE_PREFIX,
    mirrorStdio = false,
  } = options;
  
  const logDir = getLogDir(config ?? undefined);
  const levelValue = getLogLevelValue(level);
  const consoleLevelValue = consoleLevel !== null ? getLogLevelValue(consoleLevel) : null;
  
  // Handle force reconfiguration
  if (force && _configuredFileHandler !== null) {
    _configuredFileHandler.close();
    _configuredFileHandler = null;
  }
  
  // Create file handler if needed
  if (_configuredFileHandler === null) {
    _configuredFileHandler = new DailyRetentionFileHandler({
      logDir,
      prefix,
    });
    
    // Set up log writer for stdio mirroring
    _logWriter = (text: string) => {
      if (_configuredFileHandler) {
        _configuredFileHandler.write(text + '\n');
      }
    };
  }
  
  // Configure console output (note: Node.js doesn't support console interception like Python)
  if (consoleLevelValue === null) {
    // Disable console output (just log to file)
  } else {
    // Enable console output - users should use the logger directly
  }
  
  // Configure stdio mirroring
  configureStdioMirroring(mirrorStdio ? _logWriter : null);
  
  return getLogFilePath(logDir, { prefix });
}

/**
 * Get a logger instance for a specific module
 * 
 * @param name - Logger name (typically __filename or module name)
 * @returns SimpleLogger instance
 */
export function getLogger(name: string): SimpleLogger {
  return new SimpleLogger((text: string) => {
    if (_configuredFileHandler) {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      _configuredFileHandler.write(`${timestamp} [INFO] ${name}: ${text}\n`);
    }
  });
}
