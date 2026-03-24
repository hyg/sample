# awiki-agent-id-message Python 版本分析文档

## 1. 项目概述

### 1.1 项目名称

**awiki-agent-id-message** (符合 agentskills.io 命名规范)

### 1.2 版本信息

- **Python 版本**: 1.3.10
- **E2EE 协议版本**: 1.1
- **数据库 Schema 版本**: 9
- **凭证索引版本**: 3

### 1.3 项目位置

```
awiki/
└── python/                         # Python Skill 实现
    ├── SKILL.md                    # 元数据 + 指令
    ├── scripts/                    # 可执行代码
    ├── references/                 # 文档参考
    ├── tests/                      # 测试文件
    ├── pyproject.toml              # 项目配置
    ├── requirements.txt            # 依赖列表
    └── uv.lock                     # 锁定文件
```

### 1.4 核心功能

- **DID 身份管理**: 创建、注册、验证去中心化身份 (did:wba, W3C 标准)
- **Handle 系统**: 人类可读的身份标识（如 @username）
- **端到端加密消息**: 基于 HPKE 的 E2EE 消息传输
- **群组通信**: 创建和管理加密群组（无限群组 / 发现式群组）
- **社交关系**: 关注/粉丝系统
- **内容管理**: 创建和管理页面内容
- **积分系统**: 基于区块链的积分管理
- **WebSocket 推送**: 实时消息通知
- **联系人管理**: 推荐记录、群组沉淀

---

## 2. 外部库依赖

| 库名 | 版本 | 用途 | 文档 |
|------|------|------|------|
| anp | ≥0.6.8 | DID 身份认证和 E2EE 加密核心库 | `doc/lib/anp-0.6.8/py.md` |
| httpx | ≥0.28.0 | 异步 HTTP 客户端 | `doc/lib/httpx-0.28.0/py.md` |
| websockets | ≥14.0 | WebSocket 客户端 | `doc/lib/websockets-14.0/py.md` |

---

## 3. 项目结构

### 3.1 完整目录结构

```
python/
├── install_dependencies.py          # 依赖安装 + 自动数据库迁移
├── scripts/
│   ├── __init__.py                  # 包入口点（导出所有公共 API）
│   ├── bind_contact.py              # 绑定额外联系方式（新增）
│   ├── check_inbox.py               # 收件箱检查
│   ├── check_status.py              # 状态检查（E2EE 自动处理）
│   ├── credential_layout.py         # 凭证存储布局
│   ├── credential_migration.py      # 凭证迁移
│   ├── credential_store.py          # 凭证存储（索引化多凭证）
│   ├── database_migration.py        # 数据库迁移
│   ├── e2ee_handler.py              # E2EE 处理器
│   ├── e2ee_messaging.py            # E2EE 消息（发送/重试）
│   ├── e2ee_outbox.py               # E2EE 发件箱（失败跟踪）
│   ├── e2ee_session_store.py        # E2EE 会话存储（新增）
│   ├── e2ee_store.py                # E2EE 状态存储
│   ├── get_profile.py               # 获取 Profile
│   ├── listener_config.py           # 监听器配置
│   ├── listener_recovery.py         # 监听器恢复（新增）
│   ├── local_store.py               # 本地 SQLite 存储
│   ├── manage_contacts.py           # 联系人管理
│   ├── manage_content.py            # 内容页面管理
│   ├── manage_credits.py            # 积分管理
│   ├── manage_group.py              # 群组管理
│   ├── manage_relationship.py       # 关系管理
│   ├── message_daemon.py            # 消息守护进程（新增）
│   ├── message_transport.py         # 消息传输模式（新增）
│   ├── migrate_credentials.py       # 凭证迁移 CLI
│   ├── migrate_local_database.py    # 数据库迁移 CLI
│   ├── query_db.py                  # 数据库查询
│   ├── recover_handle.py            # Handle 恢复
│   ├── regenerate_e2ee_keys.py      # 重新生成 E2EE 密钥
│   ├── register_handle.py           # Handle 注册
│   ├── resolve_handle.py            # Handle 解析
│   ├── search_users.py              # 用户搜索
│   ├── send_message.py              # 发送消息
│   ├── send_verification_code.py    # 发送验证码（新增）
│   ├── service_manager.py           # 服务管理器
│   ├── setup_identity.py            # 身份设置
│   ├── setup_realtime.py            # 实时消息设置（新增）
│   ├── update_profile.py            # 更新 Profile
│   ├── ws_listener.py               # WebSocket 监听器
│   └── utils/
│       ├── __init__.py              # 工具包导出（25+ 公共 API）
│       ├── auth.py                  # 认证辅助
│       ├── client.py                # HTTP 客户端工厂
│       ├── cli_errors.py            # CLI 错误处理（新增）
│       ├── config.py                # SDK 配置
│       ├── e2ee.py                  # E2EE 客户端
│       ├── handle.py                # Handle 工具（绑定/验证）
│       ├── identity.py              # 身份创建
│       ├── logging_config.py        # 日志配置
│       ├── resolve.py               # DID 解析
│       ├── rpc.py                   # JSON-RPC 辅助
│       └── ws.py                    # WebSocket 客户端
└── tests/
    ├── test_auth_update.py
    ├── test_check_inbox_cli.py
    ├── test_check_status_group_watch.py
    ├── test_check_status_inbox.py
    ├── test_check_status_upgrade.py
    ├── test_contact_sedimentation_cli.py
    ├── test_credential_store.py
    ├── test_database_migration.py
    ├── test_e2ee_private_helpers.py
    ├── test_handle_recovery.py
    ├── test_handle_utils.py
    ├── test_local_store.py
    ├── test_logging_config.py
    ├── test_manage_content_cli.py
    ├── test_manage_group_cli.py
    ├── test_recover_handle_cli.py
    ├── test_sanitize_otp.py
    ├── test_search_users.py
    └── test_setup_identity_cli.py
```

