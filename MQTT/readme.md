# E2EE MQTT Chat - 扩展设计方案

## 项目概述

端到端加密的 MQTT 聊天工具，支持多种 DID 方法和群组通信功能。

**项目地址**: https://github.com/your-repo/e2ee-mqtt-chat

---

## 一、扩展 DID 方法支持

### 1.1 当前状态

✅ **已实现**
- `did:key` - 基于密钥的 DID 方法
  - 支持 X25519（密钥协商）
  - 支持 P-256（签名和密钥协商）
  - 支持 Ed25519（签名）

❌ **待实现**
- `did:ethr` - 基于以太坊的 DID 方法
- `did:wba` - 基于 WBA（Web3 Blockchain Alliance）的 DID 方法

### 1.2 did:ethr 实现方案

#### 1.2.1 技术选型

**依赖库**:
```json
{
  "dependencies": {
    "ethers": "^6.0.0",
    "did-resolver": "^4.0.0",
    "ethr-did-resolver": "^10.0.0"
  }
}
```

**支持的以太坊网络**:
| 网络 | Chain ID | RPC URL |
|------|----------|---------|
| Ethereum Mainnet | 1 | https://mainnet.infura.io |
| Sepolia Testnet | 11155111 | https://sepolia.infura.io |
| BSC Mainnet | 56 | https://bsc-dataseed.binance.org |
| Polygon | 137 | https://polygon-rpc.com |

#### 1.2.2 DID 文档结构

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/secp256k1recovery-2020/v2"
  ],
  "id": "did:ethr:0x03fdd57adec3d438ea237fe46b33ee1e016eda6b585c3e27ea66686c2ea5358f47",
  "verificationMethod": [
    {
      "id": "did:ethr:0x03fdd5...#controller",
      "type": "EcdsaSecp256k1RecoveryMethod2020",
      "controller": "did:ethr:0x03fdd5...",
      "blockchainAccountId": "eip155:1:0x03fdd57adec3d438ea237fe46b33ee1e016eda6b"
    }
  ],
  "authentication": [
    "did:ethr:0x03fdd5...#controller"
  ],
  "assertionMethod": [
    "did:ethr:0x03fdd5...#controller"
  ],
  "keyAgreement": [
    {
      "id": "did:ethr:0x03fdd5...#key-agreement",
      "type": "X25519KeyAgreementKey2019",
      "controller": "did:ethr:0x03fdd5...",
      "publicKeyMultibase": "z6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc"
    }
  ]
}
```

#### 1.2.3 实现步骤

**步骤 1**: 创建 `src/did/did-ethr.js`

```javascript
/**
 * did:ethr DID 方法实现
 */

import { ethers } from 'ethers';
import { Resolver } from 'did-resolver';
import { getResolver } from 'ethr-did-resolver';

export class EthrDIDHandler {
  constructor(options = {}) {
    this.infuraProjectId = options.infuraProjectId || process.env.INFURA_PROJECT_ID;
    this.chainId = options.chainId || 1; // 默认以太坊主网
    this.provider = new ethers.JsonRpcProvider(
      `https://${this.chainId === 1 ? 'mainnet' : 'sepolia'}.infura.io/v3/${this.infuraProjectId}`
    );
  }

  /**
   * 从私钥生成 DID
   */
  async generateFromPrivateKey(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    const compressedPublicKey = ethers.SigningKey.computePublicKey(wallet.publicKey, true);
    
    // did:ethr 格式：did:ethr:<chainId>:<publicKey>
    const did = `did:ethr:${this.chainId}:${compressedPublicKey.substring(2)}`;
    
    return {
      did,
      privateKey: Buffer.from(privateKey.substring(2), 'hex'),
      publicKey: Buffer.from(compressedPublicKey.substring(2), 'hex'),
      address: wallet.address,
      keyType: 'secp256k1'
    };
  }

  /**
   * 解析 DID 文档
   */
  async resolve(did) {
    const resolver = new Resolver(
      getResolver({ 
        infuraProjectId: this.infuraProjectId,
        chainId: this.chainId 
      })
    );
    
    const didDocument = await resolver.resolve(did);
    return didDocument;
  }

