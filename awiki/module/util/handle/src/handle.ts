/**
 * Handle (short name) registration and resolution utilities
 *
 * 移植自：python/scripts/utils/handle.py
 *
 * 功能：
 * - normalizePhone(): 电话号码格式化
 * - sanitizeOtp(): OTP 代码清理
 * - sendOtp(): 发送 OTP 验证码
 * - registerHandle(): 一站式 Handle 注册
 * - recoverHandle(): Handle 恢复
 * - resolveHandle(): Handle 解析
 * - lookupHandle(): 通过 DID 查找 Handle
 */

import type {
  AsyncClient,
  SDKConfig,
  DIDIdentity,
  SendOtpResult,
  RegisterHandleOptions,
  RecoverHandleOptions,
  ResolveHandleResult,
  LookupHandleResult,
} from './types.js';
import {
  HANDLE_RPC,
  DID_AUTH_RPC,
  DEFAULT_COUNTRY_CODE,
} from './types.js';
import { rpc_call, JsonRpcError } from '@awiki/rpc';
import { create_identity } from '@awiki/identity';
import { get_jwt_via_wba } from '@awiki/auth';

/**
 * 国际电话号码格式正则：+{country_code}{number}
 * 国家代码 1-3 位，号码 6-14 位
 */
const PHONE_INTL_RE = /^\+\d{1,3}\d{6,14}$/;

/**
 * 中国本地电话号码格式正则：11 位，1 开头，第二位 3-9
 */
const PHONE_CN_LOCAL_RE = /^1[3-9]\d{9}$/;

/**
 * 清理 OTP 验证码（移除所有空白字符）
 *
 * 对应 Python: _sanitize_otp()
 *
 * @param code - OTP 验证码
 * @returns 清理后的 OTP 代码
 */
export function sanitizeOtp(code: string): string {
  // 移除所有空白字符（空格、换行、制表符）
  return code.replace(/\s+/g, '');
}

/**
 * 标准化电话号码为国际格式
 *
 * 对应 Python: normalize_phone()
 *
 * 规则：
 * - 已是国际格式 (+XX...) -> 验证后原样返回
 * - 中国本地格式 (1XXXXXXXXXX) -> 自动添加 +86 前缀
 * - 其他格式 -> 抛出 ValueError
 *
 * @param phone - 电话号码
 * @returns 国际格式电话号码（如 +8613800138000）
 * @throws {Error} 当电话号码格式无效时
 */
export function normalizePhone(phone: string): string {
  phone = phone.trim();

  // 已是国际格式
  if (phone.startsWith('+')) {
    if (PHONE_INTL_RE.test(phone)) {
      return phone;
    }
    throw new Error(
      `Invalid international phone number: ${phone}. ` +
      `Expected format: +<country_code><number> (e.g., +8613800138000, +14155552671). ` +
      `Please check the country code.`
    );
  }

  // 中国本地格式
  if (PHONE_CN_LOCAL_RE.test(phone)) {
    return `${DEFAULT_COUNTRY_CODE}${phone}`;
  }

  throw new Error(
    `Invalid phone number: ${phone}. ` +
    `Use international format with country code: +<country_code><number> ` +
    `(e.g., +8613800138000 for China, +14155552671 for US). ` +
    `China local numbers (11 digits starting with 1) are auto-prefixed with +86.`
  );
}

/**
 * 发送 OTP 验证码用于 Handle 注册
 *
 * 对应 Python: send_otp()
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param phone - 电话号码（国际格式或中国本地格式）
 * @returns RPC 结果字典
 * @throws {Error} 电话号码格式无效时抛出
 * @throws {JsonRpcError} 发送失败时抛出（可能表示国家代码错误）
 */
export async function sendOtp(
  client: AsyncClient,
  phone: string
): Promise<SendOtpResult> {
  const normalized = normalizePhone(phone);
  try {
    return await rpc_call(
      client,
      HANDLE_RPC,
      'send_otp',
      { phone: normalized }
    ) as unknown as SendOtpResult;
  } catch (error) {
    if (error instanceof JsonRpcError) {
      throw new JsonRpcError(
        error.code,
        `${error.message}. Please verify the phone number and country code (current: ${normalized}).`,
        error.data
      );
    }
    throw error;
  }
}

/**
 * 一站式 Handle 注册：创建身份 -> 注册 DID -> 获取 JWT
 *
 * 对应 Python: register_handle()
 *
 * 创建带 Handle 作为路径前缀的密钥绑定 DID
 * （如 did:wba:awiki.ai:alice:k1_<fp>），
 * 然后调用 did_auth.register 进行注册。
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param config - SDK 配置
 * @param phone - 电话号码（国际格式，如 +8613800138000）
 * @param otpCode - OTP 验证码
 * @param handle - Handle 本地部分（如 "alice"）
 * @param options - 可选参数
 * @returns DIDIdentity 实例（包含 user_id 和 jwtToken）
 * @throws {Error} 电话号码格式无效时抛出
 * @throws {JsonRpcError} 注册失败时抛出
 */
