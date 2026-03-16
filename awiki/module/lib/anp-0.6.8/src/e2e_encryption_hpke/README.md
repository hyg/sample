# @awiki/anp-hpke

基于 HPKE (RFC 9180) 的端到端加密模块，用于 awiki Network Protocol。

## 安装

```bash
npm install @awiki/anp-hpke
```

## 依赖

- `@noble/curves`: X25519 密钥交换和 secp256r1 签名
- `@noble/hashes`: HKDF 和 SHA-256
- `@noble/ciphers`: AES-GCM 加密

## 密码栈

- **密钥封装**: DHKEM(X25519, HKDF-SHA256)
- **密钥派生**: HKDF-SHA256
- **对称加密**: AES-128-GCM
- **数字签名**: ECDSA secp256r1 (P-256)

## 使用示例

### 1. 创建 E2EE 会话

```typescript
import {
  E2eeHpkeSession,
  HpkeKeyManager,
  generateX25519KeyPair,
  extractX25519PublicKeyFromDidDocument,
  extractSigningPublicKeyFromDidDocument,
} from '@awiki/anp-hpke';

// 生成本地 X25519 密钥对（key-3）
const { privateKey: localX25519Sk, publicKey: localX25519Pk } = generateX25519KeyPair();

// 生成本地 secp256r1 签名密钥对（key-2）
const { privateKey: signingKey, publicKey: signingPk } = p256.utils.randomPrivateKey();

// 从 DID 文档获取对端公钥
const peerDoc = await resolveDidDocument(peerDid);
const { publicKey: peerX25519Pk, keyId: peerKeyId } = extractX25519PublicKeyFromDidDocument(peerDoc);

// 创建会话
const session = new E2eeHpkeSession(
  localDid,
  peerDid,
  localX25519Sk,
  `${localDid}#key-3`,
  signingKey,
  `${localDid}#key-2`
);

// 发起会话
const [msgType, content] = session.initiateSession(peerX25519Pk, peerKeyId);
// msgType = "e2ee_init"
// content = { e2ee_version, session_id, sender_did, recipient_did, enc, encrypted_seed, expires, proof }
```

### 2. 处理收到的 e2ee_init

```typescript
// 接收方处理 e2ee_init
const senderDoc = await resolveDidDocument(content.sender_did);
const senderSigningPk = extractSigningPublicKeyFromDidDocument(
  senderDoc,
  content.proof.verification_method
);

session.processInit(content, senderSigningPk);
// 会话现在处于 ACTIVE 状态
```

### 3. 加密消息

```typescript
const [msgType, content] = session.encryptMessage('text', 'Hello, secret world!');
// msgType = "e2ee_msg"
// content = { e2ee_version, session_id, seq, original_type, ciphertext }
```

### 4. 解密消息

```typescript
const [originalType, plaintext] = session.decryptMessage(content);
// originalType = "text"
// plaintext = "Hello, secret world!"
```

### 5. 使用密钥管理器

```typescript
const keyManager = new HpkeKeyManager();

// 注册会话
keyManager.registerSession(session);

// 获取活跃会话
const activeSession = keyManager.getActiveSession(localDid, peerDid);

// 按 ID 获取会话
const sessionById = keyManager.getSessionById(sessionId);

