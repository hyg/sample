# E2EE Chat - 端到端加密聊天应用

基于三层架构的端到端加密聊天应用，支持多种DID身份、消息类型和传输协议。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI / Web 界面                         │
├─────────────────────────────────────────────────────────────┤
│                    身份层 (Identity)                        │
│   did:key (Ed25519/X25519) │ did:ethr │ did:wba │ ...      │
├─────────────────────────────────────────────────────────────┤
│                    消息层 (Message)                         │
│          明文 (plaintext) │ 密文 (ciphertext) │ ...         │
├─────────────────────────────────────────────────────────────┤
│                    传输层 (Transport)                       │
│          MQTT │ PeerJS │ GUN │ HTTP │ WebSocket │ ...       │
└─────────────────────────────────────────────────────────────┘
```

### 三层职责

| 层级 | 职责 | 扩展点 |
|------|------|--------|
| **身份层** | DID创建、导入、验证 | 新增DID方法 |
| **消息层** | 明文/密文处理、加密/解密 | 新增消息类型 |
| **传输层** | 消息收发、连接管理 | 新增传输协议 |

## 加密实现

### RFC 9180 HPKE

本项目实现完整的 **RFC 9180 Hybrid Public Key Encryption (HPKE)** 标准。

#### 支持的套件

| 类型 | 算法 | 状态 |
|------|------|------|
| **KEM** | DHKEM-X25519-HKDF-SHA256 | ✅ 完全实现 |
| **KEM** | DHKEM-P256-HKDF-SHA256 | 🔄 计划中 |
| **KDF** | HKDF-SHA256 | ✅ 完全实现 |
| **KDF** | HKDF-SHA384 | 🔄 计划中 |
| **AEAD** | AES-128-GCM | ✅ 完全实现 |
| **AEAD** | AES-256-GCM | ✅ 支持 |
| **AEAD** | ChaCha20-Poly1305 | ✅ 支持 |

#### 支持的模式

| 模式 | 描述 | 状态 |
|------|------|------|
| **Base Mode** | 基础加密模式 | ✅ 完全实现 |
| **Auth Mode** | 发送方认证模式 | ✅ 完全实现 |
| **PSK Mode** | 预共享密钥模式 | 🔄 计划中 |
| **AuthPSK Mode** | 认证+预共享密钥模式 | 🔄 计划中 |

#### 密钥派生链

```
Root Seed
    ├── Init Chain Key (发起方消息密钥链)
    │   ├── Message Key 0
    │   ├── Message Key 1
    │   └── ...
    └── Resp Chain Key (响应方消息密钥链)
        ├── Message Key 0
        ├── Message Key 1
        └── ...
```

每条消息使用独立的密钥和 nonce，确保前向保密。

## 目录结构

```
MQTT/
├── src/
│   ├── cli.js                    # CLI入口
│   ├── e2ee/
│   │   ├── protocol.js           # E2EE协议处理
│   │   ├── session.js            # 会话管理
│   │   ├── hpke-rfc9180.js       # RFC 9180 HPKE 完整实现
│   │   └── hpke-native.js        # 简化版 HPKE（参考）
│   ├── transport/
│   │   ├── base.js               # 统一传输层抽象基类
│   │   ├── mqtt-transport.js     # MQTT 传输实现
│   │   ├── peer-transport.cjs    # PeerJS/WebRTC P2P 传输
│   │   └── gun-transport.js      # GUN 去中心化传输
│   └── did/
│       ├── manager.js            # DID管理器
│       ├── did-key.js            # did:key实现
│       ├── did-ethr.js           # did:ethr实现
│       └── did-wba.js            # did:wba实现
├── web-local/                    # 本地Web界面
├── web-cdn/                      # CDN版本Web界面
└── .data/                        # 身份数据存储
```

## 传输层统一设计

所有传输层实现相同的抽象接口，CLI 无需关心具体协议：

```
┌─────────────────────────────────────────────────────────────┐
│                    统一传输层接口 (base.js)                  │
│   connect()  send()  broadcast()  sendTo()  joinRoom()      │
├─────────────────────────────────────────────────────────────┤
│   MQTT           │   PeerJS         │   GUN                │
│   roomId→topic   │   peerId=DID     │   roomId→path        │
│   peerId→clientId│   无房间(广播)    │   peerId→sender_did  │
└─────────────────────────────────────────────────────────────┘
```

### 统一参数

| 参数 | 说明 | MQTT | PeerJS | GUN |
|------|------|------|--------|-----|
| `roomId` | 房间/主题 | topic | 无 | path |
| `peerId` | 节点标识 | clientId | peer ID | sender_did |
| `serverUrl` | 服务器 | broker URL | 信令服务器 | peers URL |

## 快速开始

### 安装

```bash
npm install
```

### CLI版本

```bash
# 使用 MQTT (默认)
node src/cli.js

