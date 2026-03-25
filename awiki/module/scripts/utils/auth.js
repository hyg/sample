/**
 * scripts/utils/auth.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/auth.py
 * 分析报告：doc/scripts/utils/auth.py/py.md
 * 蒸馏数据：doc/scripts/utils/auth.py/py.json
 *
 * DID 注册、文档更新、WBA 认证、JWT 获取
 */

// 延迟加载依赖，避免模块导入时失败
let _generate_auth_header = null;
let _ec = null;
let _hashes = null;
let _DIDIdentity = null;
let _create_identity = null;
let _rpc_call = null;
let _JsonRpcError = null;
let _SDKConfig = null;

/**
 * 初始化依赖
 * @private
 */
function _initDeps() {
  if (_generate_auth_header === null) {
    const authModule = require('../../lib/anp-0.6.8/authentication');
    _generate_auth_header = authModule.generate_auth_header;
  }
  if (_ec === null) {
    const crypto = require('cryptography');
    _ec = crypto.hazmat.primitives.asymmetric.ec;
    _hashes = crypto.hazmat.primitives.hashes;
  }
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
  if (_SDKConfig === null) {
    const configModule = require('./config');
    _SDKConfig = configModule.SDKConfig;
  }
}

/**
 * 创建 secp256k1 签名回调（适配 ANP 接口）
 *
 * ANP generate_auth_header 需要 sign_callback(content: bytes, vm_fragment: str) -> bytes，
 * 返回 DER 编码的签名。
 *
 * @param {any} privateKey - secp256k1 私钥对象
 * @returns {Function} 签名回调函数
 * @private
 */
function _secp256k1_sign_callback(privateKey) {
  /**
   * 签名回调
   *
   * @param {Buffer} content - 要签名的内容
   * @param {string} verificationMethodFragment - 验证方法片段
   * @returns {Buffer} DER 编码的签名
   */
  return function _callback(content, verificationMethodFragment) {
    return privateKey.sign(content, new _ec.ECDSA(new _hashes.SHA256()));
  };
}

/**
 * 生成 DID WBA 授权头
 *
 * @param {DIDIdentity} identity - DID 身份
 * @param {string} serviceDomain - 目标服务域名
 * @returns {string} Authorization 头值（DIDWba 格式）
 */
function generate_wba_auth_header(identity, serviceDomain) {
  _initDeps();
  const privateKey = identity.get_private_key();
  return _generate_auth_header(
    identity.did_document,
    serviceDomain,
    _secp256k1_sign_callback(privateKey)
  );
}

/**
 * 注册 DID 身份
 *
 * 发送 identity.did_document（已包含 ANP 生成的认证证明），
 * 通过 JSON-RPC 调用 user-service 的 did-auth.register 方法。
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端，指向 user-service
 * @param {DIDIdentity} identity - DID 身份（did_document 已包含认证证明）
 * @param {string|null} [name=null] - 显示名称
 * @param {boolean} [isPublic=false] - 是否公开可见
 * @param {boolean} [isAgent=false] - 是否为 AI Agent
 * @param {string|null} [role=null] - 角色
 * @param {string|null} [endpointUrl=null] - 连接端点
 * @param {string|null} [description=null] - 描述
 * @returns {Promise<object>} 注册响应 dict（包含 did, user_id, message）
 * @throws {JsonRpcError} 注册失败时抛出
 * @throws {httpx.HTTPStatusError} HTTP 层错误时抛出
 */
async function register_did(
  client,
  identity,
  name = null,
  isPublic = false,
  isAgent = false,
  role = null,
  endpointUrl = null,
  description = null
) {
  _initDeps();
  const payload = { did_document: identity.did_document };
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

  return await _rpc_call(client, '/user-service/did-auth/rpc', 'register', payload);
}

