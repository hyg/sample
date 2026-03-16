# httpx 库 JavaScript 移植设计文档

## 1. 概述

**Python 包**: `httpx`  
**版本**: `0.28.0`  
**JavaScript 替代**: `axios` (推荐) 或 `node-fetch`  
**用途**: 异步 HTTP 客户端

---

## 2. 模块结构对比

### 2.1 Python 使用方式

```python
import httpx

async with httpx.AsyncClient(
    base_url="https://awiki.ai",
    timeout=30.0,
    trust_env=False,
) as client:
    response = await client.post("/rpc", json=payload)
    data = response.json()
```

### 2.2 JavaScript 使用方式 (axios)

```javascript
import axios from 'axios';

const client = axios.create({
    baseURL: 'https://awiki.ai',
    timeout: 30000,
});

const response = await client.post('/rpc', payload);
const data = response.data;
```

---

## 3. API 映射设计

### 3.1 AsyncClient 创建

**Python**:
```python
httpx.AsyncClient(
    base_url: str = None,
    timeout: float | Timeout = 30.0,
    trust_env: bool = True,
    verify: bool | ssl.SSLContext = True,
    headers: dict = None,
)
```

**JavaScript (axios)**:
```typescript
interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
}

function create(config?: AxiosRequestConfig): AxiosInstance;

// 使用示例
const client = axios.create({
    baseURL: 'https://awiki.ai',
    timeout: 30000,
    // trust_env: 不需要 (axios 默认不使用环境变量)
    // verify: 通过 httpsAgent 配置
    headers: {
        'Content-Type': 'application/json',
    },
});
```

### 3.2 POST 请求

**Python**:
```python
async def post(
    url: str,
    json: dict = None,
    data: dict = None,
    headers: dict = None,
) -> Response:
```

**JavaScript**:
```typescript
async function post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
): Promise<AxiosResponse<T>>;

// 使用示例
const response = await client.post('/rpc', {
    jsonrpc: '2.0',
    method: 'register',
    params: {...},
    id: 1,
}, {
    headers: {
        'Authorization': 'DIDWba ...',
    },
});
```

### 3.3 GET 请求

**Python**:
```python
async def get(url: str, headers: dict = None) -> Response:
```

**JavaScript**:
```typescript
async function get<T = any>(
    url: string,
    config?: AxiosRequestConfig
): Promise<AxiosResponse<T>>;

// 使用示例
const response = await client.get('/user-service/.well-known/handle/alice');
```

### 3.4 Response 对象

**Python Response**:
```python
class Response:
    @property
    def status_code: int
    
    @property
    def headers: Headers
    
    @property
    def text: str
    
    @property
    def content: bytes
    
    def json(self) -> dict
    
    def raise_for_status(self) -> None
```

**JavaScript Response (axios)**:
```typescript
interface AxiosResponse<T = any> {
    status: number;
    statusText: string;
    headers: AxiosHeaders;
    data: T;  // 自动 JSON 解析
    config: AxiosRequestConfig;
    request: any;
}

// 手动 JSON 解析 (如需要)
const text = response.data;  // axios 自动解析 JSON
const json = typeof response.data === 'string' 
    ? JSON.parse(response.data) 
    : response.data;
```

---

## 4. 封装设计

### 4.1 创建 HTTP 客户端工厂

