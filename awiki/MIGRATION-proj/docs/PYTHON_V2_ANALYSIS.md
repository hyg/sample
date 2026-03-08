# Python 新版本代码分析报告

**分析日期**: 2026-03-08
**Python 版本**: 1.0.0 (awiki-did)
**ANP 依赖**: anp>=0.6.8

---

## 1. 架构变更摘要

### 1.1 从内嵌源码到外部依赖

**旧架构**:
- 内嵌 `anp_src/` 目录包含所有 ANP 协议实现
- 代码分散在 `anp_package/` 各子模块中
- 总代码量：约 20,个 Python 文件

**新架构**:
- 使用外部 `anp>=0.6.8` 包
- 脚本层封装 ANP API
- 代码集中在 `scripts/utils/` 模块
- 总代码量：约 15 个核心文件

### 1.2 关键模块映射

| 功能 | 旧模块 (anp_src) | 新模块 (scripts/utils) | ANP 包模块 |
|------|-----------------|----------------------|-----------|
| DID 创建 | `authentication/did_wba.py` | `identity.py` | `anp.authentication` |
| 认证 | `authentication/did_wba_authenticator.py` | `auth.py` | `anp.authentication` |
| E2EE | `e2e_encryption_hpke/` | `e2ee.py` | `anp.e2e_encryption_hpke` |
| W3C Proof | `proof/proof.py` | (由 ANP 提供) | `anp.proof` |
| HPKE | `e2e_encryption_hpke/hpke.py` | (由 ANP 提供) | `anp.e2e_encryption_hpke` |
| 凭证存储 | `scripts/utils/credential_store.py` | `credential_store.py` | (无变化) |

---

## 2. 核心 API 分析

### 2.1 DID 身份创建 (`scripts/utils/identity.py`)

```python
from anp.authentication import create_did_wba_document_with_key_binding

def create_identity(
    hostname: str,
    path_prefix: list[str] | None = None,
    proof_purpose: str = "authentication",
    domain: str | None = None,
    challenge: str | None = None,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
    """创建密钥绑定 DID 身份"""
```

**关键点**:
- 使用 ANP 的 `create_did_wba_document_with_key_binding()`
- 自动生成 `k1_{fingerprint}` 格式的 DID
- 包含 E2EE 密钥 (key-2 secp256r1, key-3 X25519)
- 返回 `DIDIdentity` 数据类

**Node.js 对比**:
- Node.js 使用 `createIdentity()` 函数
- 手动实现 JWK Thumbprint 计算
- 需要验证与 ANP 的输出一致性

### 2.2 认证流程 (`scripts/utils/auth.py`)

```python
from anp.authentication import generate_auth_header

def generate_wba_auth_header(
    identity: DIDIdentity,
    service_domain: str,
) -> str:
    """生成 DID WBA 授权头"""
    private_key = identity.get_private_key()
    return generate_auth_header(
        did_document=identity.did_document,
        service_domain=service_domain,
        sign_callback=_secp256k1_sign_callback(private_key),
    )
```

**签名流程**:
1. 构建认证数据：`{nonce, timestamp, aud, did}`
2. JCS 规范化
3. SHA-256 哈希
4. ECDSA secp256k1 签名（DER 格式）
5. Base64URL 编码

**Node.js 对比**:
- Node.js 使用 `@noble/curves/secp256k1`
- 签名格式：R||S (IEEE P1363) vs DER
- **需要验证服务器接受哪种格式**

### 2.3 E2EE 加密 (`scripts/utils/e2ee.py`)

```python
from anp.e2e_encryption_hpke import (
    E2eeHpkeSession,
    HpkeKeyManager,
    generate_proof,
    validate_proof,
)

class E2eeClient:
    """E2EE 客户端（HPKE 方案）"""
    
    async def initiate_handshake(self, peer_did: str):
        """一键初始化 E2EE 会话"""
        
    def encrypt_message(self, peer_did: str, plaintext: str):
        """加密消息"""
        
    def decrypt_message(self, content: dict):
        """解密消息"""
```