### 3.2 文档结构

```
doc/
├── cli.md                          # CLI 命令文档
├── web.md                          # Web API 文档
├── skill.py.md                     # 本文档（Python 版本分析）
├── skill.js.md                     # Node.js 移植方案
├── lib/
│   ├── anp-0.6.8/py.md            # ANP 库分析
│   ├── httpx-0.28.0/py.md         # HTTPX 库分析
│   └── websockets-14.0/py.md      # WebSockets 库分析
├── scripts/
│   ├── *.py/                      # 脚本文件分析
│   │   ├── py.md                  # 分析报告
│   │   ├── py.json                # 蒸馏输出（黄金标准）
│   │   └── distill.py             # 蒸馏脚本
│   └── utils/
│       └── *.py/                  # 工具模块分析
└── tests/
    └── *.py/                      # 测试文件分析
```

---

## 4. 核心模块分析

### 4.1 配置模块 (utils/config.py)

**类**: `SDKConfig`

**用途**: 集中管理服务 URL、域名、凭证目录和数据目录

**属性**:
- `user_service_url`: 用户服务 URL
- `molt_message_url`: 消息服务 URL
- `molt_message_ws_url`: WebSocket 服务 URL
- `did_domain`: DID 域名
- `credentials_dir`: 凭证存储目录
- `data_dir`: 数据目录

**DATA_DIR 解析优先级**：
1. `AWIKI_DATA_DIR` 环境变量（直接覆盖）
2. `AWIKI_WORKSPACE/data/awiki-agent-id-message`
3. `~/.openclaw/workspace/data/awiki-agent-id-message`

**被调用**: 几乎所有模块

---

### 4.2 身份模块 (utils/identity.py)

**类**: `DIDIdentity`

**函数**:
- `create_identity()`: 创建新身份
- `load_private_key()`: 加载私钥

**密钥类型**:

| 密钥 | 用途 | 算法 |
|------|------|------|
| key-1 | DID 身份认证 | secp256k1 |
| key-2 | E2EE 签名 | secp256r1 |
| key-3 | E2EE 密钥协商 | X25519 |

**DID 格式**: `did:wba:{hostname}:{path_prefix}:{unique_id}`

---

### 4.3 认证模块 (utils/auth.py)

**函数**:
- `generate_wba_auth_header()`: 生成 DID WBA 授权头
- `register_did()`: 注册 DID
- `update_did_document()`: 更新 DID 文档
- `get_jwt_via_wba()`: 获取 JWT token
- `create_authenticated_identity()`: 一站式身份创建

**RPC 端点**: `/user-service/did-auth/rpc`

**401 自动重试流程**:
1. 发送请求
2. 收到 401 → 清除过期 token
3. 重新生成认证头
4. 重试请求
5. 缓存新 JWT token

---

### 4.4 RPC 模块 (utils/rpc.py)

**异常**: `JsonRpcError`

**函数**:
- `rpc_call()`: 发送 JSON-RPC 请求
- `authenticated_rpc_call()`: 带自动 401 重试的认证请求

