# Node.js 客户端测试报告

**测试日期**: 2026-03-08
**Python 版本**: 1.0.0 (awiki-did, anp>=0.6.8)
**Node.js 版本**: 1.0.0
**测试状态**: ⚠️ **代码分析完成，待实际运行测试**

---

## ⚠️ 重要说明

**本报告基于代码阅读分析，所有发现的问题仅为假设，需要实际测试验证。**

根据 `NODEJS_UPGRADE_PRINCIPLES.md` 原则：
- ❌ 不基于代码阅读就确定需要修改
- ✅ 必须在 awiki.ai 进行真实测试
- ✅ 必须对比 Python 和 Node.js 的实际行为
- ✅ 必须用测试数据驱动升级决策

---

## 1. 代码对比发现（待测试验证）

### 1.1 E2EE 版本兼容性 ✅

| 项目 | Python | Node.js | 状态 |
|------|--------|---------|------|
| E2EE 版本 | `1.1` | `1.1` | ✅ 一致 |
| 版本常量位置 | `scripts/utils/e2ee.py:29` | `src/e2ee.js:29` | ✅ 一致 |
| 版本检查 | ✅ 有 | ✅ 有 | ✅ 一致 |

**结论**: E2EE 协议版本兼容，可以互操作。

---

### 1.2 签名格式差异 ⚠️ **待测试验证**

| 项目 | Python | Node.js | 影响 |
|------|--------|---------|------|
| 签名算法 | ECDSA secp256k1 | ECDSA secp256k1 | ✅ 相同 |
| 签名格式 | **DER** | **R\|\|S (IEEE P1363)** | ⚠️ **待验证** |
| 低 S 规范化 | ✅ 有 | ✅ 有 | ✅ 相同 |
| 哈希方式 | 单次哈希 | **双哈希** | ⚠️ **待验证** |

**⚠️ 重要**: 以下是代码分析发现，需要实际测试验证：

1. **签名格式差异** - 需要测试 awiki.ai 是否接受 R||S 格式
2. **双哈希问题** - 需要验证是否真的需要双哈希来匹配 Python

#### 测试验证计划

```bash
# 测试 1: Node.js 注册功能测试
cd nodejs-client
node scripts/setup_identity.js --name "TestNode1"

# 预期结果：
# - 成功：服务器接受 R||S 格式，无需修改
# - 失败：需要改为 DER 格式
```

**当前状态**: ⏳ 待测试

#### Python 签名流程 (`scripts/utils/auth.py`):

```python
# 1. 构建认证数据
auth_data = {"nonce": ..., "timestamp": ..., "aud": ..., "did": ...}

# 2. JCS 规范化
canonical_json = jcs.canonicalize(auth_data)

# 3. SHA-256 哈希
content_hash = hashlib.sha256(canonical_json).digest()

# 4. ECDSA 签名（cryptography 库内部会再次哈希）
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))

# 5. DER → Base64URL
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b'=').decode()
```

#### Node.js 签名流程 (`src/utils/auth.js`):

```javascript
// 1. 构建认证数据
const authData = { nonce, timestamp, aud: hostname, did };

// 2. JCS 规范化
const canonicalJson = canonicalize(authData);

// 3. SHA-256 哈希
const contentHash = sha256(canonicalJson);

// 4. 双哈希（为了匹配 Python cryptography 行为）
const doubleHash = sha256(contentHash);

// 5. ECDSA 签名（secp256k1-node 不内部哈希）
const sig = secp256k1.ecdsaSign(doubleHash, privateKeyBytes);

// 6. R||S 格式 → Base64URL
const signatureB64Url = encodeBase64Url(Buffer.from(sig.signature));
```

#### 关键差异分析

**问题 1: 签名格式**
- Python 输出 DER 格式：`3045022100...0220...`
- Node.js 输出 R||S 格式：`r(32 字节) + s(32 字节)`

**问题 2: 哈希次数**
- Python: `hash(content)` → `sign(hash)` → cryptography 内部再 hash
- Node.js: `hash(content)` → `hash(hash)` → `sign(double_hash)`

**服务器验证**:
需要实际测试服务器接受哪种格式。根据 `PYTHON_NODEJS_COMPARISON.md` 历史记录，服务器可能同时接受两种格式。

---

### 1.3 W3C Proof 实现 ✅

| 项目 | Python | Node.js | 状态 |
|------|--------|---------|------|
| Proof 类型 | `EcdsaSecp256k1Signature2019` | `EcdsaSecp256k1Signature2019` | ✅ 一致 |
| 签名算法 | ECDSA secp256k1 | ECDSA secp256k1 | ✅ 一致 |
| 签名格式 | R\|\|S (base64url) | R\|\|S (base64url) | ✅ 一致 |
| 哈希方式 | `hash(options) \|\| hash(document)` | `hash(options) \|\| hash(document)` | ✅ 一致 |

**结论**: W3C Proof 实现一致，DID 文档注册应该兼容。

---

### 1.4 HPKE 实现 ✅

