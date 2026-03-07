# 代码移植技能规范

## 核心原则

**结构性一致 > 功能性等价**

移植的目标不是"实现相同功能"，而是"以相同的方式实现"。调用顺序、数据流向、依赖关系必须与源版本完全一致。

---

## 第一阶段：深度分析（占 40% 时间）

### 1.1 调用链追踪

对每个核心功能，从入口到出口完整追踪：

```markdown
## 分析模板

### 功能名称：[例如：DID 身份创建]

**入口文件**：`scripts/setup_identity.py`

**调用链**：
```
setup_identity.py:create_new_identity()
  ↓
auth.py:create_authenticated_identity()
  ↓
identity.py:create_identity()
  ↓
did_wba.py:create_did_wba_document_with_key_binding()
  ↓
did_wba.py:_build_e2ee_entries()        ← 步骤 A：添加 E2EE 密钥
  ↓
did_wba.py:generate_w3c_proof()         ← 步骤 B：生成 proof
```

**关键顺序**：
- [ ] 步骤 A 在步骤 B **之前**执行
- [ ] proof 生成时 document 已包含 E2EE 密钥

**数据流**：
```
输入：hostname, path_prefix, proof_purpose
  ↓
生成 secp256k1 密钥对
  ↓
构建 DID document（不含 proof）
  ↓
添加 E2EE 密钥（key-2, key-3）          ← 关键步骤
  ↓
添加 keyAgreement 字段
  ↓
添加 @context x25519-2019
  ↓
生成 proof（覆盖完整 document）         ← 关键步骤
  ↓
输出：完整 DID document（含 proof）
```
```

### 1.2 依赖库行为分析

**禁止假设库函数行为！** 必须检查源码：

```markdown
## 依赖库分析：[库名称]

**文件位置**：`anp_src/anp_package/authentication/did_wba.py`

**关键函数**：`create_did_wba_document_with_key_binding()`

**内部流程**（逐行分析）：
```python
# 第 466 行：添加 E2EE 密钥
if enable_e2ee:
    e2ee_vms, ka_refs, e2ee_keys = _build_e2ee_entries(did)
    verification_methods.extend(e2ee_vms)
    did_document["keyAgreement"] = ka_refs

# 第 495 行：生成 proof
did_document = generate_w3c_proof(
    document=did_document,  # ← 此时已包含 E2EE 密钥
    ...
)
```

**结论**：
- E2EE 密钥在 proof 生成**之前**添加
- proof 覆盖的是**完整**的 document（含 E2EE 密钥）
- `enable_e2ee` 默认为 `True`
```

### 1.3 数据结构对比

在关键节点捕获数据结构：

```markdown
## 关键数据结构

### 节点 1：proof 生成前的 document
```json
{
  "@context": [...],
  "id": "did:wba:...",
  "verificationMethod": [
    {"id": "...#key-1", ...},
    {"id": "...#key-2", ...},  ← E2EE 密钥已存在
    {"id": "...#key-3", ...}   ← E2EE 密钥已存在
  ],
  "keyAgreement": ["...#key-3"]  ← 已存在
}
```

### 节点 2：proof 生成后的 document
```json
{
  ...
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "proofValue": "..."  ← 签名覆盖完整 document
  }
}
```
```

---

## 第二阶段：实现（占 40% 时间）

### 2.1 调用顺序映射表

创建 Python → Node.js 的调用映射：

```markdown
## 调用顺序映射

| 步骤 | Python 调用 | Node.js 调用 | 状态 |
|------|------------|--------------|------|
| 1 | `create_identity()` | `createIdentity()` | ✓ |
| 2 | （内部）`_build_e2ee_entries()` | `generateE2eeKeys()` | ✓ |
| 3 | （内部）`generate_w3c_proof()` | `generateW3cProof()` | ✓ |
| 4 | `register_did()` | `registerDid()` | ✓ |
| 5 | `get_jwt_via_wba()` | `getJwtViaWba()` | ✓ |

**关键约束**：
- 步骤 2 必须在步骤 3 **之前**完成
- 步骤 3 的输入必须包含步骤 2 的输出
```

### 2.2 函数实现检查清单

每个函数实现前必须确认：

```markdown
## 函数实现检查：[函数名]

**源文件**：`scripts/utils/identity.py:create_identity()`

**目标文件**：`nodejs-awiki/src/utils/identity.js:createIdentity()`

**前置条件**：
- [ ] 参数列表与 Python 版本一致
- [ ] 默认值与 Python 版本一致
- [ ] 参数验证逻辑与 Python 版本一致

**内部流程**：
- [ ] 步骤 1：[描述] → 对应 Python 第 X 行
- [ ] 步骤 2：[描述] → 对应 Python 第 Y 行
- [ ] ...

**后置条件**：
- [ ] 返回值结构与 Python 版本一致
- [ ] 副作用与 Python 版本一致

**依赖检查**：
- [ ] 调用的子函数已实现且行为一致
- [ ] 使用的库函数行为已验证
```

### 2.3 代码审查要点

```markdown
## 代码审查清单

### 结构性审查
- [ ] 调用顺序是否与 Python 版本一致
- [ ] 条件判断的顺序是否一致
- [ ] 循环/迭代的顺序是否一致

### 数据流审查
- [ ] 每个变量的来源是否可追溯
- [ ] 数据转换是否与 Python 版本一致
- [ ] 边界条件处理是否一致

### 依赖审查
- [ ] 第三方库的行为是否已验证
- [ ] 标准库的差异是否已处理
- [ ] 编码/哈希/加密算法是否一致
```

---

## 第三阶段：验证（占 20% 时间）

### 3.1 字节级对比测试

在关键节点生成测试向量：

