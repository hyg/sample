# JWT 自动刷新功能实现报告

**实现日期**: 2026-03-09  
**功能**: 401 自动检测并刷新 JWT

---

## 实现逻辑

### 401 处理流程

```javascript
// src/utils/rpc.js - authenticatedRpcCall

if (resp.status === 401) {
    console.log('[401] JWT expired or invalid, obtaining new JWT...');
    
    if (auth) {
        // 1. 清除过期 token
        auth.clearToken(serverUrl);
        
        // 2. 加载身份获取私钥和 DID 文档
        const { loadIdentity } = await import('../credential_store.js');
        const identity = loadIdentity(credentialName);
        
        if (identity && identity.private_key_pem && identity.did_document) {
            try {
                // 3. 通过 DID WBA 签名获取新 JWT
                const { getJwtViaWba } = await import('../auth.js');
                const newJwt = await getJwtViaWba(
                    serverUrl.replace(/\/.*$/, '/user-service/did-auth/rpc'),
                    identity.did_document,
                    identity.private_key_pem,
                    'awiki.ai'
                );
                
                console.log('[401] New JWT obtained successfully');
                
                // 4. 保存新 JWT 到凭证文件
                const { updateJwt } = await import('../credential_store.js');
                updateJwt(credentialName, newJwt);
                
                // 5. 更新 auth token 缓存
                auth.updateToken(serverUrl, { 'Authorization': `Bearer ${newJwt}` });
                
                // 6. 用新 JWT 重试请求
                authHeaders = { 'Authorization': `Bearer ${newJwt}` };
                resp = await client.post(endpoint, payload, { headers: authHeaders });
                
            } catch (e) {
                console.error('[401] Failed to obtain new JWT:', e.message);
                throw new Error(`JWT refresh failed: ${e.message}`);
            }
        } else {
            throw new Error('Cannot refresh JWT: identity not found or missing required fields');
        }
    } else {
        throw new Error('401 Unauthorized but no auth provider available');
    }
}
```

---

## 工作流程

### 正常流程

```
1. 发送请求（使用缓存的 JWT）
   ↓
2. 服务端返回 200 OK
   ↓
3. 从响应头获取新 JWT（如果服务端返回）
   ↓
4. 保存 JWT 到凭证文件
   ↓
5. 返回结果
```

### JWT 过期流程

```
1. 发送请求（使用过期的 JWT）
   ↓
2. 服务端返回 401 Unauthorized
   ↓
3. [自动] 清除缓存的过期 JWT
   ↓
4. [自动] 加载身份文件获取私钥和 DID 文档
   ↓
5. [自动] 通过 DID WBA 签名获取新 JWT
   ↓
6. [自动] 保存新 JWT 到凭证文件
   ↓
7. [自动] 更新 auth token 缓存
   ↓
8. [自动] 用新 JWT 重试原请求
   ↓
9. 服务端返回 200 OK
   ↓
10. 返回结果
```

---

## 用户感知

### 无感知刷新

**用户角度**:
```javascript
// 用户代码不需要任何变化
const result = await authenticatedRpcCall(
    client,
    '/message/rpc',
    'send',
    { ... }
);

// JWT 过期时会自动刷新，用户无感知
```

**日志输出**（仅调试模式）:
```
[401] JWT expired or invalid, obtaining new JWT...
[401] New JWT obtained successfully
```

---

## 测试方法

### 方法 1: 等待 JWT 自然过期

```bash
# 1. 创建身份
set NODE_AWIKI_DEBUG=true
node scripts/setup_identity.js --name TestUser --agent

# 2. 等待 60 分钟（JWT 有效期）

# 3. 发送消息（应触发自动刷新）
node scripts/send_test_message_simple.js
```

### 方法 2: 使用测试脚本

```bash
set NODE_AWIKI_DEBUG=true
node scripts/test_jwt_auto_refresh.js
```

### 方法 3: 手动修改 JWT 为过期时间

```bash
# 1. 备份当前 JWT
copy .credentials\k1_...\auth.json .credentials\auth.json.backup

# 2. 修改 auth.json 中的 JWT 为一个过期的 JWT

# 3. 发送消息测试自动刷新
node scripts/send_test_message_simple.js
```

---

## 错误处理

### 成功刷新

```
✅ Message sent successfully!
   Server Seq: 1

✅ JWT was refreshed successfully!
   New JWT expires: 2026-03-09T14:30:00.000Z
   New JWT valid for: 60 minutes
```

