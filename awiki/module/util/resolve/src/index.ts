/**
 * resolve 模块导出
 *
 * Handle-to-DID resolution via .well-known/handle endpoint.
 *
 * 移植自：python/scripts/utils/resolve.py
 */

export { resolveToDid } from './resolve.js';
export type {
  SDKConfig,
  HandleResolveResponse,
} from './types.js';
export {
  WELL_KNOWN_HANDLE_PATH,
  DEFAULT_TIMEOUT_MS,
  KNOWN_AWIKI_DOMAINS,
} from './types.js';

// 默认导出
import resolveModule from './resolve.js';
export default resolveModule;
