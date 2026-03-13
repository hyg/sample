# E2EE MQTT Chat - 快速开始指南

## 项目概述

本项目实现了一个支持多种 DID 方法的端到端加密 (E2EE) MQTT 聊天工具，包含：
- **CLI 客户端** - 命令行聊天应用
- **HTML 客户端** - 浏览器聊天页面

## 核心特性

### 🔐 端到端加密
- 基于 HPKE (RFC 9180) 实现密钥封装
- 双棘轮 (Double Ratchet) 密钥派生机制
- AES-128-GCM 消息加密

### 🔑 多 DID 支持
- **did:key** - 基于密钥的 DID 方法（推荐用于测试）
- **did:ethr** - 基于以太坊的 DID 方法
- **可扩展架构** - 易于添加新的 DID 方法（如 did:wba、did:web）

### 📱 双客户端
- **CLI 客户端** - Node.js 命令行工具
- **HTML 客户端** - 纯静态页面，无需服务器

## 安装

```bash
# 安装依赖
pnpm install
# 或 npm install
```

## 使用 CLI 客户端

### 1. 启动应用

```bash
node src/cli.js
```

### 2. 创建身份

在 CLI 中输入：
```
/identity new key
```

保存生成的 DID 和身份文件。

### 3. 与伙伴交换信息

- 将你的 DID 和公钥发送给伙伴
- 获取伙伴的 DID 和公钥

### 4. 连接伙伴

```
/connect did:key:z6Mk...
/pubkey <伙伴的公钥十六进制>
```

### 5. 初始化 E2EE 会话

```
/init
```

### 6. 开始聊天

```
/send Hello, secure world!
```

或直接输入消息。

### 常用命令

```
/help                   - 显示帮助
/identity show          - 显示当前身份
/identity export        - 导出身份
/session                - 显示会话状态
/quit                   - 退出
```

## 使用 HTML 客户端

### 1. 启动本地服务器

```bash
npm run serve
```

### 2. 打开浏览器

访问：http://localhost:8080

### 3. 操作步骤

1. 点击"创建 did:key 身份"
2. 与伙伴交换 DID 和公钥
3. 输入伙伴的 DID 和公钥
4. 点击"连接"
5. 点击"初始化 E2EE 会话"
6. 开始聊天

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                  E2EE MQTT Chat                     │
├─────────────────────────────────────────────────────┤
│  CLI Client  │   HTML Client   │  Node.js Library  │
└────────┬─────┴────────┬────────┴─────────┬─────────┘
         │              │                   │
         └──────────────┼───────────────────┘
                        │
         ┌──────────────▼───────────────┐
         │       E2EE Core Layer        │
         │  ┌────────┐  ┌────────────┐  │
         │  │  DID   │  │   HPKE     │  │
         │  │Manager │  │   Crypto   │  │
         │  └────────┘  └────────────┘  │
         │  ┌────────────────────────┐  │
         │  │   Session Manager      │  │
         │  │  (Double Ratchet)      │  │
         │  └────────────────────────┘  │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │    MQTT Transport Layer      │
         │     (JSON-RPC 2.0)           │
         └──────────────┬───────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Public MQTT    │
              │    Broker       │
              │ (broker.emqx.io)│
              └─────────────────┘
```

## 项目结构

```
MQTT/
├── src/
│   ├── cli.js              # CLI 入口
│   ├── did/
│   │   ├── registry.js     # DID 方法注册表
│   │   ├── manager.js      # DID 管理器
│   │   ├── did-key.js      # did:key 实现
│   │   └── did-ethr.js     # did:ethr 实现
│   ├── e2ee/
│   │   ├── hpke.js         # HPKE 加密
│   │   └── session.js      # 会话管理
│   └── core/
│       └── mqtt-client.js  # MQTT 客户端
├── index.html              # HTML 客户端
├── package.json
└── README.md
```

## 添加新的 DID 方法

1. 在 `src/did/` 创建新文件，如 `did-wba.js`
2. 实现 DID 方法接口：
   - `generate(options)` - 生成身份
   - `fromPrivateKey(privateKey, options)` - 从私钥恢复
   - `resolve(did)` - 解析 DID 文档
   - `sign(message, privateKey)` - 签名
   - `verify(message, signature, publicKey)` - 验证
3. 在 `src/did/manager.js` 注册新方法

## 安全注意事项

1. **私钥保管** - 身份文件包含私钥，请妥善保管
2. **公钥验证** - 通过安全渠道交换公钥
3. **会话过期** - 会话默认 24 小时过期
4. **单设备限制** - 当前实现不支持多设备

## 故障排除

### CLI 无法连接 MQTT Broker

检查网络连接，或更换 Broker：
```bash
export MQTT_BROKER_URL=mqtt://<broker>:<port>
```

### HTML 客户端无法加载

确保使用 HTTP 服务器访问，不要直接打开文件：
```bash
npm run serve
```

### E2EE 会话初始化失败

确认：
- 双方 DID 格式正确
- 公钥格式正确（65 字节 P-256 公钥，十六进制）
- 网络连接正常

## 参考文档

- [ANP E2EE 协议规范](https://github.com/agent-network-protocol/AgentNetworkProtocol/blob/main/09-ANP-end-to-end-instant-messaging-protocol-specification.md)
- [DID Key 规范](https://w3c-ccg.github.io/did-method-key/)
- [HPKE RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html)

## 许可证

ISC