**E2EE 协议版本**: `SUPPORTED_E2EE_VERSION = "1.1"`

**密钥设计**:
- key-2 (secp256r1): 用于 proof 签名
- key-3 (X25519): 用于 HPKE 密钥协商
- 与 DID 身份密钥 (secp256k1 key-1) 分离

**Node.js 对比**:
- Node.js 有 `E2eeClient` 类（在 `e2ee.js` 中）
- 但实现基于简化的 HPKE，非完整 ANP
- **需要验证版本兼容性和协议完整性**

---

## 3. 参考文档分析

### 3.1 E2EE 协议规范 (`references/e2ee-protocol.md`)

**关键信息**:
- E2EE 基于 ANP `e2e_encryption_v2` 实现
- 使用 ECDHE (secp256r1) 密钥协商 + AES-GCM 对称加密
- **重要**: E2EE 使用独立的 secp256r1 密钥对（与 DID 身份的 secp256k1 分离）

### 3.2 心跳机制 (`references/HEARTBEAT.md`)

**会话检查流程**:
1. 每 15 分钟运行 `check_status.py --auto-e2ee`
2. 解析状态 → 决定下一步操作
3. 报告摘要
4. 检查个人资料完整性

**E2EE 自动处理策略**:
- **自动处理**（无需确认）:
  - `e2ee_init` → 接受并建立会话
  - `e2ee_rekey` → 刷新会话
  - `e2ee_error` → 记录错误/允许后续重握手
- **需要用户指令**:
  - 发起握手、发送加密消息、解密消息

### 3.3 其他参考文档

| 文档 | 用途 | Node.js 相关性 |
|------|------|---------------|
| `local-store-schema.md` | 本地存储结构 | ⚠️ 需要对比 |
| `PROFILE_TEMPLATE.md` | 个人资料模板 | ✅ 可参考 |
| `WEBSOCKET_LISTENER.md` | WebSocket 监听器 | ⚠️ 需要实现 |
| `RULES.md` | 开发规则 | ✅ 可参考 |

---

## 4. Node.js 客户端差距分析

### 4.1 高优先级差距

#### 1. ANP 包依赖缺失

**Python**:
```python
from anp.authentication import create_did_wba_document_with_key_binding
from anp.e2e_encryption_hpke import E2eeHpkeSession
```

**Node.js**:
- 无对应的 `anp` 包
- 所有功能需要手动实现
- **风险**: 协议更新时可能落后

**建议**: 
- 创建 `anp-js` 包（长期方案）
- 或保持当前独立实现，但加强测试

#### 2. E2EE 协议版本

**Python**: `SUPPORTED_E2EE_VERSION = "1.1"`

**Node.js**: 需要检查 `e2ee.js` 中的版本常量

**验证点**:
- 版本号是否一致
- 协议字段是否完整
- 错误处理格式是否兼容

#### 3. 签名格式差异

**Python**: DER 格式
```python
der_sig = private_key.sign(content, ec.ECDSA(hashes.SHA256()))
```

**Node.js**: R||S 格式 (IEEE P1363)
```javascript
const signatureRs = Buffer.concat([rBytes, sBytes]);
```

**影响**: 
- 服务器可能只接受一种格式
- 需要实际测试验证

### 4.2 中优先级差距

#### 4. 脚本组织

**Python**:
```
scripts/
├── utils/           # 工具模块
│   ├── identity.py
│   ├── auth.py
│   ├── e2ee.py
│   └── ...
├── setup_identity.py
├── send_message.py
└── ...
```

**Node.js**:
```
nodejs-client/
├── src/
│   ├── utils/
│   │   ├── identity.js
│   │   ├── auth.js
│   │   └── ...
│   └── ...
├── scripts/
│   ├── setup_identity.js
│   └── ...
```

