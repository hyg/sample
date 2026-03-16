/**
 * resolve 模块类型定义
 *
 * 移植自：python/scripts/utils/resolve.py
 */

import type { SDKConfig } from '@awiki/config';

/**
 * Handle 解析响应接口
 *
 * 对应 Python 响应格式：
 * {"handle": "...", "did": "...", "status": "active"}
 */
export interface HandleResolveResponse {
  /** Handle 本地部分 */
  handle: string;
  /** 绑定的 DID */
  did: string;
  /** Handle 状态（"active" 表示活跃） */
  status: string;
}

/**
 * 导出所有类型
 */
export type { SDKConfig };

/**
 * 导出常量
 */
/** .well-known/handle 端点路径前缀 */
export const WELL_KNOWN_HANDLE_PATH = '/user-service/.well-known/handle';

/** 默认超时时间（秒） */
export const DEFAULT_TIMEOUT_MS = 10000;

/** 已知 awiki 域名列表 */
export const KNOWN_AWIKI_DOMAINS = ['awiki.ai', 'awiki.test'] as const;