  /**
   * 验证签名
   */
  async verify(message, signature, publicKey) {
    const address = ethers.recoverAddress(
      ethers.hashMessage(message),
      signature
    );
    
    // 从公钥推导地址
    const publicKeyHex = Buffer.from(publicKey).toString('hex');
    const derivedAddress = ethers.SigningKey.computeAddress(publicKeyHex);
    
    return address.toLowerCase() === derivedAddress.toLowerCase();
  }

  /**
   * 签名
   */
  async sign(message, privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    return await wallet.signMessage(message);
  }
}
```

**步骤 2**: 在 `src/did/manager.js` 中注册

```javascript
import { EthrDIDHandler } from './did-ethr.js';

// 在 didManager 中添加
const handlers = {
  key: new KeyDIDHandler(),
  ethr: new EthrDIDHandler({ 
    infuraProjectId: process.env.INFURA_PROJECT_ID,
    chainId: 1 
  }),
  wba: new WbaDIDHandler() // 待实现
};
```

### 1.3 did:wba 实现方案

#### 1.3.1 技术背景

WBA（Web3 Blockchain Alliance）DID 是一种跨链 DID 方法，支持多条区块链。

**DID 格式**: `did:wba:<chain>:<address>`

#### 1.3.2 支持的区块链

| 链 | Chain ID | 说明 |
|----|----------|------|
| Ethereum | 1 | 以太坊主网 |
| BSC | 56 | 币安智能链 |
| Polygon | 137 | 多边形网络 |
| Arbitrum | 42161 | 层 2 网络 |
| Optimism | 10 | 层 2 网络 |

#### 1.3.3 实现步骤

**步骤 1**: 创建 `src/did/did-wba.js`

```javascript
/**
 * did:wba DID 方法实现
 */

import { ethers } from 'ethers';

// WBA 支持的链配置
const WBA_CHAINS = {
  'eth': { chainId: 1, rpc: 'https://mainnet.infura.io' },
  'bsc': { chainId: 56, rpc: 'https://bsc-dataseed.binance.org' },
  'polygon': { chainId: 137, rpc: 'https://polygon-rpc.com' },
  'arbitrum': { chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc' },
  'optimism': { chainId: 10, rpc: 'https://mainnet.optimism.io' }
};

export class WbaDIDHandler {
  constructor(options = {}) {
    this.chains = { ...WBA_CHAINS, ...options.chains };
  }

  /**
   * 生成 DID
   */
  async generate(chain, privateKey) {
    const chainConfig = this.chains[chain];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const wallet = new ethers.Wallet(privateKey);
    const did = `did:wba:${chain}:${wallet.address}`;
    
    return {
      did,
      privateKey: Buffer.from(privateKey.substring(2), 'hex'),
      publicKey: Buffer.from(wallet.publicKey.substring(2), 'hex'),
      address: wallet.address,
      chain,
      chainId: chainConfig.chainId,
      keyType: 'secp256k1'
    };
  }

  /**
   * 解析 DID
   */
  async resolve(did) {
    const parts = did.split(':');
    if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== 'wba') {
      throw new Error('Invalid did:wba format');
    }

    const chain = parts[2];
    const address = parts[3];
    
    // 从链上解析 DID 文档
    const provider = new ethers.JsonRpcProvider(this.chains[chain].rpc);
    // ... 实现 DID 文档解析逻辑
    
    return {
      id: did,
      verificationMethod: [],
      authentication: [],
      // ...
    };
  }
}
```

---

## 二、群组通信功能

### 2.1 功能概述

群组通信支持多用户之间的端到端加密通信，基于 **Sender Keys** 模式实现。

### 2.2 技术架构

#### 2.2.1 群组密钥管理

```
群组密钥派生流程:

Group Owner
    │
    ├─→ Group Master Key (GMK)
    │       │
    │       ├─→ Sender Chain Key (每个成员独立)
    │       │       │
    │       │       └─→ Message Keys (每条消息)
    │       │
    │       └─→ Group Encryption Key (GEK)
    │               │
    │               └─→ 加密群组元数据
    │
    └─→ Member List (加密存储)
