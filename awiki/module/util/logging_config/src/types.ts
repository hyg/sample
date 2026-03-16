/**
 * logging_config 模块类型定义
 *
 * [INPUT]: SDKConfig (data_dir), logging records, local wall clock time
 * [OUTPUT]: Type definitions for logging utilities
 * [POS]: Shared runtime logging module for CLI scripts and background listeners
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

/**
 * SDKConfig 接口（用于兼容 Python SDKConfig）
 */
export interface SDKConfig {
  readonly data_dir: string;
  readonly credentials_dir: string;
  readonly user_service_url: string;
  readonly molt_message_url: string;
  readonly molt_message_ws_url: string | null;
  readonly did_domain: string;
}

/**
 * 时钟函数类型
 */
export type Clock = () => Date;

/**
 * 日志级别类型
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'warning' | 'error' | 'critical';

/**
 * DailyRetentionFileHandler 配置选项
 */
export interface DailyRetentionFileHandlerOptions {
  /** 日志目录路径 */
  logDir?: string;
  /** 日志文件前缀 */
  prefix?: string;
  /** 最大保留天数 */
  maxRetentionDays?: number;
  /** 最大总大小（字节） */
  maxTotalSizeBytes?: number;
  /** 清理间隔（秒） */
  cleanupIntervalSeconds?: number;
  /** 文件编码 */
  encoding?: BufferEncoding;
  /** 时钟函数 */
  clock?: Clock;
}

/**
 * cleanupLogFiles 函数选项
 */
export interface CleanupOptions {
  /** 当前时间 */
  now?: Date;
  /** 日志文件前缀 */
  prefix?: string;
  /** 最大保留天数 */
  maxRetentionDays?: number;
  /** 最大总大小（字节） */
  maxTotalSizeBytes?: number;
}

/**
 * getLogFilePath 函数选项
 */
export interface GetLogFilePathOptions {
  /** 当前时间 */
  now?: Date;
  /** 日志文件前缀 */
  prefix?: string;
}

/**
 * configureLogging 函数选项
 */
export interface ConfigureLoggingOptions {
  /** 日志级别 */
  level?: LogLevel | number;
  /** 控制台日志级别 */
  consoleLevel?: LogLevel | number | null;
  /** 强制重新配置 */
  force?: boolean;
  /** SDK 配置 */
  config?: SDKConfig | null;
  /** 日志文件前缀 */
  prefix?: string;
  /** 镜像标准输出 */
  mirrorStdio?: boolean;
}

/**
 * ISDKConfig 接口（别名，用于兼容）
 */
export interface ISDKConfig extends SDKConfig {}
