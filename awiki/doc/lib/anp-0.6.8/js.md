# ANP 库 JavaScript 移植设计文档

## 1. 概述

**Python 包**: `anp` (awiki Network Protocol)  
**版本**: `0.6.8`  
**JavaScript 目标包**: `@awiki/anp` (拆分为 `@awiki/anp-auth` 和 `@awiki/anp-hpke`)  
**用途**: DID WBA 认证和 HPKE 端到端加密

---

## 2. 模块结构对比

### 2.1 Python 结构

```
anp/
├── authentication/
│   ├── __init__.py
│   ├── did_wba.py
│   └── header.py
├── e2e_encryption_hpke/
│   ├── __init__.py
│   ├── session.py
│   ├── key_manager.py
│   └── message.py
└── ...
```

### 2.2 JavaScript 结构 (推荐)

```
@awiki/anp-auth/          # 认证模块
├── src/
│   ├── index.ts
│   ├── did-wba.ts
│   ├── header.ts
│   └── types.ts
└── package.json

@awiki/anp-hpke/          # HPKE 加密模块
├── src/
│   ├── index.ts
│   ├── session.ts
│   ├── key-manager.ts
│   ├── message.ts
│   └── types.ts
└── package.json
```

---

## 3. authentication 模块设计

### 3.1 `generate_auth_header` 函数

**Python 签名**:
```python
def generate_auth_header(
    did_document: dict,
    service_domain: str,
    sign_callback: callable,
) -> str:
```

**JavaScript 签名**:
```typescript
/**
 * 生成 DID WBA 认证头
 * @param didDocument - DID 文档
 * @param serviceDomain - 服务域名
 * @param signCallback - 签名回调 (content: Uint8Array, vmFragment: string) => Promise<Uint8Array>
 * @returns Authorization 头值 (DIDWba 格式)
 */
async function generateAuthHeader(
    didDocument: DidDocument,
    serviceDomain: string,
    signCallback: SignCallback
): Promise<string>;
```

**实现要点**:
1. 获取当前时间戳
2. 构建签名内容：`timestamp + method + path + body_hash`
3. 调用 signCallback 进行 secp256k1 签名
4. 返回 `DIDWba <did>:<signature>:<timestamp>` 格式

**使用示例**:
```typescript
import { generateAuthHeader } from '@awiki/anp-auth';

const authHeader = await generateAuthHeader(
    didDocument,
    'awiki.ai',
    async (content, vmFragment) => {
        // 使用 secp256k1 私钥签名
        const signature = await secp256k1.sign(content, privateKey);
        return signature.toDerkBytes();
    }
);
```

---

### 3.2 `create_did_wba_document_with_key_binding` 函数

**Python 签名**:
```python
def create_did_wba_document_with_key_binding(
    hostname: str,
    path_prefix: list[str] | None = None,
    proof_purpose: str = "authentication",
    domain: str | None = None,
    challenge: str | None = None,
    services: list[dict] | None = None,
) -> tuple[dict, dict]:
```

**JavaScript 签名**:
```typescript
interface CreateDidWbaOptions {
    hostname: string;
    pathPrefix?: string[];
    proofPurpose?: 'authentication' | 'assertionMethod' | 'keyAgreement';
    domain?: string;
    challenge?: string;
    services?: ServiceEntry[];
}

interface DidKeys {
    'key-1': [Uint8Array, Uint8Array];  // secp256k1 [private, public]
    'key-2'?: [Uint8Array, Uint8Array]; // secp256r1 [private, public]
    'key-3'?: [Uint8Array, Uint8Array]; // X25519 [private, public]
}

function createDidWbaDocumentWithKeyBinding(
    options: CreateDidWbaOptions
): [DidDocument, DidKeys];
```

**实现要点**:
1. 生成 secp256k1 密钥对 (key-1)
2. 生成 secp256r1 密钥对 (key-2，可选)
3. 生成 X25519 密钥对 (key-3，可选)
4. 构建 DID 文档
5. 生成证明 (proof)