```python
# Python 版本：generate_test_vectors.py
import hashlib
import jcs

# 在 proof 生成前捕获 document
doc_before_proof = {...}  # 完整 document（含 E2EE 密钥）

# 计算 toBeSigned
doc_hash = hashlib.sha256(jcs.canonicalize(doc_before_proof)).digest()

# 保存测试向量
test_vector = {
    "doc_before_proof": doc_before_proof,
    "doc_hash_hex": doc_hash.hex(),
    "to_be_signed_hex": to_be_signed.hex()
}
```

```javascript
// Node.js 版本：compare_test.js
import { canonicalize, hashBytes } from './src/w3c_proof.js';

// 在 proof 生成前捕获 document
const docBeforeProof = {...};  // 完整 document（含 E2EE 密钥）

// 计算 toBeSigned
const docHash = hashBytes(canonicalize(docBeforeProof));

// 对比 Python 测试向量
assert.strictEqual(docHash.toString('hex'), pythonTestVector.doc_hash_hex);
```

### 3.2 端到端对比

```markdown
## 端到端测试

### 测试用例：完整注册流程

**Python 输出**：
```json
{
  "request": {...},
  "response": {"status": 200, "result": {...}}
}
```

**Node.js 输出**：
```json
{
  "request": {...},
  "response": {"status": 200, "result": {...}}
}
```

**对比结果**：
- [ ] 请求结构一致
- [ ] 响应处理一致
- [ ] 错误处理一致
```

### 3.3 失败分析流程

当测试失败时：

```markdown
## 失败分析：[错误描述]

### 步骤 1：定位差异
- Python 输出：[具体值]
- Node.js 输出：[具体值]
- 差异：[描述]

### 步骤 2：回溯调用链
```
错误发生点：[函数名]
  ↓
上一步：[函数名]
  ↓
...
  ↓
根源：[调用顺序差异/数据流差异/库行为差异]
```

### 步骤 3：修复方案
- [ ] 调整调用顺序
- [ ] 修正数据转换
- [ ] 替换库函数
```

---

## 常见陷阱与规避

### 陷阱 1：调用顺序差异

**现象**：功能"看起来"正确，但集成测试失败

**原因**：
```python
# Python：先添加 E2EE 密钥，再生成 proof
doc = add_e2ee_keys(doc)
doc = generate_proof(doc)
```

```javascript
// Node.js：先生成 proof，后添加 E2EE 密钥（错误！）
doc = generateProof(doc)
doc = generateE2eeKeys(doc)  // ← proof 已生成，不覆盖新字段
```

**规避**：绘制调用流程图，标注数据依赖

### 陷阱 2：库函数行为假设

**现象**：手动实现与库函数行为不一致

**原因**：
```python
# Python：ANP 库默认 enable_e2ee=True
did_document, keys = create_did_wba_document_with_key_binding(...)
# → 自动添加 E2EE 密钥
```

```javascript
// Node.js：手动实现时遗漏 E2EE 密钥
const doc = createIdentity(...)
// → 没有 E2EE 密钥
```

**规避**：检查库函数源码，不要依赖文档

### 陷阱 3：加密算法细节

**现象**：签名验证失败

**原因**：
```python
# Python：cryptography 库对 toBeSigned 进行 SHA256 哈希
der_sig = private_key.sign(to_be_signed, ec.ECDSA(hashes.SHA256()))
# → 双重哈希：SHA256(SHA256(to_be_signed))
```

```javascript
// Node.js：noble-curves 也对 toBeSigned 进行 SHA256 哈希
const signature = secp256k1.sign(to_be_signed, privateKey)
// → 也是双重哈希

// 但如果 toBeSigned 已经是哈希值，需要再次哈希
const dataHash = sha256(to_be_signed)  // ← 关键步骤
const signature = secp256k1.sign(dataHash, privateKey)
```

**规避**：生成测试向量，字节级对比

---

## 移植项目启动清单

开始新移植项目前，必须完成：

- [ ] **调用链分析**：绘制完整调用流程图
- [ ] **依赖库分析**：检查所有第三方库的内部实现
- [ ] **数据结构分析**：在关键节点捕获数据结构
- [ ] **测试向量生成**：Python 版本生成参考数据
- [ ] **调用顺序映射**：创建 Python → Node.js 映射表
- [ ] **风险点标注**：标注可能出错的环节

---

## 交付物标准

### 必须交付

1. **源代码**：功能完整的 Node.js 实现
2. **测试套件**：与 Python 版本的对比测试
3. **分析文档**：调用链分析、数据结构分析
4. **测试向量**：Python 生成的参考数据

### 可选交付

1. **调试工具**：用于对比 Python/Node.js 输出
2. **性能对比**：执行时间、内存使用对比
3. **兼容性报告**：已知差异列表

---

## 质量指标

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 调用顺序一致性 | 100% | 调用链对比 |
| 数据结构一致性 | 100% | JSON 对比 |
| 测试向量匹配 | 100% | 字节级对比 |
| 端到端测试通过率 | 100% | 真实场景测试 |
| 代码审查通过率 | 100% | 审查清单 |

---

## 总结

代码移植不是"重新实现"，而是"精确复制"。

**核心方法论**：
1. 深度分析源代码的调用链、数据流、依赖行为
2. 严格遵循源代码的调用顺序和数据结构
3. 在关键节点生成测试向量，字节级验证

**成功标准**：
- Python 能通过的测试，Node.js 也能通过
- Python 生成的输出，Node.js 也能生成（允许随机因素差异）
- Python 能注册/验证的场景，Node.js 也能

**失败信号**：
- "这个顺序应该不重要"
- "这个库函数应该是这样用的"
- "功能一样就行了，细节可以不同"

出现以上想法时，立即停止编码，重新分析源代码。
