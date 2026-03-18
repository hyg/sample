# did:wba 部署完整指南

## 概述

创建符合 ANP 规范的 did:wba 身份需要两个步骤：
1. ✅ 生成 DID 身份（已完成）
2. ⚠️  部署 did.json 文件（需要手动完成）

## 快速开始

### 1. 创建身份

```bash
node src/cli.js
/create wba mars22.com x25519
```

**输出**:
```
✓ 身份创建成功!
  DID: did:wba:mars22.com
  密钥类型：x25519
```

### 2. 生成 did.json

```bash
node generate-did-json.mjs .data/identity-did_wba_mars22.com.json ./did-output
```

**输出**:
```
✓ did.json 生成成功!
输出位置：./did-output/did.json
```

### 3. 部署 did.json

将 `did-output/did.json` 上传到服务器：

```bash
# 方式 A: SCP
scp did-output/did.json user@mars22.com:/var/www/html/.well-known/did.json

# 方式 B: 手动上传
# 1. 登录服务器
# 2. 创建目录
mkdir -p /var/www/html/.well-known
# 3. 上传文件
cp did.json /var/www/html/.well-known/did.json
```

### 4. 验证部署

```bash
# 检查文件是否可访问
curl -I https://mars22.com/.well-known/did.json

# 检查内容
curl https://mars22.com/.well-known/did.json | jq
```

**预期输出**:
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1",
    "https://w3id.org/security/suites/x25519-2019/v1"
  ],
  "id": "did:wba:mars22.com",
  "verificationMethod": [...],
  "authentication": [...],
  "keyAgreement": [...]
}
```

## did.json 文件内容

### 示例（X25519 密钥）

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1",
    "https://w3id.org/security/suites/x25519-2019/v1"
  ],
  "id": "did:wba:mars22.com",
  "verificationMethod": [
    {
      "id": "did:wba:mars22.com#key-1",
      "type": "X25519KeyAgreementKey2019",
      "controller": "did:wba:mars22.com",
      "publicKeyMultibase": "z35f6f4f3e41990858090416a61dc577952f9e6d8cf6a1d677b2a10edc2e7b106"
    }
  ],
  "authentication": [
    "did:wba:mars22.com#key-1"
  ],
  "assertionMethod": [
    "did:wba:mars22.com#key-1"
  ],
  "keyAgreement": [
    "did:wba:mars22.com#key-1"
  ]
}
```

### 字段说明

| 字段 | 说明 | 必需 |
|------|------|------|
| `@context` | DID 文档上下文 | ✅ |
| `id` | DID 标识符（必须与 DID 完全匹配） | ✅ |
| `verificationMethod` | 验证方法数组 | ✅ |
| `authentication` | 身份验证方法引用 | ✅ |
| `assertionMethod` | 断言方法引用 | ✅ |
| `keyAgreement` | 密钥协商方法引用 | ✅ (用于 E2EE) |

## 部署位置映射

| DID | did.json 部署 URL | 服务器路径 |
|-----|------------------|------------|
| `did:wba:example.com` | `https://example.com/.well-known/did.json` | `/.well-known/did.json` |
| `did:wba:example.com:user:alice` | `https://example.com/user/alice/did.json` | `/user/alice/did.json` |
| `did:wba:example.com%3A8800` | `https://example.com:8800/.well-known/did.json` | `/.well-known/did.json` |

## Nginx 配置示例

```nginx
server {
    listen 443 ssl;
    server_name mars22.com;

    ssl_certificate /etc/letsencrypt/live/mars22.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mars22.com/privkey.pem;

    root /var/www/html;

    # DID 文档
    location /.well-known/did.json {
        alias /var/www/html/.well-known/did.json;
        add_header Content-Type application/json;
        add_header Access-Control-Allow-Origin *;
    }
}
```

## Apache 配置示例

```apache
<VirtualHost *:443>
    ServerName mars22.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/mars22.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/mars22.com/privkey.pem

    DocumentRoot /var/www/html

    <Directory /var/www/html/.well-known>
        Require all granted
        Header set Content-Type "application/json"
        Header set Access-Control-Allow-Origin "*"
    </Directory>
</VirtualHost>
```

## 安全建议

### 私钥保管

1. **不要上传私钥** - 只上传 did.json（公钥）
2. **加密存储** - 使用 VeraCrypt 等加密存储私钥
3. **备份** - 将私钥备份到多个安全位置
4. **定期轮换** - 定期生成新的密钥对

### 访问控制

1. **只读访问** - did.json 应该是只读的
2. **HTTPS 强制** - 强制使用 HTTPS 访问
3. **文件权限** - 设置为 644（所有者可写，其他人只读）

## 故障排除

### Q: curl 返回 404

A: 检查文件路径是否正确：
```bash
# 检查文件是否存在
ls -la /var/www/html/.well-known/did.json

# 检查 Nginx/Apache 配置
nginx -t
# 或
apache2ctl configtest
```

### Q: curl 返回 403

A: 检查文件权限：
```bash
chmod 644 /var/www/html/.well-known/did.json
```

### Q: DID 文档验证失败

A: 检查：
1. `id` 字段是否与 DID 完全匹配
2. `@context` 是否包含必要的上下文
3. `verificationMethod` 是否存在且格式正确

## 工具脚本

### 生成 did.json

```bash
node generate-did-json.mjs <identity-file> [output-dir]
```

**示例**:
```bash
node generate-did-json.mjs .data/identity-did_wba_mars22.com.json ./did-output
```

### 验证部署

```bash
# 检查 HTTPS 访问
curl -I https://mars22.com/.well-known/did.json

# 检查内容
curl https://mars22.com/.well-known/did.json | jq

# 验证 DID 文档
# 确保 id 字段与 DID 匹配
# 确保 @context 包含必要的上下文
```

## 参考文档

- [ANP DID:WBA Method Specification](https://www.agent-network-protocol.com/specs/did-method)
- [W3C DID Core Specification](https://www.w3.org/TR/did-core/)
- [DID Web Method](https://w3c-ccg.github.io/did-method-web/)

## 总结

当前实现状态：

| 功能 | 状态 | 说明 |
|------|------|------|
| DID 生成 | ✅ 完成 | 符合 ANP 规范 |
| did.json 生成 | ✅ 完成 | 使用 `generate-did-json.mjs` |
| 自动部署 | ❌ 未实现 | 需要手动上传 |
| 链上注册 | ❌ 未实现 | 可选功能 |
| 自动验证 | ⚠️ 部分实现 | 可验证格式，无法验证部署 |

**建议**: 对于生产环境，建议实现自动部署工具或集成现有的身份服务器。
