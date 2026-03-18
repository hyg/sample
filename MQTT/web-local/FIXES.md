# Web 客户端修复说明

## 当前问题

### 1. 模块导入问题
**错误**: `Uncaught Error: invalid validator function`

**原因**: noble-curves 库的 ed25519.js 依赖 abstract 目录中的模块，但 import map 没有正确映射。

**解决方案**: 使用简化的 import map，只映射必需的模块：

```json
{
  "imports": {
    "hpke-browser": "./e2ee/hpke-browser.js",
    "@noble/curves/x25519": "./lib/curves/ed25519.js",
    "@noble/curves/p256": "./lib/curves/p256.js",
    "@noble/hashes/hkdf": "./lib/hashes/hkdf.js",
    "@noble/hashes/sha256": "./lib/hashes/sha256.js",
    "@noble/hashes/hmac": "./lib/hashes/hmac.js",
    "@noble/hashes/utils": "./lib/hashes/utils.js",
    "mqtt": "./lib/mqtt.esm.js"
  }
}
```

### 2. 重复定义问题
**错误**: `Buffer` 重复定义

**原因**: 文件中有两处定义 Buffer polyfill。

**解决方案**: 删除重复的 Buffer 定义，只保留一处。

## did:wba 实现核实

### 当前实现状态

**当前实现**: 简化的 did:wba，**不符合**完整的 did:wba 协议规范。

**当前行为**:
1. **创建身份**: 生成 X25519/P-256 密钥对，从公钥派生地址，创建 DID `did:wba:<chain>:<address>`
2. **存储**: 身份保存在本地 localStorage
3. **验证**: 不使用链上验证，仅用于 E2EE 通信标识

**缺少的功能**:
1. ❌ **did.json 部署**: 没有将 DID 文档部署到域名
2. ❌ **链上注册**: 没有在区块链上注册 DID
3. ❌ **自动下载验证**: 验证时不会从链上或域名下载 did.json

### 完整的 did:wba 协议规范

根据 did:wba 规范，完整的实现应该包括：

#### 1. DID 文档创建
```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:wba:eth:0x1234567890abcdef1234567890abcdef12345678",
  "verificationMethod": [
    {
      "id": "did:wba:eth:0x1234...#key-1",
      "type": "JsonWebKey2020",
      "controller": "did:wba:eth:0x1234...",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "..."
      }
    }
  ],
  "authentication": ["did:wba:eth:0x1234...#key-1"],
  "keyAgreement": ["did:wba:eth:0x1234...#key-agreement"]
}
```

#### 2. did.json 部署
```bash
# 将 did.json 放置到指定域名
https://example.com/.well-known/did.json
```

#### 3. 链上注册（可选）
```solidity
// 在智能合约中注册 DID
contract DIDRegistry {
    mapping(bytes32 => address) public didOwners;
    
    function register(bytes32 didHash) external {
        didOwners[didHash] = msg.sender;
    }
}
```

#### 4. 验证时自动下载
```javascript
async function resolveDID(did) {
    const { chain, id } = parseDID(did);
    
    // 1. 尝试从域名下载
    const domain = getDomainForChain(chain);
    const response = await fetch(`https://${domain}/.well-known/did.json`);
    const didDocument = await response.json();
    
    // 2. 验证签名
    const valid = await verifySignature(didDocument, id);
    
    return { didDocument, valid };
}
```

### 建议的实现方案

由于完整的 did:wba 实现需要：
1. 域名和 Web 服务器
2. 智能合约部署
3. 链上交互

**当前项目定位为 E2EE 通信工具**，建议采用以下方案：

#### 方案 A：保持当前简化实现（推荐）
- **用途**: E2EE 通信标识符
- **优点**: 简单快速，无需域名和链上操作
- **缺点**: 不符合完整 did:wba 规范

#### 方案 B：实现完整的 did:wba
- **用途**: 正式的去中心化身份
- **需要**:
  1. 创建 `src/did/did-wba-full.js` 实现完整协议
  2. 添加 did.json 生成和部署工具
  3. 添加智能合约交互功能
  4. 添加链上验证逻辑

### 当前代码中的 did:wba 使用

```javascript
// 创建身份（当前实现）
const identity = didManager.generate('wba', { 
  chain: 'eth', 
  keyType: 'x25519' 
});
// 结果：did:wba:eth:0x1234...
// 用途：E2EE 通信标识

// 跨 DID 通信
const sharedSecret = await didManager.getSharedSecret(
  myDid, myPrivateKey, 
  theirDid, theirPublicKey
);
// 所有 DID 方法使用统一的密钥协商接口
```

## 修复步骤

### 立即修复（让网页版正常工作）

1. **使用 web-local 版本**（本地依赖，无 CDN 问题）
2. **启动服务器**:
   ```bash
   cd web-local
   npx http-server -p 8081
   ```
3. **访问**: http://localhost:8081

### 后续改进

1. **完善 did:wba 实现**（如需要符合完整规范）
2. **添加 did.json 部署工具**
3. **添加链上验证功能**

## 参考文档

- [DID WBA Method Specification](https://github.com/web3-alliance/did-wba)
- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [RFC 9180 HPKE](https://www.rfc-editor.org/rfc/rfc9180.html)
