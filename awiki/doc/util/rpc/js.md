# rpc 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/rpc.py`  
**JavaScript 目标文件**: `module/src/rpc.js`  
**功能**: JSON-RPC 2.0 客户端辅助函数

---

## 2. 接口设计

### 2.1 `JsonRpcError` 类

**Python**:
```python
class JsonRpcError(Exception):
    def __init__(self, code: int, message: str, data: Any = None):
```

**JavaScript**:
```javascript
/**
 * JSON-RPC 错误
 */
class JsonRpcError extends Error {
    constructor(code, message, data = null) {
        super(`JSON-RPC error ${code}: ${message}`);
        this.name = 'JsonRpcError';
        this.code = code;
        this.message = message;
        this.data = data;
    }
}
```

### 2.2 `rpcCall` 函数

**Python**:
```python
async def rpc_call(
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    params: dict | None = None,
    request_id: int | str = 1,
) -> Any:
```

**JavaScript**:
```javascript
/**
 * 发送 JSON-RPC 请求
 * @param {AsyncClient} client - HTTP 客户端
 * @param {string} endpoint - RPC 端点路径
 * @param {string} method - RPC 方法名
 * @param {Object} [params] - 方法参数
 * @param {number|string} [requestId=1] - 请求 ID
 * @returns {Promise<any>}
 */
async function rpcCall(client, endpoint, method, params = {}, requestId = 1) {
    const payload = {
        jsonrpc: '2.0',
        method,
        params: params || {},
        id: requestId,
    };

    const response = await client.post(endpoint, payload);
    
    if (response.error) {
        throw new JsonRpcError(
            response.error.code,
            response.error.message,
            response.error.data
        );
    }

    return response.result;
}
```

### 2.3 `authenticatedRpcCall` 函数

**JavaScript**:
```javascript
/**
 * 带认证的 JSON-RPC 调用
 * @param {AsyncClient} client - HTTP 客户端
 * @param {string} endpoint - RPC 端点
 * @param {string} method - 方法名
 * @param {Object} [params] - 参数
 * @param {Object} options - 选项
 * @param {Authenticator} [options.auth] - 认证器
 * @param {string} [options.credentialName='default'] - 凭证名称
 * @returns {Promise<any>}
 */
async function authenticatedRpcCall(client, endpoint, method, params = {}, options = {}) {
    const { auth, credentialName = 'default' } = options;
    
    // 获取认证头
    const authHeaders = auth.getAuthHeader(client.baseURL);
    
    let response = await client.post(endpoint, {
        jsonrpc: '2.0',
        method,
        params: params || {},
        id: 1,
    }, {
        headers: authHeaders,
    });

    // 401 -> 刷新令牌 -> 重试
    if (response.status === 401) {
        auth.clearToken(client.baseURL);
        const newAuthHeaders = auth.getAuthHeader(client.baseURL, true);
        response = await client.post(endpoint, {
            jsonrpc: '2.0',
            method,
            params: params || {},
            id: 1,
        }, {
            headers: newAuthHeaders,
        });
    }

    // 缓存新令牌
    const newToken = auth.updateToken(client.baseURL, response.headers);
    if (newToken) {
        await updateJwt(credentialName, newToken);
    }

    if (response.error) {
        throw new JsonRpcError(
            response.error.code,
            response.error.message,
            response.error.data
        );
    }

    return response.result;
}
```

---

## 3. 导出接口

```javascript
export {
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall,
};
```

---

## 4. 迁移检查清单

- [ ] 实现 `JsonRpcError` 类
- [ ] 实现 `rpcCall` 函数
- [ ] 实现 `authenticatedRpcCall` 函数
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
