# did:wba 部署工具

## 使用方法

### 1. 生成身份和 did.json

```bash
node deploy-did.js --domain example.com --user alice --key-type x25519
```

### 2. 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--domain` | 域名 | 必需 |
| `--user` | 用户路径（可选） | 无 |
| `--port` | 端口（可选） | 443 |
| `--key-type` | 密钥类型：x25519, p256, ed25519 | x25519 |
| `--output` | 输出目录 | ./did-output |

### 3. 输出

工具会生成：
- `did.json` - DID 文档
- `private-key.txt` - 私钥（妥善保管！）
- `deployment-info.json` - 部署信息

### 4. 部署步骤

#### 方式 A：手动部署

1. 将 `did.json` 上传到服务器
2. 放置到正确位置：
   - `did:wba:example.com` → `/.well-known/did.json`
   - `did:wba:example.com:user:alice` → `/user/alice/did.json`
3. 确保 HTTPS 可访问
4. 验证：`curl https://example.com/.well-known/did.json`

#### 方式 B：使用 SCP

```bash
# 部署到服务器
scp did.json user@example.com:/var/www/html/.well-known/did.json

# 验证
ssh user@example.com "curl https://example.com/.well-known/did.json"
```

#### 方式 C：使用 Nginx

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    location /.well-known/did.json {
        alias /var/www/did/did.json;
        add_header Content-Type application/json;
    }
}
```

## 示例

### 示例 1：创建主域名 DID

```bash
node deploy-did.js --domain example.com --key-type x25519
```

生成：
- DID: `did:wba:example.com`
- 部署位置：`https://example.com/.well-known/did.json`

### 示例 2：创建用户 DID

```bash
node deploy-did.js --domain example.com --user alice --key-type x25519
```

生成：
- DID: `did:wba:example.com:user:alice`
- 部署位置：`https://example.com/user/alice/did.json`

### 示例 3：带端口的 DID

```bash
node deploy-did.js --domain example.com --port 8800 --user alice
```

生成：
- DID: `did:wba:example.com%3A8800:user:alice`
- 部署位置：`https://example.com:8800/user/alice/did.json`

## 安全建议

1. **私钥保管** - 将 `private-key.txt` 存储在安全位置，不要上传到服务器
2. **使用加密** - 使用加密存储（如 VeraCrypt）保存私钥
3. **定期轮换** - 定期生成新的密钥对和 DID
4. **多 DID 策略** - 不同场景使用不同 DID

## 验证部署

```bash
# 1. 检查 HTTPS 访问
curl -I https://example.com/.well-known/did.json

# 2. 检查内容
curl https://example.com/.well-known/did.json | jq

# 3. 验证 DID 文档
# 确保 id 字段与 DID 匹配
# 确保 @context 包含必要的上下文
```

## 故障排除

### Q: 404 Not Found
A: 检查文件路径是否正确，确保 Nginx/Apache 配置正确

### Q: 403 Forbidden
A: 检查文件权限，确保 Web 服务器有读取权限

### Q: CORS 错误
A: 在 Web 服务器配置中添加 CORS 头：
```nginx
add_header Access-Control-Allow-Origin *;
```

### Q: MIME 类型错误
A: 确保服务器设置正确的 Content-Type: `application/json`
