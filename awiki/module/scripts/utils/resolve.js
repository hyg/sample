/**
 * utils/resolve.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/resolve.py
 * 分析报告：doc/scripts/utils/resolve.py/py.md
 * 蒸馏数据：doc/scripts/utils/resolve.py/py.json
 *
 * resolve_to_did - Handle 到 DID 的解析功能
 * 通过 .well-known/handle 端点实现标识符解析
 *
 * [INPUT]: SDKConfig（配置服务 URL）、httpx（HTTP 客户端）
 * [OUTPUT]: resolve_to_did() 函数
 * [POS]: 标识符解析工具，通过标准端点将 Handle 转换为 DID
 *
 * [PROTOCOL]:
 * 1. 逻辑变更时更新文件头部注释
 * 2. 更新后检查文件夹的 CLAUDE.md
 */

const httpx = require('undici');
const { SDKConfig } = require('./config');
const { _resolveVerify } = require('./client');

/**
 * 将标识符（Handle 或 DID）解析为 DID
 *
 * Python 原型:
 * async def resolve_to_did(
 *     identifier: str,
 *     config: SDKConfig | None = None,
 * ) -> str:
 *
 * @param {string} identifier - DID 字符串或 Handle 本地部分（如 "alice"）
 * @param {SDKConfig} [config] - SDK 配置，用于获取服务 URL。为 undefined 时使用默认配置
 * @returns {Promise<string>} 解析后的 DID 字符串
 * @throws {Error} Handle 未找到（404）
 * @throws {Error} Handle 状态不是 "active"
 * @throws {Error} Handle 没有绑定 DID
 * @throws {Error} HTTP 请求失败（非 404）
 */
async function resolve_to_did(identifier, config) {
  // 1. DID 直返：如果 identifier 以 "did:" 开头，直接返回
  if (identifier.startsWith('did:')) {
    return identifier;
  }

  // 2. 配置处理：使用默认或传入的 config
  if (config === undefined) {
    config = SDKConfig.load();
  }

  // 3. 域名剥离：如果 Handle 包含已知域名后缀，则剥离
  const knownDomains = ['.awiki.ai', '.awiki.test', `.${config.did_domain}`];
  let handle = identifier;
  for (const domain of knownDomains) {
    if (handle.endsWith(domain)) {
      handle = handle.slice(0, -domain.length);
      break;
    }
  }

  // 4. 构建请求 URL
  const baseUrl = config.user_service_url;
  const url = `${baseUrl}/user-service/.well-known/handle/${handle}`;

  // 5. 解析 TLS 验证设置
  const verify = _resolveVerify(baseUrl);

  // 6. HTTP 查询：调用 GET /user-service/.well-known/handle/{identifier}
  let response;
  try {
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      dispatcher: typeof verify === 'object' ? verify : undefined,
      // 注意：undici 的 TLS 验证配置方式
    };

    // 如果 verify 是 false，需要禁用 TLS 验证
    if (verify === false) {
      // undici 通过 Agent 配置 TLS
      const agent = new httpx.Agent({
        connect: {
          rejectUnauthorized: false
        }
      });
      options.dispatcher = agent;
    }

    response = await httpx.request(url, options);
  } catch (error) {
    // 网络错误等
    throw error;
  }

  // 7. 状态验证：检查返回的 Handle 状态
  if (response.statusCode === 404) {
    throw new Error(`Handle '${handle}' not found`);
  }

  // 检查其他 HTTP 错误
  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`HTTP ${response.statusCode}: ${body}`);
  }

  // 8. 解析 JSON 响应
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }

  const data = await response.body.json();

  // 9. 验证 Handle 状态是否为 "active"
  const status = data.status;
  if (status !== 'active') {
    throw new Error(`Handle '${handle}' is not active (status: ${status})`);
  }

  // 10. 提取 DID 字段
  const did = data.did || '';
  if (!did) {
    throw new Error(`Handle '${handle}' has no DID binding`);
  }

  // 11. 返回 DID
  return did;
}

module.exports = {
  resolve_to_did
};
