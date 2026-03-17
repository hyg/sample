# DID 方法扩展设计文档

## 概述

本文档描述 E2EE MQTT Chat 项目的 DID 方法扩展架构，支持多种 DID 方法并确保它们之间可以互相通信。

## 架构设计

### 核心原则

1. **统一接口**: 所有 DID 方法实现相同的接口
2. **动态注册**: 支持运行时注册新的 DID 方法
3. **跨方法通信**: 不同 DID 方法之间可以互相通信
4. **公共密钥格式**: 统一使用原始字节作为公钥格式用于 E2EE

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用层 (CLI/Web)                          │
├─────────────────────────────────────────────────────────────────┤
│                         DID Manager                             │
│  - generate()    - import()    - resolve()                      │
│  - sign()        - verify()    - getSharedSecret()              │
├─────────────────────────────────────────────────────────────────┤
│                      DID Method Registry                        │
│  - register()    - get()       - parse()                        │
├──────────────┬────────────────┬────────────────┬────────────────┤
│  did:key     │   did:ethr     │    did:wba     │   did:web      │
│  Handler     │   Handler      │    Handler     │   Handler      │
│              │                │                │   (扩展点)     │
├──────────────┴────────────────┴────────────────┴────────────────┤
│                    统一接口 (Unified Interface)                  │
│  - generate()        - fromPublicKey()    - resolvePublicKey()  │
│  - fromPrivateKey()  - getSharedSecret()  - sign()/verify()    │
├─────────────────────────────────────────────────────────────────┤
│                   加密原语 (Crypto Primitives)                   │
│  - X25519 (密钥协商)  - P-256 (签名/协商)  - Ed25519 (签名)     │
└─────────────────────────────────────────────────────────────────┘
```

## 已实现的 DID 方法

### 1. did:key

**规范**: https://w3c-ccg.github.io/did-method-key/

**格式**: `did:key:<multibase-encoded-key>`

**支持的密钥类型**:
| 类型 | 用途 | 字节数 |
|------|------|--------|
| X25519 | 密钥协商 | 32 |
| Ed25519 | 签名 | 32 |
| P-256 | 签名/密钥协商 | 65 (未压缩) |

**使用示例**:
```javascript
// 创建身份
const identity = didManager.generate('key', { keyType: 'x25519' });
// did:key:z6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc

// 导入身份
const identity = didManager.import('key', privateKey, { keyType: 'x25519' });
```

### 2. did:ethr

**规范**: https://github.com/uport-project/ethr-did/blob/develop/doc/did-method-spec.md

**格式**: `did:ethr:<chainId>:<address>`

**支持的网络**:
| 网络 | Chain ID | 说明 |
|------|----------|------|
| mainnet | 1 | 以太坊主网 |
| sepolia | 11155111 | Sepolia 测试网 |
| bsc | 56 | 币安智能链 |
| polygon | 137 | Polygon |
| arbitrum | 42161 | Arbitrum One |
| optimism | 10 | Optimism |

**使用示例**:
```javascript
// 创建身份（以太坊主网）
const identity = didManager.generate('ethr', { 
  network: 'mainnet', 
  keyType: 'x25519' 
});
// did:ethr:0x1:0x1234567890abcdef1234567890abcdef12345678

// 创建身份（Polygon）
const identity = didManager.generate('ethr', { 
  chainId: 137, 
  keyType: 'x25519' 
});
// did:ethr:0x89:0x1234567890abcdef...
```

### 3. did:wba

**说明**: WBA (Web3 Blockchain Alliance) DID 方法，支持跨链身份

**格式**: `did:wba:<chain>:<address>`

**支持的链**:
| 链 | 简写 | Chain ID |
|----|------|----------|
| Ethereum | eth | 1 |
| Sepolia | sepolia | 11155111 |
| BSC | bsc | 56 |
| Polygon | polygon | 137 |
| Arbitrum | arb | 42161 |
| Optimism | op | 10 |
| Avalanche | avax | 43114 |
| Base | base | 8453 |

**使用示例**:
```javascript
// 创建身份（以太坊）
const identity = didManager.generate('wba', { 
  chain: 'eth', 
  keyType: 'x25519' 
});
// did:wba:eth:0x1234567890abcdef1234567890abcdef12345678

