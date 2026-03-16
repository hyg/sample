/**
 * logging_config 模块主入口
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

export {
  // Constants
  LOG_FILE_PREFIX,
  MAX_RETENTION_DAYS,
  MAX_TOTAL_SIZE_BYTES,
  
  // Core functions
  getLogDir,
  getLogFilePath,
  cleanupLogFiles,
  findLatestLogFile,
  
  // Classes
  DailyRetentionFileHandler,
  SimpleLogger,
  
  // Configuration
  configureLogging,
  getLogger,
} from './logging.js';

// Re-export types
export type {
  Clock,
  LogLevel,
  DailyRetentionFileHandlerOptions,
  CleanupOptions,
  GetLogFilePathOptions,
  ConfigureLoggingOptions,
  SDKConfig,
  ISDKConfig,
} from './types.js';