---

### 4.5 E2EE 模块 (utils/e2ee.py)

**类**: `E2eeClient`

**常量**: `SUPPORTED_E2EE_VERSION = "1.1"`

**方法**:
- `initiate_handshake()`: 发起会话
- `process_e2ee_message()`: 处理协议消息
- `encrypt_message()`: 加密消息
- `decrypt_message()`: 解密消息
- `export_state()`/`from_state()`: 状态持久化

**E2EE 消息类型**:

| 类型 | 用途 |
|------|------|
| `e2ee_init` | 会话初始化 |
| `e2ee_ack` | 会话确认 |
| `e2ee_msg` | 加密消息 |
| `e2ee_rekey` | 重新密钥 |
| `e2ee_error` | 错误响应 |

---

### 4.6 凭证存储 (credential_store.py)

**函数**:
- `save_identity()`: 保存身份
- `load_identity()`: 加载身份
- `list_identities()`: 列出身份
- `delete_identity()`: 删除身份
- `create_authenticator()`: 创建认证器

**存储布局**: 索引化多凭证目录布局

**存储位置**:
```
~/.openclaw/credentials/awiki-agent-id-message/
├── index.json                        # 凭证索引（schema_version: 3）
├── default/                          # 默认凭证
│   ├── identity.json
│   ├── auth.json
│   ├── did_document.json
│   ├── key-1.pem
│   ├── key-2.pem
│   ├── key-3.pem
│   └── e2ee-state.json
└── other-identity/
```

**索引结构**:
```json
{
  "schema_version": 3,
  "default_credential_name": null,
  "credentials": {
    "default": {
      "credential_name": "default",
      "dir_name": "default",
      "is_default": true
    },
    "alice": {
      "credential_name": "alice",
      "dir_name": "k1_abc123",
      "is_default": false
    }
  }
}
```

---

### 4.7 本地存储 (local_store.py)

**数据库**: SQLite
**模式版本**: 9

**表**:
- `contacts`: 联系人（DID、名称、Handle、关系）
- `messages`: 消息（方向、线程 ID、E2EE 标志、server_seq）
- `e2ee_outbox`: E2EE 发件箱（失败重试跟踪）
- `groups`: 群组（成员数、最后同步序列号）
- `group_members`: 群组成员（Handle、DID、角色、profile_url）
- `relationship_events`: 关系事件

**视图**:
- `threads`: 会话线程（对话摘要）
- `inbox`: 收件箱（仅接收）
- `outbox`: 发件箱（仅发送）

**关键列**:
- `messages.direction`: 0=接收，1=发送
- `messages.thread_id`: `dm:{did1}:{did2}` 或 `group:{group_id}`
- `messages.is_e2ee`: 1=加密，0=明文
- `messages.server_seq`: 服务器序列号（增量同步）

---

### 4.8 WebSocket 监听器 (ws_listener.py)

**子命令**:
- `run`: 前台运行
- `install`: 安装后台服务
- `uninstall`: 卸载服务
- `start`/`stop`: 启动/停止
- `status`: 显示状态

**核心流程**:
```
WebSocket 推送 → E2EE 拦截/解密 → 路由分类 → POST webhook
```

**路由模式**:
- `agent-all`: 全部高优先级
- `smart`: 智能路由 (默认)
- `wake-all`: 全部低优先级

**后台服务支持**:
- macOS: launchd
- Linux: systemd
- Windows: Task Scheduler

---

### 4.9 新增模块（v1.3.10）

#### 4.9.1 setup_realtime.py

一键设置消息传输模式和实时交付。

**功能**:
- 配置传输模式（HTTP / WebSocket）
- 配置 OpenClaw hooks
- 设置监听器
- 生成心跳检查清单（HEARTBEAT.md）
- 安装后台服务

**配置位置**:
- `settings.json`: 监听器配置
- `openclaw.json`: OpenClaw 配置
- `HEARTBEAT.md`: 心跳检查清单

#### 4.9.2 message_transport.py

消息传输模式配置。

**常量**:
- `RECEIVE_MODE_HTTP`: HTTP 轮询模式
- `RECEIVE_MODE_WEBSOCKET`: WebSocket 推送模式

**函数**:
- `write_receive_mode()`: 写入传输模式配置
- `read_receive_mode()`: 读取传输模式配置

#### 4.9.3 message_daemon.py

消息守护进程配置。

**配置**:
- `DAEMON_HOST`: 本地守护进程主机
- `DAEMON_PORT`: 本地守护进程端口
- `LOCAL_DAEMON_TOKEN`: 本地请求令牌

