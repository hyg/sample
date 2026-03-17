# E2EE MQTT Chat

端到端加密的 MQTT 聊天工具，支持多种 DID 方法和群组通信功能。基于 ANP（Agent Network Protocol）规范扩展实现。

**项目地址**: https://github.com/your-repo/e2ee-mqtt-chat

## 特性

- 🔐 **端到端加密** - 基于 HPKE (RFC 9180) 和双棘轮密钥派生
- 🔑 **多 DID 支持** - 支持 did:key、did:ethr、did:wba，可扩展到 did:web 等
- 🔗 **跨 DID 通信** - 不同 DID 方法之间可以互相通信
- 💻 **双客户端** - CLI 命令行工具和 HTML 网页客户端
- 🌐 **去中心化通信** - 通过公共 MQTT Broker 进行消息传递
- 📦 **模块化架构** - 易于扩展和集成

## 快速开始

### CLI 客户端

```bash
# 启动 CLI
node src/cli.js

# 创建身份（支持多种 DID 方法）
/create x25519           # did:key
/create ethr x25519      # did:ethr (以太坊)
/create wba x25519       # did:wba (跨链)

# 查看身份
/show

# 连接伙伴
/connect <partner-did>
/pubkey <partner-public-key-hex>

# 初始化 E2EE 会话
/init

# 发送消息
/send Hello, secure world!
或直接输入消息
```

### Web 客户端

```bash
# CDN 版本（轻量，约 20KB）
cd web-cdn
npx http-server -p 8080

# 本地文件版本（离线，约 700KB）
cd web-local
npx http-server -p 8080
```

访问 http://localhost:8080

## 支持的 DID 方法

| 方法 | 格式 | 支持网络 | 密钥类型 |
|------|------|----------|----------|
| **did:key** | `did:key:z6Mk...` | N/A | X25519, Ed25519, P-256 |
| **did:ethr** | `did:ethr:0x1:0x123...` | Ethereum, Sepolia, BSC, Polygon, Arbitrum, Optimism | X25519, P-256 |
| **did:wba** | `did:wba:eth:0x123...` | ETH, BSC, Polygon, Arbitrum, Optimism, Avalanche, Base | X25519, P-256 |

### 跨 DID 通信示例

```
Alice (did:key)  ←→  Bob (did:ethr)  ←→  Carol (did:wba)
     ↓                    ↓                   ↓
  X25519 密钥协商     X25519 密钥协商      X25519 密钥协商
     ↓                    ↓                   ↓
  HPKE 加密通信        HPKE 加密通信       HPKE 加密通信
```

所有 DID 方法使用统一的 X25519/P-256 密钥协商接口，确保互操作性。

## 技术架构

### 加密实现

**HPKE 套件**: `DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM`

**完整 RFC 9180 实现**:
- ✅ KEM: DHKEM-X25519-HKDF-SHA256
- ✅ KDF: HKDF-SHA256
- ✅ AEAD: AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305
- ✅ 模式：Base Mode, Auth Mode
- ✅ Labeled Extract/Expand
- ✅ Key Schedule

**双棘轮密钥派生**:
```
root_seed → init_chain_key, resp_chain_key
    │
    └── 每消息派生：msg_key → enc_key + nonce
```

### DID 架构

```
┌─────────────────────────────────────────┐
│            DID Manager                  │
├─────────────────────────────────────────┤
│         DID Method Registry             │
├──────────┬────────────┬─────────────────┤
│ did:key  │  did:ethr  │    did:wba      │
│ Handler  │  Handler   │    Handler      │
└──────────┴────────────┴─────────────────┘
         │
         └──→ 统一接口：getSharedSecret()
```

详见 [DID-EXTENSION.md](DID-EXTENSION.md)

## 项目结构

```
MQTT/
├── src/
│   ├── cli.js                  # CLI 入口
│   ├── did/
│   │   ├── registry.js         # DID 方法注册表
│   │   ├── manager.js          # DID 管理器
│   │   ├── did-key.js          # did:key 实现
│   │   ├── did-ethr.js         # did:ethr 实现
│   │   └── did-wba.js          # did:wba 实现
│   ├── e2ee/
│   │   ├── hpke-rfc9180.js     # HPKE 完整实现 (RFC 9180)
│   │   └── session.js          # 会话管理
│   └── core/
│       └── mqtt-client.js      # MQTT 客户端
├── web-cdn/                    # Web 客户端 (CDN 版本)
│   ├── index.html
│   └── e2ee/hpke-browser.js
├── web-local/                  # Web 客户端 (本地版本)
│   ├── index.html
│   ├── e2ee/hpke-browser.js
│   └── lib/
├── HPKE-RFC9180.md             # HPKE 实现说明
├── DID-EXTENSION.md            # DID 扩展设计
└── README.md
```

## 扩展指南

### 添加新的 DID 方法

1. 创建 `src/did/did-<method>.js`
2. 实现统一接口（generate, fromPublicKey, getSharedSecret 等）
3. 在 `src/did/manager.js` 中注册

详见 [DID-EXTENSION.md](DID-EXTENSION.md#扩展新的-did-方法)

### 添加新的加密套件

1. 在 `src/e2ee/hpke-rfc9180.js` 中添加 KEM/KDF/AEAD 实现
2. 更新 `SUITE_CONFIG` 配置
3. 在 `HPKE` 类中添加新的套件组合

详见 [HPKE-RFC9180.md](HPKE-RFC9180.md)

## 安全考虑

1. **私钥存储** - 使用加密存储，密码派生自用户口令
2. **会话过期** - 会话默认 24 小时过期
3. **前向保密** - 每条消息使用独立的密钥
4. **重放攻击防护** - 序列号严格递增
5. **跨 DID 验证** - 使用统一的签名验证接口

## 限制

1. **单设备** - 当前实现不支持同一 DID 在多个设备上使用
2. **群聊** - 群聊 E2EE 功能在开发中
3. **大文件** - 仅支持文本消息

## 参考文档

- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [did:key Specification](https://w3c-ccg.github.io/did-method-key/)
- [did:ethr Specification](https://github.com/uport-project/ethr-did/blob/develop/doc/did-method-spec.md)
- [RFC 9180 HPKE](https://www.rfc-editor.org/rfc/rfc9180.html)
- [RFC 7748 X25519](https://www.rfc-editor.org/rfc/rfc7748.html)
- [ANP E2EE 协议规范](https://github.com/agent-network-protocol/AgentNetworkProtocol/blob/main/09-ANP-end-to-end-instant-messaging-protocol-specification.md)

## 版本历史

- **v2.0** (2026-03-14): 
  - 完整 RFC 9180 HPKE 实现
  - 支持 did:ethr, did:wba
  - 跨 DID 通信支持
  - 可扩展 DID 架构
  
- **v1.0**: 初始版本，支持 did:key

## 许可证

ISC
