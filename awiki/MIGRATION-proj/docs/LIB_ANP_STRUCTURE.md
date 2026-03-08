# lib/anp 目录结构设计

**日期**: 2026-03-08
**原则**: 路径、文件名、函数名尽可能沿用 Python anp 包

---

## 1. Python ANP 包结构（参考）

根据代码分析，Python anp 包包含以下模块：

```
anp/
├── authentication/
│   ├── __init__.py
│   ├── did_wba.py              # DID WBA 认证
│   ├── did_wba_authenticator.py
│   ├── did_wba_verifier.py
│   └── verification_methods.py
│
├── e2e_encryption_hpke/
│   ├── __init__.py
│   ├── hpke.py                 # HPKE 实现
│   ├── ratchet.py              # Ratchet 算法
│   ├── session.py              # E2EE 会话
│   ├── key_manager.py          # 密钥管理
│   ├── message_builder.py      # 消息构建
│   ├── message_parser.py       # 消息解析
│   ├── seq_manager.py          # 序号管理
│   ├── crypto.py               # 加密原语
│   └── key_pair.py             # 密钥对生成
│
├── proof/
│   ├── __init__.py
│   └── proof.py                # W3C Proof
│
└── utils/
    ├── crypto_tool.py
    └── ...
```

---

## 2. Node.js lib/anp 结构（设计）

```
nodejs-client/lib/anp/
│
├── authentication/
│   ├── __init__.js             # 模块导出
│   ├── did_wba.js              # DID WBA 认证（对应 Python）
│   ├── did_wba_authenticator.js
│   ├── did_wba_verifier.js
│   └── verification_methods.js
│
├── e2e_encryption_hpke/
│   ├── __init__.js             # 模块导出
│   ├── hpke.js                 # HPKE 实现
│   ├── ratchet.js              # Ratchet 算法
│   ├── session.js              # E2EE 会话
│   ├── key_manager.js          # 密钥管理
│   ├── message_builder.js      # 消息构建
│   ├── message_parser.js       # 消息解析
│   ├── seq_manager.js          # 序号管理
│   ├── crypto.js               # 加密原语
│   └── key_pair.js             # 密钥对生成
│
├── proof/
│   ├── __init__.js             # 模块导出
│   └── proof.js                # W3C Proof
│
└── utils/
    ├── __init__.js
    ├── crypto_tool.js
    └── index.js
```

---

## 3. 文件迁移映射

### 3.1 从 src/ 迁移到 lib/anp/

| 当前 src/ 文件 | 目标 lib/anp/ 文件 | Python 对应 | 状态 |
|--------------|------------------|-----------|------|
| `src/hpke.js` | `lib/anp/e2e_encryption_hpke/hpke.js` | `anp/e2e_encryption_hpke/hpke.py` | ✅ 直接迁移 |
| `src/ratchet.js` | `lib/anp/e2e_encryption_hpke/ratchet.js` | `anp/e2e_encryption_hpke/ratchet.py` | ✅ 直接迁移 |
| `src/w3c_proof.js` | `lib/anp/proof/proof.js` | `anp/proof/proof.py` | ✅ 直接迁移 |
| `src/e2ee.js` | `lib/anp/e2e_encryption_hpke/__init__.js` | `anp/e2e_encryption_hpke/__init__.py` | ⚠️ 整合 |
| `src/e2ee_session.js` | `lib/anp/e2e_encryption_hpke/session.js` | `anp/e2e_encryption_hpke/session.py` | ✅ 直接迁移 |
| `src/e2ee_key_manager.js` | `lib/anp/e2e_encryption_hpke/key_manager.js` | `anp/e2e_encryption_hpke/key_manager.py` | ✅ 直接迁移 |
| `src/e2ee_proof.js` | `lib/anp/e2e_encryption_hpke/message_builder.js` | `anp/e2e_encryption_hpke/message_builder.py` | ⚠️ 调整 |
| `src/e2ee_outbox.js` | (新增) | `anp/e2e_encryption_hpke/e2ee_outbox.py` | ❌ 新增 |
| `src/e2ee_store.js` | (移至 scripts/utils) | `scripts/utils/e2ee_store.py` | ⚠️ 调整 |
| `src/ws_client.js` | `scripts/utils/ws.js` | `scripts/utils/ws.py` | ⚠️ 调整 |
| `src/credential_store.js` | `scripts/utils/credential_store.js` | `scripts/utils/credential_store.py` | ⚠️ 调整 |
| `src/utils/config.js` | `scripts/utils/config.js` | `scripts/utils/config.py` | ✅ 直接迁移 |
| `src/utils/identity.js` | `scripts/utils/identity.js` | `scripts/utils/identity.py` | ✅ 直接迁移 |
| `src/utils/auth.js` | `scripts/utils/auth.js` | `scripts/utils/auth.py` | ✅ 直接迁移 |
| `src/utils/client.js` | `scripts/utils/client.js` | `scripts/utils/client.py` | ✅ 直接迁移 |
| `src/utils/rpc.js` | `scripts/utils/rpc.js` | `scripts/utils/rpc.py` | ✅ 直接迁移 |
| `src/utils/resolve.js` | `scripts/utils/resolve.js` | `scripts/utils/resolve.py` | ✅ 直接迁移 |

