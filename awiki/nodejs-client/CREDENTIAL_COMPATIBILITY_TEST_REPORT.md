# Python 版身份文件管理兼容测试报告

**测试日期**: 2026-03-09  
**测试目的**: 验证 Node.js 版本与 Python 版本的凭证管理兼容性

---

## 测试结果

### ✅ 成功实现的功能

| 功能 | Python 版本 | Node.js 版本 | 状态 |
|------|------------|-------------|------|
| **目录结构** | ✓ | ✓ | ✅ 完全兼容 |
| **index.json** | ✓ | ✓ | ✅ Schema v3 |
| **identity.json** | ✓ | ✓ | ✅ 格式一致 |
| **auth.json** | ✓ | ✓ | ✅ JWT 存储 |
| **密钥文件** | ✓ | ✓ | ✅ PEM 格式 |
| **E2EE 密钥** | ✓ | ✓ | ✅ 存储一致 |
| **文件权限** | 0o600 | 0o600 | ✅ 安全权限 |
| **目录权限** | 0o700 | 0o700 | ✅ 安全权限 |

---

## 文件结构对比

### Python 版本

```
%USERPROFILE%\.openclaw\credentials\awiki-agent-id-message\
├── index.json
├── k1_<unique_id>/
│   ├── identity.json
│   ├── auth.json
│   ├── did_document.json
│   ├── key-1-private.pem
│   ├── key-1-public.pem
│   ├── e2ee-signing-private.pem
│   └── e2ee-agreement-private.pem
```

### Node.js 版本

```
<cwd>/.credentials/ (调试模式)
%USERPROFILE%\.openclaw\credentials\awiki-agent-id-message\ (生产模式)
├── index.json
├── k1_<unique_id>/
│   ├── identity.json
│   ├── auth.json
│   ├── did_document.json
│   ├── key-1-private.pem
│   ├── key-1-public.pem
│   ├── e2ee-signing-private.pem
│   └── e2ee-agreement-private.pem
```

**结论**: ✅ **完全兼容**

---

## index.json 格式验证

### Schema Version 3

```json
{
  "schema_version": 3,
  "default_credential_name": null,
  "credentials": {
    "default": {
      "credential_name": "default",
      "dir_name": "k1_UoY-rvCIG650o0cukz1Xtwl0HlN4mbbkV4bCGimubA0",
      "did": "did:wba:awiki.ai:user:k1_UoY-rvCIG650o0cukz1Xtwl0HlN4mbbkV4bCGimubA0",
      "unique_id": "k1_UoY-rvCIG650o0cukz1Xtwl0HlN4mbbkV4bCGimubA0",
      "user_id": "9c5c3f62-8167-4c12-9b77-a5748a72cf48",
      "name": "TestCred",
      "handle": null,
      "created_at": "2026-03-09T12:33:52.299Z",
      "is_default": false
    }
  }
}
```

**验证结果**: ✅ **格式完全匹配 Python 版本**

---

## 测试消息发送

### 测试详情

**发送方**: TestCred (default)  
**接收方**: did:wba:awiki.ai:user:k1_h0MSe1gi2PDdhTWVIqraR6Vu3Kn62mtZbXhilDa5LQc  
**消息内容**: `Test message from Node.js CLI @ 2026-03-09T12:37:58.572Z`

### 测试结果

```
✅ Message sent successfully!
   Server Seq: 1
   Message ID: 0d1b4371-4920-46fe-b239-55a0be6f1443
```

**状态**: ✅ **成功**

---

## 调试模式 vs 生产模式

### 环境变量

```bash
# 调试模式
set NODE_AWIKI_DEBUG=true

# 生产模式（默认）
set NODE_AWIKI_DEBUG=
```

### 凭证目录

| 模式 | 目录 | 用途 |
|------|------|------|
| **调试** | `./nodejs-awiki/.credentials/` | 开发测试 |
| **生产** | `%USERPROFILE%\.openclaw\credentials\awiki-agent-id-message\` | 与 Python 共用 |

---

## JWT 有效期说明

### 服务端决定

**重要**: JWT 有效期由 awiki.ai 服务端决定，客户端**无法设置**。

**当前有效期**: ~60 分钟（从测试观察）

### 调试模式建议

由于无法自定义 JWT 有效期，调试模式下建议：

1. **频繁刷新**: 使用 `setup_identity.js --load <name>` 刷新 JWT
2. **自动刷新**: 实现 401 自动刷新机制（待实现）
3. **使用短期测试账号**: 创建专门用于调试的账号

---

## 兼容性验证清单

### 文件命名 ✅

- [x] index.json
- [x] identity.json
- [x] auth.json
- [x] did_document.json
- [x] key-1-private.pem
- [x] key-1-public.pem
- [x] e2ee-signing-private.pem
- [x] e2ee-agreement-private.pem

### 目录命名 ✅

- [x] 子目录名 = unique_id (k1_...)
- [x] 安全字符过滤
- [x] 权限 0o700

### 文件格式 ✅

- [x] index.json schema_version = 3
- [x] identity.json 字段完整
- [x] auth.json 包含 jwt_token
- [x] PEM 格式密钥

### 功能验证 ✅

- [x] saveIdentity
- [x] loadIdentity
- [x] listIdentities
- [x] deleteIdentity
- [x] updateJwt
- [x] createAuthenticator

---

## 生产环境共用凭证

### Python 和 Node.js 共用凭证目录

**生产模式下**，Node.js 版本使用与 Python 版本相同的凭证目录：

```
%USERPROFILE%\.openclaw\credentials\awiki-agent-id-message\
```

**验证**:
- ✅ 文件结构相同
- ✅ 文件格式相同
- ✅ 命名约定相同
- ✅ 权限设置相同

**结论**: ✅ **Python 和 Node.js 可以共用凭证目录**

---

## 下一步改进

### 401 自动刷新

当前 401 处理逻辑需要改进为主动获取 JWT：

```javascript
if (resp.status === 401) {
    // 清除缓存
    auth.clearToken(serverUrl);
    
    // 主动获取新 JWT
    const newJwt = await getJwtViaWba(...);
    
    // 保存新 JWT
    updateJwt(credentialName, newJwt);
    
    // 重试请求
    ...
}
```

### JWT 刷新脚本

创建便捷的 JWT 刷新命令：

```bash
node scripts/refresh_jwt.js --name <credential>
```

---

## 总结

### 实现状态

✅ **完全兼容 Python 版本的凭证管理**

- 文件结构 ✅
- 文件格式 ✅
- 命名约定 ✅
- 权限设置 ✅
- 调试/生产模式 ✅

### 测试状态

✅ **消息发送测试通过**

- 身份加载 ✅
- JWT 验证 ✅
- 消息发送 ✅

### 生产就绪

✅ **可以与 Python 版本共用凭证目录**

---

**测试完成时间**: 2026-03-09 12:38  
**测试状态**: ✅ **通过**  
**生产状态**: ✅ **就绪**
