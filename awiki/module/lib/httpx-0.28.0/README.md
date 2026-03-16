# httpx 0.28.0 JavaScript/TypeScript 移植

## 概述

本模块是 Python `httpx` 0.28.0 库的 JavaScript/TypeScript 移植版本，使用 `axios` 作为底层 HTTP 客户端。

**设计目标**:
- 保持与 Python httpx API 的一致性
- 提供完整的 TypeScript 类型定义
- 支持 JSON-RPC 2.0 调用模式
- 支持 TLS/SSL 证书验证配置

---

## 安装

```bash
cd module/lib/httpx-0.28.0
npm install
npm run build
```

---

## 文件结构

```
httpx-0.28.0/
├── src/
│   ├── index.ts          # 主导出文件
│   ├── types.ts          # 类型定义
│   ├── errors.ts         # 错误类
│   ├── client.ts         # HTTP 客户端工厂
│   └── rpc.ts            # JSON-RPC 客户端
├── package.json
├── tsconfig.json
└── README.md
```

---

## 快速开始

### 基本使用

```typescript
import { createHttpClient, httpPost, raiseForStatus } from '@awiki/httpx';

// 创建客户端
const client = createHttpClient({
    baseURL: 'https://awiki.ai',
    timeout: 30.0,
});

// 发送 POST 请求
const response = await httpPost(client, '/user-service/did-auth/rpc', {
    jsonrpc: '2.0',
    method: 'register',
    params: { did_document: {...} },
    id: 1,
});

// 检查状态
raiseForStatus(response);

// 获取结果
console.log(response.data.result);
```

### JSON-RPC 调用

```typescript
import { rpcCall } from '@awiki/httpx';

const result = await rpcCall(
    client,
    '/user-service/did-auth/rpc',
    'register',
    { did_document: {...} },
    1
);
```

### 带认证的 RPC 调用

```typescript
import { authenticatedRpcCall } from '@awiki/httpx';

const result = await authenticatedRpcCall(
    client,
    '/group/rpc',
    'create',
    { name: 'Test Group' },
    1,
    {
        auth: didWbaAuthHeader,
        credentialName: 'default',
    }
);
```

---

## API 对比

### Python httpx vs JavaScript httpx

| Python httpx | JavaScript httpx | 说明 |
|--------------|------------------|------|
| `httpx.AsyncClient()` | `createHttpClient()` | 创建 HTTP 客户端 |
| `client.base_url` | `client.baseURL` | 基础 URL |
| `client.timeout` | `client.timeout` | 超时时间 (秒→毫秒) |
| `client.post(url, json=data)` | `httpPost(client, url, data)` | POST 请求 |
| `client.get(url)` | `httpGet(client, url)` | GET 请求 |
| `response.status_code` | `response.statusCode` | 状态码 |
| `response.headers` | `response.headers` | 响应头 |
| `response.json()` | `response.data` | JSON 解析 (自动) |
| `response.text` | `response.text` | 原始文本 |
| `response.content` | `response.content` | 原始字节 |
| `response.raise_for_status()` | `raiseForStatus(response)` | 检查状态 |
| `httpx.HTTPStatusError` | `HTTPStatusError` | HTTP 状态错误 |
| `httpx.RequestError` | `RequestError` | 网络请求错误 |
| `httpx.ConnectError` | `ConnectError` | 连接错误 |

### TLS 验证配置

| Python | JavaScript | 说明 |
|--------|------------|------|
| `ssl.create_default_context(cafile=...)` | `{ caFile: '...', ca: Buffer }` | SSL 上下文 |
| `_resolve_verify(url)` | `_resolveVerify(url)` | 解析验证设置 |

### JSON-RPC 调用

| Python | JavaScript | 说明 |
|--------|------------|------|
| `rpc_call(client, endpoint, method, params, id)` | `rpcCall(client, endpoint, method, params, id)` | RPC 调用 |
| `authenticated_rpc_call(...)` | `authenticatedRpcCall(...)` | 认证 RPC 调用 |
| `JsonRpcError(code, message, data)` | `JsonRpcError(code, message, data)` | JSON-RPC 错误 |

