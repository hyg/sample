# identity 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/identity.py`  
**JavaScript 目标文件**: `module/src/identity.js`  
**功能**: DID 身份创建（包装 ANP 库）

---

## 2. 接口设计

### 2.1 `DIDIdentity` 类

**Python**:
```python
@dataclass
class DIDIdentity:
    did: str
    did_document: dict
    private_key_pem: bytes
    # ...
```

**JavaScript**:
```javascript
class DIDIdentity {
    constructor({
        did,
        didDocument,
        privateKeyPem,
        publicKeyPem,
        userId = null,
        jwtToken = null,
        e2eeSigningPrivatePem = null,
        e2eeSigningPublicPem = null,
        e2eeAgreementPrivatePem = null,
        e2eeAgreementPublicPem = null,
    }) {
        this.did = did;
        this.didDocument = didDocument;
        this.privateKeyPem = privateKeyPem;
        this.publicKeyPem = publicKeyPem;
        this.userId = userId;
        this.jwtToken = jwtToken;
        this.e2eeSigningPrivatePem = e2eeSigningPrivatePem;
        this.e2eeSigningPublicPem = e2eeSigningPublicPem;
        this.e2eeAgreementPrivatePem = e2eeAgreementPrivatePem;
        this.e2eeAgreementPublicPem = e2eeAgreementPublicPem;
    }

    get uniqueId() {
        return this.did.rsplit(':', 1)[1];
    }

    async getPrivateKey() {
        return loadPrivateKey(this.privateKeyPem);
    }
}
```

### 2.2 `createIdentity` 函数

**Python**:
```python
def create_identity(
    hostname: str,
    path_prefix: list[str] | None = None,
    proof_purpose: str = "authentication",
    domain: str | None = None,
    challenge: str | None = None,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
```

**JavaScript**:
```javascript
/**
 * 创建 DID 身份
 * @param {Object} options - 创建选项
 * @param {string} options.hostname - DID 域名
 * @param {string[]} [options.pathPrefix=['user']] - DID 路径前缀
 * @param {string} [options.proofPurpose='authentication'] - 证明用途
 * @param {string} [options.domain] - 服务域名
 * @param {string} [options.challenge] - 证明随机数
 * @param {Object[]} [options.services] - 自定义服务列表
 * @returns {DIDIdentity}
 */
function createIdentity(options) {
    const {
        hostname,
        pathPrefix = ['user'],
        proofPurpose = 'authentication',
        domain,
        challenge = crypto.randomBytes(16).toString('hex'),
        services = null,
    } = options;

    // 调用 ANP 库创建 DID 文档
    const { didDocument, keys } = createDidWbaDocumentWithKeyBinding({
        hostname,
        pathPrefix,
        proofPurpose,
        domain,
        challenge,
        services,
    });

    const privateKeyPem = keys['key-1'][0];
    const publicKeyPem = keys['key-1'][1];
    const e2eeSigningPrivatePem = keys['key-2']?.[0] || null;
    const e2eeSigningPublicPem = keys['key-2']?.[1] || null;
    const e2eeAgreementPrivatePem = keys['key-3']?.[0] || null;
    const e2eeAgreementPublicPem = keys['key-3']?.[1] || null;

    return new DIDIdentity({
        did: didDocument.id,
        didDocument,
        privateKeyPem,
        publicKeyPem,
        e2eeSigningPrivatePem,
        e2eeSigningPublicPem,
        e2eeAgreementPrivatePem,
        e2eeAgreementPublicPem,
    });
}
```

### 2.3 `loadPrivateKey` 函数

**JavaScript**:
```javascript
/**
 * 从 PEM 加载私钥
 * @param {Buffer|string} pemBytes - PEM 格式的私钥
 * @returns {Promise<CryptoKey>}
 */
async function loadPrivateKey(pemBytes) {
    const pem = typeof pemBytes === 'string' ? pemBytes : pemBytes.toString();
    const base64 = pem
        .replace(/-----BEGIN .* KEY-----/, '')
        .replace(/-----END .* KEY-----/, '')
        .replace(/\s/g, '');
    const der = Buffer.from(base64, 'base64');

    return crypto.subtle.importKey(
        'pkcs8',
        der,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
    );
}
```

---

## 3. 导出接口

```javascript
export {
    DIDIdentity,
    createIdentity,
    loadPrivateKey,
};
```

---

## 4. 依赖说明

**ANP 库移植**:
- `createDidWbaDocumentWithKeyBinding` 需要从 Python 的 `anp.authentication` 移植
- 使用 `@noble/curves` 或 Web Crypto API 实现密钥生成和签名

---

## 5. 迁移检查清单

- [ ] 实现 `DIDIdentity` 类
- [ ] 实现 `createIdentity` 函数
- [ ] 实现 `loadPrivateKey` 函数
- [ ] 移植或重写 ANP 库功能
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
