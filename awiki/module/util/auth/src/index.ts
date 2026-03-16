/**
 * Auth 模块入口
 *
 * DID WBA 认证模块 - 注册、文档更新、JWT 获取、一站式身份创建
 *
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

export {
  generate_wba_auth_header,
  register_did,
  update_did_document,
  get_jwt_via_wba,
  create_authenticated_identity,
} from './auth.js';

export type {
  RegisterDidOptions,
  UpdateDidDocumentOptions,
  CreateAuthenticatedIdentityOptions,
  RegisterResult,
  UpdateResult,
  SignCallback,
  GenerateAuthHeaderOptions,
} from './types.js';