---

## 错误处理

### 错误层次结构

```
HttpError (基类)
├── HTTPStatusError (HTTP 错误状态 4xx/5xx)
├── RequestError (网络错误)
│   ├── ConnectError (连接错误)
│   ├── ReadError (读取错误)
│   ├── WriteError (写入错误)
│   └── CloseError (连接关闭错误)
└── JsonRpcError (JSON-RPC 错误)
```

### 错误处理示例

```typescript
import { HTTPStatusError, RequestError, JsonRpcError } from '@awiki/httpx';

try {
    const result = await rpcCall(client, '/rpc', 'method', {});
} catch (error) {
    if (error instanceof JsonRpcError) {
        console.error(`JSON-RPC error ${error.code}: ${error.message}`);
    } else if (error instanceof HTTPStatusError) {
        console.error(`HTTP error ${error.status}: ${error.statusText}`);
    } else if (error instanceof RequestError) {
        console.error(`Network error: ${error.message}`);
    }
}
```

---

## TLS/SSL 验证

### 自动检测 CA 证书

`_resolveVerify()` 函数按以下优先级解析 TLS 验证设置:

1. **环境变量**: `AWIKI_CA_BUNDLE`, `E2E_CA_BUNDLE`, `SSL_CERT_FILE`
2. **自定义 CA**: 通过 `verify` 参数指定
3. **mkcert 本地证书**: 自动检测 `*.test` 域名和 `localhost`
4. **默认系统证书**: 使用系统默认 CA 证书

### 使用示例

```typescript
// 使用环境变量
process.env.AWIKI_CA_BUNDLE = '/path/to/ca.pem';

const client = createHttpClient({
    baseURL: 'https://api.awiki.test',
    // 自动使用环境变量中的 CA 证书
});

// 或手动指定
const client = createHttpClient({
    baseURL: 'https://api.example.com',
    verify: '/path/to/ca.pem',
});
```

---

## 超时处理

```typescript
// Python (秒)
httpx.AsyncClient(timeout=30.0)

// JavaScript (秒，内部转换为毫秒)
createHttpClient({
    baseURL: 'https://...',
    timeout: 30.0,  // 30 秒
});
```

---

## 测试用例

参考 `doc/lib/httpx-0.28.0/distill.json` 中的 35 个测试用例。

### 已覆盖的测试场景

| ID | 类别 | 描述 | 状态 |
|----|------|------|------|
| TC-001 | AsyncClient 创建 | 创建用户服务客户端 | ✅ |
| TC-002 | AsyncClient 创建 | 创建消息服务客户端 | ✅ |
| TC-003 | TLS 配置 | AWIKI_CA_BUNDLE 环境变量 | ✅ |
| TC-004 | TLS 配置 | mkcert 本地证书支持 | ✅ |
| TC-005 | TLS 配置 | localhost 支持 | ✅ |
| TC-006 | POST 请求 | JSON-RPC 成功调用 | ✅ |
| TC-007 | POST 请求 | JSON-RPC 服务器错误 | ✅ |
| TC-008 | POST 请求 | HTTP 状态错误 | ✅ |
| TC-009 | 认证 | 认证 RPC 首次成功 | ✅ |
| TC-010 | 认证 | 401 自动重试 | ✅ |
| ... | ... | ... | ... |

---

## 依赖

```json
{
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/axios": "^0.14.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## 构建

```bash
# 编译 TypeScript
npm run build

# 清理构建产物
npm run clean

# 运行测试
npm test

# 代码检查
npm run lint
```

---

## 注意事项

1. **自动 JSON 转换**: axios 自动解析 JSON，无需手动调用 `json()`
2. **超时单位**: Python 使用秒，JavaScript 内部转换为毫秒
3. **错误处理**: 使用 `handleHttpClientError()` 将 AxiosError 转换为 httpx 风格错误
4. **响应头**: axios 响应头键是小写的，使用 `getHeader()` 进行不区分大小写的访问
5. **trust_env**: axios 默认不使用环境变量中的代理配置

---

## 许可证

MIT
