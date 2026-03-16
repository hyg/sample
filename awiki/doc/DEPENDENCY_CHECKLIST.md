# Python 依赖检查清单

## 1. 概述

本文档检查 Python 版本的所有依赖包在 Node.js 项目中的映射状态。

**Python 依赖** (requirements.txt):
```txt
anp>=0.6.8
httpx>=0.28.0
websockets>=14.0
```

---

## 2. 依赖映射状态

### 2.1 anp (AWIKI Network Protocol)

**Python 版本**: `anp>=0.6.8`

**模块结构**:
```
anp/
├── authentication/         # 认证模块
│   ├── generate_auth_header
│   ├── DIDWbaAuthHeader
│   └── create_did_wba_document_with_key_binding
├── e2e_encryption_hpke/    # E2EE 加密模块
│   ├── E2eeHpkeSession
│   ├── HpkeKeyManager
│   ├── MessageType
│   ├── generate_proof
│   ├── validate_proof
│   └── detect_message_type
└── ...
```

**Node.js 映射**:

| 状态 | 模块 | 替代方案 | 工作量 |
|------|------|---------|--------|
| ⏳ | `anp.authentication` | `@awiki/anp-auth` | 高 (2-3 周) |
| ⏳ | `anp.e2e_encryption_hpke` | `@awiki/anp-hpke` | 高 (2-3 周) |

**详细设计**: [DEPENDENCIES.md](DEPENDENCIES.md)

**调用位置**:
- `utils/auth.py`: `generate_auth_header()`
- `utils/identity.py`: `create_did_wba_document_with_key_binding()`
- `utils/e2ee.py`: `E2eeHpkeSession`, `HpkeKeyManager`, `detect_message_type`

---

### 2.2 httpx

**Python 版本**: `httpx>=0.28.0`

**使用位置**:
- `utils/client.py`: `AsyncClient`
- `utils/rpc.py`: `client.post()`
- `utils/auth.py`: `client.post()`

**Node.js 映射**:

| 状态 | 模块 | 替代方案 | 工作量 |
|------|------|---------|--------|
| ✅ | `httpx.AsyncClient` | `axios` | 低 (已成熟) |
| ✅ | `httpx.AsyncClient.post` | `axios.post` | 低 (已成熟) |
| ✅ | `httpx.Response` | `axios.Response` | 低 (已成熟) |

**API 对比**:

```python
# Python (httpx)
async with httpx.AsyncClient(base_url="...", timeout=30.0) as client:
    response = await client.post("/rpc", json=payload)
    data = response.json()
```

```javascript
// JavaScript (axios)
const client = axios.create({ baseURL: '...', timeout: 30000 });
const response = await client.post('/rpc', payload);
const data = response.data;
```

**详细设计**: [doc/lib/httpx-0.28.0/readme.md](lib/httpx-0.28.0/readme.md)

---

### 2.3 websockets

**Python 版本**: `websockets>=14.0`

**使用位置**:
- `utils/ws.py`: `websockets.connect()`
- `ws_listener.py`: `WebSocketClientProtocol`

**Node.js 映射**:

| 状态 | 模块 | 替代方案 | 工作量 |
|------|------|---------|--------|
| ✅ | `websockets.connect` | `ws.WebSocket` | 低 (已成熟) |
| ✅ | `WebSocketClientProtocol` | `ws.WebSocket` | 低 (已成熟) |
| ✅ | `conn.send()` | `ws.send()` | 低 (已成熟) |
| ✅ | `conn.recv()` | `ws.on('message')` | 低 (已成熟) |

**API 对比**:

```python
# Python (websockets)
async with websockets.connect("wss://...", extra_headers=...) as ws:
    await ws.send(data)
    message = await ws.recv()
```

```javascript
// JavaScript (ws)
const ws = new WebSocket('wss://...', { headers: {...} });
ws.send(JSON.stringify(data));
ws.on('message', (data) => {
    console.log(JSON.parse(data.toString()));
});
```

**详细设计**: [doc/lib/websockets-16.0/readme.md](lib/websockets-16.0/readme.md)

---

### 2.4 cryptography (间接依赖)

**Python 版本**: `cryptography` (通过 anp 间接使用)

**使用位置**:
- `utils/auth.py`: `ec.EllipticCurvePrivateKey`, `hashes.SHA256`
- `utils/identity.py`: `load_pem_private_key`
- `utils/e2ee.py`: `X25519PrivateKey`

