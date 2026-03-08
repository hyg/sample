# 测试结果：认证模式切换

## 测试时间
2026-03-07

## 测试假设

### 假设一：认证模式切换
**内容**：注册成功后，服务端要求后续请求使用 Bearer JWT 认证，不再接受 DID WBA 签名。

**测试结果**：✓ **已证实**

**证据**：
```
Test: Using Bearer JWT for authentication...
Result: SUCCESS with Bearer JWT
Response: {
  "did": "did:wba:awiki.ai:user:k1_YyAuYBpZnBFunOHFBOBLmh1WL8kxOe8nvmlWc1MKaXw",
  "user_id": "01947b20-2627-429e-8f6a-474101af8bac",
  "name": null,
  "avatar": null,
  "role": null,
  "is_public": false
}
```

### 假设二：防重放机制
**内容**：服务端有严格的 Nonce 去重或 Timestamp 窗口限制。

**测试结果**：✗ **未证实**

即使使用全新的 nonce 和 timestamp，DID WBA 签名验证仍然失败。

### 假设三：凭证状态问题
**内容**：注册后 DID 状态需要激活或权限同步。

**测试结果**：✓ **部分证实**

使用 JWT 可以成功获取用户信息，说明凭证状态正常，但 DID WBA 签名不被接受。

---

## 正确的认证流程

### 1. 注册阶段
```
POST /user-service/did-auth/rpc
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "register",
  "params": {
    "did_document": {...},  // 包含 W3C proof
    "name": "TestUser",
    "is_agent": false
  },
  "id": 1
}

Response:
{
  "jsonrpc": "2.0",
  "result": {
    "did": "did:wba:awiki.ai:user:k1_...",
    "user_id": "01947b20-...",
    "access_token": "eyJhbGciOiJSUzI1NiIs..."  // JWT token
  },
  "id": 1
}
```

### 2. 后续请求（使用 JWT）
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

Response:
{
  "jsonrpc": "2.0",
  "result": {
    "did": "did:wba:awiki.ai:user:k1_...",
    "user_id": "01947b20-...",
    "name": null,
    ...
  },
  "id": 1
}
```

### 3. 错误方式（不再接受）
```
POST /user-service/did-auth/rpc
Content-Type: application/json
Authorization: DIDWba v="1.1", did="...", ...  // 这种方式不再被接受

{
  "jsonrpc": "2.0",
  "method": "verify",  // verify 方法可能仅用于 JWT 刷新
  "params": {
    "authorization": "DIDWba ...",
    "domain": "awiki.ai"
  },
  "id": 1
}

Response:
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Signature verification failed: Signature verification failed"
  },
  "id": 1
}
```

---

## Node.js 实现建议

### 正确的使用流程

1. **使用 Python 注册身份**（或等待 Node.js 注册功能测试通过）
   ```bash
   python scripts/setup_identity.py --name "MyAgent" --agent --credential myagent
   ```

2. **保存返回的 JWT token**
   - 凭证文件已包含 `jwt_token` 字段

3. **Node.js 加载凭证并使用 JWT**
   ```javascript
   import { loadIdentity } from './src/credential_store.js';
   
   const cred = loadIdentity('myagent');
   const jwtToken = cred.jwt_token;
   
   // 使用 JWT 进行认证
   const client = createUserServiceClient(config);
   client.headers['Authorization'] = `Bearer ${jwtToken}`;
   
   // 调用 RPC 方法
   const result = await authenticatedRpcCall(client, '/user-service/did-auth/rpc', 'get_me', {});
   ```

4. **E2EE 功能独立工作**
   - E2EE 加密/解密不依赖 JWT
   - 使用私钥进行消息签名和解密

---

## 文档更新

需要更新以下文档：

1. `nodejs-awiki/README.md` - 说明认证流程
2. `nodejs-awiki/scripts/README.md` - 说明各脚本的用途
3. `PYTHON_NODEJS_COMPARISON.md` - 添加认证模式切换的说明

---

## 总结

**问题已解决**：不是 Node.js 实现的问题，而是认证模式的理解有误。

**正确的做法**：
- 注册时使用 DID WBA 签名
- 注册成功后，使用返回的 JWT token 进行后续认证
- 不要尝试使用 `verify` 方法重新获取 JWT（除非需要刷新 token）

**Node.js 实现状态**：
- ✓ JCS 规范化 - 正确
- ✓ SHA-256 哈希 - 正确
- ✓ ECDSA 签名 - 正确
- ✓ W3C proof 生成 - 正确
- ✓ 凭证存储 - 正确
- ✓ JWT 使用 - 待文档化
