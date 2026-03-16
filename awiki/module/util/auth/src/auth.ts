/**
 * DID WBA 认证模块
 *
 * 移植自：python/scripts/utils/auth.py
 *
 * 功能：
 * - generate_wba_auth_header(): 生成 DID WBA 认证头
 * - register_did(): DID 身份注册
 * - update_did_document(): DID 文档更新
 * - get_jwt_via_wba(): JWT 获取
 * - create_authenticated_identity(): 一站式身份创建
 *
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

import crypto from 'crypto';
import type { KeyObject } from 'crypto';
import type { AsyncClient } from '@awiki/client';
import { DIDIdentity } from '@awiki/identity';
import { SDKConfig } from '@awiki/config';
import { rpc_call } from '@awiki/rpc';
import type {
  RegisterDidOptions,
  UpdateDidDocumentOptions,
  CreateAuthenticatedIdentityOptions,
  RegisterResult,
  UpdateResult,
  SignCallback,
} from './types.js';

/**
 * 创建 secp256k1 签名回调
 *
 * 对应 Python: _secp256k1_sign_callback()
 *
 * ANP generate_auth_header 需要 sign_callback(content: bytes, vm_fragment: str) -> bytes，
 * 返回 DER 编码的签名。
 *
 * @param privateKey - secp256k1 私钥
 * @returns 签名回调函数
 */
function _secp256k1_sign_callback(privateKey: KeyObject): SignCallback {
  return function _callback(content: Buffer, verificationMethodFragment: string): Buffer {
    // 使用 SHA256 哈希和 secp256k1 私钥签名
    // crypto.sign() 返回 DER 编码的签名
    const signature = crypto.sign('sha256', content, privateKey);
    return signature;
  };
}

/**
 * 生成 DID WBA 认证头
 *
 * 对应 Python: generate_wba_auth_header()
 *
 * 认证头格式：DIDWba {did}:{signature}:{timestamp}
 *
 * @param identity - DID 身份对象
 * @param serviceDomain - 目标服务域名
 * @returns Authorization 头值（DIDWba 格式）
 */
export async function generate_wba_auth_header(
  identity: DIDIdentity,
  serviceDomain: string
): Promise<string> {
  const privateKey = identity.get_private_key();
  const signCallback = _secp256k1_sign_callback(privateKey);

  // 构建签名内容
  // 对应 Python anp.authentication.generate_auth_header 的逻辑
  const did = identity.did;
  const timestamp = Date.now().toString();

  // 签名内容：{did}:{timestamp}
  const contentToSign = `${did}:${timestamp}`;
  const contentBuffer = Buffer.from(contentToSign, 'utf-8');

  // 获取验证方法片段（从 DID 提取 unique_id）
  const vmFragment = identity.unique_id;

  // 调用签名回调
  const signature = await signCallback(contentBuffer, vmFragment);

  // Base64URL 编码签名（不带填充）
  const signatureBase64Url = signature.toString('base64url').replace(/=/g, '');

  // 构建认证头：DIDWba {did}:{signature}:{timestamp}
  return `DIDWba ${did}:${signatureBase64Url}:${timestamp}`;
}

/**
 * 注册 DID 身份
 *
 * 对应 Python: register_did()
 *
 * 发送 identity.did_document 直接（已包含 ANP 生成的认证证明），
 * 调用 user-service 的 did-auth.register 方法通过 JSON-RPC。
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param identity - DID 身份（did_document 已包含认证证明）
 * @param options - 可选参数
 * @returns 注册结果字典（包含 did, user_id, message）
 * @throws {JsonRpcError} 当注册失败时
 * @throws {Error} HTTP 层错误时抛出
 */
export async function register_did(
  client: AsyncClient,
  identity: DIDIdentity,
  options: RegisterDidOptions = {}
): Promise<RegisterResult> {
  const {
    name = null,
    isPublic = false,
    isAgent = false,
    role = null,
    endpointUrl = null,
    description = null,
  } = options;

  // 构建请求载荷
  const payload: Record<string, unknown> = { did_document: identity.did_document };
  if (name !== null) {
    payload.name = name;
  }
  if (isPublic) {
    payload.is_public = true;
  }
  if (isAgent) {
    payload.is_agent = true;
  }
  if (role !== null) {
    payload.role = role;
  }
  if (endpointUrl !== null) {
    payload.endpoint_url = endpointUrl;
  }
  if (description !== null) {
    payload.description = description;
  }

  return rpc_call(
    client,
    '/user-service/did-auth/rpc',
    'register',
    payload
  ) as Promise<RegisterResult>;
}

