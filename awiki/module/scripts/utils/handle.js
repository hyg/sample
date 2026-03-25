/**
 * scripts/utils/handle.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/handle.py
 * 分析报告：doc/scripts/utils/handle.py/py.md
 * 蒸馏数据：doc/scripts/utils/handle.py/py.json
 *
 * Handle 注册和解析工具
 */

// 延迟加载依赖，避免模块导入时失败
let _DIDIdentity = null;
let _create_identity = null;
let _rpc_call = null;
let _JsonRpcError = null;
let _get_jwt_via_wba = null;
let _SDKConfig = null;

/**
 * 初始化依赖
 * @private
 */
function _initDeps() {
  if (_DIDIdentity === null) {
    const identityModule = require('./identity');
    _DIDIdentity = identityModule.DIDIdentity;
    _create_identity = identityModule.create_identity;
  }
  if (_rpc_call === null) {
    const rpcModule = require('./rpc');
    _rpc_call = rpcModule.rpc_call;
    _JsonRpcError = rpcModule.JsonRpcError;
  }
  if (_get_jwt_via_wba === null) {
    const authModule = require('./auth');
    _get_jwt_via_wba = authModule.get_jwt_via_wba;
  }
  if (_SDKConfig === null) {
    const configModule = require('./config');
    _SDKConfig = configModule.SDKConfig;
  }
}

// ==================== 常量 ====================

const HANDLE_RPC = '/user-service/handle/rpc';
const DID_AUTH_RPC = '/user-service/did-auth/rpc';
const DEFAULT_COUNTRY_CODE = '+86';

// ==================== Email verification REST endpoints ====================

const EMAIL_SEND_REST = '/user-service/auth/email-send';
const EMAIL_STATUS_REST = '/user-service/auth/email-status';

// ==================== Account binding REST endpoints ====================

const PHONE_BIND_SEND_REST = '/user-service/auth/phone-bind-send';
const PHONE_BIND_VERIFY_REST = '/user-service/auth/phone-bind-verify';

// ==================== 手机号格式正则 ====================

// 国际格式：+{国家代码}{号码}
const _PHONE_INTL_RE = /^\+\d{1,3}\d{6,14}$/;
// 中国本地格式：11 位数字，1[3-9] 开头
const _PHONE_CN_LOCAL_RE = /^1[3-9]\d{9}$/;

/**
 * 去除 OTP 代码中的所有空白字符 (空格、换行、制表符)
 *
 * @param {string} code - OTP 代码
 * @returns {string} 清理后的 OTP 代码
 * @private
 */
function _sanitize_otp(code) {
  return code.replace(/\s+/g, '');
}

/**
 * 规范化手机号到国际格式
 *
 * 规则:
 * - 已有国际格式 (+XX...) → 保持不变
 * - 中国本地格式 (1XXXXXXXXXX) → 自动加 +86
 * - 其他 → 抛出 ValueError
 *
 * @param {string} phone - 原始手机号
 * @returns {string} 国际格式手机号 (如 +8613800138000)
 * @throws {Error} 无效的手机号格式
 */
