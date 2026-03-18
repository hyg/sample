/**
 * 生成 did:wba 的 did.json 文件
 * 
 * 使用方法:
 * node generate-did-json.js <identity-file> [output-dir]
 * 
 * 示例:
 * node generate-did-json.js .data/identity-did_wba_mars22.com.json ./did-output
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取参数
const identityFile = process.argv[2];
const outputDir = process.argv[3] || './did-output';

if (!identityFile) {
  console.log('用法：node generate-did-json.js <identity-file> [output-dir]');
  console.log('示例：node generate-did-json.js .data/identity-did_wba_mars22.com.json ./did-output');
  process.exit(1);
}

// 读取身份文件
const identityPath = join(__dirname, identityFile);
const identity = JSON.parse(readFileSync(identityPath, 'utf-8'));

console.log('读取身份文件:', identityPath);
console.log('DID:', identity.did);

// 生成 DID 文档
const didDocument = {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/jws-2020/v1',
    'https://w3id.org/security/suites/x25519-2019/v1'
  ],
  id: identity.did,
  verificationMethod: [
    {
      id: `${identity.did}#key-1`,
      type: identity.keyType === 'x25519' 
        ? 'X25519KeyAgreementKey2019' 
        : 'JsonWebKey2020',
      controller: identity.did,
      publicKeyMultibase: identity.keyType === 'x25519'
        ? 'z' + identity.publicKey
        : undefined,
      publicKeyJwk: identity.keyType !== 'x25519'
        ? publicKeyToJWK(identity.publicKey, identity.keyType)
        : undefined
    }
  ],
  authentication: [`${identity.did}#key-1`],
  assertionMethod: [`${identity.did}#key-1`],
  keyAgreement: identity.keyType === 'x25519' 
    ? [`${identity.did}#key-1`] 
    : []
};

// 生成输出目录
const fullOutputDir = join(__dirname, outputDir);
if (!existsSync(fullOutputDir)) {
  mkdirSync(fullOutputDir, { recursive: true });
}

// 写入 did.json
const didJsonPath = join(fullOutputDir, 'did.json');
writeFileSync(didJsonPath, JSON.stringify(didDocument, null, 2));

console.log('\n✓ did.json 生成成功!');
console.log('输出位置:', didJsonPath);

// 生成部署说明
const deployInstructions = generateDeployInstructions(identity, outputDir);
console.log('\n' + deployInstructions);

/**
 * 将原始公钥转换为 JWK 格式
 */
function publicKeyToJWK(publicKeyHex, keyType) {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  
  if (keyType === 'p256') {
    // P-256 公钥转换为 JWK
    let uncompressed;
    if (publicKey.length === 33) {
      // 压缩格式，需要解压缩（简化处理，假设是未压缩）
      uncompressed = publicKey;
    } else if (publicKey.length === 65) {
      uncompressed = publicKey;
    } else {
      throw new Error('Invalid P-256 public key length');
    }
    
    const x = uncompressed.slice(1, 33);
    const y = uncompressed.slice(33, 65);
    
    return {
      kty: 'EC',
      crv: 'P-256',
      x: x.toString('base64url'),
      y: y.toString('base64url')
    };
  }
  
  throw new Error('Unsupported key type: ' + keyType);
}

/**
 * 生成部署说明
 */
function generateDeployInstructions(identity, outputDir) {
  const domain = identity.did.replace('did:wba:', '');
  const didJsonUrl = `https://${domain}/.well-known/did.json`;
  
  return `
========================================
DID 部署说明
========================================

DID: ${identity.did}
部署 URL: ${didJsonUrl}

----------------------------------------
部署步骤:
----------------------------------------

1. 将生成的 did.json 文件上传到服务器
   目标位置：${outputDir}/did.json
   
   完整 URL: ${didJsonUrl}

2. 部署方式（选择一种）:

   A) 使用 SCP:
      scp ${outputDir}/did.json user@${domain}:/${outputDir}/did.json
   
   B) 使用 FTP/SFTP:
      使用 FileZilla 等工具上传到对应路径
   
   C) 直接服务器操作:
      ssh user@${domain}
      sudo cp ${outputDir}/did.json /var/www/html/.well-known/did.json

3. 设置正确的文件权限:
   chmod 644 ${outputDir}/did.json

4. 确保 Web 服务器配置正确:
   
   Nginx 示例:
   location /.well-known/did.json {
       alias /path/to/${outputDir}/did.json;
       add_header Content-Type application/json;
   }

5. 验证部署:
   curl -I ${didJsonUrl}
   curl ${didJsonUrl} | jq

----------------------------------------
安全警告:
----------------------------------------
- 私钥文件必须妥善保管
- 不要将私钥上传到服务器
- 建议使用加密存储（如 VeraCrypt）
- 定期轮换密钥

========================================
`.trim();
}
