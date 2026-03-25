/**
 * scripts/utils/rpc.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/rpc.py
 * 分析报告：doc/scripts/utils/rpc.py/py.md
 * 蒸馏数据：doc/scripts/utils/rpc.py/py.json
 *
 * JSON-RPC 2.0 客户端辅助函数
 */

/**
 * JSON-RPC 错误响应异常类
 *
 * Python 原型:
 * class JsonRpcError(Exception):
 *     def __init__(self, code: int, message: str, data: Any = None):
 *         self.code = code
 *         self.message = message
 *         self.data = data
 */
class JsonRpcError extends Error {
  /**
   * 创建 JsonRpcError 实例
   *
   * @param {number} code - 错误码
   * @param {string} message - 错误消息
   * @param {any} [data] - 附加数据
   */
  constructor(code, message, data = null) {
    super(`JSON-RPC error ${code}: ${message}`);
    this.code = code;
    this.message = message;
    this.data = data;
    this.name = 'JsonRpcError';
  }
}

/**
 * 发送 JSON-RPC 2.0 请求并返回结果
 *
 * Python 原型:
 * async def rpc_call(
 *     client: httpx.AsyncClient,
 *     endpoint: str,
 *     method: str,
 *     params: dict | None = None,
 *     request_id: int | str = 1,
 * ) -> Any:
 *
 * @param {httpx.AsyncClient} client - httpx 异步客户端
 * @param {string} endpoint - RPC 端点路径 (如 "/did-auth/rpc")
 * @param {string} method - RPC 方法名 (如 "register")
 * @param {object|null} [params=null] - 方法参数
 * @param {number|string} [request_id=1] - 请求 ID
 * @returns {Promise<any>} JSON-RPC result 字段值
 * @throws {JsonRpcError} 服务器返回 JSON-RPC 错误
 * @throws {httpx.HTTPStatusError} HTTP 层错误
 */
async function rpc_call(client, endpoint, method, params = null, request_id = 1) {
  const payload = {
    jsonrpc: '2.0',
    method: method,
    params: params || {},
    id: request_id,
  };

  const resp = await client.post(endpoint, { json: payload });
  resp.raise_for_status();
  const body = await resp.json();

  if (body.error !== null && body.error !== undefined) {
    const error = body.error;
    throw new JsonRpcError(
      error.code,
      error.message,
      error.data !== undefined ? error.data : null
    );
  }

  return body.result;
}

/**
 * 带自动 401 重试的 JSON-RPC 2.0 请求
 *
 * 使用 DIDWbaAuthHeader 管理认证头和 token 缓存。
 * 遇到 401 时自动清除过期 token 并重新生成 DIDWBA 认证头重试。
 *
 * Python 原型:
 * async def authenticated_rpc_call(
 *     client: httpx.AsyncClient,
 *     endpoint: str,
 *     method: str,
 *     params: dict | None = None,
 *     request_id: int | str = 1,
 *     *,
 *     auth: Any = None,              # DIDWbaAuthHeader 实例
 *     credential_name: str = "default",
 * ) -> Any:
 *
 * @param {httpx.AsyncClient} client - httpx 异步客户端
 * @param {string} endpoint - RPC 端点路径
 * @param {string} method - RPC 方法名
 * @param {object|null} [params=null] - 方法参数
 * @param {number|string} [request_id=1] - 请求 ID
 * @param {object} [options] - 可选参数
 * @param {any} [options.auth=null] - DIDWbaAuthHeader 实例
 * @param {string} [options.credentialName='default'] - 凭证名称 (用于持久化新 JWT)
 * @returns {Promise<any>} JSON-RPC result 字段值
 * @throws {JsonRpcError} 服务器返回 JSON-RPC 错误
 * @throws {httpx.HTTPStatusError} HTTP 层错误 (非 401)
 */
async function authenticated_rpc_call(
  client,
  endpoint,
  method,
  params = null,
  request_id = 1,
  { auth = null, credentialName = 'default' } = {}
) {
  const serverUrl = String(client.base_url);
  const payload = {
    jsonrpc: '2.0',
    method: method,
    params: params || {},
    id: request_id,
  };

  // 获取认证头
  let authHeaders = auth.get_auth_header(serverUrl);
  let resp = await client.post(endpoint, { json: payload, headers: authHeaders });

  // 401 -> 清除过期 token -> 重新认证 -> 重试
  if (resp.status_code === 401) {
    auth.clear_token(serverUrl);
    authHeaders = auth.get_auth_header(serverUrl, true); // force_new=True
    resp = await client.post(endpoint, { json: payload, headers: authHeaders });
  }

  resp.raise_for_status();

  // 成功：缓存新 token
  // 注意：httpx 响应头键为小写，DIDWbaAuthHeader.update_token() 期望 "Authorization"
  const authHeaderValue = resp.headers.get('authorization') || '';
  const newToken = auth.update_token(serverUrl, { Authorization: authHeaderValue });
  if (newToken) {
    const { updateJwt } = require('../credential_store');
    updateJwt(credentialName, newToken);
  }

  const body = resp.json();
  if (body.error !== null && body.error !== undefined) {
    const error = body.error;
    throw new JsonRpcError(
      error.code,
      error.message,
      error.data !== undefined ? error.data : null
    );
  }

  return body.result;
}

module.exports = {
  JsonRpcError,
  rpc_call,
  authenticated_rpc_call
};
