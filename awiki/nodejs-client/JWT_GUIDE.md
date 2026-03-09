# Node.js JWT 获取和使用指南

## 问题说明

Node.js 注册身份时，JWT 获取失败（`getJwtViaWba` 返回 "Signature verification failed"）。

**原因**：awiki.ai 服务端在注册后可能不再接受 DID WBA 签名方式的 JWT 获取请求。

## 解决方案

### 方案 1：使用 Python 注册获取 JWT（推荐）

1. **使用 Python 注册身份**
   ```bash
   cd D:\huangyg\git\awiki-agent-id-skill
   python scripts/setup_identity.py --name "MyAgent" --agent --credential myagent
   ```

2. **Python 注册成功后会返回 JWT**
   ```
   JWT token : eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1jZDRjYjI3ZiIsIn...
   ```

3. **Node.js 加载凭证使用 JWT**
   ```javascript
   import { loadIdentity } from './src/credential_store.js';
   
   const cred = loadIdentity('myagent');
   const jwt = cred.jwt_token;
   
   // 使用 Bearer JWT 进行认证
   const response = await axios.post('https://awiki.ai/...', data, {
       headers: { 'Authorization': `Bearer ${jwt}` }
   });
   ```

### 方案 2：从现有 Python 凭证复制 JWT

如果已经有 Python 注册的凭证（如 `bearertest`），可以直接使用其 JWT：

```bash
node tests/test_python_jwt.js
```

这个脚本会：
1. 加载 Python 凭证（`bearertest.json`）
2. 测试 JWT 是否有效
3. 保存 JWT 到 Node.js 凭证目录

### 方案 3：手动保存 JWT

1. 从 Python 凭证文件复制 JWT token
2. 创建 Node.js 凭证文件，包含 JWT：
   ```json
   {
     "did": "did:wba:awiki.ai:user:k1_...",
     "jwt_token": "eyJhbGciOiJSUzI1NiIs...",
     "source": "Manual copy from Python"
   }
   ```

## JWT 有效期

- **TTL**: 60 分钟
- **刷新**: 过期后需要重新注册或使用 `verify` 方法刷新

## 测试脚本

| 脚本 | 用途 | 状态 |
|------|------|------|
| `tests/test_python_jwt.js` | 使用 Python JWT | ✓ 通过 |
| `tests/test_jwt_acquisition.js` | Node.js 获取 JWT | ⚠️ 部分失败 |
| `tests/test_bearer_jwt.js` | Bearer JWT 认证 | ✓ 通过 |

## API 端点

### 注册（获取 JWT）
```
POST /user-service/did-auth/rpc
Content-Type: application/json
Authorization: DIDWba v="1.1", ...

{
  "jsonrpc": "2.0",
  "method": "register",
  "params": {
    "did_document": {...},
    "name": "MyAgent",
    "is_agent": true
  },
  "id": 1
}
```

**响应**：
```json
{
  "result": {
    "did": "did:wba:...",
    "user_id": "...",
    "access_token": "eyJhbGciOiJSUzI1NiIs..."  // JWT token
  }
}
```

### 使用 JWT 认证
```
POST /user-service/did-auth/rpc
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

{
  "jsonrpc": "2.0",
  "method": "get_me",
  "params": {},
  "id": 1
}
```

## 最佳实践

1. **优先使用 Python 注册** - 确保 JWT 获取成功
2. **保存 JWT 到凭证文件** - 方便 Node.js 加载使用
3. **检查 JWT 有效期** - 60 分钟 TTL
4. **JWT 过期前重新注册** - 或实现刷新逻辑

## 故障排查

### JWT 获取失败
```
Error: Signature verification failed
```
**解决**：使用 Python 注册获取 JWT

### JWT 过期
```
Status: 401
Response: {"detail": "Token has expired"}
```
**解决**：重新注册身份获取新 JWT

### 凭证文件无 JWT
检查凭证文件是否包含 `jwt_token` 字段：
```json
{
  "jwt_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

---

**更新时间**: 2026-03-07 23:45:00 UTC
