# Node.js 依赖映射设计文档

## 1. 概述

本文档详细说明 Python 版本的依赖包在 Node.js 项目中的映射和替代方案。

---

## 2. Python 依赖列表

```txt
# requirements.txt
anp>=0.6.8
httpx>=0.28.0
websockets>=14.0
```

---

## 3. 依赖映射总览

| Python 包 | Node.js 替代 | 状态 | 说明 |
|-----------|-------------|------|------|
| `anp` (authentication) | `@awiki/anp-auth` | ⏳ 需要移植 | DID WBA 认证 |
| `anp` (e2e_encryption_hpke) | `@awiki/anp-hpke` | ⏳ 需要移植 | HPKE 加密 |
| `httpx` | `axios` / `node-fetch` | ✅ 有成熟替代 | HTTP 客户端 |
| `websockets` | `ws` / `websockets` | ✅ 有成熟替代 | WebSocket 客户端 |
| `cryptography` | `@noble/curves` + Web Crypto | ✅ 有成熟替代 | 加密原语 |

---

## 4. 详细依赖设计

### 4.1 ANP 库 (最关键)

**Python**:
```python
from anp.authentication import generate_auth_header, DIDWbaAuthHeader
from anp.e2e_encryption_hpke import E2eeHpkeSession, HpkeKeyManager, MessageType
```

**Node.js 替代方案**:

#### 方案 A: 完整移植 (推荐)

创建两个 npm 包：

```json
{
  "name": "@awiki/anp-auth",
  "version": "1.0.0",
  "dependencies": {
    "@noble/curves": "^1.0.0",
    "@noble/hashes": "^1.0.0"
  }
}
```

```json
{
  "name": "@awiki/anp-hpke",
  "version": "1.0.0",
  "dependencies": {
    "@noble/hpke": "^1.0.0",
    "@noble/curves": "^1.0.0",
    "@noble/hashes": "^1.0.0"
  }
}
```

**移植模块**:

| Python 模块 | JavaScript 模块 | 优先级 |
|------------|----------------|--------|
| `anp.authentication.generate_auth_header` | `@awiki/anp-auth.generateAuthHeader` | P0 |
| `anp.authentication.DIDWbaAuthHeader` | `@awiki/anp-auth.DIDWbaAuthHeader` | P0 |
| `anp.authentication.create_did_wba_document_with_key_binding` | `@awiki/anp-auth.createDidWbaDocument` | P0 |
| `anp.e2e_encryption_hpke.E2eeHpkeSession` | `@awiki/anp-hpke.E2eeHpkeSession` | P0 |
| `anp.e2e_encryption_hpke.HpkeKeyManager` | `@awiki/anp-hpke.HpkeKeyManager` | P0 |
| `anp.e2e_encryption_hpke.detect_message_type` | `@awiki/anp-hpke.detectMessageType` | P1 |
| `anp.e2e_encryption_hpke.generate_proof` | `@awiki/anp-hpke.generateProof` | P1 |
| `anp.e2e_encryption_hpke.validate_proof` | `@awiki/anp-hpke.validateProof` | P1 |

#### 方案 B: 使用现有库组合

```javascript
// 认证部分
import { p256 } from '@noble/curves/p256';  // secp256r1 签名
import { secp256k1 } from '@noble/curves/secp256k1';  // secp256k1 身份

// HPKE 加密
import { hpke } from '@noble/hpke';
import { x25519 } from '@noble/curves/x25519';
```

**优缺点对比**:

| 方案 | 优点 | 缺点 | 时间估算 |
|------|------|------|---------|
| 方案 A (完整移植) | 接口一致，易于维护 | 工作量大 | 4-6 周 |
| 方案 B (库组合) | 快速启动 | 接口不一致，需要适配 | 2-3 周 |

**推荐**: 长期采用方案 A，短期可用方案 B 快速验证。

---

### 4.2 httpx 库