```

#### 2.2.2 消息格式

**群组消息结构**:
```json
{
  "jsonrpc": "2.0",
  "method": "send",
  "params": {
    "type": "group_msg",
    "content": {
      "group_id": "group:did:wba:eth:0x123...abc",
      "sender_did": "did:key:z6Mk...",
      "sender_key_id": "sk_abc123",
      "message_id": "msg_xyz789",
      "seq": 42,
      "ciphertext": "base64...",
      "sender_keys": {
        "chain_key": "base64...",
        "signature": "base64..."
      }
    },
    "receiver_did": "group:did:wba:eth:0x123...abc"
  }
}
```

### 2.3 实现方案

#### 2.3.1 群组会话管理

创建 `src/e2ee/group-session.js`:

```javascript
/**
 * 群组 E2EE 会话管理
 */

import { x25519 } from '@noble/curves/x25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

export class GroupSession {
  constructor(params) {
    this.groupId = params.groupId;
    this.groupDid = params.groupDid;
    this.ownerDid = params.ownerDid;
    this.myDid = params.myDid;
    this.members = params.members || [];
    
    // 密钥材料
    this.groupMasterKey = params.groupMasterKey || null;
    this.senderChainKey = params.senderChainKey || null;
    this.sendSeq = params.sendSeq || 0n;
    
    // 成员密钥映射
    this.memberKeys = new Map(); // memberId -> { chainKey, seq }
    
    this.isActive = false;
  }

  /**
   * 创建群组（作为群主）
   */
  async create(memberDids) {
    // 生成群组主密钥
    this.groupMasterKey = randomBytes(32);
    
    // 为每个成员生成独立的发送者密钥
    for (const memberDid of memberDids) {
      const chainKey = hkdf(
        sha256,
        this.groupMasterKey,
        { salt: new TextEncoder().encode(memberDid), info: new TextEncoder().encode('sender-chain') },
        32
      );
      
      this.memberKeys.set(memberDid, {
        chainKey,
        seq: 0n
      });
    }
    
    // 自己的发送者密钥
    this.senderChainKey = hkdf(
      sha256,
      this.groupMasterKey,
      { salt: new TextEncoder().encode(this.myDid), info: new TextEncoder().encode('sender-chain') },
      32
    );
    
    this.isActive = true;
    
    return {
      groupId: this.groupId,
      members: memberDids,
      encryptedGroupKey: await this.encryptGroupKey()
    };
  }

  /**
   * 加入群组（作为成员）
   */
  async join(groupInfo, ownerPublicKey) {
    // 解密群组主密钥
    this.groupMasterKey = await this.decryptGroupKey(
      groupInfo.encryptedGroupKey,
      ownerPublicKey
    );
    
    // 派生自己的发送者密钥
    this.senderChainKey = hkdf(
      sha256,
      this.groupMasterKey,
      { salt: new TextEncoder().encode(this.myDid), info: new TextEncoder().encode('sender-chain') },
      32
    );
    
    this.isActive = true;
  }

  /**
   * 加密群组消息
   */
  async encryptMessage(plaintext) {
    if (!this.senderChainKey) {
      throw new Error('Sender chain key not set');
    }

    // 派生消息密钥
    const { encKey, nonce, newChainKey } = await this.deriveMessageKey(
      this.senderChainKey,
      this.sendSeq
    );
    
    // AES-GCM 加密
    const ciphertext = await this.aesGcmEncrypt(encKey, nonce, plaintext);
    
    // 更新链密钥
    this.senderChainKey = newChainKey;
    const seq = this.sendSeq;
    this.sendSeq += 1n;
    
    return {
      ciphertext,
      seq: Number(seq),
      senderKeyId: this.getSenderKeyId()
    };
  }