**使用示例**:
```typescript
import { createDidWbaDocumentWithKeyBinding } from '@awiki/anp-auth';

const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
    hostname: 'awiki.ai',
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: 'awiki.ai',
    services: [{
        id: '#messaging',
        type: 'Messaging',
        serviceEndpoint: 'https://awiki.ai/message/rpc'
    }]
});

console.log(didDocument.id); // did:wba:awiki.ai:user:k1_...
console.log(keys['key-1']);  // [privateKeyPem, publicKeyPem]
```

---

### 3.3 `resolve_did_wba_document` 函数

**Python 签名**:
```python
async def resolve_did_wba_document(did: str) -> dict | None:
```

**JavaScript 签名**:
```typescript
async function resolveDidWbaDocument(did: string): Promise<DidDocument | null>;
```

**实现要点**:
1. 解析 DID 获取域名
2. 调用 `.well-known/did.json` 或 RPC 端点
3. 验证 DID 文档签名

---

## 4. e2e_encryption_hpke 模块设计

### 4.1 `E2eeHpkeSession` 类

**Python 类定义**:
```python
class E2eeHpkeSession:
    def __init__(
        self,
        local_did: str,
        peer_did: str,
        local_x25519_private_key: X25519PrivateKey,
        local_x25519_key_id: str,
        signing_private_key: ec.EllipticCurvePrivateKey,
        signing_verification_method: str,
    ):
        self.session_id: str | None
        self.state: SessionState
        # ...
    
    def initiate_session(
        self,
        peer_public_key: bytes,
        peer_key_id: str,
    ) -> tuple[str, dict]:
        """发起会话，返回 (msg_type, content)"""
    
    def process_init(self, content: dict, sender_signing_pk: bytes) -> None:
        """处理 e2ee_init"""
    
    def encrypt_message(
        self,
        original_type: str,
        plaintext: str,
    ) -> tuple[str, dict]:
        """加密消息"""
    
    def decrypt_message(self, content: dict) -> tuple[str, str]:
        """解密消息"""
```

**JavaScript 类定义**:
```typescript
type SessionState = 'init' | 'active' | 'closed' | 'expired';

interface E2eeSessionConfig {
    localDid: string;
    peerDid: string;
    localX25519PrivateKey: Uint8Array;
    localX25519KeyId: string;
    signingPrivateKey: Uint8Array;
    signingVerificationMethod: string;
}

class E2eeHpkeSession {
    sessionId: string | null;
    state: SessionState;
    
    constructor(config: E2eeSessionConfig);
    
    initiateSession(
        peerPublicKey: Uint8Array,
        peerKeyId: string
    ): [MessageType, E2eeContent];
    
    processInit(content: E2eeContent, senderSigningPk: Uint8Array): void;
    
    processRekey(content: E2eeContent, senderSigningPk: Uint8Array): void;
    
    encryptMessage(originalType: string, plaintext: string): [MessageType, E2eeContent];
    
    decryptMessage(content: E2eeContent): [string, string];
    
    isExpired(): boolean;
}
```

**实现依赖**:
- `@noble/hpke`: HPKE 协议实现
- `@noble/curves/x25519`: X25519 密钥协商
- `@noble/curves/p256`: secp256r1 签名

---

### 4.2 `HpkeKeyManager` 类

**JavaScript 类定义**:
```typescript
class HpkeKeyManager {
    // 获取或创建密钥对
    getKeyPair(keyId: string): [Uint8Array, Uint8Array];
    
    // 保存密钥对
    saveKeyPair(keyId: string, publicKey: Uint8Array, privateKey: Uint8Array): void;
    
    // 获取对等方公钥
    getPeerPublicKey(did: string): Promise<Uint8Array>;
    
    // 注册会话
    registerSession(session: E2eeHpkeSession): void;
    
    // 获取活跃会话
    getActiveSession(localDid: string, peerDid: string): E2eeHpkeSession | null;
    
    // 按 ID 获取会话
    getSessionById(sessionId: string): E2eeHpkeSession | null;
    
    // 清理过期会话
    cleanupExpired(): void;
}
```