export async function registerHandle(
  client: AsyncClient,
  config: SDKConfig,
  phone: string,
  otpCode: string,
  handle: string,
  options: RegisterHandleOptions = {}
): Promise<DIDIdentity> {
  const {
    inviteCode = null,
    name = null,
    isPublic = false,
    services = null,
  } = options;

  const normalized = normalizePhone(phone);

  // 1. 创建带 Handle 前缀的 DID 身份
  const identity = create_identity({
    hostname: config.did_domain,
    path_prefix: [handle],
    proof_purpose: 'authentication',
    domain: config.did_domain,
    services: services ?? undefined,
  });

  // 2. 构建注册载荷
  const payload: Record<string, unknown> = {
    did_document: identity.did_document,
    handle,
    phone: normalized,
    otp_code: sanitizeOtp(otpCode),
  };

  if (inviteCode !== null) {
    payload.invite_code = inviteCode;
  }
  if (name !== null) {
    payload.name = name;
  }
  if (isPublic) {
    payload.is_public = true;
  }

  const regResult = await rpc_call(
    client,
    DID_AUTH_RPC,
    'register',
    payload
  ) as any;

  identity.user_id = regResult.user_id;

  // 3. 注册返回 access_token（Handle 模式）
  if (regResult.access_token) {
    identity.jwt_token = regResult.access_token;
  } else {
    identity.jwt_token = await get_jwt_via_wba(client, identity, config.did_domain);
  }

  return identity;
}

/**
 * 恢复 Handle（重新绑定到新生成的 DID）
 *
 * 对应 Python: recover_handle()
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param config - SDK 配置
 * @param phone - 电话号码（国际格式）
 * @param otpCode - OTP 验证码
 * @param handle - Handle 名称
 * @param options - 可选参数
 * @returns [DIDIdentity, 恢复结果] 元组
 * @throws {Error} 电话号码格式无效时抛出
 * @throws {JsonRpcError} 恢复失败时抛出
 */
export async function recoverHandle(
  client: AsyncClient,
  config: SDKConfig,
  phone: string,
  otpCode: string,
  handle: string,
  options: RecoverHandleOptions = {}
): Promise<[DIDIdentity, Record<string, unknown>]> {
  const { services = null } = options;
  const normalized = normalizePhone(phone);

  // 创建带 Handle 前缀的新 DID 身份
  const identity = create_identity({
    hostname: config.did_domain,
    path_prefix: [handle],
    proof_purpose: 'authentication',
    domain: config.did_domain,
    services: services ?? undefined,
  });

  // 构建恢复载荷
  const payload: Record<string, unknown> = {
    did_document: identity.did_document,
    handle,
    phone: normalized,
    otp_code: sanitizeOtp(otpCode),
  };

  const recoverResult = await rpc_call(
    client,
    DID_AUTH_RPC,
    'recover_handle',
    payload
  ) as Record<string, unknown>;

  identity.user_id = recoverResult.user_id as string;

  // 获取 JWT
  if (recoverResult.access_token) {
    identity.jwt_token = recoverResult.access_token as string;
  } else {
    identity.jwt_token = await get_jwt_via_wba(client, identity, config.did_domain);
  }

  return [identity, recoverResult];
}

/**
 * 解析 Handle 为 DID 映射
 *
 * 对应 Python: resolve_handle()
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param handle - Handle 本地部分（如 "alice"）
 * @returns 查找结果字典（包含 handle, did, status 等）
 * @throws {JsonRpcError} 查找失败时抛出（如 Handle 不存在）
 */
export async function resolveHandle(
  client: AsyncClient,
  handle: string
): Promise<ResolveHandleResult> {
  return await rpc_call(
    client,
    HANDLE_RPC,
    'lookup',
    { handle }
  ) as unknown as ResolveHandleResult;
}

/**
 * 通过 DID 查找 Handle
 *
 * 对应 Python: lookup_handle()
 *
 * @param client - HTTP 客户端，指向 user-service
 * @param did - DID 标识符
 * @returns 查找结果字典（包含 handle, did, status 等）
 * @throws {JsonRpcError} 查找失败时抛出（如该 DID 无 Handle）
 */
export async function lookupHandle(
  client: AsyncClient,
  did: string
): Promise<LookupHandleResult> {
  return await rpc_call(
    client,
    HANDLE_RPC,
    'lookup',
    { did }
  ) as unknown as LookupHandleResult;
}

// 默认导出
export default {
  sanitizeOtp,
  normalizePhone,
  sendOtp,
  registerHandle,
  recoverHandle,
  resolveHandle,
  lookupHandle,
};