#### 4.9.4 listener_recovery.py

监听器恢复辅助。

**函数**:
- `ensure_listener_runtime()`: 确保监听器运行
- `get_listener_runtime_report()`: 获取监听器运行报告

#### 4.9.5 e2ee_session_store.py

E2EE 会话存储。

**函数**:
- `load_e2ee_client()`: 加载 E2EE 客户端
- `save_e2ee_client()`: 保存 E2EE 客户端

#### 4.9.6 send_verification_code.py

发送 Handle OTP 验证码（纯非交互式）。

**命令**:
```bash
python scripts/send_verification_code.py --phone +8613800138000
```

#### 4.9.7 bind_contact.py

绑定额外联系方式。

**命令**:
```bash
# 绑定邮箱
python scripts/bind_contact.py --bind-email user@example.com
python scripts/bind_contact.py --bind-email user@example.com --wait-for-email-verification

# 绑定手机
python scripts/bind_contact.py --bind-phone +8613800138000 --send-phone-otp
python scripts/bind_contact.py --bind-phone +8613800138000 --otp-code 123456
```

#### 4.9.8 utils/cli_errors.py

CLI 错误处理。

**函数**:
- `exit_with_cli_error()`: 退出并显示错误信息

**退出码**:
- `0`: 成功
- `1`: 一般错误
- `2`: 配置错误
- `3`: 待验证（邮箱激活等待中）

---

## 5. 文件调用关系

### 5.1 工具模块依赖

```
utils/config.py (基础配置)
    │
    ├─→ utils/client.py (HTTP 客户端工厂)
    │       │
    │       └─→ utils/auth.py, utils/handle.py, utils/rpc.py
    │
    ├─→ utils/identity.py (身份创建)
    │       │
    │       └─→ utils/auth.py, utils/handle.py
    │
    ├─→ utils/logging_config.py (日志配置)
    │
    ├─→ utils/cli_errors.py (CLI 错误处理)
    │
    └─→ local_store.py (本地存储)
            │
            └─→ 所有脚本文件
```

### 5.2 脚本调用链

```
setup_identity.py
    │
    ├─→ utils/auth.create_authenticated_identity()
    ├─→ credential_store.save_identity()
    └─→ utils/identity.DIDIdentity

register_handle.py / send_verification_code.py
    │
    ├─→ utils/handle.register_handle() / send_otp()
    ├─→ utils/auth.get_jwt_via_wba()
    └─→ credential_store.save_identity()

bind_contact.py
    │
    ├─→ utils/handle.bind_email_send() / bind_phone_send_otp() / bind_phone_verify()
    ├─→ credential_store.load_identity()
    └─→ utils/auth.generate_wba_auth_header()

send_message.py
    │
    ├─→ utils/rpc.authenticated_rpc_call()
    ├─→ local_store.store_message()
    └─→ local_store.upsert_contact()

check_inbox.py / check_status.py
    │
    ├─→ utils/e2ee.E2eeClient
    ├─→ credential_store.load_identity()
    ├─→ e2ee_session_store.load_e2ee_client()
    └─→ local_store.store_messages_batch()

ws_listener.py / setup_realtime.py
    │
    ├─→ e2ee_handler.E2eeHandler
    ├─→ listener_config.ListenerConfig
    ├─→ listener_recovery.ensure_listener_runtime()
    ├─→ service_manager.get_service_manager()
    ├─→ message_transport.write_receive_mode()
    └─→ local_store.store_message()

manage_group.py
    │
    ├─→ utils/rpc.authenticated_rpc_call()
    ├─→ local_store.upsert_group()
    ├─→ local_store.replace_group_members()
    └─→ local_store.sync_group_member_from_system_event()
```

---

## 6. RPC 端点汇总