  /**
   * 解密群组消息
   */
  async decryptMessage(content, senderDid) {
    // 获取发送者的链密钥
    let memberKey = this.memberKeys.get(senderDid);
    if (!memberKey) {
      // 新成员，需要密钥分发
      memberKey = { chainKey: null, seq: 0n };
      this.memberKeys.set(senderDid, memberKey);
    }
    
    // 跳过缺失的序列号
    while (memberKey.seq < BigInt(content.seq)) {
      const { newChainKey } = await this.deriveMessageKey(
        memberKey.chainKey,
        memberKey.seq
      );
      memberKey.chainKey = newChainKey;
      memberKey.seq += 1n;
    }
    
    // 解密消息
    const { plaintext, newChainKey } = await this.deriveMessageKey(
      memberKey.chainKey,
      memberKey.seq
    );
    
    memberKey.chainKey = newChainKey;
    memberKey.seq += 1n;
    
    return plaintext;
  }

  /**
   * 派生消息密钥
   */
  async deriveMessageKey(chainKey, seq) {
    const encoder = new TextEncoder();
    const seqBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      seqBytes[7 - i] = Number((seq >> BigInt(i * 8)) & 0xffn);
    }

    const msgKey = hkdf(
      sha256,
      chainKey,
      { salt: new Uint8Array(), info: encoder.encode(`msg${seqBytes}`) },
      32
    );
    
    const newChainKey = hkdf(
      sha256,
      chainKey,
      { salt: new Uint8Array(), info: encoder.encode('ck') },
      32
    );
    
    const encKey = msgKey.slice(0, 16);
    const nonce = msgKey.slice(16, 28);
    
    return { encKey, nonce, newChainKey };
  }

  /**
   * AES-GCM 加密
   */
  async aesGcmEncrypt(key, nonce, plaintext) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'AES-GCM', length: 128 }, false, ['encrypt']
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: new Uint8Array() },
      cryptoKey,
      plaintext
    );
    return new Uint8Array(encrypted);
  }

  /**
   * 获取发送者密钥 ID
   */
  getSenderKeyId() {
    return `sk_${this.myDid.substring(0, 8)}_${this.sendSeq}`;
  }
}
```

#### 2.3.2 群组管理命令

**CLI 命令扩展**:

```javascript
// 群组相关命令
const groupCommands = {
  '/group create <name>': '创建新群组',
  '/group join <group-did>': '加入群组',
  '/group leave <group-did>': '离开群组',
  '/group members <group-did>': '查看成员列表',
  '/group invite <group-did> <member-did>': '邀请成员',
  '/group kick <group-did> <member-did>': '移除成员',
  '/group transfer <group-did> <new-owner-did>': '转移群主'
};

// 使用示例
/group create "项目讨论组"
/group invite group:did:wba:eth:0x123...abc did:key:z6Mk...
/group members group:did:wba:eth:0x123...abc
```

### 2.4 群组消息流程

#### 2.4.1 发送群组消息

```
发送方                          MQTT Broker                       接收方
   │                               │                                │
   │─── 1. 加密消息 ───────────────>│                                │
   │    (使用 Sender Key)          │                                │
   │                               │─── 2. 广播 ───────────────────>│
   │                               │    (群组 Topic)                 │
   │                               │                                │─── 3. 解密消息
   │                               │                                │    (使用发送者链密钥)
   │                               │                                │
```

#### 2.4.2 新成员加入

```
群主                           新成员                          MQTT Broker
  │                              │                                │
  │── 1. 生成群组密钥 ──────────>│                                │
  │    (使用新成员公钥加密)       │                                │
  │                              │                                │
  │── 2. 发送邀请 ──────────────>│                                │
  │    (包含加密的群组密钥)       │                                │
  │                              │── 3. 解密群组密钥 ────────────>│
  │                              │    (加入群组)                   │
  │                              │                                │