// 创建身份（Base）
const identity = didManager.generate('wba', { 
  chain: 'base', 
  keyType: 'x25519' 
});
// did:wba:base:0x1234567890abcdef...
```

## 跨 DID 通信

### 原理

不同 DID 方法之间可以通信的关键在于：

1. **统一的密钥协商接口**: 所有 DID 方法都实现 `getSharedSecret()` 方法
2. **公共密钥格式**: 使用原始字节（Uint8Array）作为公钥格式
3. **标准 E2EE 协议**: 使用 HPKE (RFC 9180) 进行端到端加密

### 通信流程

```
Alice (did:key)                          Bob (did:ethr)
     │                                       │
     │─── 1. 交换 DID 和公钥 ─────────────────>│
     │    did:key:z6Mk...                    │    did:ethr:0x1:0x1234...
     │    pubkey: 0x8dfe8b73...              │    pubkey: 0x8dfe8b73...
     │                                       │
     │─── 2. 创建会话 (e2ee_init) ───────────>│
     │    HPKE 封装 (使用 Bob 公钥)            │
     │                                       │
     │                                       │─── 3. 解封装 root_seed
     │                                       │     派生链密钥
     │                                       │
     │<── 4. 加密消息 (e2ee_msg) ─────────────│
     │    使用共享链密钥加密                   │
     │                                       │
     │─── 5. 解密消息 ───────────────────────>│
          使用相同的链密钥解密
```

### 代码示例

```javascript
// Alice (did:key) 与 Bob (did:ethr) 通信

// 1. Alice 创建身份
const alice = didManager.generate('key', { keyType: 'x25519' });
console.log(alice.did);  // did:key:z6Mk...

// 2. Bob 创建身份
const bob = didManager.generate('ethr', { network: 'mainnet', keyType: 'x25519' });
console.log(bob.did);  // did:ethr:0x1:0x1234...

// 3. 交换公钥（通过任意渠道）
const alicePublicKey = alice.publicKey;  // Uint8Array(32)
const bobPublicKey = bob.publicKey;      // Uint8Array(32)

// 4. Alice 发起 E2EE 会话
// 使用 Bob 的公钥进行 HPKE 封装
const { enc, ciphertext } = await hpkeSeal({
  recipientPublicKey: bobPublicKey,
  plaintext: rootSeed,
  info: new TextEncoder().encode(sessionId)
});

// 5. Bob 解封装
const rootSeed = await hpkeOpen({
  recipientPrivateKey: bob.privateKey,
  enc: enc,
  ciphertext: ciphertext,
  info: new TextEncoder().encode(sessionId)
});

// 6. 双方派生相同的链密钥
const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
// 根据 DID 字典序分配发送/接收密钥
const isInitiator = alice.did < bob.did;
// Alice 和 Bob 现在可以加密通信
```

## 扩展新的 DID 方法

### 步骤

1. **创建处理器文件**: `src/did/did-<method>.js`

2. **实现统一接口**:
```javascript
export class DIDMethodHandler {
  constructor(options = {}) {
    // 初始化配置
  }

  // 生成新身份
  generate(options = {}) {
    // 返回：{ did, privateKey, publicKey, keyType, didDocument }
  }

  // 从公钥创建身份
  fromPublicKey(publicKey, options = {}) {
    // 返回：{ did, publicKey, keyType, didDocument }
  }

  // 从私钥恢复身份
  fromPrivateKey(privateKey, options = {}) {
    // 返回：{ did, privateKey, publicKey, keyType, didDocument }
  }

  // 解析公钥
  resolvePublicKey(did) {
    // 返回：{ publicKey, keyType, didDocument }
  }

  // 获取共享密钥（跨 DID 通信的关键）
  async getSharedSecret(myPrivateKey, theirPublicKey, options = {}) {
    // 使用 X25519 或 P-256 进行密钥协商
    // 返回：Uint8Array (共享密钥)
  }

  // 签名
  sign(message, privateKey) {
    // 返回：Uint8Array (签名)
  }

  // 验证签名
  verify(message, signature, publicKey) {
    // 返回：boolean
  }
}

export const didMethodHandler = new DIDMethodHandler();
```

3. **注册处理器**: 在 `src/did/manager.js` 中添加
```javascript
import { didMethodHandler } from './did-<method>.js';
didRegistry.register('<method>', didMethodHandler);
```

### 示例：添加 did:web

```javascript
// src/did/did-web.js

import { x25519 } from '@noble/curves/x25519';
import { p256 } from '@noble/curves/p256';