**Node.js 映射**:

| 状态 | 模块 | 替代方案 | 工作量 |
|------|------|---------|--------|
| ✅ | `ec.EllipticCurvePrivateKey` | `@noble/curves/secp256k1` | 低 |
| ✅ | `ec.ECDSA(hashes.SHA256())` | `@noble/curves` sign | 低 |
| ✅ | `load_pem_private_key` | Web Crypto API | 低 |
| ✅ | `X25519PrivateKey` | `@noble/curves/x25519` | 低 |

**详细设计**: [DEPENDENCIES.md](DEPENDENCIES.md)

---

## 3. 依赖树对比

### 3.1 Python 依赖树

```
awiki-agent-id-message (Python)
├── anp>=0.6.8
│   ├── cryptography
│   └── ...
├── httpx>=0.28.0
│   ├── anyio
│   ├── certifi
│   ├── httpcore
│   ├── idna
│   └── sniffio
└── websockets>=14.0
```

### 3.2 Node.js 依赖树

```
@awiki/module (JavaScript)
├── @awiki/anp-auth (需要开发)
│   ├── @noble/curves
│   └── @noble/hashes
├── @awiki/anp-hpke (需要开发)
│   ├── @noble/hpke
│   ├── @noble/curves
│   └── @noble/hashes
├── axios
│   ├── follow-redirects
│   ├── form-data
│   └── ...
└── ws
```

---

## 4. 工作量估算

| 依赖 | 状态 | 工作量 | 优先级 |
|------|------|--------|--------|
| `anp.authentication` | ⏳ 需要移植 | 2-3 周 | P0 |
| `anp.e2e_encryption_hpke` | ⏳ 需要移植 | 2-3 周 | P0 |
| `httpx` → `axios` | ✅ 成熟替代 | 0.5 周 | P0 |
| `websockets` → `ws` | ✅ 成熟替代 | 0.5 周 | P0 |
| `cryptography` → `@noble` | ✅ 成熟替代 | 0.5 周 | P0 |

**总计**: 5-7 周

---

## 5. 互操作性测试

### 5.1 认证互操作

- [ ] JavaScript 生成的认证头能被 Python 服务器验证
- [ ] Python 生成的认证头能被 JavaScript 验证

### 5.2 E2EE 互操作

- [ ] JavaScript 加密的消息能被 Python 解密
- [ ] Python 加密的消息能被 JavaScript 解密
- [ ] 会话初始化协议一致
- [ ] 密钥更新协议一致

### 5.3 HTTP 互操作

- [ ] HTTP 请求格式一致
- [ ] JSON-RPC 协议一致
- [ ] 错误处理一致

### 5.4 WebSocket 互操作

- [ ] 握手协议一致
- [ ] 消息格式一致
- [ ] 心跳机制一致

---

## 6. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| ANP 移植复杂度高 | 高 | 中 | 分阶段移植，先认证后加密 |
| @noble 库 API 变化 | 中 | 低 | 锁定版本，添加版本测试 |
| axios 性能问题 | 低 | 低 | 基准测试，必要时切换 |
| ws 库兼容性问题 | 低 | 低 | 使用最新稳定版 |

---

## 7. 检查清单

### 7.1 Module 项目

- [ ] 实现 `@awiki/anp-auth` 包
- [ ] 实现 `@awiki/anp-hpke` 包
- [ ] 配置 `axios` HTTP 客户端
- [ ] 配置 `ws` WebSocket 客户端
- [ ] 添加 `@noble/curves` 加密支持
- [ ] 编写互操作测试

### 7.2 Skill 项目

- [ ] 依赖 `@awiki/module`
- [ ] 配置 `package.json`
- [ ] 测试依赖加载

### 7.3 SDK 项目

- [ ] 依赖 `@awiki/module`
- [ ] 封装 SDK API
- [ ] 编写类型定义

---

## 8. 文档索引

| 文档 | 说明 |
|------|------|
| [DEPENDENCIES.md](DEPENDENCIES.md) | 详细依赖映射设计 |
| [doc/lib/anp-0.6.8/readme.md](lib/anp-0.6.8/readme.md) | ANP 库分析 |
| [doc/lib/httpx-0.28.0/readme.md](lib/httpx-0.28.0/readme.md) | httpx 库分析 |
| [doc/lib/websockets-16.0/readme.md](lib/websockets-16.0/readme.md) | websockets 库分析 |

---

**最后更新**: 2026-03-16