### 3.2 需要新增的文件

| Python 文件 | Node.js 目标文件 | 说明 |
|------------|----------------|------|
| `anp/authentication/did_wba.py` | `lib/anp/authentication/did_wba.js` | DID WBA 认证 |
| `anp/authentication/did_wba_authenticator.py` | `lib/anp/authentication/did_wba_authenticator.js` | 认证器 |
| `anp/authentication/did_wba_verifier.py` | `lib/anp/authentication/did_wba_verifier.js` | 验证器 |
| `anp/authentication/verification_methods.py` | `lib/anp/authentication/verification_methods.js` | 验证方法 |
| `anp/e2e_encryption_hpke/message_parser.py` | `lib/anp/e2e_encryption_hpke/message_parser.js` | 消息解析 |
| `anp/e2e_encryption_hpke/seq_manager.py` | `lib/anp/e2e_encryption_hpke/seq_manager.js` | 序号管理 |
| `anp/e2e_encryption_hpke/crypto.py` | `lib/anp/e2e_encryption_hpke/crypto.js` | 加密原语 |
| `anp/e2e_encryption_hpke/key_pair.py` | `lib/anp/e2e_encryption_hpke/key_pair.js` | 密钥对生成 |
| `anp/utils/crypto_tool.py` | `lib/anp/utils/crypto_tool.js` | 加密工具 |
| `scripts/utils/handle.py` | `scripts/utils/handle.js` | Handle 操作 |

---

## 4. 函数命名原则

### 4.1 沿用 Python 函数名

**示例**:

```python
# Python: anp/authentication/did_wba.py
def create_did_wba_document_with_key_binding(
    hostname: str,
    path_prefix: list[str] | None = None,
    proof_purpose: str = "authentication",
    domain: str | None = None,
    challenge: str | None = None,
    enable_e2ee: bool = True,
) -> Tuple[Dict, Dict]:
    ...
```

```javascript
// Node.js: lib/anp/authentication/did_wba.js
function createDidWbaDocumentWithKeyBinding(
    { hostname, pathPrefix = null, proofPurpose = 'authentication', domain = null, challenge = null, enableE2EE = true } = {}
) {
    ...
}

// 导出时保持 Python 风格
export { createDidWbaDocumentWithKeyBinding as create_did_wba_document_with_key_binding };
```

### 4.2 导出规范

每个 `__init__.js` 文件应该：

1. 导出所有公共函数（使用 Python 风格的函数名）
2. 提供 JavaScript 风格的别名（camelCase）

```javascript
// lib/anp/authentication/__init__.js
export {
    // Python 风格（用于与 Python 代码对比）
    create_did_wba_document_with_key_binding,
    generate_auth_header,
    resolve_did_wba_document,
    
    // JavaScript 风格（可选，方便 JS 开发者）
    createDidWbaDocumentWithKeyBinding,
    generateAuthHeader,
    resolveDidWbaDocument
};
```

---

## 5. 最终目录结构

