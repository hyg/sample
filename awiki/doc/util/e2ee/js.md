# e2ee 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/e2ee.py`  
**JavaScript 目标文件**: `module/src/e2ee.js`  
**功能**: E2EE 端到端加密客户端（HPKE 协议）

---

## 2. 依赖关系

### 2.1 Python 依赖

```python
from anp.e2e_encryption_hpke import (
    E2eeHpkeSession,
    SessionState,
    HpkeKeyManager,
    MessageType,
    generate_proof,
    validate_proof,
    detect_message_type,
)
```

### 2.2 JavaScript 依赖

```javascript
import { hpke } from '@noble/hpke';  // 需要移植或使用替代库
import { x25519 } from '@noble/curves/ed25519';
import { p256 } from '@noble/curves/p256';
```

---

## 3. 接口设计

### 3.1 常量

```javascript
const STATE_VERSION = 'hpke_v1';
const SUPPORTED_E2EE_VERSION = '1.1';
```

### 3.2 `E2eeClient` 类

```javascript
/**
 * E2EE 端到端加密客户端
 */
class E2eeClient {
    /**
     * @param {string} localDid - 本地 DID
     * @param {Object} options - 选项
     * @param {string} [options.signingPem] - key-2 secp256r1 私钥 PEM
     * @param {string} [options.x25519Pem] - key-3 X25519 私钥 PEM
     */
    constructor(localDid, options = {}) {
        this.localDid = localDid;
        this.signingPem = options.signingPem || null;
        this.x25519Pem = options.x25519Pem || null;
        
        // 加载密钥对象
        this.signingKey = this.signingPem ? loadSigningKey(this.signingPem) : null;
        this.x25519Key = this.x25519Pem ? loadX25519Key(this.x25519Pem) : null;
        
        this.keyManager = new HpkeKeyManager();
        this.confirmedSessionIds = new Set();
    }

    /**
     * 发起握手
     * @param {string} peerDid - 对等方 DID
     * @returns {Promise<[string, Object]>}
     */
    async initiateHandshake(peerDid) {
        if (!this.signingKey || !this.x25519Key) {
            throw new Error('Missing E2EE keys');
        }

        // 获取对等方 DID 文档
        const peerDoc = await resolveDidWbaDocument(peerDid);
        if (!peerDoc) {
            throw new Error(`Unable to retrieve peer DID document: ${peerDid}`);
        }

        // 提取对等方 X25519 公钥
        const { publicKey: peerPk, keyId: peerKeyId } = 
            extractX25519PublicKeyFromDidDocument(peerDoc);

        // 创建会话
        const session = new E2eeHpkeSession({
            localDid: this.localDid,
            peerDid,
            localX25519PrivateKey: this.x25519Key,
            localX25519KeyId: `${this.localDid}#key-3`,
            signingPrivateKey: this.signingKey,
            signingVerificationMethod: `${this.localDid}#key-2`,
        });

        // 初始化会话
        const [msgType, content] = session.initiateSession(peerPk, peerKeyId);
        
        // 注册会话
        this.keyManager.registerSession(session);

        return [msgType, content];
    }

    /**
     * 处理 E2EE 消息
     * @param {string} msgType - 消息类型
     * @param {Object} content - 消息内容
     * @returns {Promise<Array<[string, Object]>>}
     */
    async processE2eeMessage(msgType, content) {
        // 处理各种 E2EE 消息类型
        if (msgType === 'e2ee_ack') {
            return this.handleAck(content);
        }

        const detected = detectMessageType(msgType);
        
        if (detected === 'e2ee_init') {
            return this.handleInit(content);
        } else if (detected === 'e2ee_rekey') {
            return this.handleRekey(content);
        } else if (detected === 'e2ee_error') {
            return this.handleError(content);
        } else if (detected === 'e2ee_msg') {
            // 加密消息需要使用 decryptMessage
            console.warn('Use decrypt_message for e2ee_msg');
            return [];
        }

        return [];
    }

    /**
     * 加密消息
     * @param {string} peerDid - 对等方 DID
     * @param {string} plaintext - 明文
     * @param {string} [originalType='text'] - 原始消息类型
     * @returns {[string, Object]}
     */
    encryptMessage(peerDid, plaintext, originalType = 'text') {
        const session = this.keyManager.getActiveSession(this.localDid, peerDid);
        if (!session) {
            throw new Error(`No active E2EE session with ${peerDid}`);
        }
        return session.encryptMessage(originalType, plaintext);
    }

    /**
     * 解密消息
     * @param {Object} content - 加密内容
     * @returns {[string, string]}
     */
    decryptMessage(content) {
        const sessionId = content.session_id;
        if (!sessionId) {
            throw new Error('Message missing session_id');
        }

        const session = this.keyManager.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Cannot find session for session_id=${sessionId}`);
        }

        return session.decryptMessage(content);
    }

    /**
     * 确保活跃会话
     * @param {string} peerDid - 对等方 DID
     * @returns {Promise<Array<[string, Object]>>}
     */
    async ensureActiveSession(peerDid) {
        if (this.hasActiveSession(peerDid)) {
            return [];
        }
        
        const [msgType, content] = await this.initiateHandshake(peerDid);
        return [[msgType, content]];
    }

    /**
     * 检查是否有活跃会话
     * @param {string} peerDid - 对等方 DID
     * @returns {boolean}
     */
    hasActiveSession(peerDid) {
        const session = this.keyManager.getActiveSession(this.localDid, peerDid);
        return session !== null;
    }

    /**
     * 导出状态
     * @returns {Object}
     */
    exportState() {
        const sessions = [];
        for (const session of this.keyManager.sessions) {
            if (session.state === 'ACTIVE' && !session.isExpired()) {
                const exported = this.exportSession(session);
                if (exported) {
                    sessions.push(exported);
                }
            }
        }

        return {
            version: STATE_VERSION,
            localDid: this.localDid,
            signingPem: this.signingPem,
            x25519Pem: this.x25519Pem,
            confirmedSessionIds: Array.from(this.confirmedSessionIds).sort(),
            sessions,
        };
    }

    /**
     * 从状态恢复
     * @param {Object} state - 导出的状态
     * @returns {E2eeClient}
     */
    static fromState(state) {
        const client = new E2eeClient(state.localDid, {
            signingPem: state.signingPem,
            x25519Pem: state.x25519Pem,
        });

        for (const sessionData of state.sessions || []) {
            const session = restoreSession(sessionData);
            if (session) {
                client.keyManager.registerSession(session);
            }
        }

        client.confirmedSessionIds = new Set(state.confirmedSessionIds || []);
        return client;
    }
}
```

---

## 4. 辅助函数

### 4.1 密钥加载

```javascript
/**
 * 加载 secp256r1 签名密钥
 * @param {string} pem - PEM 格式密钥
 * @returns {CryptoKey}
 */
function loadSigningKey(pem) {
    // 实现 PEM 解析和密钥加载
}

/**
 * 加载 X25519 密钥
 * @param {string} pem - PEM 格式密钥
 * @returns {Uint8Array}
 */
function loadX25519Key(pem) {
    // 实现 PEM 解析和密钥加载
}
```

### 4.2 错误处理

```javascript
/**
 * 构建 E2EE 错误内容
 */
function buildE2eeErrorContent(errorCode, options = {}) {
    const content = {
        e2ee_version: SUPPORTED_E2EE_VERSION,
        error_code: errorCode,
    };
    
    if (options.sessionId) content.session_id = options.sessionId;
    if (options.failedMsgId) content.failed_msg_id = options.failedMsgId;
    if (options.retryHint) content.retry_hint = options.retryHint;
    
    return content;
}
```

---

## 5. 导出接口

```javascript
export {
    E2eeClient,
    SUPPORTED_E2EE_VERSION,
    buildE2eeErrorContent,
};
```

---

## 6. 实现注意事项

### 6.1 HPKE 协议移植

HPKE (Hybrid Public Key Encryption) 是 RFC 9180 标准，需要：
1. 密钥协商（X25519）
2. KDF（HKDF）
3. AEAD 加密（ChaCha20-Poly1305）

### 6.2 使用 @noble 库

```javascript
import { hpke } from '@noble/hpke';
import { x25519 } from '@noble/curves/x25519';
import { hkdf } from '@noble/hashes/hkdf';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
```

### 6.3 状态持久化

```javascript
// 导出状态用于存储
const state = client.exportState();
await fs.writeFile(statePath, JSON.stringify(state));

// 从存储恢复
const state = JSON.parse(await fs.readFile(statePath));
client = E2eeClient.fromState(state);
```

---

## 7. 迁移检查清单

- [ ] 实现 `E2eeClient` 类
- [ ] 实现 HPKE 协议（使用 @noble 库）
- [ ] 实现会话管理
- [ ] 实现密钥加载
- [ ] 实现状态导出/恢复
- [ ] 实现错误处理
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 编写互操作测试
- [ ] 更新文档
