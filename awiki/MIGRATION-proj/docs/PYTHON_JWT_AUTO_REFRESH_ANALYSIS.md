# Python JWT 自动刷新机制分析

**分析日期**: 2026-03-09  
**Python 版本**: 1.0.0 (anp>=0.6.8)

---

## JWT 自动刷新流程

### 核心机制

Python 版本实现了**全自动的 JWT 过期检测和刷新机制**，无需人工参与。

```
请求 API
    ↓
发送请求 (携带 JWT)
    ↓
服务器返回 401 Unauthorized
    ↓
检测到 401 错误
    ↓
清除过期 JWT
    ↓
重新生成 DID 签名认证头
    ↓
重试请求
    ↓
获取新 JWT
    ↓
保存到凭证文件
    ↓
继续后续功能
```

---

## 关键文件和函数

### 1. `scripts/utils/rpc.py`

**函数**: `authenticated_rpc_call()`

**位置**: 第 88-145 行

**核心逻辑**:

```python
async def authenticated_rpc_call(
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    params: dict | None = None,
    request_id: int | str = 1,
    *,
    auth: Any = None,  # DIDWbaAuthHeader 实例
    credential_name: str = "default",
) -> Any:
    """JSON-RPC 2.0 request with automatic 401 retry.

    Uses DIDWbaAuthHeader to manage authentication headers and token caching.
    On 401, automatically clears the expired token and regenerates DIDWba auth header to retry.
    """
    server_url = str(client.base_url)
    payload = {...}

    # 第一次请求（使用缓存的 JWT）
    auth_headers = auth.get_auth_header(server_url)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)

    # 检测 401 -> 清除过期 token -> 重新认证 -> 重试
    if resp.status_code == 401:
        auth.clear_token(server_url)  # 清除过期 JWT
        auth_headers = auth.get_auth_header(server_url, force_new=True)  # 强制生成新的 DID 签名
        resp = await client.post(endpoint, json=payload, headers=auth_headers)

    resp.raise_for_status()

    # 成功：从响应头获取新 JWT 并保存
    auth_header_value = resp.headers.get("authorization", "")
    new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
    if new_token:
        from credential_store import update_jwt
        update_jwt(credential_name, new_token)  # 保存到凭证文件

    return body["result"]
```

**关键点**:
1. **自动检测 401**: `if resp.status_code == 401:`
2. **清除过期 JWT**: `auth.clear_token(server_url)`
3. **强制重新认证**: `auth.get_auth_header(server_url, force_new=True)`
4. **保存新 JWT**: `update_jwt(credential_name, new_token)`

---

### 2. `scripts/utils/auth.py`

**函数**: `generate_wba_auth_header()`

**位置**: 第 47-62 行

**功能**: 生成 DID WBA 认证头

```python
def generate_wba_auth_header(
    identity: DIDIdentity,
    service_domain: str,
) -> str:
    """Generate DID WBA Authorization header."""
    private_key = identity.get_private_key()
    return generate_auth_header(
        did_document=identity.did_document,
        service_domain=service_domain,
        sign_callback=_secp256k1_sign_callback(private_key),
    )
```

**调用链**:
```
generate_wba_auth_header()
    ↓
generate_auth_header()  # ANP 包中的函数
    ↓
构建认证数据 {nonce, timestamp, aud, did}
    ↓
JCS 规范化
    ↓
SHA-256 哈希
    ↓
ECDSA secp256k1 签名 (DER 格式)
    ↓
Base64URL 编码
    ↓
返回 DIDWba 认证头
```

---

### 3. `anp.authentication` 包

**模块**: `anp.authentication.generate_auth_header`

**功能**: ANP 包提供的核心认证函数

**输入**:
- `did_document`: DID 文档（包含 proof）
- `service_domain`: 服务端域名
- `sign_callback`: 签名回调函数

**输出**: DIDWba 认证头字符串

**签名流程**:
```python
def _secp256k1_sign_callback(private_key):
    def _callback(content, verification_method_fragment):
        # ECDSA 签名（DER 格式）
        return private_key.sign(content, ec.ECDSA(hashes.SHA256()))
    return _callback
```

---

### 4. `scripts/credential_store.py`

**函数**: `update_jwt()`

**功能**: 更新凭证文件中的 JWT token

```python
def update_jwt(credential_name: str, jwt_token: str) -> None:
    """Update JWT token in credential file."""
    cred_path = get_credential_path(credential_name)
    cred = load_identity(credential_name)
    cred["jwt_token"] = jwt_token
    save_identity(cred, credential_name)
```

---

## 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户调用 API (如 send_message)                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. authenticated_rpc_call() 被调用                           │
│    - 从 auth 对象获取认证头（使用缓存的 JWT）                   │
│    - auth.get_auth_header(server_url)                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 发送 HTTP POST 请求                                        │
│    POST /message/rpc                                         │
│    Headers: Authorization: DIDWba v="1.1", ...               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
          ┌────────┴────────┐
          │  服务器响应      │
          └────────┬────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ↓                       ↓
