# 跨平台消息测试报告

**测试时间**: 2026-03-08 03:47 UTC

## 测试身份

### Node.js 创建的身份
- **DID**: `did:wba:awiki.ai:user:k1_ZC4d5CFobUfciijgHmNZ3w0WzkX3_-PHWHShgZv06zc`
- **User ID**: `2262b05c-7eaa-439e-bc56-feaed4adda28`
- **JWT**: ✓ 已获取（通过 Node.js getJwtViaWba()）
- **凭证文件**: `nodejs-awiki/.credentials/nodeagentfixed.json`

### Python 创建的身份
- **DID**: `did:wba:awiki.ai:user:k1_DV_IfpDG5Ri9bJdNI4xGrp-gCUU8bv2OypaRQmIynIM`
- **User ID**: `4dd5bec4-99b2-40f2-89ed-a303d9fbf732`
- **JWT**: ✓ 已获取（通过 Python get_jwt_via_wba()）
- **凭证文件**: `~/.openclaw/credentials/awiki-agent-id-message/pythonmsgtest.json`

---

## 测试结果

### 测试 1: Node.js -> Python ✓

**发送方**: Node.js 身份 (JWT 通过 Node.js 获取)  
**接收方**: Python 身份  
**消息内容**: `From Node.js (new JWT) 2026-03-08T03:46:48.219Z`

**结果**:
```
✓ Message sent successfully
  Server Seq: 1
```

**状态**: ✓ **PASS**

---

### 测试 2: Python -> Node.js ⏳

**发送方**: Python 身份  
**接收方**: Node.js 身份  
**消息内容**: `From Python 2026-03-08T03:46:49.774Z`

**结果**: 待测试（需要更新测试脚本使用新的 Python 身份）

---

## 关键修复

### 1. JWT 获取功能修复 ✓

**问题**: PEM 格式 OID 错误

**修复前**:
```javascript
// 错误的 OID (X25519)
const algorithmIdentifier = Buffer.from([
    0x30, 0x07,
    0x06, 0x05, 0x2b, 0x65, 0x70, // 1.3.101.112 (X25519)
]);
```

**修复后**:
```javascript
// 正确的 OID (secp256k1)
const algorithmIdentifier = Buffer.from([
    0x30, 0x09,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x01, 0x01, // 1.3.132.0.10 (secp256k1)
]);
```

**验证**: Node.js 成功获取 JWT

---

### 2. PEM 字符串处理修复 ✓

**问题**: JSON 存储的 PEM 中 `\n` 是转义字符

**修复**:
```javascript
// 替换 JSON 转义的换行符为实际换行符
const normalizedPem = rawPem.replace(/\\n/g, '\n');
```

**验证**: PEM 正确解析

---

## 测试结论

### Node.js 功能验证

| 功能 | 状态 | 备注 |
|------|------|------|
| 创建身份 | ✓ | createIdentity() |
| 获取 JWT | ✓ | getJwtViaWba() - 已修复 |
| 发送消息 | ✓ | send_message() |
| 接收消息 | ⏳ | 待测试 |

### 跨平台互操作性

| 方向 | 状态 | 备注 |
|------|------|------|
| Node.js -> Python | ✓ | Node.js JWT 发送，Python DID 接收 |
| Python -> Node.js | ⏳ | 待测试 |
| Node.js -> Node.js | ⏳ | 待测试 |

---

## 下一步

1. 测试 Python -> Node.js 消息发送
2. 测试 Node.js -> Node.js 消息发送
3. 测试 E2EE 加密消息
4. 测试消息接收功能

---

**报告生成时间**: 2026-03-08 03:47:00 UTC