**Python**:
```python
import httpx

async with httpx.AsyncClient(base_url="https://awiki.ai", timeout=30.0) as client:
    response = await client.post("/rpc", json=payload)
```

**Node.js 替代**:

#### 选项 A: axios (推荐)

```javascript
import axios from 'axios';

const client = axios.create({
    baseURL: 'https://awiki.ai',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

const response = await client.post('/rpc', payload);
```

#### 选项 B: node-fetch (Node.js 18+)

```javascript
import fetch from 'node-fetch';

const response = await fetch('https://awiki.ai/rpc', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
});
```

#### 选项 C: 原生 fetch (Node.js 18+)

```javascript
const response = await fetch('https://awiki.ai/rpc', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
});
```

**推荐**: 使用 **axios**，因为：
- API 与 httpx 最接近
- 支持拦截器
- 自动 JSON 转换
- 更好的错误处理

---

### 4.3 websockets 库

**Python**:
```python
import websockets

async with websockets.connect("wss://awiki.ai/ws", extra_headers=...) as ws:
    message = await ws.recv()
    await ws.send(data)
```

**Node.js 替代**:

#### 选项 A: ws (推荐)

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('wss://awiki.ai/ws', {
    headers: {
        'Authorization': 'DIDWba ...',
    },
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
});

ws.send(JSON.stringify(data));
```

#### 选项 B: websockets (npm)

```javascript
import { WebSocket } from 'websockets';

// 类似 Python 的 API
```

**推荐**: 使用 **ws**，因为：
- 最成熟的 WebSocket 库
- 性能优秀
- 社区活跃

---

### 4.4 cryptography 库

**Python**:
```python
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key

private_key = load_pem_private_key(pem_bytes, password=None)
signature = private_key.sign(data, ec.ECDSA(hashes.SHA256()))
```

**Node.js 替代**:

#### 选项 A: Web Crypto API (推荐，Node.js 20+)

```javascript
import { webcrypto } from 'node:crypto';

// 加载 PEM
const privateKey = await webcrypto.subtle.importKey(
    'pkcs8',
    pemToDer(pemBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
);

// 签名
const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(data)
);
```

#### 选项 B: @noble/curves

```javascript
import { p256 } from '@noble/curves/p256';
import { secp256k1 } from '@noble/curves/secp256k1';

// secp256r1 签名
const signature = p256.sign(hash, privateKey);