```

---

## 三、实施计划

### 3.1 第一阶段：DID 方法扩展（2 周）

**Week 1**: did:ethr 实现
- [ ] 创建 `src/did/did-ethr.js`
- [ ] 集成 `ethers.js` 和 `ethr-did-resolver`
- [ ] 实现密钥生成和解析
- [ ] 添加 CLI 命令支持
- [ ] 编写单元测试

**Week 2**: did:wba 实现
- [ ] 创建 `src/did/did-wba.js`
- [ ] 实现多链支持
- [ ] 添加链配置管理
- [ ] 集成到 DID 管理器
- [ ] 编写文档

### 3.2 第二阶段：群组通信（3 周）

**Week 3**: 核心功能
- [ ] 创建 `src/e2ee/group-session.js`
- [ ] 实现 Sender Keys 模式
- [ ] 实现群组密钥派生
- [ ] 实现消息加密/解密

**Week 4**: 群组管理
- [ ] 创建群组 CLI 命令
- [ ] 实现成员管理
- [ ] 实现邀请/踢出功能
- [ ] 添加群组元数据加密

**Week 5**: Web 客户端支持
- [ ] 更新 Web UI 支持群组
- [ ] 添加群组创建界面
- [ ] 添加群组聊天界面
- [ ] 测试跨平台通信

### 3.3 第三阶段：优化和测试（1 周）

**Week 6**:
- [ ] 性能优化
- [ ] 安全审计
- [ ] 集成测试
- [ ] 文档完善
- [ ] 发布 v2.0

---

## 四、安全考虑

### 4.1 密钥管理

- **私钥存储**: 使用加密存储，密码派生自用户口令
- **密钥轮换**: 支持定期轮换群组密钥
- **前向保密**: 每条消息使用独立密钥

### 4.2 群组安全

- **成员验证**: 新成员加入需要现有成员签名
- **消息认证**: 所有消息需要数字签名
- **重放防护**: 严格序列号检查

### 4.3 隐私保护

- **元数据加密**: 群组信息加密存储
- **匿名性**: 支持一次性 DID
- **最小化泄露**: 仅暴露必要信息

---

## 五、API 参考

### 5.1 DID 管理器

```javascript
import { didManager } from './did/manager.js';

// 创建 DID
const identity = await didManager.generate('ethr', {
  chainId: 1,
  privateKey: '0x...'
});

// 解析 DID
const doc = await didManager.resolve('did:ethr:1:0x...');

// 签名
const sig = await didManager.sign(message, identity.did);

// 验证
const valid = await didManager.verify(message, sig, identity.did);
```

### 5.2 群组会话

```javascript
import { GroupSession } from './e2ee/group-session.js';

// 创建群组
const group = new GroupSession({
  groupId: 'group-123',
  groupDid: 'group:did:wba:eth:0x...',
  ownerDid: 'did:key:z6Mk...',
  myDid: 'did:key:z6Mk...'
});

await group.create(['did:key:z6Mk...']);

// 加密消息
const encrypted = await group.encryptMessage('Hello, group!');

// 解密消息
const plaintext = await group.decryptMessage(encrypted, senderDid);
```

---

## 六、测试计划

### 6.1 单元测试

```bash
# 运行所有测试
npm test

# 运行 DID 相关测试
npm test -- --grep "DID"

# 运行群组相关测试
npm test -- --grep "Group"
```

### 6.2 集成测试

```bash
# 启动测试环境
npm run test:setup

# 运行集成测试
npm run test:integration

# 清理测试环境
npm run test:cleanup
```

### 6.3 性能测试

```bash
# 压力测试
npm run test:stress

# 基准测试
npm run test:benchmark
```

---

## 七、参考文档

- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [did:ethr Method Specification](https://github.com/uport-project/ethr-did/blob/develop/doc/did-method-spec.md)
- [did:wba Method Specification](https://github.com/web3-alliance/did-wba)
- [Signal Protocol](https://signal.org/docs/)
- [MLS Protocol](https://messaginglayersecurity.rocks/)
- [ANP E2EE 协议规范](https://github.com/agent-network-protocol/AgentNetworkProtocol/blob/main/09-ANP-end-to-end-instant-messaging-protocol-specification.md)

---

## 八、版本历史

- **v1.0** (2026-03-14): 初始版本，支持 did:key 和一对一通信
- **v2.0** (计划 2026-04-30): 支持 did:ethr、did:wba 和群组通信

---

**最后更新**: 2026-03-14  
**维护者**: E2EE MQTT Chat Team
