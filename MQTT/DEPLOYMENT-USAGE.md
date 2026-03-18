# DID 部署与验证使用指南

## 概述

本文档介绍如何使用 did:wba 的部署和验证功能。

## 部署功能

### 1. 手动部署（默认）

适用于大多数情况，生成文件后手动上传到服务器。

```javascript
import { didManager } from './src/did/manager.js';

// 创建身份
const identity = didManager.generate('wba', {
  domain: 'example.com',
  path: 'user:alice',
  keyType: 'x25519'
});

console.log('DID:', identity.did);
// 输出：did:wba:example.com:user:alice

// 部署 DID 文档
const deployResult = await didManager.deployDidDocument(identity.did, {
  method: 'manual'  // 默认值
});

console.log(deployResult);
// 输出：
// {
//   success: true,
//   did: 'did:wba:example.com:user:alice',
//   didJsonUrl: 'https://example.com/user/alice/did.json',
//   message: '已生成部署文件，请按照说明手动部署',
//   instructions: '...',
//   deployPath: './user/alice/did.json'
// }

// 查看部署说明
console.log(deployResult.instructions);
```

**生成的文件**（在 `./did-output/` 目录）:
- `did.json` - DID 文档
- `deployment-info.json` - 部署信息
- `deployment-instructions.txt` - 详细部署说明

### 2. 本地文件部署

适用于本地测试或有本地文件系统访问权限的情况。

```javascript
const deployResult = await didManager.deployDidDocument(identity.did, {
  method: 'local',
  webRoot: '/var/www/html'  // Web 服务器根目录
});

console.log(deployResult);
// 输出：
// {
//   success: true,
//   did: 'did:wba:example.com:user:alice',
//   didJsonUrl: 'https://example.com/user/alice/did.json',
//   message: '已部署到本地文件系统：/var/www/html/user/alice/did.json',
//   deployPath: '/var/www/html/user/alice/did.json'
// }
```

### 3. RESTful API 部署（可插拔接口）

适用于提供 RESTful API 的身份服务器。

```javascript
// 1. 实现 API 部署器
import { ApiDeployer, DeploymentResult } from './src/did/deployment-manager.js';

class CustomApiDeployer extends ApiDeployer {
  async deploy(did, didDocument, privateKey) {
    // 调用身份服务器的 API
    const response = await fetch(this.config.apiEndpoint + '/did/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiToken}`
      },
      body: JSON.stringify({
        did,
        didDocument,
        signature: await this.sign(didDocument, privateKey)
      })
    });

    const result = await response.json();

    return new DeploymentResult(
      result.success,
      did,
      result.didJsonUrl,
      result.message,
      result.details
    );
  }

  async verify(did) {
    const response = await fetch(this.config.apiEndpoint + `/did/verify/${did}`);
    return await response.json();
  }

  async update(did, didDocument, privateKey) {
    // 实现更新逻辑
  }

  async revoke(did, privateKey) {
    // 实现撤销逻辑
  }

  async sign(data, privateKey) {
    // 实现签名逻辑
  }
}

// 2. 注册部署器
const apiDeployer = new CustomApiDeployer({
  apiEndpoint: 'https://identity-server.example.com/api',
  apiToken: 'your-api-token'
});

didManager.registerDeployer('api', apiDeployer);

// 3. 使用
const deployResult = await didManager.deployDidDocument(identity.did, {
  method: 'api'
});
```

### 4. SSH/SFTP 部署（可插拔接口）

适用于有 SSH 访问权限的服务器。

```javascript
// 实现 SshDeployer（类似 ApiDeployer）
import { SshDeployer, DeploymentResult } from './src/did/deployment-manager.js';

class CustomSshDeployer extends SshDeployer {
  async deploy(did, didDocument) {
    // 使用 SSH/SFTP 上传文件
    // 需要实现 SSH 连接和文件传输逻辑
  }

  async verify(did) {
    // 通过 SSH 执行验证命令
  }
}

// 注册和使用
const sshDeployer = new CustomSshDeployer({
  sshHost: 'example.com',
  sshUser: 'deploy',
  sshPort: 22,
  sshKey: 'path/to/private/key',
  webRoot: '/var/www/html'
});

didManager.registerDeployer('ssh', sshDeployer);
```

## 验证功能

### 1. 本地验证 DID 文档

```javascript
// 验证本地生成的 DID 文档
const verifyResult = await didManager.verifyDidDocument(identity.did, identity.didDocument);

console.log(verifyResult);
// 输出：
// {
//   verified: true,
//   did: 'did:wba:example.com:user:alice',
//   didDocument: {...},
//   errors: [],
//   warnings: [],
//   timestamp: '2026-03-14T12:34:56.789Z'
// }

// 检查验证结果
if (verifyResult.verified) {
  console.log('✅ DID 文档验证通过');
} else {
  console.log('❌ DID 文档验证失败');
  console.log('错误:', verifyResult.errors);
  console.log('警告:', verifyResult.warnings);
}
```

### 2. 远程验证（从域名下载）

```javascript
// 从域名下载并验证 DID 文档
const verifyResult = await didManager.verifyDidDocument('did:wba:example.com:user:alice');

console.log(verifyResult);

// 如果验证失败，查看错误信息
if (!verifyResult.verified) {
  console.log('验证失败原因:');
  verifyResult.errors.forEach(err => console.log('  -', err));
}
```

### 3. 验证公钥（跨 DID 通信）

```javascript
// 在跨 DID 通信中，验证对方的公钥
const publicKey = Buffer.from('8dfe8b73f837ab1f...', 'hex');
const keyType = 'x25519';

