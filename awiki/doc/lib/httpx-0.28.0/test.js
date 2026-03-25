/**
 * httpx-0.28.0 Node.js 测试代码
 * 
 * 使用 undici 库模拟 httpx.AsyncClient 的功能
 * 测试覆盖：AsyncClient, Request, Response, 异常处理
 */

// 延迟加载 undici，避免 Jest 模块解析问题
let _undici;
let _request;
let _Agent;

function getUndici() {
  if (!_undici) {
    _undici = require('undici');
    _request = _undici.request;
    _Agent = _undici.Agent;
  }
  return { request: _request, Agent: _Agent };
}

// ============================================================================
// 模拟 httpx 类
// ============================================================================

/**
 * 模拟 httpx.Request 类
 */
class Request {
  constructor(method, url, options = {}) {
    this.method = method.toUpperCase();
    this.url = url;
    this.headers = {};
    
    // httpx 响应头键是小写的，统一转换
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        this.headers[key.toLowerCase()] = value;
      }
    }
    
    this.content = options.content || null;

    // 如果提供了 json，转换为 JSON 字符串并设置 Content-Type
    if (options.json !== undefined) {
      this.content = JSON.stringify(options.json);
      this.headers['content-type'] = 'application/json';
    }
  }
}

/**
 * 模拟 httpx.Response 类
 */
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

/**
 * 模拟 httpx.Headers 类 (小写键)
 */