| 项目 | Python (ANP) | Node.js | 状态 |
|------|-------------|---------|------|
| Cipher Suite | `DHKEM-X25519/HKDF-SHA256/AES-128-GCM` | `DHKEM-X25519/HKDF-SHA256/AES-128-GCM` | ✅ 一致 |
| RFC 9180 常量 | ✅ 完整 | ✅ 完整 | ✅ 一致 |
| LabeledExtract | ✅ 有 | ✅ 有 | ✅ 一致 |
| LabeledExpand | ✅ 有 | ✅ 有 | ✅ 一致 |
| Encap/Decap | ✅ 有 | ✅ 有 | ✅ 一致 |
| KeySchedule | ✅ 有 | ✅ 有 | ✅ 一致 |

**结论**: HPKE 实现算法一致，应该可以互操作。

---

### 1.5 Ratchet 链式派生 ⚠️ **待测试验证**

| 项目 | Python | Node.js | 状态 |
|------|--------|---------|------|
| 根种子派生 | `HKDFExpand(root_seed, "anp-e2ee-init")` | `HMAC-SHA256(root_seed, "anp-e2ee-init")` | ⚠️ **待验证** |
| 方向判断 | DID UTF-8 字节序比较 | DID UTF-8 字节序比较 | ✅ 一致 |
| 消息密钥 | `HMAC-SHA256(chain_key, "msg" + seq)` | `HMAC-SHA256(chain_key, "msg" + seq)` | ✅ 一致 |
| 链更新 | `HMAC-SHA256(chain_key, "ck")` | `HMAC-SHA256(chain_key, "ck")` | ✅ 一致 |

**⚠️ 重要**: 以下是代码分析发现，需要实际测试验证：

#### 关键差异：根种子派生

**Python** 使用 HKDF-Expand，**Node.js** 使用 HMAC-SHA256。

**潜在影响**: 
- HKDF-Expand 和 HMAC 输出不同
- 这可能导致 Python 和 Node.js 派生不同的链密钥
- E2EE 消息可能无法互相解密

**测试验证计划**:

```bash
# 测试 2: E2EE 互操作性测试
# 1. Python 发起 E2EE 握手
# 2. Node.js 响应握手
# 3. Python 发送加密消息
# 4. Node.js 尝试解密

# 预期结果：
# - 成功解密：派生算法兼容，无需修改
# - 解密失败：需要统一派生算法
```

**当前状态**: ⏳ 待测试

---

## 2. 测试计划

### 2.1 基础功能测试（优先级：高）

| 测试项 | 命令 | 预期结果 | 状态 |
|--------|------|----------|------|
| Python DID 创建 | `python scripts/setup_identity.py --name "TestPy"` | 成功创建 DID | ⏳ |
| Node.js DID 创建 | `node scripts/setup_identity.js --name "TestNode"` | 成功创建 DID | ⏳ |
| Python DID 注册 | (自动在 setup 中) | 注册成功 | ⏳ |
| Node.js DID 注册 | (自动在 setup 中) | 注册成功 | ⏳ |
| Python JWT 获取 | (自动在 setup 中) | 获取 JWT | ⏳ |
| Node.js JWT 获取 | (自动在 setup 中) | 获取 JWT | ⏳ |

### 2.2 互操作性测试（优先级：高）

| 测试项 | Python → Node.js | Node.js → Python | 状态 |
|--------|-----------------|-----------------|------|
| 明文消息 | ⏳ | ⏳ | ⏳ |
| E2EE 握手 | ⏳ | ⏳ | ⏳ |
| E2EE 消息 | ⏳ | ⏳ | ⏳ |

### 2.3 签名格式验证（优先级：高）

| 测试场景 | 预期 | 状态 |
|---------|------|------|
| Python 签名 → 服务器验证 | 接受 | ⏳ |
| Node.js 签名 → 服务器验证 | 接受/拒绝 | ⏳ |

---

## 3. 问题清单（基于代码分析，待测试确认）

### 🔴 高优先级（需测试确认）

1. **Ratchet 根种子派生差异**
   - Python 使用 HKDF-Expand
   - Node.js 使用 HMAC-SHA256
   - **潜在影响**: E2EE 消息可能无法互相解密
   - **测试**: E2EE 互操作性测试
   - **修复**: 如测试失败，修改 Node.js 使用 HKDF-Expand

2. **签名格式差异**
   - Python 使用 DER 格式
   - Node.js 使用 R||S 格式
   - **潜在影响**: 服务器可能拒绝 Node.js 请求
   - **测试**: Node.js 注册功能测试
   - **修复**: 如测试失败，改为 DER 格式

3. **双哈希问题**
   - Node.js 使用双哈希来模拟 Python cryptography 行为
   - **潜在影响**: 可能导致签名验证失败
   - **测试**: JWT 获取测试
   - **修复**: 根据测试结果调整

### 🟡 中优先级

4. **文档过时**
   - 项目存在大量旧版本文档
   - 需要基于新代码和测试结果更新

5. **测试覆盖率不足**
   - 缺少互操作性测试
   - 需要添加自动化测试