// secp256k1 身份
const pubKey = secp256k1.getPublicKey(privateKey);
```

**推荐**: 
- Node.js 20+: 使用 **Web Crypto API**
- 旧版本：使用 **@noble/curves**

---

## 5. package.json 依赖配置

### 5.1 Module 项目

```json
{
  "name": "@awiki/module",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@noble/curves": "^1.2.0",
    "@noble/hashes": "^1.3.0",
    "@noble/hpke": "^1.1.0",
    "axios": "^1.6.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 5.2 Skill 项目

```json
{
  "name": "@awiki/awiki-agent-id-message-skill",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@awiki/module": "^1.0.0",
    "@awiki/agent-sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### 5.3 SDK 项目

```json
{
  "name": "@awiki/agent-sdk",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@awiki/module": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## 6. 依赖树

```
skill/
├── @awiki/module
│   ├── @noble/curves       # 椭圆曲线加密
│   ├── @noble/hashes       # 哈希函数
│   ├── @noble/hpke         # HPKE 加密
│   ├── axios               # HTTP 客户端
│   └── ws                  # WebSocket
└── @awiki/agent-sdk
    └── @awiki/module       # 复用
```

---

## 7. 移植优先级

### P0: 核心功能 (Week 1-2)

| 功能 | Python | Node.js | 优先级 |
|------|--------|---------|--------|
| HTTP 客户端 | `httpx.AsyncClient` | `axios` | P0 |
| WebSocket | `websockets.connect` | `ws` | P0 |
| secp256k1 签名 | `cryptography` | `@noble/curves/secp256k1` | P0 |
| secp256r1 签名 | `cryptography` | `@noble/curves/p256` | P0 |
| X25519 密钥协商 | `cryptography` | `@noble/curves/x25519` | P0 |

### P1: ANP 认证 (Week 3-4)

| 功能 | Python | Node.js | 优先级 |
|------|--------|---------|--------|
| `generate_auth_header` | `anp.authentication` | `@awiki/anp-auth` | P1 |
| `create_did_wba_document` | `anp.authentication` | `@awiki/anp-auth` | P1 |
| `DIDWbaAuthHeader` | `anp.authentication` | `@awiki/anp-auth` | P1 |

### P2: ANP HPKE (Week 5-6)

| 功能 | Python | Node.js | 优先级 |
|------|--------|---------|--------|
| `E2eeHpkeSession` | `anp.e2e_encryption_hpke` | `@awiki/anp-hpke` | P2 |
| `HpkeKeyManager` | `anp.e2e_encryption_hpke` | `@awiki/anp-hpke` | P2 |
| `generate_proof` | `anp.e2e_encryption_hpke` | `@awiki/anp-hpke` | P2 |
| `validate_proof` | `anp.e2e_encryption_hpke` | `@awiki/anp-hpke` | P2 |

---

## 8. 互操作性测试

### 8.1 认证互操作

```javascript
// 测试 JavaScript 生成的认证头能否被 Python 服务器验证
import { generateAuthHeader } from '@awiki/anp-auth';

const authHeader = await generateAuthHeader({
    didDocument,
    serviceDomain: 'awiki.ai',
    signCallback: secp256k1SignCallback,
});

// 发送到 Python 服务器验证
```

### 8.2 E2EE 互操作

```javascript
// 测试 JavaScript 加密的消息能否被 Python 解密
import { E2eeHpkeSession } from '@awiki/anp-hpke';

const session = new E2eeHpkeSession({...});
const [msgType, content] = session.encryptMessage('text', 'Hello!');

// Python 端应该能解密
```

---

## 9. 性能对比

| 操作 | Python | Node.js | 说明 |
|------|--------|---------|------|
| HTTP 请求 | ~100ms | ~80ms | Node.js 异步优势 |
| WebSocket | ~5ms | ~3ms | 原生支持 |
| secp256k1 签名 | ~10ms | ~8ms | Web Crypto 加速 |
| HPKE 加密 | ~20ms | ~15ms | @noble 优化 |

---

## 10. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| ANP 移植复杂度高 | 高 | 中 | 分阶段移植，先认证后加密 |
| @noble 库 API 变化 | 中 | 低 | 锁定版本，添加版本测试 |
| Web Crypto API 兼容性 | 中 | 低 | 提供 @noble 降级方案 |
| axios 性能问题 | 低 | 低 | 基准测试，必要时切换 |

---

## 11. 检查清单

### 11.1 Module 项目

- [ ] 实现 `@awiki/anp-auth` 包
- [ ] 实现 `@awiki/anp-hpke` 包
- [ ] 配置 `axios` HTTP 客户端
- [ ] 配置 `ws` WebSocket 客户端
- [ ] 添加 `@noble/curves` 加密支持
- [ ] 编写互操作测试

### 11.2 Skill 项目

- [ ] 依赖 `@awiki/module`
- [ ] 配置 `package.json`
- [ ] 测试依赖加载

### 11.3 SDK 项目

- [ ] 依赖 `@awiki/module`
- [ ] 封装 SDK API
- [ ] 编写类型定义

---

## 12. 总结

Python 版本的三个核心依赖在 Node.js 中都有成熟的替代方案：

1. **anp**: 需要移植为 `@awiki/anp-auth` 和 `@awiki/anp-hpke`
2. **httpx**: 使用 `axios` 替代
3. **websockets**: 使用 `ws` 替代
4. **cryptography**: 使用 `@noble/curves` + Web Crypto API 替代

**总开发时间**: 6-8 周（包括 ANP 移植）