function normalize_phone(phone) {
  phone = phone.trim();

  if (phone.startsWith('+')) {
    // 已有国际格式
    if (_PHONE_INTL_RE.test(phone)) {
      return phone;
    }
    throw new Error(
      `Invalid international phone number: ${phone}. ` +
      `Expected format: +<country_code><number> (e.g., +8613800138000, +14155552671). ` +
      `Please check the country code.`
    );
  }

  if (_PHONE_CN_LOCAL_RE.test(phone)) {
    // 中国本地格式 → 自动加 +86
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
 * 发送 OTP 验证码
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} phone - 国际格式手机号
 * @returns {Promise<object>} RPC 结果 dict
 * @throws {Error} 无效的手机号格式
 * @throws {JsonRpcError} 发送失败时抛出
 */
async function send_otp(client, phone) {
  const normalized = normalize_phone(phone);
  try {
    return await _rpc_call(client, HANDLE_RPC, 'send_otp', { phone: normalized });
  } catch (e) {
    if (e instanceof _JsonRpcError) {
      throw new _JsonRpcError(
        e.code,
        `${e.message}. Please verify the phone number and country code (current: ${normalized}).`,
        e.data
      );
    }
    throw e;
  }
}

/**
 * 一站式 Handle 注册
 *
 * 流程:
 * 1. 创建密钥绑定 DID (handle 作为路径前缀)
 * 2. 注册 DID (带 Handle 参数)
 * 3. 获取 JWT token
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} phone - 国际格式手机号
 * @param {string} otp_code - OTP 验证码
 * @param {string} handle - Handle 本地部分 (如 "alice")
 * @param {string|null} [invite_code=null] - 邀请码 (短 handle <= 4 字符时需要)
 * @param {string|null} [name=null] - 显示名称
 * @param {boolean} [is_public=false] - 是否公开可见
 * @param {Array<object>|null} [services=null] - 自定义服务条目列表
 * @returns {Promise<DIDIdentity>} DIDIdentity (包含 user_id 和 jwt_token)
 * @throws {Error} 无效的手机号格式
 * @throws {JsonRpcError} 注册失败时抛出
 */
async function register_handle(
  client,
  config,
  phone,
  otp_code,
  handle,
  invite_code = null,
  name = null,
  is_public = false,
  services = null
) {
  _initDeps();
  const normalized = normalize_phone(phone);

  // 1. 创建密钥绑定 DID identity，handle 作为路径前缀
  const identity = _create_identity(
    config.did_domain,
    [handle],
    'authentication',
    config.did_domain,
    undefined,
    services
  );

  // 2. 注册 DID，带 Handle 参数
  const payload = {
    did_document: identity.did_document,
    handle: handle,
    phone: normalized,
    otp_code: _sanitize_otp(otp_code),
  };
  if (invite_code !== null) {
    payload.invite_code = invite_code;
  }
  if (name !== null) {
    payload.name = name;
  }
  if (is_public) {
    payload.is_public = true;
  }

  const regResult = await _rpc_call(client, DID_AUTH_RPC, 'register', payload);
  identity.user_id = regResult.user_id;

  // 3. 注册返回 handle 模式的 access_token
  if (regResult.access_token) {
    identity.jwt_token = regResult.access_token;
  } else {
    identity.jwt_token = await _get_jwt_via_wba(client, identity, config.did_domain);
  }

  return identity;
}

/**
 * EmailVerificationResult 数据类
 *
 * Python 原型:
 * @dataclass(frozen=True)
 * class EmailVerificationResult:
 *     verified: bool
 *     activation_sent: bool
 *     verified_at: str | None = None
 */
class EmailVerificationResult {
  /**
   * 创建 EmailVerificationResult 实例
   *
   * @param {boolean} verified - 是否已验证
   * @param {boolean} activation_sent - 是否已发送激活邮件
   * @param {string|null} [verified_at=null] - 验证时间
   */
  constructor(verified, activation_sent, verified_at = null) {
    this.verified = verified;
    this.activation_sent = activation_sent;
    this.verified_at = verified_at;
  }
}

/**
 * 发送 email 验证 (激活链接)
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} email - Email 地址
 * @returns {Promise<object>} 响应 dict，包含 "message" 字段
 * @throws {httpx.HTTPStatusError} HTTP 错误时抛出
 */
async function send_email_verification(client, email) {
  const resp = await client.post(EMAIL_SEND_REST, {
    json: { email: email.trim().toLowerCase() },
  });
  resp.raise_for_status();
  return resp.json();
}

/**
 * 检查 email 是否已验证
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} email - Email 地址
 * @returns {Promise<[boolean, string|null]>} [verified, verified_at]
 */
async function check_email_verified(client, email) {
  const resp = await client.get(EMAIL_STATUS_REST, {
    params: { email: email.trim().toLowerCase() },
  });
  resp.raise_for_status();
  const data = resp.json();
  return [data.verified || false, data.verified_at || null];
}

/**
 * 确保 email 验证 (纯非交互式流程)
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} email - 需要验证的 email
 * @param {Function|null} [send_fn=null] - 发送激活邮件的异步函数
 * @param {Object} [options] - 可选参数
 * @param {boolean} [options.wait=false] - 是否轮询直到 email 被验证
 * @param {number} [options.timeout=300] - 等待超时时间 (秒)
 * @param {number} [options.poll_interval=5.0] - 轮询间隔 (秒)
 * @returns {Promise<EmailVerificationResult>} 验证结果
 * @throws {httpx.HTTPStatusError} HTTP 错误时抛出
 * @throws {Error} timeout 或 poll_interval 无效时抛出
 */
async function ensure_email_verification(
  client,
  email,
  send_fn = null,
  { wait = false, timeout = 300, poll_interval = 5.0 } = {}
) {
  const normalized_email = email.trim().toLowerCase();
  let [verified, verified_at] = await check_email_verified(client, normalized_email);

  if (verified) {
    return new EmailVerificationResult(true, false, verified_at);
  }

  console.log(`\nSending activation email to ${normalized_email}...`);
  if (send_fn !== null) {
    await send_fn();
  } else {
    await send_email_verification(client, normalized_email);
  }
  console.log('Activation email sent. Please check your inbox and click the activation link.');

  if (!wait) {
    return new EmailVerificationResult(false, true, null);
  }

  if (timeout < 0) {
    throw new Error('email verification timeout must be >= 0 seconds.');
  }
  if (poll_interval <= 0) {
    throw new Error('email verification poll interval must be > 0 seconds.');
  }

  console.log(
    `Waiting for email verification (timeout: ${timeout}s, poll interval: ${poll_interval}s)...`
  );

  // 使用性能时间计算 deadline
  const deadline = Date.now() + timeout * 1000;

  while (true) {
    [verified, verified_at] = await check_email_verified(client, normalized_email);
    if (verified) {
      return new EmailVerificationResult(true, true, verified_at);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return new EmailVerificationResult(false, true, null);
    }

    // 等待 poll_interval 或剩余时间 (取较小值)
    const sleepTime = Math.min(poll_interval * 1000, remaining);
    await new Promise((resolve) => setTimeout(resolve, sleepTime));
  }
}

/**
 * 等待 email 验证 (完全等待的向后兼容包装器)
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} email - Email 地址
 * @param {Function|null} [send_fn=null] - 发送激活邮件的异步函数
 * @param {number} [timeout=300] - 超时时间 (秒)
 * @param {number} [poll_interval=5.0] - 轮询间隔 (秒)
 * @returns {Promise<EmailVerificationResult>} 验证结果
 */
async function wait_for_email_verification(
  client,
  email,
  send_fn = null,
  timeout = 300,
  poll_interval = 5.0
) {
  return await ensure_email_verification(client, email, send_fn, {
    wait: true,
    timeout: timeout,
    poll_interval: poll_interval,
  });
}

/**
 * 一站式 Handle 注册 (使用 email)
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} email - 已验证的 email 地址
 * @param {string} handle - Handle 本地部分 (如 "alice")
 * @param {string|null} [invite_code=null] - 邀请码
 * @param {string|null} [name=null] - 显示名称
 * @param {boolean} [is_public=false] - 是否公开可见
 * @param {Array<object>|null} [services=null] - 自定义服务条目列表
 * @returns {Promise<DIDIdentity>} DIDIdentity (包含 user_id 和 jwt_token)
 * @throws {JsonRpcError} 注册失败时抛出
 */
async function register_handle_with_email(
  client,
  config,
  email,
  handle,
  invite_code = null,
  name = null,
  is_public = false,
  services = null
) {
  _initDeps();

  // 1. 创建密钥绑定 DID identity，handle 作为路径前缀
  const identity = _create_identity(
    config.did_domain,
    [handle],
    'authentication',
    config.did_domain,
    undefined,
    services
  );

  // 2. 注册 DID，带 Handle + email 参数 (不需要 phone/otp_code)
  const payload = {
    did_document: identity.did_document,
    handle: handle,
    email: email.trim().toLowerCase(),
  };
  if (invite_code !== null) {
    payload.invite_code = invite_code;
  }
  if (name !== null) {
    payload.name = name;
  }
  if (is_public) {
    payload.is_public = true;
  }

  const regResult = await _rpc_call(client, DID_AUTH_RPC, 'register', payload);
  identity.user_id = regResult.user_id;

  // 3. 注册返回 handle 模式的 access_token
  if (regResult.access_token) {
    identity.jwt_token = regResult.access_token;
  } else {
    identity.jwt_token = await _get_jwt_via_wba(client, identity, config.did_domain);
  }

  return identity;
}

/**
 * 发送 email 验证以绑定 email 到现有账户
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} email - 需要绑定的 email
 * @param {string} jwt_token - 用户的 JWT access token
 * @returns {Promise<object>} 响应 dict，包含 "message" 字段
 * @throws {httpx.HTTPStatusError} HTTP 错误时抛出
 */
async function bind_email_send(client, email, jwt_token) {
  const resp = await client.post(EMAIL_SEND_REST, {
    json: { email: email.trim().toLowerCase() },
    headers: { Authorization: `Bearer ${jwt_token}` },
  });
  resp.raise_for_status();
  return resp.json();
}

/**
 * 发送 OTP 以绑定手机号到现有账户
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} phone - 手机号
 * @param {string} jwt_token - 用户的 JWT access token
 * @returns {Promise<object>} 响应 dict，包含 "message" 字段
 * @throws {httpx.HTTPStatusError} 401 无效 JWT, 409 手机号已被占用，429 频率限制
 */
async function bind_phone_send_otp(client, phone, jwt_token) {
  const normalized = normalize_phone(phone);
  const resp = await client.post(PHONE_BIND_SEND_REST, {
    json: { phone: normalized },
    headers: { Authorization: `Bearer ${jwt_token}` },
  });
  resp.raise_for_status();
  return resp.json();
}

/**
 * 验证 OTP 并绑定手机号到现有账户
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} phone - 手机号 (与发送到 bind_phone_send_otp 的相同)
 * @param {string} otp_code - 6 位 OTP 代码
 * @param {string} jwt_token - 用户的 JWT access token
 * @returns {Promise<object>} 响应 dict，包含 "success" 和 "phone" 字段
 * @throws {httpx.HTTPStatusError} 401 无效 JWT/OTP, 409 手机号已被占用
 */
async function bind_phone_verify(client, phone, otp_code, jwt_token) {
  const normalized = normalize_phone(phone);
  const resp = await client.post(PHONE_BIND_VERIFY_REST, {
    json: { phone: normalized, code: _sanitize_otp(otp_code) },
    headers: { Authorization: `Bearer ${jwt_token}` },
  });
  resp.raise_for_status();
  return resp.json();
}

/**
 * 通过重新绑定到新 DID 来恢复 Handle
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {string} phone - 手机号
 * @param {string} otp_code - OTP 验证码
 * @param {string} handle - Handle 本地部分
 * @param {Object} [options] - 可选参数
 * @param {Array<object>|null} [options.services=null] - 自定义服务条目列表
 * @returns {Promise<[DIDIdentity, object]>} [DIDIdentity, 恢复结果 dict]
 */
async function recover_handle(
  client,
  config,
  phone,
  otp_code,
  handle,
  { services = null } = {}
) {
  _initDeps();
  const normalized = normalize_phone(phone);

  const identity = _create_identity(
    config.did_domain,
    [handle],
    'authentication',
    config.did_domain,
    undefined,
    services
  );

  const payload = {
    did_document: identity.did_document,
    handle: handle,
    phone: normalized,
    otp_code: _sanitize_otp(otp_code),
  };

  const recoverResult = await _rpc_call(client, DID_AUTH_RPC, 'recover_handle', payload);
  identity.user_id = recoverResult.user_id;

  if (recoverResult.access_token) {
    identity.jwt_token = recoverResult.access_token;
  } else {
    identity.jwt_token = await _get_jwt_via_wba(client, identity, config.did_domain);
  }

  return [identity, recoverResult];
}

/**
 * 解析 Handle 到 DID 映射
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} handle - Handle 本地部分 (如 "alice")
 * @returns {Promise<object>} 查找结果 dict (包含 handle, did, status 等)
 * @throws {JsonRpcError} 查找失败时抛出 (如 handle 未找到)
 */
async function resolve_handle(client, handle) {
  return await _rpc_call(client, HANDLE_RPC, 'lookup', { handle: handle });
}

/**
 * 通过 DID 查找 Handle
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {string} did - DID 标识符
 * @returns {Promise<object>} 查找结果 dict (包含 handle, did, status 等)
 * @throws {JsonRpcError} 查找失败时抛出 (如该 DID 没有 handle)
 */
async function lookup_handle(client, did) {
  return await _rpc_call(client, HANDLE_RPC, 'lookup', { did: did });
}

module.exports = {
  EmailVerificationResult,
  HANDLE_RPC,
  DID_AUTH_RPC,
  DEFAULT_COUNTRY_CODE,
  EMAIL_SEND_REST,
  EMAIL_STATUS_REST,
  PHONE_BIND_SEND_REST,
  PHONE_BIND_VERIFY_REST,
  normalize_phone,
  _sanitize_otp,
  send_otp,
  register_handle,
  register_handle_with_email,
  send_email_verification,
  check_email_verified,
  ensure_email_verification,
  wait_for_email_verification,
  recover_handle,
  resolve_handle,
  lookup_handle,
  bind_email_send,
  bind_phone_send_otp,
  bind_phone_verify,
};