---

### 4.3 `detect_message_type` 函数

**JavaScript 签名**:
```typescript
type MessageType = 'e2ee_init' | 'e2ee_ack' | 'e2ee_msg' | 'e2ee_rekey' | 'e2ee_error' | 'text' | null;

function detectMessageType(msgType: string): MessageType;
```

---

### 4.4 `generate_proof` 和 `validate_proof` 函数

**JavaScript 签名**:
```typescript
interface ProofContent {
    e2ee_version: string;
    session_id: string;
    sender_did: string;
    recipient_did: string;
    expires: number;
    // ... 其他字段
}

function generateProof(
    content: ProofContent,
    signingPrivateKey: Uint8Array,
    verificationMethodId: string
): ProofContent;

function validateProof(
    content: ProofContent,
    signingPublicKey: Uint8Array,
    maxPastAgeSeconds?: number
): void;  // 验证失败抛出异常
```

---

### 4.5 公钥提取函数

**JavaScript 签名**:
```typescript
function extractX25519PublicKeyFromDidDocument(
    didDocument: DidDocument,
    keyId?: string
): { publicKey: Uint8Array; keyId: string };

function extractSigningPublicKeyFromDidDocument(
    didDocument: DidDocument,
    keyId?: string
): Uint8Array;
```

---

## 5. 依赖关系

### 5.1 @awiki/anp-auth 依赖

```json
{
  "dependencies": {
    "@noble/curves": "^1.0.0",
    "@noble/hashes": "^1.0.0"
  }
}
```

### 5.2 @awiki/anp-hpke 依赖

```json
{
  "dependencies": {
    "@noble/hpke": "^1.0.0",
    "@noble/curves": "^1.0.0",
    "@noble/hashes": "^1.0.0"
  }
}
```

---

## 6. 类型定义

```typescript
// types/did.ts
export interface DidDocument {
    '@context': string[];
    id: string;
    verificationMethod: VerificationMethod[];
    authentication: string[];
    assertionMethod: string[];
    keyAgreement: string[];
    service?: ServiceEntry[];
    proof?: Proof;
}

export interface VerificationMethod {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
}

export interface ServiceEntry {
    id: string;
    type: string;
    serviceEndpoint: string;
}

export interface Proof {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
}

// types/e2ee.ts
export interface E2eeContent {
    e2ee_version: string;
    session_id: string;
    sender_did: string;
    recipient_did: string;
    expires: number;
    ciphertext?: string;
    proof: {
        verification_method: string;
        proof_value: string;
    };
}
```

---

## 7. 测试用例

参考 [distill.json](distill.json) 中的 14 个测试用例。

---

## 8. 迁移检查清单

- [ ] 实现 `generateAuthHeader` 函数
- [ ] 实现 `createDidWbaDocumentWithKeyBinding` 函数
- [ ] 实现 `resolveDidWbaDocument` 函数
- [ ] 实现 `E2eeHpkeSession` 类
- [ ] 实现 `HpkeKeyManager` 类
- [ ] 实现 `generateProof` 和 `validateProof` 函数
- [ ] 实现公钥提取函数
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 编写与 Python 版本的互操作测试

---

## 9. 注意事项

1. **密钥格式**: JavaScript 使用 `Uint8Array`，需要处理 PEM 编码转换
2. **签名算法**: secp256k1 使用 `@noble/curves/secp256k1`
3. **HPKE 协议**: 使用 `@noble/hpke` 实现 RFC 9180
4. **异步处理**: 所有签名操作都是异步的
5. **互操作性**: 确保与 Python 版本的加密输出兼容