**状态**: ✅ 结构相似，可保持

#### 5. 错误处理标准化

**Python**:
```python
def build_e2ee_error_message(error_code: str, ...) -> str:
    """构建标准化的错误消息"""
```

**Node.js**: 需要添加类似的错误处理函数

### 4.3 低优先级差距

#### 6. 文档完整性

**Python**:
- `references/` 目录包含 6 个参考文档
- 详细的协议规范和使用指南

**Node.js**:
- 文档分散在多个位置
- 缺少统一的协议规范

**建议**: 整合 Node.js 文档

---

## 5. 测试建议

### 5.1 互操作性测试

| 测试场景 | Python → Node.js | Node.js → Python | 状态 |
|---------|-----------------|-----------------|------|
| DID 创建 | N/A | N/A | ⏳ |
| DID 注册 | N/A | N/A | ⏳ |
| JWT 获取 | N/A | N/A | ⏳ |
| 明文消息 | ⏳ | ⏳ | ⏳ |
| E2EE 握手 | ⏳ | ⏳ | ⏳ |
| E2EE 消息 | ⏳ | ⏳ | ⏳ |

### 5.2 签名格式测试

```bash
# 1. 使用 Python 创建身份并注册
cd python-client/scripts
python setup_identity.py --name "TestPy"

# 2. 使用 Node.js 加载凭证并尝试 JWT 验证
cd nodejs-client
node scripts/setup_identity.js --load testpy

# 3. 观察是否成功
```

### 5.3 E2EE 版本测试

```bash
# 1. Python 发送 E2EE 消息到 Node.js
# 2. Node.js 解密并回复
# 3. 验证版本号是否匹配
```

---

## 6. 行动清单

### 立即行动（本周）

1. ✅ **验证签名格式** - 测试 DER vs R||S
2. ✅ **检查 E2EE 版本** - 确认 Node.js 支持 1.1
3. ✅ **测试互操作性** - Python ↔ Node.js 消息互通

### 短期行动（2 周内）

4. 📋 **添加错误处理** - 实现 `build_e2ee_error_message`
5. 📋 **整合文档** - 创建统一的参考文档
6. 📋 **增加测试** - 添加互操作性测试套件

### 长期行动（1 个月内）

7. 📋 **考虑创建 anp-js** - 统一的协议库
8. 📋 **自动化同步** - 建立 Python→Node.js 同步流程

---

## 7. 文件位置参考

### Python 新代码

| 功能 | 文件路径 |
|------|---------|
| DID 创建 | `scripts/utils/identity.py` |
| 认证 | `scripts/utils/auth.py` |
| E2EE | `scripts/utils/e2ee.py` |
| 凭证存储 | `scripts/credential_store.py` |
| 配置 | `scripts/utils/config.py` |
| RPC | `scripts/utils/rpc.py` |
| WebSocket | `scripts/ws_listener.py` |

### 参考文档

| 文档 | 文件路径 |
|------|---------|
| E2EE 协议 | `references/e2ee-protocol.md` |
| 心跳机制 | `references/HEARTBEAT.md` |
| 本地存储 | `references/local-store-schema.md` |
| 个人资料 | `references/PROFILE_TEMPLATE.md` |
| WebSocket | `references/WEBSOCKET_LISTENER.md` |
| 开发规则 | `references/RULES.md` |

### Node.js 对应文件

| 功能 | 文件路径 |
|------|---------|
| DID 创建 | `src/utils/identity.js` |
| 认证 | `src/auth.js` |
| E2EE | `src/e2ee.js`, `src/e2ee_session.js` |
| 凭证存储 | `src/credential_store.js` |
| 配置 | `src/utils/config.js` |
| RPC | `src/utils/rpc.js` |
| WebSocket | `src/ws_client.js` |

---

**分析人**: AI Assistant
**分析日期**: 2026-03-08
**下次审查**: 测试完成后
