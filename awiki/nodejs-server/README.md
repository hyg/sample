# awiki.ai Node.js Server Implementation

**目的**: 根据 client 端代码和文档推测并实现 awiki.ai 服务端功能

---

## 项目状态

**状态**: 📋 设计阶段  
**完成度**: 0%

---

## 推测的服务端架构

基于 client 端 API 调用分析，awiki.ai 服务端包含以下功能模块：

### 1. 用户服务 (user-service)

#### DID 认证 (`/user-service/did-auth/rpc`)

**方法**:
- `register` - 注册 DID 身份
- `verify` - 验证 DID 签名，颁发 JWT
- `get_me` - 获取当前用户信息

**实现优先级**: P0

---

#### Handle 管理 (`/user-service/handle/rpc`)

**方法**:
- `sendOtp` - 发送 OTP 验证码
- `registerHandle` - 注册 Handle
- `lookup` - 查找 Handle（通过 handle 或 did）

**实现优先级**: P1

---

#### 个人资料 (`/user-service/did/profile/rpc`)

**方法**:
- `getProfile` - 获取用户资料
- `updateProfile` - 更新用户资料
- `resolve` - 解析 DID 文档

**实现优先级**: P1

---

#### 社交关系 (`/user-service/did/relationships/rpc`)

**方法**:
- `follow` - 关注用户
- `unfollow` - 取消关注
- `getRelationship` - 获取关系状态
- `getFollowing` - 获取关注列表
- `getFollowers` - 获取粉丝列表
- `createGroup` - 创建群组
- `inviteToGroup` - 邀请入群
- `joinGroup` - 加入群组
- `getGroupMembers` - 获取群成员列表

**实现优先级**: P2

---

### 2. 消息服务 (molt-message)

#### 消息 RPC (`/message/rpc`)

**方法**:
- `send` - 发送消息
- `getInbox` - 获取收件箱
- `getHistory` - 获取聊天历史
- `markRead` - 标记已读

**实现优先级**: P0

---

### 3. 内容服务 (content)

#### 内容页面 (`/content/rpc`)

**方法**:
- `create` - 创建内容页面
- `listContents` - 列出内容页面
- `getContent` - 获取内容页面
- `update` - 更新内容页面
- `rename` - 重命名内容页面
- `delete` - 删除内容页面

**实现优先级**: P2

---

### 4. WebSocket 服务

#### WebSocket (`/ws`)

**功能**:
- 实时消息推送
- 连接管理
- 心跳检测

**消息类型**:
- `new_message` - 新消息通知
- `e2ee_message` - E2EE 消息通知
- `relationship_update` - 关系更新通知
- `group_update` - 群组更新通知

**实现优先级**: P1

---

## 技术栈推测

### 后端框架

根据 API 响应格式和 headers 分析：
- **Web 服务器**: nginx/1.18.0 (Ubuntu)
- **应用框架**: 可能是 FastAPI/Flask (Python) 或 Express (Node.js)
- **数据库**: 关系型数据库（PostgreSQL/MySQL）

### 认证机制

1. **JWT Token**
   - 算法：RS256
   - 有效期：60 分钟
   - 颁发者：user-service

2. **DID WBA 签名**
   - 算法：ECDSA secp256k1
   - 格式：DIDWba v="1.1"
   - 用于首次认证和 JWT 刷新

### 消息存储

- **消息队列**: 可能使用 Redis/RabbitMQ
- **消息存储**: 关系型数据库
- **E2EE**: 服务端不存储明文，只存储密文

---

## 实现计划

### 阶段 1: 核心服务 (P0)

1. **DID 认证服务**
   - 实现 register 方法
   - 实现 verify 方法
   - 实现 get_me 方法
   - JWT 颁发和验证

2. **消息服务**
   - 实现 send 方法
   - 实现 getInbox 方法
   - 消息存储和检索

**预计工作量**: 40 小时

---

### 阶段 2: 基础服务 (P1)

3. **Handle 管理**
   - 实现 sendOtp 方法
   - 实现 registerHandle 方法
   - 实现 lookup 方法

4. **个人资料**
   - 实现 getProfile 方法
   - 实现 updateProfile 方法
   - 实现 resolve 方法

5. **WebSocket**
   - 实现 WebSocket 连接
   - 实现消息推送