const verifyResult = await didManager.verifyPublicKey(
  'did:wba:example.com:user:alice',
  publicKey,
  keyType
);

if (verifyResult.verified) {
  console.log('✅ 公钥验证通过，可以安全通信');
} else {
  console.log('❌ 公钥验证失败:', verifyResult.message);
}
```

### 4. 验证签名

```javascript
// 验证对方的签名
const message = new TextEncoder().encode('Hello, World!');
const signature = await didManager.sign(identity.did, message);

const isValid = await didManager.verifySignature(
  identity.did,
  message,
  signature
);

console.log(isValid ? '✅ 签名有效' : '❌ 签名无效');
```

## 完整示例

### 场景：创建并部署 did:wba 身份

```javascript
import { didManager } from './src/did/manager.js';

async function main() {
  // 1. 创建身份
  console.log('正在创建身份...');
  const identity = didManager.generate('wba', {
    domain: 'example.com',
    path: 'user:alice',
    keyType: 'x25519'
  });

  console.log('DID:', identity.did);
  console.log('公钥:', identity.publicKey.toString('hex'));

  // 2. 部署 DID 文档（手动模式）
  console.log('\n正在生成部署文件...');
  const deployResult = await didManager.deployDidDocument(identity.did, {
    method: 'manual'
  });

  console.log('部署结果:', deployResult.message);
  console.log('部署 URL:', deployResult.didJsonUrl);
  console.log('\n部署说明:');
  console.log(deployResult.instructions);

  // 3. 验证本地 DID 文档
  console.log('\n正在验证 DID 文档...');
  const verifyResult = await didManager.verifyDidDocument(
    identity.did,
    identity.didDocument
  );

  if (verifyResult.verified) {
    console.log('✅ DID 文档验证通过');
  } else {
    console.log('❌ DID 文档验证失败');
    console.log('错误:', verifyResult.errors);
  }

  // 4. 保存身份（用于后续使用）
  const exported = didManager.export(identity.did);
  console.log('\n导出的身份:');
  console.log(JSON.stringify(exported, null, 2));
}

main().catch(console.error);
```

### 场景：验证远程身份

```javascript
async function verifyRemoteIdentity(did, publicKey) {
  console.log('正在验证远程身份:', did);

  // 1. 从域名下载并验证 DID 文档
  const docResult = await didManager.verifyDidDocument(did);
  
  if (!docResult.verified) {
    console.log('❌ DID 文档验证失败');
    docResult.errors.forEach(err => console.log('  -', err));
    return false;
  }

  console.log('✅ DID 文档验证通过');

  // 2. 验证公钥
  const keyResult = await didManager.verifyPublicKey(did, publicKey, 'x25519');
  
  if (!keyResult.verified) {
    console.log('❌ 公钥验证失败:', keyResult.message);
    return false;
  }

  console.log('✅ 公钥验证通过');
  console.log('可以安全通信');
  return true;
}
```

## 部署检查清单

### 手动部署

- [ ] 生成 did.json 文件
- [ ] 上传到正确的路径
  - `did:wba:example.com` → `/.well-known/did.json`
  - `did:wba:example.com:user:alice` → `/user/alice/did.json`
- [ ] 设置正确的文件权限（644）
- [ ] 配置 Web 服务器（Nginx/Apache）
- [ ] 设置正确的 MIME 类型（application/json）
- [ ] 验证 HTTPS 访问
- [ ] 验证 DID 文档内容

### 验证检查清单

- [ ] DID 格式正确（`did:wba:...`）
- [ ] @context 包含 `https://www.w3.org/ns/did/v1`
- [ ] id 字段与 DID 匹配
- [ ] verificationMethod 存在且格式正确
- [ ] authentication 存在
- [ ] 公钥格式正确
- [ ] 签名验证通过（如果有 proof 字段）

## 安全建议

1. **私钥保管**
   - 不要将私钥上传到服务器
   - 使用加密存储（如 VeraCrypt）
   - 定期轮换密钥

2. **多 DID 策略**
   - 主 DID：长期使用，维护社交关系
   - 子 DID：特定场景使用，定期更换

3. **HTTPS 强制**
   - 确保服务器配置 HTTPS
   - 使用有效的 SSL 证书
   - 强制 HTTPS 重定向

4. **访问控制**
   - 限制 did.json 的写权限
   - 使用 SSH 密钥认证
   - 定期审计访问日志

## 故障排除

### Q: 部署后无法访问 did.json

A: 检查以下几点：
1. 文件路径是否正确
2. Web 服务器配置是否正确
3. 文件权限是否正确（644）
4. MIME 类型是否设置为 application/json
5. 防火墙是否允许 HTTPS 访问

### Q: 验证失败 "DID 文档 id 与待验证的 DID 不匹配"

A: 确保 did.json 中的 `id` 字段与 DID 完全匹配：
```json
{
  "id": "did:wba:example.com:user:alice",  // 必须与 DID 完全一致
  ...
}
```

### Q: 验证失败 "@context 必须包含..."

A: 确保 @context 包含必要的上下文：
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  ...
}
```

## 参考文档

- [DID-EXTENSION.md](DID-EXTENSION.md) - DID 扩展设计
- [DEPLOY-DID.md](DEPLOY-DID.md) - did:wba 部署指南
- [STATUS.md](STATUS.md) - 项目状态总结