```typescript
// src/client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as https from 'https';
import * as fs from 'fs';

interface ClientConfig {
    baseURL: string;
    timeout?: number;
    caBundle?: string;  // CA 证书路径
}

function _resolveVerify(baseURL: string, caBundle?: string): https.Agent | boolean {
    // 1. 检查环境变量
    const envVars = ['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE'];
    for (const envVar of envVars) {
        const candidate = process.env[envVar]?.trim();
        if (candidate && fs.existsSync(candidate)) {
            return new https.Agent({
                ca: fs.readFileSync(candidate),
            });
        }
    }

    // 2. 检查自定义 CA
    if (caBundle && fs.existsSync(caBundle)) {
        return new https.Agent({
            ca: fs.readFileSync(caBundle),
        });
    }

    // 3. 检查本地 *.test 域名
    const { hostname } = new URL(baseURL);
    if (hostname.endsWith('.test') || hostname === 'localhost') {
        const mkcertRoot = path.join(
            process.env.HOME,
            'Library',
            'Application Support',
            'mkcert',
            'rootCA.pem'
        );
        if (fs.existsSync(mkcertRoot)) {
            return new https.Agent({
                ca: fs.readFileSync(mkcertRoot),
            });
        }
    }

    // 4. 默认验证
    return true;
}

export function createHttpClient(config: ClientConfig): AxiosInstance {
    const agent = _resolveVerify(config.baseURL, config.caBundle);
    
    return axios.create({
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
        httpsAgent: agent instanceof https.Agent ? agent : undefined,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    });
}

export function createUserSvcClient(config: ClientConfig): AxiosInstance {
    return createHttpClient(config);
}

export function createMessageClient(config: ClientConfig): AxiosInstance {
    return createHttpClient(config);
}
```

### 4.2 错误处理

```typescript
// src/errors.ts
import { AxiosError } from 'axios';

export class HttpError extends Error {
    constructor(
        public status: number,
        public statusText: string,
        public data?: any
    ) {
        super(`HTTP error ${status}: ${statusText}`);
        this.name = 'HttpError';
    }
}

export class RequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RequestError';
    }
}

export async function handleHttpClientError(error: AxiosError): Promise<never> {
    if (error.response) {
        // 服务器返回错误响应
        throw new HttpError(
            error.response.status,
            error.response.statusText,
            error.response.data
        );
    } else if (error.request) {
        // 请求已发送但无响应
        throw new RequestError('No response received');
    } else {
        // 其他错误
        throw new RequestError(error.message);
    }
}
```

---

## 5. 使用示例

### 5.1 基本使用

```javascript
import { createUserSvcClient } from './client.js';

const client = createUserSvcClient({
    baseURL: 'https://awiki.ai',
    timeout: 30000,
});

// POST 请求
const response = await client.post('/user-service/did-auth/rpc', {
    jsonrpc: '2.0',
    method: 'register',
    params: { did_document: {...} },
    id: 1,
});

console.log(response.data.result);
```

### 5.2 带认证头的请求

```javascript
const authHeader = await generateAuthHeader(identity, 'awiki.ai');

const response = await client.post(
    '/user-service/did-auth/rpc',
    {
        jsonrpc: '2.0',
        method: 'verify',
        params: { authorization: authHeader },
        id: 1,
    },
    {
        headers: {
            'Authorization': authHeader,
        },
    }
);

const jwt = response.data.result.access_token;
```

### 5.3 错误处理

```javascript
import { handleHttpClientError } from './errors.js';

try {
    const response = await client.post('/rpc', payload);
    console.log(response.data);
} catch (error) {
    if (error.isAxiosError) {
        await handleHttpClientError(error);
    } else {
        console.error('Unknown error:', error);
    }
}
```

---

## 6. 超时处理

```typescript
// 使用 AbortController 实现超时
async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}
```

---

## 7. 依赖配置

```json
{
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/axios": "^0.14.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 8. 测试用例

参考 [distill.json](distill.json) 中的 35 个测试用例。

---

## 9. 迁移检查清单

- [ ] 实现 HTTP 客户端工厂函数
- [ ] 实现 TLS 验证配置 (`_resolveVerify`)
- [ ] 实现错误处理
- [ ] 实现超时处理
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 编写与 Python 版本的互操作测试

---

## 10. 注意事项

1. **自动 JSON 转换**: axios 自动解析 JSON，无需手动调用 `json()`
2. **错误处理**: axios 抛出 `AxiosError`，需要转换为自定义错误
3. **取消请求**: 使用 `AbortController` 实现请求取消
4. **拦截器**: 可使用 axios 拦截器统一处理认证头
5. **TypeScript 支持**: axios 提供完整的类型定义