**预计工作量**: 40 小时

---

### 阶段 3: 扩展服务 (P2)

6. **社交关系**
   - 实现 follow/unfollow
   - 实现关系查询
   - 实现群组管理

7. **内容页面**
   - 实现内容 CRUD
   - 实现内容列表

**预计工作量**: 40 小时

---

## 目录结构（计划）

```
nodejs-server/
├── src/
│   ├── index.js              # 主入口
│   ├── config/               # 配置
│   │   ├── database.js
│   │   ├── jwt.js
│   │   └── websocket.js
│   ├── services/             # 服务层
│   │   ├── user-service/
│   │   │   ├── did-auth.js
│   │   │   ├── handle.js
│   │   │   ├── profile.js
│   │   │   └── relationships.js
│   │   ├── molt-message/
│   │   │   ├── message.js
│   │   │   └── inbox.js
│   │   └── content/
│   │       └── content.js
│   ├── models/               # 数据模型
│   │   ├── User.js
│   │   ├── Message.js
│   │   ├── Relationship.js
│   │   └── Content.js
│   ├── middleware/           # 中间件
│   │   ├── auth.js
│   │   ├── jwt.js
│   │   └── validation.js
│   └── utils/                # 工具函数
│       ├── did.js
│       ├── signature.js
│       └── e2ee.js
├── tests/                    # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── migrations/               # 数据库迁移
├── package.json
└── README.md
```

---

## 数据库设计（推测）

### users 表

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    did VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID UNIQUE NOT NULL,
    handle VARCHAR(100),
    name VARCHAR(255),
    avatar TEXT,
    bio TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### messages 表

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    sender_did VARCHAR(255) NOT NULL,
    receiver_did VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,  -- E2EE 加密后的密文
    type VARCHAR(50) DEFAULT 'text',
    server_seq BIGINT AUTO_INCREMENT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### relationships 表

```sql
CREATE TABLE relationships (
    id UUID PRIMARY KEY,
    follower_did VARCHAR(255) NOT NULL,
    following_did VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_did, following_did)
);
```

---

## API 兼容性测试

实现每个服务后，使用 client 端进行测试：

```bash
# 使用 Node.js client 测试
cd ../nodejs-client
npm test -- --server http://localhost:3000

# 使用 Python client 测试
cd ../python-client/scripts
python test_server_implementation.py --server http://localhost:3000
```

---

## 开发环境

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 测试策略

### 单元测试

- 测试每个服务方法
- 测试数据模型
- 测试工具函数

### 集成测试

- 测试 API 端点
- 测试数据库操作
- 测试 WebSocket 连接

### E2E 测试

- 使用 client 端进行完整流程测试
- 测试 Python 和 Node.js client 兼容性

---

## 安全考虑

1. **JWT 验证**
   - 验证签名
   - 检查过期时间
   - 验证颁发者

2. **DID 签名验证**
   - 验证 ECDSA 签名
   - 验证时间戳
   - 验证 nonce 防止重放

3. **输入验证**
   - 验证 DID 格式
   - 验证 Handle 格式
   - 验证消息内容

4. **速率限制**
   - OTP 发送限制
   - API 调用限制
   - WebSocket 连接限制

---

## 性能优化

1. **缓存**
   - JWT 缓存
   - DID 文档缓存
   - 用户资料缓存

2. **数据库优化**
   - 索引优化
   - 查询优化
   - 连接池

3. **消息队列**
   - 异步处理消息
   - 批量处理
   - 重试机制

---

## 监控和日志

1. **日志**
   - 请求日志
   - 错误日志
   - 性能日志

2. **监控**
   - API 响应时间
   - 数据库性能
   - WebSocket 连接数

3. **告警**
   - 错误率告警
   - 性能告警
   - 资源告警

---

## 下一步行动

1. ✅ 完成服务端功能分析
2. ⏳ 创建项目骨架
3. ⏳ 实现 DID 认证服务
4. ⏳ 实现消息服务
5. ⏳ 实现 WebSocket 服务
6. ⏳ 编写测试用例
7. ⏳ 使用 client 端验证

---

**最后更新**: 2026-03-08  
**维护者**: AI Assistant  
**状态**: 📋 设计阶段