export class DIDWebHandler {
  generate(domain, keyType = 'x25519') {
    let privateKey, publicKey;
    
    if (keyType === 'x25519') {
      privateKey = Buffer.from(x25519.utils.randomPrivateKey());
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else {
      privateKey = Buffer.from(p256.utils.randomPrivateKey());
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    }
    
    const did = `did:web:${encodeURIComponent(domain)}`;
    
    return {
      did,
      privateKey,
      publicKey,
      keyType,
      domain,
      didDocument: this.createDIDDocument(did, publicKey, domain, keyType)
    };
  }

  fromPublicKey(publicKey, domain, keyType = 'x25519', did = null) {
    const finalDid = did || `did:web:${encodeURIComponent(domain)}`;
    return {
      did: finalDid,
      publicKey: Buffer.from(publicKey),
      keyType,
      didDocument: this.createDIDDocument(finalDid, publicKey, domain, keyType)
    };
  }

  fromPrivateKey(privateKey, domain, keyType = 'x25519') {
    let publicKey;
    if (keyType === 'x25519') {
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else {
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    }
    
    const did = `did:web:${encodeURIComponent(domain)}`;
    return {
      did,
      privateKey: Buffer.from(privateKey),
      publicKey,
      keyType,
      didDocument: this.createDIDDocument(did, publicKey, domain, keyType)
    };
  }

  resolvePublicKey(did) {
    const parts = did.split(':');
    const domain = decodeURIComponent(parts[2]);
    return {
      domain,
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [{
          id: `${did}#key-1`,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: { /* ... */ }
        }]
      }
    };
  }

  async getSharedSecret(myPrivateKey, theirPublicKey) {
    // 使用 X25519 或 P-256 进行密钥协商
    try {
      if (theirPublicKey.length === 32) {
        return new Uint8Array(x25519.getSharedSecret(myPrivateKey, theirPublicKey));
      }
    } catch (e) {}
    try {
      if (theirPublicKey.length === 65 || theirPublicKey.length === 33) {
        return new Uint8Array(p256.getSharedSecret(myPrivateKey, theirPublicKey));
      }
    } catch (e) {}
    throw new Error('Cannot derive shared secret');
  }

  sign(message, privateKey) {
    const signature = p256.sign(message, privateKey);
    return new Uint8Array(signature.toCompactRawBytes());
  }

  verify(message, signature, publicKey) {
    try {
      return p256.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  }

  createDIDDocument(did, publicKey, domain, keyType) {
    // 创建 DID 文档
    return {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: did,
      verificationMethod: [{ /* ... */ }]
    };
  }
}

export const didWebHandler = new DIDWebHandler();
```

## API 参考

### DIDManager

```javascript
// 生成身份
const identity = didManager.generate(method, options);

// 导入身份
const identity = didManager.import(method, privateKey, options);

// 获取身份
const identity = didManager.getIdentity(did);

// 列出所有身份
const identities = didManager.listIdentities();

// 解析 DID 文档
const doc = await didManager.resolve(did);

// 获取公钥
const pubkey = await didManager.getPublicKey(did);

// 签名
const sig = didManager.sign(did, message);

// 验证签名
const valid = await didManager.verify(did, message, sig, pubkey);

// 获取共享密钥（跨 DID 通信）
const sharedSecret = await didManager.getSharedSecret(
  myDid, myPrivateKey, theirDid, theirPublicKey
);

// 导出身份
const exported = didManager.export(did);

// 删除身份
didManager.delete(did);

// 获取支持的方法
const methods = didManager.getSupportedMethods();
```

## 安全考虑

1. **私钥存储**: 使用加密存储，不要明文保存
2. **密钥轮换**: 定期轮换 E2EE 密钥
3. **前向保密**: 每条消息使用独立密钥（双棘轮）
4. **身份验证**: 通过安全渠道交换公钥
5. **重放防护**: 严格序列号检查

## 参考文档

- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [did:key Method Specification](https://w3c-ccg.github.io/did-method-key/)
- [did:ethr Method Specification](https://github.com/uport-project/ethr-did/blob/develop/doc/did-method-spec.md)
- [RFC 9180 HPKE](https://www.rfc-editor.org/rfc/rfc9180.html)
- [X25519 RFC 7748](https://www.rfc-editor.org/rfc/rfc7748.html)

---

**最后更新**: 2026-03-14  
**版本**: 2.0
