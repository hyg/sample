# E2EE MQTT Chat - Web 客户端（CDN 版）

## 目录结构

```
web-cdn/
├── index.html              # 主页面
├── e2ee/
│   └── hpke-browser.js     # HPKE 加密模块
├── README.md               # 本文件
└── DEPLOY.md               # 部署指南
```

## 特点

- **轻量**：只有 2 个文件，约 20 KB
- **使用 CDN**：依赖从 jsdelivr 加载
- **快速部署**：文件小，上传快

## 依赖说明

所有依赖都从 jsdelivr CDN 加载：
- `@noble/curves` - https://cdn.jsdelivr.net/npm/@noble/curves@1.3.0/
- `@noble/hashes` - https://cdn.jsdelivr.net/npm/@noble/hashes@1.3.3/
- `mqtt` - https://cdn.jsdelivr.net/npm/mqtt@5.3.0/

## 部署

将整个 `web-cdn/` 文件夹上传到支持 HTTPS 的静态文件服务器即可。

**注意**：
- 需要 HTTPS 支持（WSS 需要）
- 需要外网连接（访问 CDN）
- 文件大小约 20 KB（不含依赖）

## 使用方法

1. **访问页面**：打开浏览器访问 `https://your-domain.com`

2. **创建身份**：
   - 点击"创建 X25519 身份"
   - 保存显示的 DID 和公钥（十六进制）

3. **交换信息**：
   - 将你的 DID 和公钥发送给通信伙伴
   - 获取伙伴的 DID 和公钥

4. **连接伙伴**：
   - 在"伙伴的 DID"输入框粘贴伙伴的 DID
   - 在"伙伴的公钥"输入框粘贴伙伴的公钥（十六进制）
   - 点击"连接"

5. **初始化加密会话**：
   - 点击"初始化 E2EE 会话"
   - 等待会话建立

6. **开始聊天**：
   - 在输入框输入消息
   - 按 Enter 或点击"发送"

## 与 CLI 客户端互通

### CLI 连接网页版

1. **网页版**：
   - 创建身份，复制 DID 和公钥

2. **CLI 端**：
   ```bash
   node src/cli.js
   
   # 创建身份
   /create x25519
   
   # 连接网页版
   /connect <网页版 DID>
   /pubkey <网页版公钥>
   
   # 初始化会话
   /init
   
   # 发送消息
   /send Hello!
   ```

### 网页版连接 CLI

1. **CLI 端**：
   ```bash
   node src/cli.js
   /create x25519
   # 保存显示的 DID 和公钥
   ```

2. **网页版**：
   - 创建身份
   - 粘贴 CLI 的 DID 和公钥
   - 点击"连接"
   - 点击"初始化 E2EE 会话"

## 注意事项

1. **HTTPS 要求**：浏览器要求 WebSocket Secure (WSS) 必须在 HTTPS 下运行

2. **MQTT Broker**：
   - 默认使用 `wss://broker.emqx.io:8084/mqtt`
   - 如需使用自己的 Broker，修改 `index.html` 中的 `connectToBroker()` 函数

3. **身份存储**：
   - 身份保存在浏览器 localStorage
   - 清除浏览器数据会丢失身份
   - 可以使用"导出"功能备份身份

4. **跨浏览器通信**：
   - 同一浏览器的多个标签页共享 localStorage
   - 如需在同一浏览器测试两个身份，请使用隐私/无痕窗口

## 故障排除

### 无法连接 MQTT Broker
- 检查防火墙是否允许 WSS 连接
- 确认 Broker 地址和端口正确
- 检查浏览器控制台是否有 CORS 错误

### 解密失败
- 确认双方使用了正确的公钥
- 检查会话是否已正确初始化
- 查看浏览器控制台的错误信息

### 消息重复或丢失
- 这是双棘轮协议的正常行为
- 消息按序列号处理，乱序消息会被跳过

## 技术栈

- **加密算法**：X25519 + HPKE + AES-128-GCM
- **密钥派生**：HKDF-SHA256 + 双棘轮
- **通信协议**：MQTT over WebSocket
- **消息格式**：JSON-RPC 2.0
