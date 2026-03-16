# auth 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/auth.py`  
**JavaScript 目标文件**: `module/src/auth.js`  
**功能**: DID 身份注册、更新和 WBA 认证、JWT 获取

---

## 2. 依赖关系

### 2.1 Python 依赖

```python
import httpx
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from anp.authentication import generate_auth_header
```

### 2.2 JavaScript 依赖

```javascript
import * as httpx from '@awiki/httpx';  // 或 node-fetch/axios
import * as crypto from 'crypto';
import { generateAuthHeader } from '@awiki/anp-auth';  // 需要移植或重写
```

### 2.3 本地依赖

```javascript
import { SDKConfig } from './config.js';
import { DIDIdentity, createIdentity } from './identity.js';
import { JsonRpcError, rpcCall } from './rpc.js';
```

---

## 3. 接口设计

### 3.1 函数签名对比

#### 3.1.1 `_secp256k1_sign_callback`

**Python**:
```python
def _secp256k1_sign_callback(
    private_key: ec.EllipticCurvePrivateKey,
) -> callable:
    def _callback(content: bytes, verification_method_fragment: str) -> bytes:
        return private_key.sign(content, ec.ECDSA(hashes.SHA256()))
    return _callback
```

**JavaScript**:
```javascript
/**
 * 创建 secp256k1 签名回调
 * @param {CryptoKey} privateKey - secp256k1 私钥
 * @returns {Function} 签名回调函数
 */
function _secp256k1SignCallback(privateKey) {
    return async function _callback(content, verificationMethodFragment) {
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            privateKey,
            content
        );
        return Buffer.from(signature);
    };
}
```

---

#### 3.1.2 `generate_wba_auth_header`

**Python**:
```python
def generate_wba_auth_header(
    identity: DIDIdentity,
    service_domain: str,
) -> str:
```

**JavaScript**:
```javascript
/**
 * 生成 DID WBA 认证头
 * @param {DIDIdentity} identity - DID 身份对象
 * @param {string} serviceDomain - 目标服务域名
 * @returns {string} Authorization 头值
 */
async function generateWbaAuthHeader(identity, serviceDomain) {
    const privateKey = await identity.getPrivateKey();
    return generateAuthHeader({
        didDocument: identity.didDocument,
        serviceDomain,
        signCallback: _secp256k1SignCallback(privateKey),
    });
}
```

---

#### 3.1.3 `register_did`

**Python**:
```python
async def register_did(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    name: str | None = None,
    is_public: bool = False,
    is_agent: bool = False,
    role: str | None = None,
    endpoint_url: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
```

**JavaScript**:
```javascript
/**
 * 注册 DID 身份
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {DIDIdentity} identity - DID 身份
 * @param {Object} options - 可选参数
 * @param {string} [options.name] - 显示名称
 * @param {boolean} [options.isPublic=false] - 是否公开可见
 * @param {boolean} [options.isAgent=false] - 是否为 AI Agent
 * @param {string} [options.role] - 角色
 * @param {string} [options.endpointUrl] - 连接端点
 * @param {string} [options.description] - 描述
 * @returns {Promise<Object>} 注册结果
 */
async function registerDid(client, identity, options = {}) {
    const {
        name = null,
        isPublic = false,
        isAgent = false,
        role = null,
        endpointUrl = null,
        description = null,
    } = options;

    const payload = { did_document: identity.didDocument };
    if (name !== null) payload.name = name;
    if (isPublic) payload.is_public = true;
    if (isAgent) payload.is_agent = true;
    if (role !== null) payload.role = role;
    if (endpointUrl !== null) payload.endpoint_url = endpointUrl;
    if (description !== null) payload.description = description;

    return rpcCall(client, '/user-service/did-auth/rpc', 'register', payload);
}
```

---

#### 3.1.4 `update_did_document`

**Python**:
```python
async def update_did_document(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    domain: str,
    *,
    is_public: bool = False,
    is_agent: bool = False,
    role: str | None = None,
    endpoint_url: str | None = None,
) -> dict[str, Any]:
```

**JavaScript**:
```javascript
/**
 * 更新 DID 文档
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {DIDIdentity} identity - 更新后的 DID 身份
 * @param {string} domain - 服务域名
 * @param {Object} options - 可选参数
 * @param {boolean} [options.isPublic=false]
 * @param {boolean} [options.isAgent=false]
 * @param {string} [options.role]
 * @param {string} [options.endpointUrl]
 * @returns {Promise<Object>} 更新结果
 */
async function updateDidDocument(client, identity, domain, options = {}) {
    const {
        isPublic = false,
        isAgent = false,
        role = null,
        endpointUrl = null,
    } = options;

    const payload = { did_document: identity.didDocument };
    if (isPublic) payload.is_public = true;
    if (isAgent) payload.is_agent = true;
    if (role !== null) payload.role = role;
    if (endpointUrl !== null) payload.endpoint_url = endpointUrl;

    const authHeader = await generateWbaAuthHeader(identity, domain);
    const response = await client.post('/user-service/did-auth/rpc', {
        jsonrpc: '2.0',
        method: 'update_document',
        params: payload,
        id: 1,
    }, {
        headers: { Authorization: authHeader },
    });

    // 处理响应...
}
```

---

#### 3.1.5 `get_jwt_via_wba`

**Python**:
```python
async def get_jwt_via_wba(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    domain: str,
) -> str:
```

