# 多账号测试与 JWT 自动刷新问题分析

**测试日期**: 2026-03-09  
**测试目的**: 验证多账号消息收发和 JWT 自动刷新功能

---

## 测试环境

### 调试模式 vs 生产模式

**调试模式** (开发时使用):
```bash
set NODE_AWIKI_DEBUG=true
node scripts/test_multi_account_messages.js
```
- 凭证目录：`./nodejs-awiki/.credentials/`
- 用途：本地开发测试

**生产模式** (npm 包发布后):
```bash
node scripts/test_multi_account_messages.js
```
- 凭证目录：`C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\`
- 用途：正式使用

---

## 测试账号状态

| 账号名 | DID | JWT 状态 | 过期时间 |
|--------|-----|----------|----------|
| **nodeagentfixed** | k1_ZC4d5CFo... | ❌ 已过期 | 2026-03-08 04:44 |
| **nodetest1** | k1_5T3jD34N... | ❌ 已过期 | 2026-03-08 07:14 |
| **MsgTest1** | k1_pQtIhzZQ... | ✅ 有效 | 53 分钟后 |

---

## 测试结果

### Test 1: 检查收件箱

**nodeagentfixed** (JWT 过期):
```
=== Checking inbox for nodeagentfixed ===
Failed to check inbox: 需要认证
JsonRpcError: 需要认证 (code: -32000)
```

**结果**: ❌ 401 认证失败，JWT 过期

**问题**: 401 后没有自动刷新 JWT

---

## 问题分析

### 401 自动刷新逻辑

当前实现 (`src/utils/rpc.js`):
```javascript
if (resp.status === 401) {
    if (auth) {
        auth.clearToken(serverUrl);
        authHeaders = auth.getAuthHeader(serverUrl, true);  // 生成 DID WBA 签名
        resp = await client.post(endpoint, payload, { headers: authHeaders });
    }
}
```

**问题**:
1. 清除缓存 JWT ✓
2. 生成 DID WBA 签名头 ✓
3. 用 DID WBA 签名重试原请求 ✓
4. **期望服务端在响应头返回新 JWT** ✗

**实际情况**: 服务端**不会**在普通 API 响应头中返回 JWT！

### Python 版本的实现

Python 版本也是同样的逻辑，但为什么 Python 能成功？

**可能原因**:
1. Python 的 JWT 还没过期
2. Python 的 `get_auth_header` 内部有不同实现
3. 服务端行为有变化

---

## 解决方案

### 方案 1: 主动调用 verify 接口获取 JWT

修改 `rpc.js` 的 401 处理：

```javascript
if (resp.status === 401) {
    if (auth) {
        auth.clearToken(serverUrl);
        
        // 主动调用 verify 接口获取新 JWT
        const { getJwtViaWba } = await import('../auth.js');
        const newJwt = await getJwtViaWba(
            serverUrl.replace('/message/rpc', '/user-service/did-auth/rpc'),
            auth.didDocument,
            auth.privateKeyBytes,
            'awiki.ai'
        );
        
        // 保存新 JWT
        const { updateJwt } = await import('../credential_store.js');
        updateJwt(credentialName, newJwt);
        
        // 用新 JWT 重试
        authHeaders = { 'Authorization': `Bearer ${newJwt}` };
        resp = await client.post(endpoint, payload, { headers: authHeaders });
    }
}
```

**优点**: 
- 不依赖服务端返回 JWT
- 明确的 JWT 获取流程

**缺点**:
- 需要额外的一次 API 调用
- 代码复杂度增加

---

### 方案 2: 添加 JWT 过期预检

在请求前检查 JWT 是否即将过期：

```javascript
function isJwtExpiringSoon(jwtToken, thresholdMinutes = 5) {
    try {
        const payload = JSON.parse(Buffer.from(jwtToken.split('.')[1], 'base64').toString());
        const expTime = new Date(payload.exp * 1000);
        const now = new Date();
        const expiresIn = (expTime - now) / 1000 / 60;
        return expiresIn < thresholdMinutes;
    } catch {
        return true;
    }
}
```

**优点**: 提前刷新，避免 401
**缺点**: 增加复杂度

---

## 调试模式实施状态

### ✅ 已完成

1. **凭证目录切换**
   - `src/credential_store.js` 添加 `isDebugMode()` 函数
   - 调试模式：`./.credentials/`
   - 生产模式：`C:\Users\hyg\.openclaw\credentials\...`

2. **多账号测试脚本**
   - `scripts/test_multi_account_messages.js`
   - 支持 3 个账号互相收发消息
   - 自动检测 JWT 状态

3. **批处理文件**
   - `test_multi_account.bat`
   - 一键运行调试模式测试

### ⏳ 待完成

1. **修复 401 自动刷新**
   - 实现主动获取 JWT
   - 或验证服务端是否真的返回 JWT

2. **创建更多测试账号**
   - 有些 JWT 已过期
   - 需要刷新或新建

---

## 下一步行动

### 立即执行

1. **刷新过期 JWT**
   ```bash
   node scripts/setup_identity.js --load nodeagentfixed
   node scripts/setup_identity.js --load nodetest1
   ```

2. **重新运行测试**
   ```bash
   test_multi_account.bat
   ```

3. **观察 401 处理**
   - 添加详细日志
   - 查看服务端响应头

### 修复 401 自动刷新

如果确认服务端不返回 JWT，实施方案 1。

---

## 测试脚本用法

### 创建测试账号

```bash
node scripts/setup_identity.js --name TestAccount --agent
```

### 运行多账号测试

```bash
# 调试模式（本地凭证）
set NODE_AWIKI_DEBUG=true
node scripts/test_multi_account_messages.js

# 或使用批处理
test_multi_account.bat

# 生产模式（系统凭证）
node scripts/test_multi_account_messages.js
```

### 查看 JWT 状态

测试脚本会自动显示：
- JWT 过期时间
- 剩余有效时间
- 是否已过期

---

**测试完成时间**: 2026-03-09 20:45  
**状态**: ⏳ 需要修复 401 自动刷新功能  
**发现**: JWT 过期后无法自动恢复
