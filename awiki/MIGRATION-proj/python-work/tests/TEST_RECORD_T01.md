# T01: DID 身份创建 - 测试记录

**测试日期**: 2026-03-08
**测试人员**: AI Assistant
**测试版本**: Python 3.14.3 (ANP 0.6.4) / Node.js v25.2.1
**测试环境**: 同一局域网

---

## 测试结果

### ✅ 通过

---

## 测试步骤与结果

### 步骤 1: Python 创建身份

**PC-A (Python)**:
```bash
cd D:\huangyg\git\sample\awiki\python-client
python scripts/setup_identity.py --name "PyTest1" --agent --credential py_test_base
```

**输出**:
```
Service configuration:
  user-service: https://awiki.ai
  DID domain  : awiki.ai

Creating DID identity...
  DID       : did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g
  unique_id : k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g
  user_id   : 77ec3f44-f94f-4c19-b315-49c0f0bf4a37
  JWT token : eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1jZDRjYjI3ZiIsIn...

Credential saved to: C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\py_test_base.json
```

**验证**:
- [x] DID 格式：`did:wba:awiki.ai:user:k1_{43 字符 base64url}` ✅
- [x] 返回 user_id ✅
- [x] 返回 JWT token ✅
- [x] 凭证保存到本地 ✅

---

### 步骤 2: Node.js 创建身份

**PC-B (Node.js)**:
```bash
cd D:\huangyg\git\sample\awiki\nodejs-client
node scripts/setup_identity.js --name "NodeTest1" --agent --credential node_test_base
```

**输出**:
```
Service configuration:
  user-service: https://awiki.ai
  DID domain  : awiki.ai

Creating DID identity...
  DID       : did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w
  unique_id : k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w
[getJwtViaWba] Starting JWT acquisition...
[getJwtViaWba] Authorization Header: DIDWba v="1.1", did="...", signature="..."
[getJwtViaWba] Response Status: 200
[getJwtViaWba] SUCCESS - JWT acquired
  user_id   : 087b4a1f-3bc9-44e9-a0b3-5ca5f3be3cd7
  JWT token : eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1jZDRjYjI3ZiIsIn...

Credential saved to: D:\huangyg\git\sample\awiki\nodejs-client\.credentials\node_test_base.json
```

**验证**:
- [x] DID 格式：`did:wba:awiki.ai:user:k1_{43 字符 base64url}` ✅
- [x] 返回 user_id ✅
- [x] 返回 JWT token ✅
- [x] 凭证保存到本地 ✅
- [x] 签名格式被服务器接受 (R||S) ✅

---

### 步骤 3: 验证 DID 格式

**Python DID**: `did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g`
**Node.js DID**: `did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w`

**格式验证**:
- [x] 前缀：`did:wba:` ✅
- [x] 域名：`awiki.ai` ✅
- [x] 路径：`user:k1_{fingerprint}` ✅
- [x] Fingerprint 长度：43 字符 ✅

---

### 步骤 4: 验证凭证文件

**Python 凭证** (`py_test_base.json`):
- [x] `did` - DID 标识符 ✅
- [x] `did_document` - 包含 proof 的 DID 文档 ✅
- [x] `private_key_pem` - 私钥 PEM ✅
- [x] `public_key_pem` - 公钥 PEM ✅
- [x] `user_id` - 用户 ID ✅
- [x] `jwt_token` - JWT 令牌 ✅
- [x] `e2ee_signing_private_pem` - key-2 私钥 ✅
- [x] `e2ee_signing_public_pem` - key-2 公钥 ✅
- [x] `e2ee_agreement_private_pem` - key-3 私钥 ✅
- [x] `e2ee_agreement_public_pem` - key-3 公钥 ✅

**Node.js 凭证** (`node_test_base.json`):
- [x] 所有字段都存在 ✅

---

## 问题记录

### 问题 1: Python 代码导入错误（已修复）

**现象**: 
```
ImportError: cannot import name 'validate_proof' from 'anp.e2e_encryption_hpke'
```

**原因**: ANP 0.6.4 版本中函数名为 `verify_proof` 而非 `validate_proof`

**修复**: 
- 修改 `scripts/utils/e2ee.py` 第 34-44 行
- 将 `validate_proof` 改为 `verify_proof`
- 修改第 770 行的函数调用

**状态**: ✅ 已修复

---

## 测试结论

- [x] **通过** - 所有验证点通过

**总体评价**:
Python 和 Node.js 都能成功创建 DID 身份，格式符合规范，都能成功注册到 awiki.ai 并获取 JWT。
Node.js 的 R||S 签名格式被服务器接受，这是一个重要验证结果。

**关键发现**:
1. Python 和 Node.js 创建的 DID 格式一致
2. Node.js 的 R||S 签名格式有效（不需要改为 DER）
3. 两个凭证文件结构一致
4. 都包含 E2EE 密钥（key-2, key-3）

---

**记录人**: AI Assistant
**记录日期**: 2026-03-08
**审核状态**: 已完成