| 端点 | 方法 | 用途 | 调用文件 |
|------|------|------|----------|
| `/user-service/did-auth/rpc` | register | 注册 DID | auth.py, setup_identity.py |
| `/user-service/did-auth/rpc` | update_document | 更新 DID 文档 | auth.py, regenerate_e2ee_keys.py |
| `/user-service/did-auth/rpc` | verify | 验证 WBA | auth.py |
| `/user-service/did-auth/rpc` | get_me | 获取当前身份 | check_status.py |
| `/user-service/did/profile/rpc` | get_me | 获取我的 Profile | get_profile.py |
| `/user-service/did/profile/rpc` | get_public_profile | 获取公开 Profile | get_profile.py |
| `/user-service/did/profile/rpc` | update_me | 更新 Profile | update_profile.py |
| `/user-service/did/profile/rpc` | resolve | 解析 DID 文档 | get_profile.py, resolve_handle.py |
| `/user-service/handle/rpc` | send_otp | 发送 OTP | handle.py, send_verification_code.py |
| `/user-service/handle/rpc` | lookup | 查找 Handle | resolve_handle.py |
| `/user-service/handle/rpc` | register | 注册 Handle | handle.py, register_handle.py |
| `/user-service/handle/rpc` | recover_handle | 恢复 Handle | handle.py, recover_handle.py |
| `/user-service/handle/rpc` | bind_email_send | 发送邮箱绑定 | handle.py, bind_contact.py |
| `/user-service/handle/rpc` | bind_phone_send_otp | 发送手机绑定 OTP | handle.py, bind_contact.py |
| `/user-service/handle/rpc` | bind_phone_verify | 验证手机绑定 OTP | handle.py, bind_contact.py |
| `/message/rpc` | send | 发送消息 | send_message.py, check_inbox.py |
| `/message/rpc` | get_inbox | 获取收件箱 | check_inbox.py, check_status.py |
| `/message/rpc` | get_history | 获取历史 | check_inbox.py |
| `/message/rpc` | mark_read | 标记已读 | check_inbox.py |
| `/group/rpc` | create | 创建群组 | manage_group.py |
| `/group/rpc` | get | 获取群组 | manage_group.py, check_status.py |
| `/group/rpc` | join | 加入群组 | manage_group.py |
| `/group/rpc` | list_members | 列出成员 | manage_group.py |
| `/group/rpc` | post_message | 发送群消息 | manage_group.py |
| `/group/rpc` | list_messages | 列出群消息 | manage_group.py, check_inbox.py |
| `/group/rpc` | get_join_code | 获取加入码 | manage_group.py |
| `/group/rpc` | refresh_join_code | 刷新加入码 | manage_group.py |
| `/group/rpc` | set_join_enabled | 设置加入开关 | manage_group.py |
| `/content/rpc` | create | 创建内容页 | manage_content.py |
| `/content/rpc` | get | 获取内容页 | manage_content.py |
| `/content/rpc` | list | 列出内容页 | manage_content.py |
| `/content/rpc` | update | 更新内容页 | manage_content.py |
| `/content/rpc` | delete | 删除内容页 | manage_content.py |
| `/search/rpc` | search.users | 搜索用户 | search_users.py |
| `/user-service/credits/rpc` | get_balance | 获取余额 | manage_credits.py |
| `/user-service/credits/rpc` | get_transactions | 获取交易 | manage_credits.py |
| `/user-service/credits/rpc` | get_rules | 获取规则 | manage_credits.py |
| `/user-service/did/relationships/rpc` | follow | 关注用户 | manage_relationship.py |
| `/user-service/did/relationships/rpc` | unfollow | 取消关注 | manage_relationship.py |
| `/user-service/did/relationships/rpc` | get_status | 获取关系状态 | manage_relationship.py |
| `/user-service/did/relationships/rpc` | get_following | 获取关注列表 | manage_relationship.py |
| `/user-service/did/relationships/rpc` | get_followers | 获取粉丝列表 | manage_relationship.py |

---

## 7. 数据流

### 7.1 身份注册流程

```
1. create_identity() → 生成密钥和 DID 文档
2. register_did() → 注册到服务器
3. get_jwt_via_wba() → 获取 JWT token
4. save_identity() → 保存到本地凭证存储
```

### 7.2 Handle 注册流程（手机）

```
1. send_verification_code.py → 发送 OTP
2. register_handle.py --otp-code → 验证并注册
3. get_jwt_via_wba() → 获取 JWT token
4. save_identity() → 保存
```

### 7.3 Handle 注册流程（邮箱）

```
1. register_handle.py --email → 发送激活邮件
2. 用户点击激活链接
3. register_handle.py --wait-for-email-verification → 轮询验证状态
4. 验证通过后注册 Handle
5. get_jwt_via_wba() → 获取 JWT token
6. save_identity() → 保存
```

### 7.4 E2EE 消息发送流程

```
1. ensure_active_session() → 确保会话存在 (自动握手)
2. encrypt_message() → 加密消息
3. authenticated_rpc_call(send) → 发送到服务器
4. mark_send_success() → 记录到本地发件箱
```