/**
 * 通过 DID WBA 认证更新 DID 文档
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端，指向 user-service
 * @param {DIDIdentity} identity - 包含更新后 did_document 的 DID 身份
 * @param {string} domain - 用于 DID WBA 认证的服务域名
 * @param {Object} [options] - 可选参数
 * @param {boolean} [options.isPublic=false] - 是否公开可见
 * @param {boolean} [options.isAgent=false] - 是否为 AI Agent
 * @param {string|null} [options.role=null] - 角色
 * @param {string|null} [options.endpointUrl=null] - 连接端点
 * @returns {Promise<object>} 更新响应 dict（包含 did, user_id, message，可选 access_token）
 * @throws {JsonRpcError} 服务器返回 JSON-RPC 错误时抛出
 * @throws {httpx.HTTPStatusError} HTTP 层错误时抛出
 */
async function update_did_document(
  client,
  identity,
  domain,
  { isPublic = false, isAgent = false, role = null, endpointUrl = null } = {}
) {
  _initDeps();
  const payload = { did_document: identity.did_document };
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

  const authHeader = generate_wba_auth_header(identity, domain);
  const resp = await client.post('/user-service/did-auth/rpc', {
    json: {
      jsonrpc: '2.0',
      method: 'update_document',
      params: payload,
      id: 1,
    },
    headers: { Authorization: authHeader },
  });
  resp.raise_for_status();
  const body = resp.json();

  if (body.error !== null && body.error !== undefined) {
    const error = body.error;
    throw new _JsonRpcError(
      error.code,
      error.message,
      error.data !== undefined ? error.data : null
    );
  }

  const result = body.result;
  const authValue = (resp.headers.get('authorization') || '').trim();
  if (authValue.toLowerCase().startsWith('bearer ') && !result.access_token) {
    result.access_token = authValue.split(' ', 2)[1];
  }
  return result;
}

/**
 * 通过 DID WBA 签名获取 JWT token
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端，指向 user-service
 * @param {DIDIdentity} identity - DID 身份
 * @param {string} domain - 服务域名
 * @returns {Promise<string>} JWT access token 字符串
 */
async function get_jwt_via_wba(client, identity, domain) {
  _initDeps();
  const authHeader = generate_wba_auth_header(identity, domain);
  const result = await _rpc_call(
    client,
    '/user-service/did-auth/rpc',
    'verify',
    { authorization: authHeader, domain: domain }
  );
  return result.access_token;
}

/**
 * 一站式创建完整的 DID 身份（生成密钥 -> 注册 -> 获取 JWT）
 *
 * 使用密钥绑定 DID：公钥指纹自动成为 DID 路径的最后一段（k1_{fp}），
 * 无需手动指定 unique_id。path_prefix 固定为 ["user"]（服务器要求）。
 *
 * @param {httpx.AsyncClient} client - HTTP 客户端，指向 user-service
 * @param {SDKConfig} config - SDK 配置
 * @param {string|null} [name=null] - 显示名称
 * @param {boolean} [isPublic=false] - 是否公开可见
 * @param {boolean} [isAgent=false] - 是否为 AI Agent
 * @param {string|null} [role=null] - 角色
 * @param {string|null} [endpointUrl=null] - 连接端点
 * @param {Array<object>|null} [services=null] - 自定义服务条目列表，写入 DID 文档并由证明签名覆盖
 * @returns {Promise<DIDIdentity>} 包含 user_id 和 jwt_token 的 DIDIdentity
 */
async function create_authenticated_identity(
  client,
  config,
  name = null,
  isPublic = false,
  isAgent = false,
  role = null,
  endpointUrl = null,
  services = null
) {
  _initDeps();
  // 1. 创建密钥绑定 DID 身份（带认证证明，绑定到服务域名）
  //    path_prefix 固定为 ["user"]：服务器要求 DID 格式为 did:wba:{domain}:user:{id}
  const identity = _create_identity(
    config.did_domain,
    ['user'],
    'authentication',
    config.did_domain,
    undefined,
    services
  );

  // 2. 注册（直接发送 ANP 生成的文档）
  const regResult = await register_did(
    client,
    identity,
    name,
    isPublic,
    isAgent,
    role,
    endpointUrl
  );
  identity.user_id = regResult.user_id;

  // 3. 获取 JWT
  identity.jwt_token = await get_jwt_via_wba(client, identity, config.did_domain);

  return identity;
}

module.exports = {
  generate_wba_auth_header,
  register_did,
  update_did_document,
  get_jwt_via_wba,
  create_authenticated_identity,
};