```
nodejs-client/
├── lib/
│   └── anp/
│       ├── authentication/
│       │   ├── __init__.js
│       │   ├── did_wba.js
│       │   ├── did_wba_authenticator.js
│       │   ├── did_wba_verifier.js
│       │   └── verification_methods.js
│       │
│       ├── e2e_encryption_hpke/
│       │   ├── __init__.js
│       │   ├── hpke.js
│       │   ├── ratchet.js
│       │   ├── session.js
│       │   ├── key_manager.js
│       │   ├── message_builder.js
│       │   ├── message_parser.js
│       │   ├── seq_manager.js
│       │   ├── crypto.js
│       │   └── key_pair.js
│       │
│       ├── proof/
│       │   ├── __init__.js
│       │   └── proof.js
│       │
│       └── utils/
│           ├── __init__.js
│           └── crypto_tool.js
│
├── scripts/
│   ├── utils/
│   │   ├── __init__.js
│   │   ├── config.js
│   │   ├── identity.js
│   │   ├── auth.js
│   │   ├── client.js
│   │   ├── rpc.js
│   │   ├── resolve.js
│   │   ├── e2ee.js
│   │   ├── handle.js              # 新增
│   │   ├── credential_store.js
│   │   ├── e2ee_store.js
│   │   └── ws.js
│   │
│   ├── setup_identity.js
│   ├── send_message.js
│   ├── check_inbox.js
│   ├── get_profile.js
│   ├── update_profile.js
│   ├── register_handle.js
│   ├── resolve_handle.js          # 新增
│   ├── manage_relationship.js
│   ├── manage_group.js
│   ├── manage_content.js
│   ├── e2ee_messaging.js
│   ├── ws_listener.js
│   ├── check_status.js            # 新增
│   ├── e2ee_handler.js            # 新增
│   ├── e2ee_outbox.js             # 新增
│   ├── query_db.js                # 新增
│   ├── service_manager.js         # 新增
│   ├── regenerate_e2ee_keys.js    # 新增
│   └── listener_config.js         # 新增
│
├── bin/
│   └── awiki.js
│
├── SKILL.md
├── SKILL-DID.md
├── SKILL-PROFILE.md
├── SKILL-MESSAGE.md
├── SKILL-SOCIAL.md
├── SKILL-GROUP.md
├── SKILL-CONTENT.md
├── README.md
├── USAGE.md
├── package.json
├── LICENSE
└── NOTICE.md
```

---

## 6. 实施步骤

### 步骤 1: 创建 lib/anp 目录结构

```bash
cd nodejs-client
mkdir -p lib/anp/authentication
mkdir -p lib/anp/e2e_encryption_hpke
mkdir -p lib/anp/proof
mkdir -p lib/anp/utils
```

### 步骤 2: 迁移现有文件

| 操作 | 源文件 | 目标文件 |
|------|--------|---------|
| 迁移 | `src/hpke.js` | `lib/anp/e2e_encryption_hpke/hpke.js` |
| 迁移 | `src/ratchet.js` | `lib/anp/e2e_encryption_hpke/ratchet.js` |
| 迁移 | `src/w3c_proof.js` | `lib/anp/proof/proof.js` |
| 迁移 | `src/utils/*` | `scripts/utils/*` |
| ... | ... | ... |

### 步骤 3: 新增缺失文件

根据 Python anp 包，新增缺失的实现文件。

### 步骤 4: 更新引用

更新所有 `import` 语句，使用新的路径。

### 步骤 5: 创建 __init__.js

为每个模块创建导出文件。

### 步骤 6: 测试验证

确保迁移后功能正常。

---

## 7. 原则总结

### 7.1 文件组织原则

> **原则 1**: nodejs-client 的路径和文件命名，尽量沿用 python-client 的同功能对象。

> **原则 2**: 类似 Python 依赖的 ANP 包，对应功能在 nodejs-client/lib/anp 自行开发。

> **原则 3**: lib/anp 的子文件夹名、文件名、函数名尽可能沿用 Python anp 包的同名对象。

### 7.2 依赖管理原则

> **原则 4**: Python 使用外部 pip 包 → Node.js 优先找 npm 替代。

> **原则 5**: Python 使用 ANP 包 → Node.js 自己实现，放在 `lib/anp/`。

### 7.3 命名规范

> **原则 6**: 函数名提供 Python 风格（snake_case）和 JavaScript 风格（camelCase）两种导出。

> **原则 7**: 模块导出使用 `__init__.js`（对应 Python `__init__.py`）。

---

**制定人**: AI Assistant
**制定日期**: 2026-03-08
**状态**: 待执行
