/**
 * DID Identity 模块导出
 *
 * 移植自：python/scripts/utils/identity.py
 *
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

export {
  DIDIdentity,
  create_identity,
  load_private_key,
} from './identity.js';

export type {
  DIDIdentityData,
  CreateIdentityOptions,
  KeyPair,
  DidDocumentWithKeys,
} from './types.js';