// 清理过期会话
keyManager.cleanupExpired();
```

## API 参考

### 类

#### E2eeHpkeSession

E2EE 会话类，管理单个私聊会话的生命周期。

**构造函数参数**:
- `localDid: string` - 本地 DID
- `peerDid: string` - 对端 DID
- `localX25519PrivateKey: Uint8Array` - 本地 X25519 私钥（32 字节）
- `localX25519KeyId: string` - 本地 keyAgreement 的 id
- `signingPrivateKey: Uint8Array` - 本地 secp256r1 签名私钥（32 字节）
- `signingVerificationMethod: string` - 签名用的 verificationMethod id
- `seqMode?: SeqMode` - 序号验证策略（默认 STRICT）
- `defaultExpires?: number` - 默认有效期（秒，默认 86400）

**方法**:
- `initiateSession(peerPk, peerKeyId)` - 发起会话初始化
- `processInit(content, senderSigningPk)` - 处理收到的 e2ee_init
- `encryptMessage(originalType, plaintext)` - 加密消息
- `decryptMessage(content)` - 解密消息
- `initiateRekey(peerPk, peerKeyId)` - 发起会话重建
- `processRekey(content, senderSigningPk)` - 处理收到的 e2ee_rekey
- `isExpired()` - 检查会话是否过期
- `getSessionInfo()` - 获取会话信息

#### HpkeKeyManager

管理多个 E2EE 会话。

**方法**:
- `getActiveSession(localDid, peerDid)` - 获取活跃会话
- `getSessionById(sessionId)` - 按 ID 获取会话
- `registerSession(session)` - 注册会话
- `removeSession(localDid, peerDid)` - 移除会话
- `cleanupExpired()` - 清理过期会话

### 函数

#### HPKE 原语

- `hpkeSeal(recipientPk, plaintext, aad, info)` - HPKE 加密
- `hpkeOpen(recipientSk, enc, ciphertext, aad, info)` - HPKE 解密
- `generateX25519KeyPair()` - 生成 X25519 密钥对

#### 密钥派生

- `deriveChainKeys(rootSeed)` - 从根种子派生链密钥
- `deriveMessageKey(chainKey, seq)` - 派生消息密钥
- `determineDirection(localDid, peerDid)` - 判断 initiator 角色
- `assignChainKeys(initChainKey, respChainKey, isInitiator)` - 分配链密钥

#### 签名证明

- `generateProof(content, privateKey, verificationMethod)` - 生成证明
- `validateProof(content, publicKey, options)` - 验证证明
- `verifyProof(content, publicKey, options)` - 验证证明（返回布尔值）

#### 公钥提取

- `extractX25519PublicKeyFromDidDocument(doc, keyId)` - 从 DID 文档提取 X25519 公钥
- `extractSigningPublicKeyFromDidDocument(doc, vmId)` - 从 DID 文档提取签名公钥

#### 消息构建

- `buildE2eeInit(...)` - 构建 e2ee_init 消息
- `buildE2eeMsg(sessionId, seq, originalType, ciphertextB64)` - 构建 e2ee_msg 消息
- `buildE2eeAck(...)` - 构建 e2ee_ack 消息
- `buildE2eeRekey(...)` - 构建 e2ee_rekey 消息
- `buildE2eeError(errorCode, options)` - 构建 e2ee_error 消息

#### 消息解析

- `detectMessageType(typeField)` - 检测消息类型

## 协议流程

### 会话建立

```
发起方                              接收方
  |                                   |
  |-- e2ee_init (HPKE sealed) ------->|
  |                                   | processInit
  |                           (验证 proof, HPKE open)
  |                                   |
  |<-- e2ee_ack (signed proof) -------|
  |                                   |
  | (验证 proof)                       |
  |                                   |
  [会话激活]                          [会话激活]
```

### 消息加密解密

```
发送方                              接收方
  |                                   |
  | encryptMessage                    |
  | (Chain Ratchet + AES-GCM)         |
  |                                   |
  |-- e2ee_msg (ciphertext) --------->|
  |                                   |
  |                           decryptMessage
  |                          (Chain Ratchet + AES-GCM)
  |                                   |
  |                               [明文]
```

## 安全特性

1. **前向安全**: 使用 Chain Ratchet 机制，每条消息使用不同的密钥
2. **身份验证**: 使用 secp256r1 签名验证消息来源
3. **防重放**: 序号验证机制防止重放攻击
4. **会话过期**: 自动清理过期会话

## 与 Python 版本的兼容性

本 JavaScript 实现与 Python `anp>=0.6.8` 版本完全兼容：

- 相同的 HPKE 参数和密钥派生函数
- 相同的 Chain Ratchet 算法
- 相同的 proof 签名格式
- 相同的消息结构

## 许可证

MIT