### 🟢 低优先级

6. **代码组织**
   - Node.js 可参考 Python 的 `utils/` 模块化
   - 当前结构已经合理

---

## 4. 修复建议

### 4.1 立即修复（本周）

#### 修复 1: Ratchet 根种子派生

修改 `src/ratchet.js`:

```javascript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

export function deriveChainKeys(rootSeed) {
    // 使用 HKDF-Expand 匹配 Python
    const initChainKey = hkdf(
        sha256,
        rootSeed,
        { salt: '', info: Buffer.from('anp-e2ee-init'), length: 32 }
    );
    
    const respChainKey = hkdf(
        sha256,
        rootSeed,
        { salt: '', info: Buffer.from('anp-e2ee-resp'), length: 32 }
    );
    
    return { initChainKey, respChainKey };
}
```

#### 修复 2: 签名格式验证

首先测试当前实现是否工作：

```bash
# 1. 使用 Node.js 创建并注册身份
cd nodejs-client
node scripts/setup_identity.js --name "TestNode"

# 2. 观察是否成功
# 如果成功，说明服务器接受 R||S 格式
# 如果失败，需要改为 DER 格式
```

### 4.2 短期修复（2 周内）

5. **添加互操作性测试**
   - Python 发送 → Node.js 接收
   - Node.js 发送 → Python 接收
   - 验证 E2EE 消息能否互相解密

6. **更新文档**
   - 删除过时文档
   - 基于新代码更新 API 文档

---

## 5. 测试执行计划

### 阶段 1: 基础功能测试（1 天）

```bash
# Python 测试
cd python-client/scripts
python setup_identity.py --name "TestPy1"
python send_message.py --to "did:wba:..." --content "Hello"

# Node.js 测试
cd nodejs-client
node scripts/setup_identity.js --name "TestNode1"
node scripts/send_message.js --to "did:wba:..." --content "Hello"
```

### 阶段 2: 互操作性测试（2 天）

```bash
# 1. Python 创建身份并注册
# 2. Node.js 加载 Python 凭证
# 3. Node.js 发送消息到 Python
# 4. Python 发送消息到 Node.js
```

### 阶段 3: E2EE 测试（2 天）

```bash
# 1. Python 发起 E2EE 握手
# 2. Node.js 响应握手
# 3. 互相发送加密消息
# 4. 验证能否解密
```

### 阶段 4: 问题修复（根据测试结果）

- 修复 Ratchet 派生
- 修复签名格式（如需要）
- 重新测试

---

## 6. 文档更新清单

根据测试结果，需要更新以下文档：

| 文档 | 当前状态 | 更新内容 | 优先级 |
|------|---------|----------|--------|
| `README.md` | ⚠️ 部分过时 | 更新 python-client 获取方式 | 🔴 高 |
| `PYTHON_NODEJS_COMPARISON.md` | ⚠️ 基于旧代码 | 更新代码对比 | 🔴 高 |
| `PYTHON_NODEJS_DIFF.md` | ⚠️ 基于旧代码 | 更新差异列表 | 🔴 高 |
| `MIGRATION-proj/docs/*` | 🆕 新建 | 添加新分析文档 | 🟡 中 |
| `nodejs-client/USAGE.md` | ⚠️ 部分过时 | 更新使用指南 | 🟡 中 |
| `nodejs-client/RELEASE_*.md` | ✅ 可用 | 保持 | 🟢 低 |

---

## 7. 结论

### 7.1 当前状态（基于代码分析）

**⚠️ 重要**: 以下结论基于代码阅读，需要实际测试验证。

| 功能 | 状态 | 备注 |
|------|------|------|
| E2EE 版本 | ✅ 兼容 (1.1) | 版本号一致 |
| W3C Proof | ✅ 兼容 | 算法一致 |
| HPKE | ✅ 兼容 | RFC 9180 一致 |
| Ratchet | ⚠️ 待验证 | 根种子派生差异 |
| 签名格式 | ⚠️ 待验证 | DER vs R||S |

### 7.2 关键风险（需测试确认）

1. **Ratchet 不兼容** - E2EE 消息可能无法互相解密
   - 缓解：执行 E2EE 互操作性测试

2. **签名格式不被接受** - Node.js 可能无法注册/验证
   - 缓解：执行注册功能测试

3. **未经测试就修复** - 可能修复不存在的问题
   - 缓解：严格遵守 `NODEJS_UPGRADE_PRINCIPLES.md`

### 7.3 建议行动

**严格遵守测试驱动原则**:

1. **先测试后修复** - 不基于假设做决策
2. **在 awiki.ai 验证** - 使用真实服务测试
3. **记录测试数据** - 用数据驱动升级
4. **保持行为一致** - 关注功能等价而非代码一致

**下一步**:

1. 执行基础功能测试
2. 执行互操作性测试
3. 根据测试结果制定修复计划
4. 在 awiki.ai 验证修复

---

**报告人**: AI Assistant
**报告日期**: 2026-03-08
**测试状态**: ⏳ 待执行
**下次更新**: 测试执行完成后
