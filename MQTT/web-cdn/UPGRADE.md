# Web 客户端升级说明

## 新增功能

### 1. 多 DID 方法支持

现在 Web 客户端支持创建多种 DID 方法的身份：

#### did:key（推荐）
- **简单快速**：无需区块链，即时生成
- **用途**：日常通信，测试
- **格式**：`did:key:z6Mk...`

#### did:ethr（以太坊）
- **支持网络**：
  - Ethereum Mainnet
  - Sepolia Testnet
  - BSC Mainnet
  - Polygon
  - Arbitrum One
  - Optimism
- **用途**：与以太坊生态集成
- **格式**：`did:ethr:0x1:0x1234567890abcdef...`

#### did:wba（跨链）
- **支持链**：
  - Ethereum
  - Sepolia
  - BSC
  - Polygon
  - Arbitrum
  - Optimism
  - Avalanche
  - Base
- **用途**：跨链身份，多链用户
- **格式**：`did:wba:eth:0x1234567890abcdef...`

### 2. 跨 DID 通信

不同 DID 方法之间可以互相通信：

```
did:key 用户  ←→  did:ethr 用户  ←→  did:wba 用户
     ↓               ↓                 ↓
  都可以使用 X25519 密钥协商进行 E2EE 通信
```

## 使用方法

### 创建身份

1. 打开 Web 客户端（http://localhost:8080）

2. 选择 DID 方法：
   - **did:key**：简单快速，推荐新手
   - **did:ethr**：选择以太坊网络
   - **did:wba**：选择区块链

3. 选择密钥类型：
   - **X25519**（推荐）：用于密钥协商，E2EE 通信
   - **P-256**：用于签名和密钥协商

4. 点击"创建 X25519 身份"或"创建 P-256 身份"

5. 保存显示的 DID 和公钥

### 与 CLI 互通

#### Web → CLI

1. **Web 端**：
   - 创建身份
   - 复制 DID 和公钥

2. **CLI 端**：
   ```bash
   /connect <Web-DID>
   /pubkey <Web-PublicKey>
   /init
   /send Hello from CLI!
   ```

#### CLI → Web

1. **CLI 端**：
   ```bash
   /create x25519
   # 保存显示的 DID 和公钥
   ```

2. **Web 端**：
   - 创建身份
   - 粘贴 CLI 的 DID 和公钥
   - 点击"连接"
   - 点击"初始化 E2EE 会话"
   - 发送消息

### 跨 DID 方法通信示例

#### 场景 1：did:key (Web) → did:ethr (CLI)

1. **Web 端**：
   - 选择 "did:key"
   - 创建 X25519 身份
   - 复制 DID：`did:key:z6Mk...`
   - 复制公钥：`8dfe8b73...`

2. **CLI 端**：
   ```bash
   /create ethr x25519  # 创建 did:ethr 身份
   /connect did:key:z6Mk...
   /pubkey 8dfe8b73...
   /init
   /send Hello from did:ethr!
   ```

3. **Web 端**：收到消息

#### 场景 2：did:wba (Web) → did:key (Web，另一个窗口)

1. **窗口 A**：
   - 选择 "did:wba" → "polygon"
   - 创建 X25519 身份
   - 复制 DID：`did:wba:polygon:0x1234...`
   - 复制公钥

2. **窗口 B**（隐私模式）：
   - 选择 "did:key"
   - 创建 X25519 身份
   - 粘贴窗口 A 的 DID 和公钥
   - 点击"连接"
   - 点击"初始化 E2EE 会话"

3. **双方**：可以加密通信

## 身份存储

- **存储位置**：浏览器 localStorage
- **存储内容**：
  ```json
  {
    "did": "did:key:z6Mk...",
    "method": "key",
    "privateKey": "hex...",
    "publicKey": "hex...",
    "keyType": "x25519",
    "chain": null
  }
  ```

- **清除数据**：清除浏览器数据会丢失身份
- **备份**：使用"导出"功能备份身份

## 技术细节

### 密钥派生

所有 DID 方法使用统一的密钥派生流程：

```
私钥 (X25519/P-256)
    ↓
公钥 (原始字节)
    ↓
DID (根据方法不同格式不同)
    ↓
E2EE 通信 (HPKE + 双棘轮)
```

### 跨 DID 通信原理

1. **统一接口**：所有 DID 方法实现 `getSharedSecret()` 接口
2. **公共密钥格式**：使用原始字节（Uint8Array）
3. **标准 E2EE**：HPKE (RFC 9180) + 双棘轮

### 支持的加密套件

- **KEM**: DHKEM-X25519-HKDF-SHA256
- **KDF**: HKDF-SHA256
- **AEAD**: AES-128-GCM

## 故障排除

### Q: 创建身份失败
A: 检查浏览器控制台错误，确保加载了所有依赖

### Q: 无法连接到伙伴
A: 确认 DID 和公钥格式正确，公钥应为 64 字符十六进制

### Q: 跨 DID 方法通信失败
A: 确保双方都使用 X25519 密钥类型进行 E2EE 通信

### Q: 身份丢失
A: 从备份恢复，或重新创建身份

## 版本历史

- **v2.0** (2026-03-14): 支持 did:ethr, did:wba，跨 DID 通信
- **v1.0**: 初始版本，仅支持 did:key