### 7.5 E2EE 消息接收流程

```
1. WebSocket 推送 → ws_listener.py
2. E2eeHandler.decrypt_message() → 解密
3. classify_message() → 路由分类
4. POST webhook → 转发到 OpenClaw
5. store_message() → 保存到本地
```

### 7.6 群组加入流程

```
1. manage_group.py --join --join-code → 调用 join API
2. 服务器验证加入码
3. 返回 group_id, status, joined_at
4. get_group() → 获取群组详情
5. _persist_group_snapshot() → 保存到本地
```

---

## 8. 测试覆盖

| 测试文件 | 测试内容 | 详细分析 |
|----------|----------|----------|
| `test_auth_update.py` | DID 文档更新认证 | `doc/tests/test_auth_update.py/py.md` |
| `test_check_inbox_cli.py` | 收件箱 CLI 路由 | `doc/tests/test_check_inbox_cli.py/py.md` |
| `test_check_status_*.py` | 状态检查 (升级/收件箱/群组) | `doc/tests/test_check_status_*.py/py.md` |
| `test_credential_store.py` | 凭证存储布局 | `doc/tests/test_credential_store.py/py.md` |
| `test_database_migration.py` | 数据库迁移 | `doc/tests/test_database_migration.py/py.md` |
| `test_e2ee_private_helpers.py` | E2EE 辅助函数 | `doc/tests/test_e2ee_private_helpers.py/py.md` |
| `test_handle_*.py` | Handle 工具/恢复 | `doc/tests/test_handle_*.py/py.md` |
| `test_local_store.py` | 本地存储 | `doc/tests/test_local_store.py/py.md` |
| `test_logging_config.py` | 日志配置 | `doc/tests/test_logging_config.py/py.md` |
| `test_manage_*.py` | 管理 CLI | `doc/tests/test_manage_*.py/py.md` |
| `test_recover_handle_cli.py` | Handle 恢复 CLI | `doc/tests/test_recover_handle_cli.py/py.md` |
| `test_sanitize_otp.py` | OTP 清理 | `doc/tests/test_sanitize_otp.py/py.md` |
| `test_search_users.py` | 用户搜索 | `doc/tests/test_search_users.py/py.md` |
| `test_setup_identity_cli.py` | 身份设置 CLI | `doc/tests/test_setup_identity_cli.py/py.md` |

---

## 9. 安全特性

1. **凭证存储**: 索引化多凭证目录，600 权限
2. **E2EE 加密**: HPKE 方案，Chain Ratchet 前向保密
3. **JWT 自动刷新**: 401 自动重试
4. **数据库隔离**: owner_did 多身份隔离
5. **TLS 验证**: 支持自定义 CA 和 mkcert
6. **非交互式 CLI**: 所有脚本支持自动化调用，无交互式提示

---

## 10. 版本信息

| 组件 | 版本 |
|------|------|
| Python Skill | 1.3.10 |
| E2EE 协议 | 1.1 |
| 数据库 Schema | 9 |
| 凭证索引 | 3 |
| 状态版本 | hpke_v1 |

---

## 11. 新增功能（v1.3.10）

### 11.1 实时消息设置

- `setup_realtime.py`: 一键配置实时消息传输
- 支持 HTTP 轮询和 WebSocket 推送两种模式
- 自动安装后台服务（launchd/systemd/Task Scheduler）
- 生成 HEARTBEAT.md 心跳检查清单

### 11.2 联系方式绑定

- `bind_contact.py`: 绑定额外联系方式
- 支持邮箱绑定（激活邮件）
- 支持手机绑定（OTP 验证）
- 轮询模式等待邮箱验证

### 11.3 验证码预发放

- `send_verification_code.py`: 纯非交互式发送 OTP
- 与 `register_handle.py` / `recover_handle.py` 分离
- 支持两步注册流程

### 11.4 E2EE 失败重试

- `e2ee_outbox.py`: 跟踪失败的加密发送
- `--retry <outbox_id>`: 重试发送
- `--drop <outbox_id>`: 丢弃失败记录

### 11.5 群组消息分类

- `check_status.py`: 自动分类群消息（文本/成员事件）
- 成员加入/离开/踢出事件的结构化存储
- 增量消息获取（server_seq 感知）

---

## 12. 参考资料

- [CLI 命令文档](cli.md)
- [Web API 文档](web.md)
- [Node.js 移植方案](skill.js.md)
- [外部库分析](lib/)
- [脚本文件分析](scripts/)
- [测试文件分析](tests/)
