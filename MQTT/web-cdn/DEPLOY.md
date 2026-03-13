# E2EE MQTT Chat - Web 客户端部署脚本

## 快速部署

### 方式 1：使用 http-server 本地测试

```bash
cd web
npm run serve
# 或
npx http-server -p 8080 -c-1
```

访问 http://localhost:8080

### 方式 2：使用 Python 内置服务器

```bash
cd web
python -m http.server 8080
```

访问 http://localhost:8080

### 方式 3：上传到服务器

只需上传整个 `web/` 文件夹到支持 HTTPS 的静态文件服务器：

```bash
# 示例：使用 scp 上传
scp -r web/ user@your-server:/var/www/html/

# 示例：使用 rsync 上传
rsync -avz web/ user@your-server:/var/www/html/
```

## 文件清单

部署时只需要以下文件：

```
web/
├── index.html              # 必需 - 主页面
├── e2ee/
│   └── hpke-browser.js     # 必需 - HPKE 加密模块
├── README.md               # 可选 - 说明文档
└── package.json            # 可选 - npm 配置
```

**注意**：
- 所有依赖（@noble/curves, @noble/hashes, mqtt）都从 jsdelivr CDN 加载
- 不需要上传 node_modules
- 确保服务器支持 HTTPS（WSS 需要）

## 服务器配置

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /var/www/html/web;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Apache

```apache
<VirtualHost *:443>
    ServerName your-domain.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem

    DocumentRoot /var/www/html/web

    <Directory /var/www/html/web>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

## 验证部署

1. 访问 `https://your-domain.com`
2. 点击"创建 X25519 身份"
3. 检查浏览器控制台是否有错误
4. 测试发送消息

## 常见问题

### Q: 页面加载后显示空白
A: 检查浏览器控制台是否有 JavaScript 错误，通常是 CDN 加载失败

### Q: 无法连接 MQTT Broker
A: 确保服务器允许 WSS 连接，检查防火墙设置

### Q: HTTPS 证书错误
A: 使用 Let's Encrypt 获取免费 SSL 证书：
```bash
certbot --nginx -d your-domain.com
# 或
certbot --apache -d your-domain.com
```
