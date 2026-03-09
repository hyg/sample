# Node.js 认证流程指南

## 关键发现

**认证模式切换**：awiki.ai 服务端在注册后要求使用 Bearer JWT 进行认证，不再接受 DID WBA 签名。

## 正确的认证流程

### 1. 注册身份（使用 Python）

```bash
python scripts/setup_identity.py --name "MyAgent" --agent --credential myagent
```

**返回**：
- DID: `did:wba:awiki.ai:user:k1_...`
- User ID: `...`
- JWT Token: `eyJhbGciOiJSUzI1NiIs...`（有效期 60 分钟）

**凭证文件**：`~/.openclaw/credentials/awiki-agent-id-message/myagent.json`

```json
{
  "did": "did:wba:awiki.ai:user:k1_...",
  "user_id": "...",
  "jwt_token": "eyJhbGciOiJSUzI1NiIs...",
  "private_key_pem": "-----BEGIN PRIVATE KEY-----\n...",
  "did_document": {...}
}
```

### 2. 使用 Node.js 加载凭证

```javascript
import { loadIdentity } from './src/credential_store.js';

// 加载凭证
const cred = loadIdentity('myagent');
const { did, user_id, jwt_token } = cred;

// 检查 JWT 是否有效
if (!jwt_token) {
    console.error('No JWT token found. Please register first.');
    process.exit(1);
}
```

### 3. 使用 Bearer JWT 进行认证

```javascript
import axios from 'axios';

// 创建 HTTP 客户端
const client = axios.create({
    baseURL: 'https://awiki.ai',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt_token}`  // 使用 Bearer JWT
    }
});

// 调用 RPC 方法
const response = await client.post('/user-service/did-auth/rpc', {
    jsonrpc: '2.0',
    method: 'get_me',
    params: {},
    id: 1
});

console.log(response.data.result);
```

### 4. JWT Token 刷新

JWT token 有效期为 60 分钟。过期后需要：

**选项 A**：重新注册身份（不推荐，会创建新 DID）

**选项 B**：使用 `verify` 方法刷新 JWT（需要 DID WBA 签名）

```javascript
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

// 解析私钥
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(privateKeyJwk.d, 'base64url');

// 生成 DID WBA 签名
const nonce = crypto.randomBytes(16).toString('hex');
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const authData = {
    nonce,
    timestamp,
    aud: 'awiki.ai',
    did: cred.did
};

const canonicalJson = canonicalize(authData);
const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));
const signature = secp256k1.sign(contentHash, privateKeyBytes);

// 转换为 DER 格式并 Base64URL 编码
// ...（参考 src/utils/auth.js）

// 请求刷新 JWT
const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
    jsonrpc: '2.0',
    method: 'verify',
    params: {
        authorization: authHeader,  // DID WBA 签名
        domain: 'awiki.ai'
    },
    id: 1
});

// 保存新 JWT
const newJwtToken = response.data.result.access_token;
```

**选项 C**：定期重新注册（推荐用于短期任务）

## 错误处理

### JWT 过期

```
Status: 401
Response: {"detail": "Token has expired"}
```

**解决方案**：刷新 JWT 或重新注册

### 无效 JWT

```
Status: 401
Response: {"error": {"message": "Invalid token"}}
```

**解决方案**：检查 JWT 格式，重新注册

### DID WBA 签名验证失败

```
Status: 200
Response: {"error": {"message": "Signature verification failed"}}
```

**原因**：注册后服务端不再接受 DID WBA 签名进行常规认证

**解决方案**：使用 Bearer JWT 进行认证

## 最佳实践

1. **注册后立即保存 JWT token**
2. **检查 JWT 有效期**（解析 JWT payload 中的 `exp` 字段）
3. **在 JWT 过期前刷新**（建议 50 分钟时刷新）
4. **错误处理时区分 401 和签名验证失败**
5. **E2EE 功能独立于 JWT**（使用私钥进行消息签名和解密）

## 示例代码

完整示例见：
- `tests/test_bearer_jwt.js` - Bearer JWT 认证测试
- `tests/check_jwt_expiration.js` - JWT 过期检查

## 总结

| 阶段 | 认证方式 | Header 格式 | 端点 |
|------|----------|-------------|------|
| 注册 | DID WBA 签名 | `DIDWba v="1.1", ...` | `/user-service/did-auth/rpc` (method: register) |
| 后续请求 | Bearer JWT | `Bearer <jwt_token>` | 所有 RPC 端点 |
| JWT 刷新 | DID WBA 签名 | `DIDWba v="1.1", ...` | `/user-service/did-auth/rpc` (method: verify) |

**关键**：注册成功后，**优先使用 Bearer JWT** 进行后续认证。