**JavaScript**:
```javascript
/**
 * 通过 DID WBA 获取 JWT
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {DIDIdentity} identity - DID 身份
 * @param {string} domain - 服务域名
 * @returns {Promise<string>} JWT token
 */
async function getJwtViaWba(client, identity, domain) {
    const authHeader = await generateWbaAuthHeader(identity, domain);
    const result = await rpcCall(
        client,
        '/user-service/did-auth/rpc',
        'verify',
        { authorization: authHeader, domain }
    );
    return result.access_token;
}
```

---

#### 3.1.6 `create_authenticated_identity`

**Python**:
```python
async def create_authenticated_identity(
    client: httpx.AsyncClient,
    config: SDKConfig,
    name: str | None = None,
    is_public: bool = False,
    is_agent: bool = False,
    role: str | None = None,
    endpoint_url: str | None = None,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
```

**JavaScript**:
```javascript
/**
 * 一站式创建完整的 DID 身份
 * @param {httpx.AsyncClient} client - HTTP 客户端
 * @param {SDKConfig} config - SDK 配置
 * @param {Object} options - 可选参数
 * @param {string} [options.name] - 显示名称
 * @param {boolean} [options.isPublic=false]
 * @param {boolean} [options.isAgent=false]
 * @param {string} [options.role]
 * @param {string} [options.endpointUrl]
 * @param {Array<Object>} [options.services] - 自定义服务列表
 * @returns {Promise<DIDIdentity>} DID 身份对象
 */
async function createAuthenticatedIdentity(client, config, options = {}) {
    const {
        name = null,
        isPublic = false,
        isAgent = false,
        role = null,
        endpointUrl = null,
        services = null,
    } = options;

    // 1. 创建密钥绑定 DID
    const identity = createIdentity({
        hostname: config.didDomain,
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: config.didDomain,
        services,
    });

    // 2. 注册 DID
    const regResult = await registerDid(client, identity, {
        name, isPublic, isAgent, role, endpointUrl,
    });
    identity.userId = regResult.user_id;

    // 3. 获取 JWT
    identity.jwtToken = await getJwtViaWba(client, identity, config.didDomain);

    return identity;
}
```

---

## 4. 导出接口

```javascript
// auth.js
export {
    generateWbaAuthHeader,
    registerDid,
    updateDidDocument,
    getJwtViaWba,
    createAuthenticatedIdentity,
};

export default {
    generateWbaAuthHeader,
    registerDid,
    updateDidDocument,
    getJwtViaWba,
    createAuthenticatedIdentity,
};
```

---

## 5. 类型定义

```typescript
// types/auth.d.ts
import { DIDIdentity } from './identity.js';
import { AsyncClient } from './client.js';

export interface RegisterDidOptions {
    name?: string;
    isPublic?: boolean;
    isAgent?: boolean;
    role?: string;
    endpointUrl?: string;
    description?: string;
}

export interface UpdateDidDocumentOptions {
    isPublic?: boolean;
    isAgent?: boolean;
    role?: string;
    endpointUrl?: string;
}

export interface CreateAuthenticatedIdentityOptions {
    name?: string;
    isPublic?: boolean;
    isAgent?: boolean;
    role?: string;
    endpointUrl?: string;
    services?: ServiceEntry[];
}

export function generateWbaAuthHeader(
    identity: DIDIdentity,
    serviceDomain: string
): Promise<string>;

export function registerDid(
    client: AsyncClient,
    identity: DIDIdentity,
    options?: RegisterDidOptions
): Promise<RegisterResult>;

export function updateDidDocument(
    client: AsyncClient,
    identity: DIDIdentity,
    domain: string,
    options?: UpdateDidDocumentOptions
): Promise<UpdateResult>;

export function getJwtViaWba(
    client: AsyncClient,
    identity: DIDIdentity,
    domain: string
): Promise<string>;

export function createAuthenticatedIdentity(
    client: AsyncClient,
    config: SDKConfig,
    options?: CreateAuthenticatedIdentityOptions
): Promise<DIDIdentity>;
```

---

## 6. 实现注意事项

### 6.1 加密实现

**Python** 使用 `cryptography` 库：
```python
from cryptography.hazmat.primitives.asymmetric import ec
private_key.sign(content, ec.ECDSA(hashes.SHA256()))
```

**JavaScript** 使用 Web Crypto API：
```javascript
const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    content
);
```

### 6.2 HTTP 客户端

**Python** 使用 `httpx.AsyncClient`  
**JavaScript** 可选：
- `@awiki/httpx` (如果移植 httpx)
- `node-fetch` (Node.js 18+)
- `axios`

### 6.3 异步处理

Python 的 `async/await` 与 JavaScript 的 `async/await` 语义相同，直接对应即可。

---

## 7. 测试用例

```javascript
// tests/auth.test.js
import { describe, it, expect } from '@jest/globals';
import { generateWbaAuthHeader, registerDid } from '../src/auth.js';

describe('auth module', () => {
    it('should generate WBA auth header', async () => {
        const identity = await createIdentity({...});
        const header = await generateWbaAuthHeader(identity, 'awiki.ai');
        expect(header).toMatch(/^DIDWba /);
    });

    it('should register DID', async () => {
        const client = createTestClient();
        const identity = await createIdentity({...});
        const result = await registerDid(client, identity);
        expect(result).toHaveProperty('user_id');
    });
});
```

---

## 8. 迁移检查清单

- [ ] 实现 `_secp256k1SignCallback` 函数
- [ ] 实现 `generateWbaAuthHeader` 函数
- [ ] 实现 `registerDid` 函数
- [ ] 实现 `updateDidDocument` 函数
- [ ] 实现 `getJwtViaWba` 函数
- [ ] 实现 `createAuthenticatedIdentity` 函数
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 更新文档