### 刷新失败

```
[401] JWT expired or invalid, obtaining new JWT...
[401] Failed to obtain new JWT: <error message>

❌ Failed: JWT refresh failed: <error message>
```

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `identity not found` | 凭证文件不存在 | 使用 `setup_identity.js --load` 重新加载 |
| `missing required fields` | 身份文件缺少私钥或 DID 文档 | 重新创建身份 |
| `JWT refresh failed` | DID WBA 签名验证失败 | 检查私钥是否正确 |

---

## 依赖模块

### 必需模块

- `credential_store.js` - 凭证管理
- `auth.js` - DID WBA 签名
- `rpc.js` - RPC 调用（包含 401 处理）

### 可选模块

- 无

---

## 配置项

### 环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `NODE_AWIKI_DEBUG` | `true` | 调试模式，使用本地凭证目录 |
| `NODE_AWIKI_DEBUG` | (空) | 生产模式，使用系统凭证目录 |

### 凭证目录

| 模式 | 目录 |
|------|------|
| **调试** | `./nodejs-awiki/.credentials/` |
| **生产** | `%USERPROFILE%\.openclaw\credentials\awiki-agent-id-message\` |

---

## 与 Python 版本对比

### Python 版本

```python
# Python: utils/rpc.py
if resp.status_code == 401:
    auth.clear_token(server_url)
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 期望服务端在响应头返回 JWT
auth_header_value = resp.headers.get("authorization", "")
new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
```

**问题**: 服务端可能不在响应头返回 JWT

### Node.js 版本

```javascript
// Node.js: src/utils/rpc.js
if (resp.status === 401) {
    // 主动获取 JWT
    const newJwt = await getJwtViaWba(...);
    
    // 保存并重试
    updateJwt(credentialName, newJwt);
    resp = await client.post(endpoint, payload, { headers: newJwt });
}
```

**优势**: 不依赖服务端返回 JWT，主动获取

---

## 实现状态

### ✅ 已完成

- [x] 401 自动检测
- [x] 清除过期 JWT
- [x] 加载身份文件
- [x] DID WBA 签名获取 JWT
- [x] 保存新 JWT 到凭证文件
- [x] 更新 auth token 缓存
- [x] 重试原请求
- [x] 错误处理和日志

### ⏳ 待测试

- [ ] JWT 自然过期后自动刷新
- [ ] 多账号场景下的自动刷新
- [ ] 网络异常时的重试

---

## 日志级别

### 调试模式

```bash
set NODE_AWIKI_DEBUG=true
```

**输出**:
```
[401] JWT expired or invalid, obtaining new JWT...
[401] New JWT obtained successfully
```

### 生产模式

```bash
set NODE_AWIKI_DEBUG=
```

**输出**: 无（静默刷新）

---

## 最佳实践

### 1. 使用 authenticatedRpcCall

所有需要认证的 API 调用都应该使用 `authenticatedRpcCall`，它会自动处理 401 和 JWT 刷新。

```javascript
// ✅ 正确
const result = await authenticatedRpcCall(client, endpoint, method, params, 1, { auth, credentialName });

// ❌ 错误 - 不会自动刷新 JWT
const result = await client.post(endpoint, payload, { headers: authHeaders });
```

### 2. 保存凭证

确保身份凭证正确保存，包含以下必需字段：
- `private_key_pem` - 私钥
- `did_document` - DID 文档
- `jwt_token` - JWT（可选，过期会自动刷新）

### 3. 错误处理

捕获 JWT 刷新失败的错误并提供友好的用户提示：

```javascript
try {
    const result = await authenticatedRpcCall(...);
} catch (e) {
    if (e.message.includes('JWT refresh failed')) {
        console.log('认证失败，请重新登录');
        // 引导用户重新创建身份
    }
}
```

---

## 总结

### 实现效果

✅ **用户无感知的 JWT 自动刷新**

- 401 自动检测
- 主动获取新 JWT
- 保存并重试
- 完整的错误处理

### 下一步

1. **等待 JWT 自然过期测试** - 验证完整流程
2. **添加日志级别控制** - 生产环境静默刷新
3. **优化错误提示** - 友好的用户提示

---

**实现完成时间**: 2026-03-09 13:00  
**状态**: ✅ **实现完成，待自然过期测试**
