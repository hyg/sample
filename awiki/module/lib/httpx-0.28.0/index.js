/**
 * httpx-0.28.0 Node.js 适配器
 * 
 * 使用 undici 实现 httpx.AsyncClient 的功能
 * 保持与 Python httpx 库的 API 一致
 */

const undici = require('undici');

// ============================================================================
// httpx.Headers 类
// ============================================================================

class Headers {
  constructor(headers = {}) {
    this._headers = {};
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this._headers[key.toLowerCase()] = value;
      }
    }
  }

  get(key) {
    return this._headers[key.toLowerCase()];
  }

  has(key) {
    return key.toLowerCase() in this._headers;
  }

  items() {
    return Object.entries(this._headers);
  }

  toJSON() {
    return this._headers;
  }
}

// ============================================================================
// httpx.Request 类
// ============================================================================

class Request {
  constructor(method, url, headers = null, content = null, json = undefined) {
    this.method = method.toUpperCase();
    this.url = url;
    this.headers = new Headers(headers || {});
    this.content = content;

    // 如果提供了 json，转换为 JSON 字符串并设置 Content-Type
    if (json !== undefined) {
      this.content = JSON.stringify(json);
      this.headers._headers['content-type'] = 'application/json';
    }
  }
}

// ============================================================================
// httpx.Response 类
// ============================================================================

class Response {
  constructor(statusCode, headers, body, request = null) {
    this.statusCode = statusCode;
    this.status = statusCode; // 别名
    this.headers = new Headers(headers);
    this._body = body;
    this._request = request;
    this._jsonCache = null;
  }

  get is_success() {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  get is_error() {
    return this.statusCode >= 400;
  }

  get is_client_error() {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  get is_server_error() {
    return this.statusCode >= 500;
  }

  get request() {
    return this._request;
  }

  async text() {
    return this._body;
  }

  async json() {
    if (this._jsonCache !== null) {
      return this._jsonCache;
    }
    try {
      this._jsonCache = JSON.parse(this._body);
      return this._jsonCache;
    } catch (e) {
      throw new Error('Invalid JSON response');
    }
  }

  raise_for_status() {
    if (this.is_error) {
      throw new HTTPStatusError(
        `HTTP Error ${this.statusCode}`,
        { status_code: this.statusCode },
        this._request,
        this
      );
    }
  }
}

// ============================================================================
// httpx 异常类
// ============================================================================

class HTTPStatusError extends Error {
  constructor(message, response, request, rawResponse) {
    super(message);
    this.name = 'HTTPStatusError';
    this.response = response;
    this.request = request;
    if (rawResponse) {
      this.status_code = rawResponse.statusCode;
    }
  }
}

class TimeoutException extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutException';
  }
}

class RequestError extends Error {
  constructor(message, request = null) {
    super(message);
    this.name = 'RequestError';
    this.request = request;
  }
}

class ConnectTimeout extends TimeoutException {
  constructor(message) {
    super(message);
    this.name = 'ConnectTimeout';
  }
}

class ConnectError extends RequestError {
  constructor(message, request = null) {
    super(message, request);
    this.name = 'ConnectError';
  }
}

// ============================================================================
// httpx.AsyncClient 类
// ============================================================================

class AsyncClient {
  constructor(options = {}) {
    // 参数处理
    this.base_url = options.base_url ? options.base_url.replace(/\/$/, '') + '/' : null;
    this.timeout = options.timeout !== undefined ? options.timeout : 30.0;
    this.trust_env = options.trust_env !== undefined ? options.trust_env : true;
    this.verify = options.verify !== undefined ? options.verify : true;

    // 创建 undici Agent
    const agentOptions = {
      connect: {
        rejectUnauthorized: this.verify === true || this.verify === undefined ? true : false
      }
    };

    // 设置超时（undici 使用毫秒）
    if (typeof this.timeout === 'number') {
      agentOptions.bodyTimeout = this.timeout * 1000;
      agentOptions.headersTimeout = this.timeout * 1000;
    }

    this._agent = new undici.Agent(agentOptions);
  }

  async _doRequest(method, url, options = {}) {
    // 构建完整 URL
    let fullUrl = url;
    if (this.base_url && !url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = this.base_url.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url);
    }

    // 处理查询参数
    if (options.params) {
      const queryString = new URLSearchParams(options.params).toString();
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }

    // 准备请求头
    const headers = { ...options.headers };
    let body = options.body || options.content;

    // 处理 JSON payload
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers['content-type'] = 'application/json';
    }

    // 执行请求
    const response = await undici.request(fullUrl, {
      method,
      headers,
      body,
      dispatcher: this._agent
    });

    // 读取响应体
    const responseBody = await response.body.text();
    
    // 转换响应头（确保小写）
    const responseHeaders = {};
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders[key.toLowerCase()] = value;
    }

    // 创建 Request 对象
    const req = new Request(method, fullUrl, headers, body);
    
    return new Response(response.statusCode, responseHeaders, responseBody, req);
  }

  async get(url, options = {}) {
    return this._doRequest('GET', url, options);
  }

  async post(url, options = {}) {
    return this._doRequest('POST', url, options);
  }

  async put(url, options = {}) {
    return this._doRequest('PUT', url, options);
  }

  async delete(url, options = {}) {
    return this._doRequest('DELETE', url, options);
  }

  async patch(url, options = {}) {
    return this._doRequest('PATCH', url, options);
  }

  async request(method, url, options = {}) {
    return this._doRequest(method.toUpperCase(), url, options);
  }

  build_request(method, url, options = {}) {
    return new Request(method, url, options.headers, options.content, options.json);
  }

  async send(request, options = {}) {
    return this._doRequest(request.method, request.url, {
      headers: request.headers._headers,
      content: request.content,
      ...options
    });
  }

  async aclose() {
    await this._agent.destroy();
  }

  async close() {
    await this.aclose();
  }

  async [Symbol.asyncDispose]() {
    await this.aclose();
  }
}

// ============================================================================
// 模块导出
// ============================================================================

module.exports = {
  AsyncClient,
  Request,
  Response,
  Headers,
  HTTPStatusError,
  TimeoutException,
  RequestError,
  ConnectTimeout,
  ConnectError
};