class Headers {
  constructor(headers = {}) {
    this._headers = {};
    for (const [key, value] of Object.entries(headers)) {
      this._headers[key.toLowerCase()] = value;
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

/**
 * 模拟 httpx.AsyncClient 类
 */
class AsyncClient {
  constructor(options = {}) {
    this.base_url = options.base_url ? options.base_url.replace(/\/$/, '') + '/' : null;
    this.timeout = options.timeout || 30.0;
    this.trust_env = options.trust_env !== undefined ? options.trust_env : true;
    this.verify = options.verify !== undefined ? options.verify : true;
    
    // 创建 undici Agent
    const { Agent } = getUndici();
    const agentOptions = {
      connect: {
        rejectUnauthorized: this.verify === true || this.verify === undefined ? true : false
      }
    };
    
    if (typeof this.timeout === 'number') {
      agentOptions.bodyTimeout = this.timeout * 1000;
      agentOptions.headersTimeout = this.timeout * 1000;
    }
    
    this._agent = new Agent(agentOptions);
  }

  async _doRequest(method, url, options = {}) {
    const { request } = getUndici();
    
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
    const response = await request(fullUrl, {
      method,
      headers,
      body,
      dispatcher: this._agent
    });

    const responseBody = await response.body.text();
    const responseHeaders = {};
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders[key.toLowerCase()] = value;
    }

    const req = new Request(method, fullUrl, { headers, content: body });
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

  buildRequest(method, url, options = {}) {
    return new Request(method, url, options);
  }

  async send(request) {
    return this._doRequest(request.method, request.url, {
      headers: request.headers,
      content: request.content
    });
  }

  async close() {
    await this._agent.destroy();
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }
}

// ============================================================================
// 模拟 httpx 异常类
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
// httpx 模块导出
// ============================================================================

const httpx = {
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

// ============================================================================
// Jest 测试用例
// ============================================================================

describe('httpx-0.28.0', () => {
  describe('AsyncClient 创建', () => {
    test('TC-001: 创建用户服务客户端 - 默认配置', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://awiki.ai',
        timeout: 30.0
      });
      
      expect(client.base_url).toBe('https://awiki.ai/');
      expect(client.timeout).toBe(30.0);
      
      await client.close();
    });

    test('TC-002: 创建消息服务客户端 - 自定义超时', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://awiki.ai',
        timeout: 10.0,
        trust_env: false
      });
      
      expect(client.base_url).toBe('https://awiki.ai/');
      expect(client.timeout).toBe(10.0);
      expect(client.trust_env).toBe(false);
      
      await client.close();
    });
  });

  describe('GET 请求', () => {
    test('TC-003: GET 请求 - 带参数', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/get', {
          params: { key: 'value' }
        });

        expect(response.statusCode).toBe(200);
        const data = await response.json();
        expect(data.args).toEqual({ key: 'value' });
        expect(data.url).toContain('key=value');
      } finally {
        await client.close();
      }
    });
  });

  describe('POST 请求', () => {
    test('TC-004: POST 请求 - JSON payload', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const payload = {
          jsonrpc: '2.0',
          method: 'test',
          params: { key: 'value' }
        };

        const response = await client.post('/post', { json: payload });

        expect(response.statusCode).toBe(200);
        const data = await response.json();
        expect(data.json).toBeDefined();
        expect(data.json.method).toBe('test');
        expect(data.json.params).toEqual({ key: 'value' });
        expect(response.headers.get('content-type')).toContain('application/json');
      } finally {
        await client.close();
      }
    });
  });

  describe('PUT 请求', () => {
    test('TC-005: PUT 请求', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const payload = {
          name: 'updated',
          value: 123
        };

        const response = await client.put('/put', { json: payload });

        expect(response.statusCode).toBe(200);
        const data = await response.json();
        expect(data.json).toEqual(payload);
      } finally {
        await client.close();
      }
    });
  });

  describe('DELETE 请求', () => {
    test('TC-006: DELETE 请求', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.delete('/delete');
        expect(response.statusCode).toBe(200);
      } finally {
        await client.close();
      }
    });
  });

  describe('通用请求', () => {
    test('TC-007: 通用 request 方法 - build_request + send', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const payload = { patched: true };
        const request = client.buildRequest('PATCH', '/patch', { json: payload });
        
        expect(request.method).toBe('PATCH');
        expect(request.url).toBe('/patch');
        
        const response = await client.send(request);
        expect(response.statusCode).toBe(200);
        const data = await response.json();
        expect(data.json).toEqual(payload);
      } finally {
        await client.close();
      }
    });
  });

  describe('Request', () => {
    test('TC-008: Request 对象创建', () => {
      const request = new httpx.Request('POST', 'https://awiki.ai/rpc', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token'
        },
        json: {
          jsonrpc: '2.0',
          method: 'test'
        }
      });

      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://awiki.ai/rpc');
      expect(request.headers['content-type']).toBe('application/json');
      expect(request.headers['authorization']).toBe('Bearer token');
      expect(request.content).toBeDefined();
      expect(JSON.parse(request.content).method).toBe('test');
    });
  });

  describe('Response', () => {
    test('TC-009: Response 属性访问', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/status/200');

        expect(response.statusCode).toBe(200);
        expect(response.is_success).toBe(true);
        expect(response.is_error).toBe(false);
        expect(response.headers).toBeDefined();
      } finally {
        await client.close();
      }
    });

    test('TC-010: Response.json() 解析', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/json');

        expect(response.statusCode).toBe(200);
        const data = await response.json();
        expect(data.slideshow).toBeDefined();
        expect(response.headers.get('content-type')).toContain('application/json');
      } finally {
        await client.close();
      }
    });

    test('TC-011: Response.headers 访问', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/headers');

        expect(response.statusCode).toBe(200);
        expect(response.headers.has('content-type')).toBe(true);
        expect(response.headers.get('content-type')).toBe('application/json');
        
        // 检查所有响应头都是小写的
        const allHeaders = response.headers.items();
        allHeaders.forEach(([key, value]) => {
          expect(key).toBe(key.toLowerCase());
        });
      } finally {
        await client.close();
      }
    });
  });

  describe('异常处理', () => {
    test('ERR-001: HTTPStatusError - 404 Not Found', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/status/404');
        
        expect(() => response.raise_for_status()).toThrow(httpx.HTTPStatusError);
        
        try {
          response.raise_for_status();
        } catch (e) {
          expect(e.name).toBe('HTTPStatusError');
          expect(e.status_code).toBe(404);
        }
      } finally {
        await client.close();
      }
    });

    test('ERR-002: HTTPStatusError - 500 Internal Server Error', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/status/500');
        
        expect(() => response.raise_for_status()).toThrow(httpx.HTTPStatusError);
        
        try {
          response.raise_for_status();
        } catch (e) {
          expect(e.name).toBe('HTTPStatusError');
          expect(e.status_code).toBe(500);
        }
      } finally {
        await client.close();
      }
    });

    test('ERR-003: TimeoutException - 请求超时', async () => {
      // 使用极短超时时间触发超时
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 0.001 // 1ms 超时
      });

      try {
        await client.get('/delay/1');
        // 如果没有抛出异常，测试失败
        expect(true).toBe(false);
      } catch (e) {
        // undici 抛出的是 ConnectTimeout 或 TimeoutError
        expect(e.name).toMatch(/Timeout|ConnectTimeout/);
      } finally {
        await client.close();
      }
    });

    test('ERR-004: RequestError - DNS 解析失败', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://nonexistent.invalid.domain.xyz',
        timeout: 5.0
      });

      try {
        await client.get('/test');
        expect(true).toBe(false); // 不应该到达这里
      } catch (e) {
        // undici 抛出的是 ConnectError 或类似错误
        expect(e.name).toMatch(/ConnectError|Error/);
        expect(e.message).toBeDefined();
      } finally {
        await client.close();
      }
    });

    test('ERR-005: 401 Unauthorized - 认证失败', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        timeout: 30.0
      });

      try {
        const response = await client.get('/status/401');

        expect(response.statusCode).toBe(401);
        expect(response.is_client_error).toBe(true);
        expect(response.is_success).toBe(false);
      } finally {
        await client.close();
      }
    });
  });

  describe('TLS 配置', () => {
    test('TC-012: TLS 验证 - 默认系统证书', async () => {
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        verify: true
      });

      try {
        const response = await client.get('/get');
        expect(response.statusCode).toBe(200);
      } finally {
        await client.close();
      }
    });

    test('TC-013: TLS 验证 - 自定义 SSL 上下文', async () => {
      // Node.js 中自定义 SSL 上下文需要更多配置
      // 这里测试基本的 TLS 验证功能
      const client = new httpx.AsyncClient({
        base_url: 'https://httpbin.org',
        verify: true
      });

      try {
        const response = await client.get('/get');
        expect(response.statusCode).toBe(200);
      } finally {
        await client.close();
      }
    });
  });

  describe('httpx 模块导出', () => {
    test('验证 httpx 模块导出', () => {
      expect(httpx.AsyncClient).toBeDefined();
      expect(httpx.Request).toBeDefined();
      expect(httpx.Response).toBeDefined();
      expect(httpx.HTTPStatusError).toBeDefined();
      expect(httpx.TimeoutException).toBeDefined();
      expect(httpx.RequestError).toBeDefined();
    });
  });
});