┌─────────────┐         ┌─────────────┐
│ 200 OK      │         │ 401 Unauthorized │
│ 有 JWT      │         │ JWT 过期     │
└─────────────┘         └──────┬──────┘
       │                       │
       │                       ↓
       │              ┌─────────────────────────┐
       │              │ 4. 检测 401 错误          │
       │              │ auth.clear_token()      │
       │              └────────┬────────────────┘
       │                       │
       │                       ↓
       │              ┌─────────────────────────┐
       │              │ 5. 强制重新认证          │
       │              │ auth.get_auth_header(   │
       │              │   force_new=True)       │
       │              │ - 生成新的 nonce        │
       │              │ - 生成新的 timestamp    │
       │              │ - DID 私钥签名          │
       │              └────────┬────────────────┘
       │                       │
       │                       ↓
       │              ┌─────────────────────────┐
       │              │ 6. 重试请求              │
       │              │ POST /message/rpc       │
       │              │ Headers: 新认证头        │
       │              └────────┬────────────────┘
       │                       │
       │                       ↓
       │              ┌─────────────────────────┐
       │              │ 7. 服务器验证成功        │
       │              │ 返回 200 OK             │
       │              │ Headers: Authorization: │
       │              │   Bearer <new_jwt>      │
       │              └────────┬────────────────┘
       │                       │
       │                       ↓
       │              ┌─────────────────────────┐
       │              │ 8. 保存新 JWT            │
       │              │ auth.update_token()     │
       │              │ update_jwt(             │
       │              │   credential_name,      │
       │              │   new_token)            │
       │              │ - 写入凭证文件           │
       │              └────────┬────────────────┘
       │                       │
       └───────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. 返回 API 结果给用户                                         │
│    整个过程用户无感知，无需人工干预                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 涉及的文件清单

| 文件 | 函数/类 | 作用 |
|------|--------|------|
| `scripts/utils/rpc.py` | `authenticated_rpc_call()` | 核心认证和自动刷新逻辑 |
| `scripts/utils/auth.py` | `generate_wba_auth_header()` | 生成 DID 认证头 |
| `scripts/credential_store.py` | `update_jwt()` | 保存新 JWT 到凭证文件 |
| `anp.authentication` | `generate_auth_header` | ANP 包提供的认证函数 |
| `anp.authentication` | `DIDWbaAuthHeader` | DID 认证头管理类（内部使用） |

---

## 关键特性

### 1. 完全自动化

- ✅ 自动检测 401 错误
- ✅ 自动清除过期 JWT
- ✅ 自动生成新的 DID 签名
- ✅ 自动重试请求
- ✅ 自动保存新 JWT
- ✅ 用户无感知，无需人工干预

### 2. 凭证持久化

- JWT 保存在凭证文件中
- 每次刷新后自动更新文件
- 下次启动时自动加载最新 JWT

### 3. 认证头缓存

- `DIDWbaAuthHeader` 类内部缓存 JWT
- 优先使用缓存的 JWT
- 401 时强制刷新

---

## Node.js 版本对比

### Python 版本（完整实现）

```python
# rpc.py
if resp.status_code == 401:
    auth.clear_token(server_url)
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 保存新 JWT
if new_token:
    update_jwt(credential_name, new_token)
```

### Node.js 版本（待完善）

```javascript
// 当前实现：缺少 401 自动重试
const result = await authenticatedRpcCall(
    client, MESSAGE_RPC, 'send',
    {...}, 1,
    { auth, credentialName }
);

// 需要添加：
// if (response.status === 401) {
//     auth.clearToken(serverUrl);
//     headers = auth.getAuthHeader(serverUrl, true);
//     response = await client.post(..., headers);
// }
```

---

## 总结

Python 版本的 JWT 自动刷新机制是一个**完整的、全自动的认证系统**：

1. **检测**: 自动检测 401 错误
2. **刷新**: 自动重新生成 DID 签名认证
3. **重试**: 自动重试失败的请求
4. **保存**: 自动保存新 JWT 到凭证文件
5. **透明**: 整个过程对用户完全透明

这个机制确保了：
- 用户无需手动刷新 JWT
- API 调用不会因为 JWT 过期而失败
- 凭证文件始终保持最新状态

**Node.js 版本需要完全复制这个机制**，包括：
- `authenticatedRpcCall` 的 401 重试逻辑
- `DIDWbaAuthHeader` 的 token 缓存和刷新
- `updateJwt` 的凭证文件更新

---

**分析人**: AI Assistant  
**分析日期**: 2026-03-09  
**参考文档**: `scripts/utils/rpc.py`, `scripts/utils/auth.py`, `scripts/credential_store.py`