# 使用 PeerJS (WebRTC)
node src/cli.js -t peer

# 使用 PeerJS 并指定 ID
node src/cli.js -t peer --peer-id my-id

# 使用 PeerJS 并连接到指定 peer
node src/cli.js -t peer --connect target-peer-id

# 使用 GUN (去中心化网络)
node src/cli.js -t gun

# 查看所有选项
node src/cli.js --help
```

### Web版本

本地版本：
```bash
cd web-local
# 使用任意静态服务器
python -m http.server 8080
# 或
npx serve
```

CDN版本：
```bash
cd web-cdn
# 同上
```

## 传输协议

### MQTT (默认)
- 优点：稳定可靠，支持大量并发连接
- 服务器：`mqtt://broker.emqx.io:1883`
- 房间映射：topic
- 协议：MQTT over WebSocket

### PeerJS (peer)
- 优点：WebRTC P2P，端到端加密，跨局域网
- 信令服务器：`0.peerjs.com` (PeerJS Cloud)
- 数据传输：WebRTC DataChannel
- Node.js 支持：`@roamhq/wrtc`
- 官网：https://peerjs.com
- **注意**：需要手动连接到对方的 peer ID（使用 `/peer <id>` 命令）

### GUN (gun)
- 优点：去中心化网状网络，离线优先
- 服务器：`https://gun-manhattan.herokuapp.com/gun`
- 房间映射：`gun.get('e2ee').get(roomId)`
- 特性：自动同步，冲突解决

## 使用说明

### CLI 命令

```bash
# 传输协议切换
/transport mqtt      # 切换到 MQTT
/transport peer      # 切换到 PeerJS
/transport gun       # 切换到 GUN
/transport           # 查看当前传输协议

# PeerJS 连接 (peer 模式专用)
/peer                # 显示我的 PeerJS ID
/peer <peer-id>      # 连接到指定的 peer

# 身份管理
/create x25519       # 创建 did:key 身份
/create wba xuemen.com  # 创建 did:wba 身份
/import .data/identity-xxx.json  # 导入身份

# 连接与会话
/connect did:key:xxx  # 设置伙伴DID
/pubkey <hex>         # 设置伙伴公钥
/init                 # 发起E2EE会话
/sessions             # 列出所有会话
/switch <id>          # 切换会话

# 消息
Hello                 # 发送消息 (自动加密或明文)
/send Hello           # 显式发送
```

### PeerJS 使用示例

```bash
# 节点 A
node src/cli.js -t peer
# 输出: [PeerJS] Connected to PeerJS Cloud, ID: abc-123

# 节点 B
node src/cli.js -t peer
# 输出: [PeerJS] Connected to PeerJS Cloud, ID: xyz-789

# 节点 B 连接到节点 A
> /peer abc-123
# 输出: [PeerJS] ✓ 已发起连接

# 现在可以发送消息了
> Hello from B

# 节点 A 收到消息
[PeerJS] Connected to peer: xyz-789
[📢 公共] unknown: Hello from B
```

### Web 界面

1. 选择传输协议（MQTT/PeerJS/GUN）
2. 创建或导入身份
3. 设置伙伴DID和公钥
4. 发起E2EE会话
5. 开始聊天

## 扩展开发

### 添加新的DID方法

1. 在 `src/did/` 创建新实现文件
2. 实现DID创建、导入、验证接口
3. 在 `manager.js` 注册新方法

### 添加新的消息类型

1. 在 `protocol.js` 添加消息类型常量
2. 实现构建和处理逻辑
3. 在 `cli.js` 添加命令处理

### 添加新的传输协议

1. 继承 `Transport` 抽象类
2. 实现 `connect()`、`send()`、`broadcast()` 等方法
3. 在 `cli.js` 替换传输实例

### 添加新的 HPKE 套件

1. 在 `hpke-rfc9180.js` 添加 KEM/KDF/AEAD 实现
2. 注册到 `SUITE_CONFIG`
3. 更新 `HPKE` 类支持新套件

## 依赖

- mqtt: MQTT客户端
- peer: PeerJS WebRTC客户端
- gun: GUN去中心化数据库
- @noble/hashes: 密码学哈希
- @noble/curves: 椭圆曲线
- @noble/ciphers: 对称加密

## 参考

- [RFC 9180 - HPKE](https://www.rfc-editor.org/rfc/rfc9180.html)
- [RFC 5869 - HKDF](https://www.rfc-editor.org/rfc/rfc5869.html)
- [RFC 7748 - X25519/X448](https://www.rfc-editor.org/rfc/rfc7748.html)

## 许可

ISC