/**
 * 通过 DID WBA 认证更新现有 DID 文档
 *
 * 对应 Python: update_did_document()
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param identity - 包含更新后 didDocument 的 DID 身份
 * @param domain - 用于 DID WBA 认证的服务域名
 * @param options - 可选参数
 * @returns 更新结果字典（包含 did, user_id, message, 可选 access_token）
 * @throws {JsonRpcError} 当服务器返回 JSON-RPC 错误时
 * @throws {Error} HTTP 层错误时抛出
 */
export async function update_did_document(
  client: AsyncClient,
  identity: DIDIdentity,
  domain: string,
  options: UpdateDidDocumentOptions = {}
): Promise<UpdateResult> {
  const {
    isPublic = false,
    isAgent = false,
    role = null,
    endpointUrl = null,
  } = options;

  // 构建请求载荷
  const payload: Record<string, unknown> = { did_document: identity.did_document };
  if (isPublic) {
    payload.is_public = true;
  }
  if (isAgent) {
    payload.is_agent = true;
  }
  if (role !== null) {
    payload.role = role;
  }
  if (endpointUrl !== null) {
    payload.endpoint_url = endpointUrl;
  }

  // 生成认证头
  const authHeader = await generate_wba_auth_header(identity, domain);

  // 发送请求
  const response = await client.post('/user-service/did-auth/rpc', {
    jsonrpc: '2.0' as const,
    method: 'update_document',
    params: payload,
    id: 1,
  }, {
    headers: { Authorization: authHeader },
  });

  // 检查响应状态
  const statusCode = (response as any).status_code ?? (response as any).statusCode;
  if (statusCode >= 400) {
    throw new Error(`HTTP ${statusCode}: ${(response as any).statusText ?? 'Unknown error'}`);
  }

  // 解析响应体
  const body = response as any;

  // 检查 JSON-RPC 错误
  if (body.error !== undefined && body.error !== null) {
    const error = body.error;
    const err = new Error(`JSON-RPC error ${error.code}: ${error.message}`);
    (err as any).code = error.code;
    (err as any).data = error.data;
    throw err;
  }

  const result: UpdateResult = body.result;

  // 从响应头获取 access_token（如果存在）
  // 优先级：响应体 access_token > 响应头 Authorization: Bearer {token}
  const respHeaders = (response as any).headers ?? {};
  const authHeaderValue = respHeaders.authorization ?? respHeaders.Authorization ?? '';

  if (authHeaderValue.toLowerCase().startsWith('bearer ') && !result.access_token) {
    result.access_token = authHeaderValue.split(' ', 2)[1];
  }

  return result;
}

/**
 * 通过 DID WBA 签名获取 JWT 令牌
 *
 * 对应 Python: get_jwt_via_wba()
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param identity - DID 身份
 * @param domain - 服务域名
 * @returns JWT access token 字符串
 */
export async function get_jwt_via_wba(
  client: AsyncClient,
  identity: DIDIdentity,
  domain: string
): Promise<string> {
  const authHeader = await generate_wba_auth_header(identity, domain);
  const result = await rpc_call(
    client,
    '/user-service/did-auth/rpc',
    'verify',
    { authorization: authHeader, domain }
  );
  return (result as any).access_token;
}

/**
 * 一站式创建完整的 DID 身份（生成密钥 -> 注册 -> 获取 JWT）
 *
 * 对应 Python: create_authenticated_identity()
 *
 * 使用密钥绑定 DID：公钥指纹自动成为 DID 路径的最后一段
 * (k1_{fp})，不需要手动 unique_id。path_prefix 固定为
 * ["user"]（服务器要求）。
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param config - SDK 配置
 * @param options - 可选参数
 * @returns DIDIdentity 实例（包含 user_id 和 jwt_token）
 */
export async function create_authenticated_identity(
  client: AsyncClient,
  config: SDKConfig,
  options: CreateAuthenticatedIdentityOptions = {}
): Promise<DIDIdentity> {
  const {
    name = null,
    isPublic = false,
    isAgent = false,
    role = null,
    endpointUrl = null,
    services = null,
  } = options;

  // 1. 创建密钥绑定 DID 身份（带认证证明，绑定到服务域名）
  //    path_prefix 固定为 ["user"]：服务器要求 DID 格式 did:wba:{domain}:user:{id}
  const { create_identity } = await import('@awiki/identity');
  const identity = create_identity({
    hostname: config.did_domain,
    path_prefix: ['user'],
    proof_purpose: 'authentication',
    domain: config.did_domain,
    services,
  });

  // 2. 注册（直接发送 ANP 生成的文档）
  const regResult = await register_did(client, identity, {
    name,
    isPublic,
    isAgent,
    role,
    endpointUrl,
  });
  identity.user_id = regResult.user_id;

  // 3. 获取 JWT
  identity.jwt_token = await get_jwt_via_wba(client, identity, config.did_domain);

  return identity;
}

// 默认导出
export default {
  generate_wba_auth_header,
  register_did,
  update_did_document,
  get_jwt_via_wba,
  create_authenticated_identity,
};
