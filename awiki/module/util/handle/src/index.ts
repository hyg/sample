/**
 * Handle 模块导出
 *
 * 移植自：python/scripts/utils/handle.py
 */

// 从 handle.js 导出函数
export {
  sanitizeOtp,
  normalizePhone,
  sendOtp,
  registerHandle,
  recoverHandle,
  resolveHandle,
  lookupHandle,
} from './handle.js';

// 从 types.js 导出常量
export {
  HANDLE_RPC,
  DID_AUTH_RPC,
  DEFAULT_COUNTRY_CODE,
} from './types.js';

// 重新导出类型
export type {
  DIDIdentity,
  SDKConfig,
  AsyncClient,
  SendOtpResult,
  RegisterHandleOptions,
  RecoverHandleOptions,
  ResolveHandleResult,
  LookupHandleResult,
} from './types.js';
