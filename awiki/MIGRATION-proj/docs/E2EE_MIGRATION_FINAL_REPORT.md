# E2EE 功能差异分析与搬运报告

**日期**: 2026-03-09  
**分析对象**: Python e2ee_messaging.py vs Node.js e2ee_messaging.js

---

## 关键差异分析

### 差异 1: 认证方式

**Python**:
```python
auth_result = create_authenticator(credential_name, config)
auth, data = auth_result
await _send_msg(client, data["did"], peer_did, msg_type, content, auth=auth)
```

**Node.js (旧)**:
```javascript
const cred = loadIdentity(credentialName);
await sendMessage(client, cred.did, peerDid, msgType, content, cred.jwt_token);
```

**Node.js (新 - 已修复)**:
```javascript
const authResult = await createAuthenticator(credentialName, config);
const { auth, data } = authResult;
await sendMessage(client, data.did, peerDid, msgType, content, auth, credentialName);
```

**状态**: ✅ 已修复

---

### 差异 2: Content 格式

**Python**:
```python
if isinstance(content, dict):
    content = json.dumps(content)
```

**Node.js (旧)**:
```javascript
// 直接发送对象
content: content
```

**Node.js (新 - 已修复)**:
```javascript
const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;
```

**状态**: ✅ 已修复

---

### 差异 3: create_authenticator 函数

**Python**:
```python
from credential_store import create_authenticator
```

**Node.js (旧)**: 不存在

**Node.js (新 - 已搬运)**:
```javascript
import { createAuthenticator } from './utils/credential_store.js';
```

**状态**: ✅ 已从原文件夹搬运

---

## 已搬运文件清单

### 从 `d:\huangyg\git\awiki-agent-id-skill\nodejs-awiki\src\` 搬运

| 文件 | 目标位置 | 状态 |
|------|---------|------|
| `credential_store.js` | `scripts/utils/credential_store.js` | ✅ 已搬运并修复 |
| `auth.js` | `scripts/utils/auth.js` | ✅ 已搬运 |
| `e2ee.js` | `lib/anp/e2e_encryption_hpke/_init.js` | ✅ 已搬运 |
| `e2ee_session.js` | `lib/anp/e2e_encryption_hpke/session.js` | ✅ 已搬运 |
| `e2ee_key_manager.js` | `lib/anp/e2e_encryption_hpke/key_manager.js` | ✅ 已搬运 |
| `e2ee_proof.js` | `lib/anp/e2e_encryption_hpke/message_builder.js` | ✅ 已搬运 |
| `e2ee_outbox.js` | `scripts/utils/e2ee_outbox.js` | ✅ 已搬运 |
| `e2ee_store.js` | `scripts/utils/e2ee_store.js` | ✅ 已搬运 |
| `hpke.js` | `lib/anp/e2e_encryption_hpke/hpke.js` | ✅ 已搬运 |
| `ratchet.js` | `lib/anp/e2e_encryption_hpke/ratchet.js` | ✅ 已搬运 |
| `w3c_proof.js` | `lib/anp/proof/proof.js` | ✅ 已搬运 |

### 新建文件

| 文件 | 用途 | 状态 |
|------|------|------|
| `scripts/utils/e2ee.js` | E2EE 封装层 | ✅ 已创建 |

---

## 当前问题

### 问题 1: 参数校验失败

**错误**: `Error: 参数校验失败`

**可能原因**:
1. E2EE 消息 content 字段格式不正确
2. 缺少必需的字段（如 session_id, e2ee_version 等）
3. 消息类型识别问题

**待排查**:
- 检查 Python 发送的完整消息格式
- 对比 Node.js 发送的消息格式
- 检查 awiki.ai 服务器的 API 要求

---

## 下一步行动

1. **调试消息格式**
   - 打印 Node.js 发送的完整请求
   - 对比 Python 发送的请求
   - 找出差异并修复

2. **测试完整 E2EE 流程**
   - 握手：Node.js → Python
   - 加密：Node.js → Python
   - 解密：Python → Node.js

3. **完善文档**
   - 更新 E2EE 模块使用文档
   - 记录认证流程

---

**搬运人**: AI Assistant  
**报告日期**: 2026-03-09  
**状态**: 搬运完成 95%，待修复消息格式问题
