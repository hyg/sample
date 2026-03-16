/**
 * Handle-to-DID resolution via .well-known/handle endpoint.
 *
 * 移植自：python/scripts/utils/resolve.py
 *
 * 功能：
 * - resolveToDid(): 将 Handle 或 DID 解析为 DID
 *
 * [PROTOCOL]:
 * 1. 如果 identifier 以 "did:" 开头，直接返回（不发起 HTTP 请求）
 * 2. 移除已知的 awiki 域名后缀（awiki.ai, awiki.test, config.did_domain）
 * 3. 调用 GET /user-service/.well-known/handle/{identifier}
 * 4. 检查状态码：404 -> "Handle not found"
 * 5. 检查 status 字段：非 "active" -> "Handle not active"
 * 6. 检查 did 字段：空 -> "No DID binding"
 */

import type { SDKConfig } from './types.js';
import {
  WELL_KNOWN_HANDLE_PATH,
  DEFAULT_TIMEOUT_MS,
  KNOWN_AWIKI_DOMAINS,
} from './types.js';
import { HttpClientImpl, _resolveVerify } from '@awiki/client';
import { SDKConfig as ConfigLoader } from '@awiki/config';

/**
 * Handle 解析响应接口（内联定义，避免循环依赖）
 */
interface HandleResolveResponse {
  handle: string;
  did: string;
  status: string;
}

/**
 * 解析 DID 或 Handle 为 DID
 *
 * 对应 Python: resolve_to_did()
 *
 * 逻辑：
 * 1. 如果 identifier 以 "did:" 开头，直接返回
 * 2. 移除已知的 awiki 域名后缀（awiki.ai, awiki.test, config.did_domain）
 * 3. 调用 GET /user-service/.well-known/handle/{identifier}
 * 4. 检查状态码：404 -> "Handle not found"
 * 5. 检查 status 字段：非 "active" -> "Handle not active"
 * 6. 检查 did 字段：空 -> "No DID binding"
 *
 * @param identifier - DID 字符串或 Handle 本地部分（如 "alice" 或 "alice.awiki.ai"）
 * @param config - SDKConfig 用于服务 URL。使用默认值如果为 null
 * @returns 解析后的 DID 字符串
 * @throws {Error} 当 Handle 未找到、状态非 active 或无 DID 绑定时抛出
 *
 * @example
 * ```typescript
 * // DID 直接返回
 * const did1 = await resolveToDid('did:wba:awiki.ai:user:k1_...');
 *
 * // Handle 解析
 * const did2 = await resolveToDid('alice');
 *
 * // 带域名后缀的 Handle 自动剥离
 * const did3 = await resolveToDid('alice.awiki.ai');
 * ```
 */
export async function resolveToDid(
  identifier: string,
  config: SDKConfig | null = null
): Promise<string> {
  // 已是 DID，直接返回
  if (identifier.startsWith('did:')) {
    return identifier;
  }

  // 使用默认配置如果未提供
  if (config === null) {
    config = ConfigLoader.load();
  }

  // 构建已知域名集合
  // 顺序：先检查 awiki.ai, awiki.test，再检查 config.did_domain
  const stripDomains = new Set<string>(KNOWN_AWIKI_DOMAINS);
  if (config.did_domain) {
    stripDomains.add(config.did_domain);
  }

  // 剥离域名后缀（如果匹配）
  let handle = identifier;
  for (const domain of stripDomains) {
    const suffix = `.${domain}`;
    if (handle.endsWith(suffix)) {
      handle = handle.slice(0, -suffix.length);
      break;
    }
  }

  // 创建 HTTP 客户端（10 秒超时，不使用认证）
  const verifyConfig = _resolveVerify(config.user_service_url);
  const client = new HttpClientImpl(
    config.user_service_url,
    verifyConfig,
    DEFAULT_TIMEOUT_MS
  );

  try {
    // 调用 .well-known/handle 端点（公共端点，无需认证）
    const response = await client.get<HandleResolveResponse>(
      WELL_KNOWN_HANDLE_PATH + '/' + handle
    );

    const data = response;

    // 检查 status 字段：非 "active" -> "Handle not active"
    const status = data.status || '';
    if (status !== 'active') {
      throw new Error(
        `Handle '${handle}' is not active (status: ${status})`
      );
    }

    // 检查 did 字段：空 -> "No DID binding"
    const did = data.did || '';
    if (!did) {
      throw new Error(`Handle '${handle}' has no DID binding`);
    }

    return did;
  } catch (error) {
    // 检查是否为 404 错误
    if (error instanceof Error && error.message.includes('HTTP 404')) {
      throw new Error(`Handle '${handle}' not found`);
    }
    throw error;
  } finally {
    // 关闭客户端连接
    client.close();
  }
}

// 默认导出
export default {
  resolveToDid,
};
