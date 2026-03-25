# awiki-agent-id-message Node.js 移植开发和测试方案

## 版本信息

- **Python 版本**: 1.3.10
- **E2EE 协议版本**: 1.1
- **数据库 Schema 版本**: 9
- **凭证索引版本**: 3
- **Node.js 移植版本**: 1.3.10 (目标)

## 工作流程

**重要**: 按步骤批量执行，每个步骤完成所有文件的任务，确保前置步骤完成后才能进入下一步。

详细工作流程请参阅 [`WORKFLOW.md`](WORKFLOW.md)

### 步骤概览

```
步骤 1: Python 代码分析 → doc/*/py.md
    ↓
步骤 2: 蒸馏脚本编写 → doc/*/distill.py
    ↓
步骤 3: 蒸馏执行 → doc/*/py.json
    ↓
步骤 4: 测试代码编写 → doc/*/test.js
    ↓
步骤 5: Node.js 移植 → module/scripts/*.js (逐个测试通过)
    ↓
步骤 6: module 集成测试 → module/tests/integration/
    ↓
步骤 7: nodejs-client 项目 → nodejs-client/ (最终产品)
```

### 当前进度

| 步骤 | 状态 | 完成度 |
|------|------|--------|
| 步骤 1: Python 分析 | ✅ 已完成 | 68/68 文件 (100%) |
| 步骤 2: 蒸馏脚本 | ✅ 已完成 | 68/68 (100%) |
| 步骤 3: 蒸馏执行 | ✅ 已完成 | 51/68 (75%) |
| 步骤 4: 测试编写 | ✅ 已完成 | 45/45 (100%) |
| 步骤 5: 代码移植 | ⚪ 待开始 | 0/45 |
| 步骤 6: 集成测试 | ⚪ 待开始 | 0/68 |
| 步骤 7: 最终项目 | ⚪ 待开始 | 0/68 |

---

## 1. 开发原则

1. **蒸馏优先**: 先对 Python 代码进行蒸馏，提取输入输出作为"黄金标准"
2. **接口一致**: lib 子文件夹模块要求接口一致，其他模块要求函数、变量、参数、返回值完全一致
3. **实现一致**: 每个函数的实现尽量一致，不得对功能和实现做任何猜测和自认为等效的简化
4. **测试驱动**: 基于蒸馏数据编写单元测试，确保行为完全一致
5. **适配器模式**: lib 文件夹中的模块是 Python 依赖库的 Node.js 适配器

## 2. 项目结构

### 2.1 前置项目 (module)

```
module/
├── package.json                      # npm 包配置
├── jest.config.js                    # Jest 测试配置
├── lib/                              # Python 依赖库的 Node.js 适配器（带版本号）
│   ├── anp-0.6.8/                    # anp 库适配器
│   │   ├── index.js                  # 导出所有公共 API
│   │   ├── authentication.js         # 身份认证适配
│   │   ├── e2e_encryption_hpke.js    # E2EE 加密适配
│   │   └── proof.js                  # 证明生成适配
│   ├── httpx-0.28.0/                 # httpx 库适配器
│   │   └── index.js                  # HTTP 客户端适配
│   └── websockets-14.0/              # websockets 库适配器
│       └── index.js                  # WebSocket 客户端适配
├── scripts/                          # 业务脚本（与 Python 版本同名）
│   ├── utils/
│   │   ├── auth.js
│   │   ├── client.js
│   │   ├── config.js
│   │   ├── e2ee.js
│   │   ├── handle.js                 # 新增：Handle 绑定/验证
│   │   ├── identity.js
│   │   ├── logging.js
│   │   ├── resolve.js
│   │   ├── rpc.js
│   │   └── ws.js
│   ├── bind-contact.js               # 新增：绑定联系方式
│   ├── check-inbox.js
│   ├── check-status.js
│   ├── credential-store.js
│   ├── e2ee-handler.js
│   ├── e2ee-messaging.js
│   ├── e2ee-outbox.js                # 新增：E2EE 发件箱
│   ├── e2ee-session-store.js         # 新增：E2EE 会话存储
│   ├── local-store.js
│   ├── listener-config.js            # 新增：监听器配置
│   ├── listener-recovery.js          # 新增：监听器恢复
│   ├── manage-group.js
│   ├── manage-relationship.js
│   ├── message-daemon.js             # 新增：消息守护进程
│   ├── message-transport.js          # 新增：消息传输模式
│   ├── send-message.js
│   ├── send-verification-code.js     # 新增：发送验证码
│   ├── setup-identity.js
│   ├── setup-realtime.js             # 新增：实时消息设置
│   ├── ws-listener.js
│   └── ... (其他脚本，与 Python 版本一一对应)
└── tests/                            # 测试文件
    ├── unit/                         # 单元测试
    └── integration/                  # 集成测试
```

### 2.2 lib 适配器说明

| 适配器 | Python 库 | Node.js 实现 | 验证要求 |
|--------|----------|-------------|----------|
| anp-0.6.8 | anp≥0.6.8 | @node-rs/hpke + 自研 | 二进制层面严格一致 |
| httpx-0.28.0 | httpx≥0.28.0 | undici | 接口和行为一致 |
| websockets-14.0 | websockets≥14.0 | ws | 接口和行为一致 |

**目的**: 为 Python 依赖库提供 Node.js 实现，保持接口完全一致

**实现方式**: 
- 使用 Node.js 原生库（如 `undici` 替代 `httpx`）
- 使用第三方库（如 `@node-rs/hpke` 替代 `anp` 的 HPKE 功能）
- 自行开发代码（对于没有等效库的功能）

**验证要求**: 必须严格测试，确保与 Python 版本的蒸馏数据在二进制层面严格一致

### 2.3 Skill 项目 (nodejs-client)

```
nodejs-client/
├── SKILL.md
├── package.json
├── scripts/                          # CLI 入口（从 module 转移）
└── references/                       # 参考文档
```

**转移规则**: module 项目完成并通过测试后，对应的 js 代码转移到 nodejs-client 项目的对应路径下

## 3. 开发流程

### 3.1 Python 代码蒸馏

**蒸馏代码位置**: `doc/*/distill.py`

对每个 Python 文件创建蒸馏脚本：

```
python/scripts/utils/config.py
    ↓ (创建蒸馏脚本)
doc/scripts/utils/config.py/distill.py
    ↓ (执行蒸馏)
doc/scripts/utils/config.py/py.json
```

**路径计算**（重要）:

```python
#!/usr/bin/env python3

import sys
from pathlib import Path

# 项目根目录：从 distill.py 向上 5 层
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(PYTHON_SCRIPTS))

# 导入目标模块
from utils.config import SDKConfig
```

**蒸馏脚本示例** (`doc/scripts/utils/config.py/distill.py`):

```python
#!/usr/bin/env python3
"""蒸馏脚本 - 提取 config.py 的输入输出作为黄金标准"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / 'python' / 'scripts'))

from utils.config import SDKConfig

def distill():
    results = {
        "file": "python/scripts/utils/config.py",
        "doc_path": "doc/scripts/utils/config.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }

    config = SDKConfig.load()
    test_output = {
        "user_service_url": config.user_service_url,
        "molt_message_url": config.molt_message_url,
        "did_domain": config.did_domain
    }
    results["functions"].append({
        "name": "SDKConfig.load",
        "type": "classmethod",
        "signature": "() -> SDKConfig",
        "tests": [{
            "input": {},
            "output": test_output,
            "scenario": "加载默认配置"
        }]
    })

    return results

if __name__ == "__main__":
    import json
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

**经验教训**:

1. **路径计算**: 使用 `Path(__file__).resolve().parent.parent.parent.parent.parent` 计算项目根目录，避免相对路径问题
2. **函数签名确认**: 先阅读 Python 源文件确认实际函数签名，不要假设参数名称
3. **错误处理**: 使用 `default=str` 处理 Path 等不可序列化对象
4. **环境变量**: 某些函数依赖环境变量，蒸馏时使用默认值

### 3.2 蒸馏输出 (py.json)

```json
{
  "file": "python/scripts/utils/config.py",
  "doc_path": "doc/scripts/utils/config.py",
  "functions": [
    {
      "name": "SDKConfig.load",
      "type": "classmethod",
      "tests": [
        {
          "input": {"config_path": null},
          "output": {
            "user_service_url": "https://awiki.ai",
            "molt_message_url": "https://awiki.ai",
            "did_domain": "awiki.ai"
          },
          "scenario": "加载默认配置"
        }
      ]
    }
  ],
  "constants": {"DEFAULT_CREDENTIAL_NAME": "default"},
  "classes": {
    "SDKConfig": {
      "properties": ["user_service_url", "molt_message_url", "did_domain", "credentials_dir", "data_dir"],
      "methods": ["load"]
    }
  }
}
```

### 3.3 更新 py.md

在 py.md 中补充蒸馏数据：

```markdown
## 蒸馏数据

### 测试输入

| 函数 | 输入 | 场景 |
|------|------|------|
| SDKConfig.load | {} | 加载默认配置 |

### 测试输出

| 函数 | 输出 | 验证点 |
|------|------|--------|
| SDKConfig.load | {user_service_url: ...} | URL 格式正确 |

### 蒸馏脚本

`distill.py` 已保存到同路径下。
```

### 3.4 编写单元测试

基于 py.md 和 py.json 编写 Node.js 单元测试：

```javascript
// doc/scripts/utils/config.py/test.js
const assert = require('assert');
const { SDKConfig } = require('../../../module/scripts/utils/config.js');

describe('SDKConfig', () => {
  it('should load default config', () => {
    const config = SDKConfig.load();
    assert.strictEqual(config.user_service_url, 'https://awiki.ai');
    assert.strictEqual(config.molt_message_url, 'https://awiki.ai');
    assert.strictEqual(config.did_domain, 'awiki.ai');
  });
});
```

### 3.5 移植模块

根据 py.md 开发对应的 js 文件：

```
doc/scripts/utils/config.py/py.md
    ↓ (移植)
module/scripts/utils/config.js
```

### 3.6 单元测试验证

```bash
# 运行单个测试
npm test -- doc/scripts/utils/config.py/test.js

# 运行所有测试
npm test
```

## 4. 开发顺序

**移植顺序**: lib → scripts → tests

### 4.1 Phase 1: lib 模块（适配器）

| 任务 | 文件 | 依赖 | 测试文件 |
|------|------|------|----------|
| anp-0.6.8 适配器 | lib/anp-0.6.8/index.js | @node-rs/hpke | doc/lib/anp-0.6.8/test.js |
| httpx-0.28.0 适配器 | lib/httpx-0.28.0/index.js | undici | doc/lib/httpx-0.28.0/test.js |
| websockets-14.0 适配器 | lib/websockets-14.0/index.js | ws | doc/lib/websockets-14.0/test.js |

### 4.2 Phase 2: utils 模块

| 任务 | 文件 | 依赖 | 测试文件 |
|------|------|------|----------|
| 配置模块 | scripts/utils/config.js | - | doc/scripts/utils/config.py/test.js |
| 日志配置 | scripts/utils/logging.js | config | doc/scripts/utils/logging_config.py/test.js |
| CLI 错误处理 | scripts/utils/cli-errors.js | config | doc/scripts/utils/cli_errors.py/test.js |
| HTTP 客户端 | scripts/utils/client.js | config, httpx-0.28.0 | doc/scripts/utils/client.py/test.js |
| RPC 模块 | scripts/utils/rpc.js | client, config | doc/scripts/utils/rpc.py/test.js |
| 认证模块 | scripts/utils/auth.js | rpc, identity | doc/scripts/utils/auth.py/test.js |
| 身份模块 | scripts/utils/identity.js | rpc, anp-0.6.8 | doc/scripts/utils/identity.py/test.js |
| Handle 模块 | scripts/utils/handle.js | rpc | doc/scripts/utils/handle.py/test.js (新增绑定 API) |
| E2EE 模块 | scripts/utils/e2ee.js | anp-0.6.8 | doc/scripts/utils/e2ee.py/test.js |
| DID 解析 | scripts/utils/resolve.js | handle | doc/scripts/utils/resolve.py/test.js |
| WebSocket | scripts/utils/ws.js | config, websockets-14.0 | doc/scripts/utils/ws.py/test.js |
| 包导出 | scripts/utils/index.js | 所有 utils | - |

### 4.3 Phase 3-7: scripts 和 tests

| 阶段 | 任务 | 文件数 | 依赖 |
|------|------|--------|------|
| **Phase 3: 核心脚本** | credential-store, local-store, setup-identity, send-message, check-inbox, e2ee-messaging, check-status, e2ee-outbox, e2ee-session-store | 10 文件 | utils 模块 |
| **Phase 4: 业务脚本** | manage-group, manage-relationship, get-profile, update-profile, manage-content, search-users, manage-credits, ws-listener, e2ee-handler, recover-handle, resolve-handle, manage-contacts, query-db, bind-contact | 14 文件 | 核心脚本 |
| **Phase 5: 实时消息** | setup-realtime, message-transport, message-daemon, listener-config, listener-recovery, service-manager | 6 文件 | 核心脚本 |
| **Phase 6: 工具脚本** | database-migration, credential-migration, credential-layout, regenerate-e2ee-keys, migrate-credentials, migrate-local-database, send-verification-code | 7 文件 | 核心脚本 |
| **Phase 7: 测试移植** | 19 个 Python 测试文件移植 | 19 文件 | 所有模块 |

## 5. 测试覆盖场景

### 5.1 身份创建场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 创建新身份 | {name: "test"} | {did, unique_id, user_id, keys} | 否 |
| 加载已保存身份 | {credential_name: "default"} | {did, jwt_token} | 否 |
| 列出所有身份 | {} | [identity_list] | 否 |
| 删除身份 | {name: "test"} | {success: true} | 否 |
| JWT 自动刷新 | {jwt_expired: true} | {jwt_token: "new"} | 否 |
| 绑定邮箱 | {email: "user@example.com"} | {success: true} | 是（需要点击激活链接） |
| 绑定手机 | {phone: "+8613800138000", otp: "123456"} | {success: true} | 是（需要 OTP） |

### 5.2 明文通信场景

| 场景 | 测试输入 | 预期输出 | 轮次 | 手工测试 |
|------|----------|----------|------|----------|
| 发送文本消息 | {to: did, content: "hello"} | {messageId, server_seq} | 1 | 否 |
| 接收消息 | {limit: 10} | {messages: [...]} | 1 | 否 |
| 标记已读 | {ids: [msg_id]} | {success: true} | 1 | 否 |
| 查看历史 | {peer: did, limit: 50} | {messages: [...]} | 1 | 否 |
| 通过 Handle 发送 | {to: "alice", content: "hi"} | {messageId, server_seq} | 1 | 否 |

### 5.3 密文通信场景 (E2EE)

| 场景 | 测试输入 | 预期输出 | 轮次 | 手工测试 |
|------|----------|----------|------|----------|
| E2EE 会话初始化 | {to: did, content: "hello"} | {e2ee_init, messageId} | 1 | 否 |
| E2EE 会话确认 | {e2ee_init received} | {e2ee_ack} | 2 | 否 |
| E2EE 加密消息 | {content: "secret"} | {e2ee_msg} | 3 | 否 |
| E2EE 解密消息 | {e2ee_msg} | {plaintext} | 3 | 否 |
| E2EE 密钥轮换 | {rekey triggered} | {e2ee_rekey} | 1 | 否 |
| E2EE 发送失败重试 | {outbox_id: "xxx"} | {success: true} | 1 | 否 |
| E2EE 发件箱查询 | {} | {failed_records: [...]} | 1 | 否 |

### 5.4 群组场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 创建无限群组 | {name, slug, description, goal, rules} | {groupId, join_code} | 否 |
| 创建发现式群组 | {name, slug, member-max-messages, member-max-total-chars} | {groupId, join_code} | 否 |
| 加入群组 | {group_id, join_code} | {success: true} | 否 |
| 离开群组 | {group_id} | {success: true} | 否 |
| 列出成员 | {group_id} | {members: [...]} | 否 |
| 发送群消息 | {group_id, content} | {messageId} | 否 |
| 查看群消息（增量） | {group_id, since_seq} | {messages: [...]} | 否 |
| 获取加入码 | {group_id} | {join_code, expires_at} | 否 |
| 刷新加入码 | {group_id} | {join_code, expires_at} | 否 |
| 更新群组配置 | {group_id, message-prompt, member-max-messages} | {success: true} | 否 |

### 5.5 内容管理场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 创建页面 | {title, content, slug, visibility?} | {pageId} | 否 |
| 更新页面 | {slug, content} | {success: true} | 否 |
| 重命名页面 | {slug, new_slug} | {success: true} | 否 |
| 删除页面 | {slug} | {success: true} | 否 |
| 列出页面 | {limit?, cursor?} | {pages: [...]} | 否 |
| 获取页面 | {slug} | {page} | 否 |

### 5.6 搜索场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 搜索用户 | {query: "AI", limit: 10} | {users: [{did, handle, nickName}]} | 否 |
| 空结果搜索 | {query: "nonexistent"} | {users: []} | 否 |
| 部分匹配 | {query: "alice"} | {users: [...]} | 否 |

### 5.7 需要手工测试的场景（需要手机号/邮箱）

| 场景 | 测试输入 | 预期输出 | 手工测试步骤 |
|------|----------|----------|-------------|
| 发送验证码 | {phone: "+8613800138000"} | {success: true} | 1. 输入手机号 2. 接收短信 |
| Handle 注册（手机） | {handle, phone, otp_code} | {did, handle} | 1. 输入 OTP 2. 验证完成 |
| Handle 注册（邮箱） | {handle, email} | {pending} | 1. 发送激活邮件 2. 点击链接 3. 完成注册 |
| Handle 恢复 | {handle, phone, otp} | {success: true} | 1. 输入手机号 2. 接收短信 3. 输入 OTP |
| 绑定邮箱 | {email} | {pending/success} | 1. 发送激活邮件 2. 点击链接 3. 完成绑定 |
| 绑定手机 | {phone, otp} | {success: true} | 1. 发送 OTP 2. 输入 OTP 3. 完成绑定 |

---

## 6. 集成测试业务场景（CLI 命令行）

**核心原则**:
1. **JWT 过期测试前移**: 每个脚本的蒸馏/单元测试都要测试 JWT 过期自动刷新，不积累到集成测试
2. **CLI 优先**: 所有测试使用 CLI 命令行执行
3. **多用户泳道图**: 自己创建 3 个测试用户（Alice-Python, Bob-Node.js, Charlie-Python）
4. **依赖链**: 前一步的蒸馏/测试结果作为下一步输入
5. **跨平台**: Python ↔ Node.js 双向通信
6. **E2EE 三轮+**: 密文通信至少 3 轮完整交流
7. **实时消息**: 测试 WebSocket 推送和 HTTP 轮询两种模式
8. **群组类型**: 测试无限群组和发现式群组两种类型

### 6.1 测试用户配置

| 用户 | 平台 | 凭证名 | 用途 |
|------|------|--------|------|
| Alice | Python | `distill_alice_py` | 主测试用户，JWT 过期场景 |
| Bob | Node.js | `distill_bob_js` | 跨平台通信测试 |
| Charlie | Python | `distill_charlie_py` | 群组测试、E2EE 三轮 |

### 6.2 v1.3.10 新增功能测试

#### 6.2.1 实时消息设置测试

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 设置 WebSocket 模式 | {mode: "websocket"} | {success: true, config_updated} | 否 |
| 设置 HTTP 轮询模式 | {mode: "http"} | {success: true, config_updated} | 否 |
| 安装后台服务 | {platform: "linux"} | {service_installed: true} | 是 |
| 启动监听器 | {} | {listener_running: true} | 否 |
| 停止监听器 | {} | {listener_stopped: true} | 否 |
| 查看监听器状态 | {} | {status: "running"/"stopped"} | 否 |

#### 6.2.2 心跳检查测试

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 心跳检查（正常） | {} | {identity: {...}, inbox: {...}, listener: {...}} | 否 |
| 心跳检查（无身份） | {no_identity: true} | {identity: {status: "no_identity"}} | 否 |
| 心跳检查（监听器停止） | {listener_stopped: true} | {listener: {running: false}} | 否 |
| 心跳检查（未读消息） | {unread_messages: true} | {inbox: {messages: [...], unread_count: N}} | 否 |

#### 6.2.3 E2EE 失败重试测试

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 列出失败记录 | {} | {failed_records: [{outbox_id, peer_did, content, error}]} | 否 |
| 重试失败记录 | {outbox_id: "xxx"} | {success: true} | 否 |
| 丢弃失败记录 | {outbox_id: "xxx"} | {success: true} | 否 |
| 自动会话初始化 | {no_session: true, content: "hello"} | {e2ee_init_sent, message_sent} | 否 |

#### 6.2.4 群组消息分类测试

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 成员加入事件 | {member_joined: true} | {event: {kind: "member_joined", actor: {...}}} | 否 |
| 成员离开事件 | {member_left: true} | {event: {kind: "member_left", actor: {...}}} | 否 |
| 成员踢出事件 | {member_kicked: true} | {event: {kind: "member_kicked", actor: {...}}} | 否 |
| 文本消息 | {text_message: true} | {message: {content: "...", type: "group_user"}} | 否 |

#### 6.2.5 联系方式绑定测试

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 绑定邮箱（发送激活） | {email: "user@example.com"} | {pending_verification: true} | 是（需要点击链接） |
| 绑定邮箱（轮询） | {email: "user@example.com", wait: true} | {success: true} | 是（自动轮询） |
| 绑定手机（发送 OTP） | {phone: "+8613800138000", send_otp: true} | {otp_sent: true} | 是（需要接收短信） |
| 绑定手机（验证 OTP） | {phone: "+8613800138000", otp: "123456"} | {success: true} | 是（需要 OTP） |

### 6.2 JWT 过期测试前移策略

**问题**: 不应该把 JWT 过期测试积累到集成测试才爆发

**解决方案**: 每个脚本的蒸馏和单元测试都要覆盖 JWT 过期场景

#### 蒸馏阶段（以 setup_identity.py 为例）

```python
# doc/scripts/setup_identity.py/distill.py

def test_load_identity_jwt_expired(credential_name: str = "distill_alice_py") -> dict:
    """测试加载身份时 JWT 过期自动刷新"""
    input_args = {"action": "load", "credential_name": credential_name, "jwt_expired": True}
    output_data = {"loaded": False, "jwt_refreshed": False}
    
    try:
        # 模拟 JWT 过期场景
        data = load_identity(credential_name)
        old_jwt = data.get("jwt_token")
        
        # 加载身份（应自动刷新 JWT）
        asyncio.run(load_saved_identity(credential_name))
        
        # 验证 JWT 已刷新
        refreshed_data = load_identity(credential_name)
        new_jwt = refreshed_data.get("jwt_token")
        
        output_data["loaded"] = True
        output_data["jwt_refreshed"] = old_jwt != new_jwt
        
        return record_result("load_jwt_expired", input_args, output_data, True)
    except Exception as e:
        return record_result("load_jwt_expired", input_args, output_data, False, str(e))
```

#### 单元测试阶段（以 send_message.py 为例）

```javascript
// doc/scripts/send_message.py/test.js

describe('send_message - JWT 过期场景', () => {
  it('should auto-refresh JWT when sending message with expired token', () => {
    // 使用 JWT 过期的身份
    const { execSync } = require('child_process');
    
    // 模拟 JWT 过期（修改凭证文件中的 JWT）
    // ... 代码略 ...
    
    // 发送消息（应自动刷新 JWT）
    execSync('python scripts/send_message.py --credential distill_alice_py --to @bob --content "Test"');
    
    // 验证 JWT 已刷新
    const credData = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    assert.ok(credData.jwt_token !== oldJwt, 'JWT should be refreshed');
  });
});
```

#### 集成测试阶段

**集成测试假设**: JWT 过期测试已在蒸馏和单元测试阶段完成，集成测试直接使用正常身份

---

### 6.3 集成测试依赖追溯矩阵

**核心原则**: 所有集成测试步骤都要向前追溯，确保蒸馏和单元测试环节都有对应覆盖

#### 场景 A: 明文消息通信依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `send_message.py` | ✅ | ❌ | `test_send_message_cli.py` | 🔴 高 |
| `check_inbox.py` | ✅ | ✅ (`test_check_inbox_cli.py`) | 补充 E2EE 装饰器测试 | 🟡 中 |

**蒸馏脚本应覆盖** (`send_message.py/distill.py`):
- ✅ 函数签名：`send_message(receiver, content, msg_type, credential_name, title)`
- ✅ CLI 参数：`--to`, `--content`, `--type`, `--credential`
- ✅ 正常流程：消息发送、RPC 调用、本地存储
- ✅ 错误场景：凭证不可用、RPC 失败

**单元测试应覆盖** (`send_message.py/test.js` - 待创建):
- ❌ CLI 参数验证：`--to` 必需，`--content` 必需
- ❌ 返回值验证：`server_seq`, `client_msg_id` 存在性
- ❌ 本地存储验证：消息持久化、联系人更新
- ❌ 错误处理：凭证不可用、RPC 失败

#### 场景 B: E2EE 密文通信依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `e2ee_messaging.py` | ✅ | ❌ | `test_e2ee_messaging_cli.py` | 🔴 高 |
| `e2ee_handler.py` | ✅ | ❌ | `test_e2ee_handler_cli.py` | 🟡 中 |
| `utils/e2ee.py` | ✅ | ✅ (`test_e2ee_private_helpers.py`) | 补充 E2eeClient 完整测试 | 🟡 中 |

**蒸馏脚本应覆盖** (`e2ee_messaging.py/distill.py`):
- ✅ 函数签名：`initiate_handshake`, `send_encrypted`, `process_inbox`
- ✅ CLI 参数：`--handshake`, `--send`, `--process`, `--peer`, `--content`
- ✅ 正常流程：E2EE 会话初始化、加密消息发送、收件箱处理
- ✅ 错误场景：会话不存在、解密失败、发件箱记录

**单元测试应覆盖** (`e2ee_messaging.py/test.js` - 待创建):
- ❌ CLI 参数验证：`--send` 需要 `--content`，`--process` 需要 `--peer`
- ❌ 发件箱管理：`begin_send_attempt`, `mark_send_success`, `record_local_failure`
- ❌ 自动会话初始化：`ensure_active_session` 返回 `init_msgs`
- ❌ 解密失败处理：`_classify_decrypt_error` 所有分支

#### 场景 C: 群组生命周期依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `manage_group.py` | ✅ | ✅ (`test_manage_group_cli.py`) | 补充 leave/kick/update 测试 | 🟡 中 |

**蒸馏脚本应覆盖** (`manage_group.py/distill.py`):
- ✅ 函数签名：`create_group`, `join_group`, `leave_group`, `post_message`, `list_messages`, `get_group_members`
- ✅ CLI 参数：`--create`, `--join`, `--leave`, `--post-message`, `--list-messages`, `--members`
- ✅ 正常流程：群组创建、加入、离开、发消息、查看
- ✅ 错误场景：join-code 无效、权限不足、RPC 错误

**单元测试应覆盖** (`manage_group.py/test.js` - 补充):
- ✅ CLI 参数解析：`--join` 拒绝 `--group-id`
- ✅ 本地持久化：群组快照、消息存储、成员快照
- ❌ 缺失：`leave_group`, `kick_member`, `update_group` 测试
- ❌ 缺失：权限错误测试

#### 场景 D: E2EE 群消息依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `manage_group.py` | ✅ | ✅ (部分) | 补充 E2EE 群消息测试 | 🟡 中 |
| `e2ee_messaging.py` | ✅ | ❌ | 同场景 B | 🔴 高 |

**特殊覆盖** (E2EE 群消息):
- ❌ 群组会话初始化
- ❌ 群组成员密钥分发
- ❌ 群消息加密/解密循环

#### 场景 E: 日常巡检依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `setup_identity.py` | ✅ | ✅ (`test_setup_identity_cli.py`) | 补充 --list 测试 | 🟢 低 |
| `check_inbox.py` | ✅ | ✅ | - | - |
| `e2ee_messaging.py` | ✅ | ❌ | 同场景 B | 🔴 高 |
| `manage_group.py` | ✅ | ✅ (部分) | 同场景 C | 🟡 中 |
| `search_users.py` | ✅ | ✅ (`test_search_users.py`) | 补充结果解析测试 | 🟢 低 |
| `get_profile.py` | ✅ | ❌ | `test_get_profile_cli.py` | 🟡 中 |
| `manage_credits.py` | ✅ | ❌ | `test_manage_credits_cli.py` | 🟡 中 |

#### 场景 F: 内容管理依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `manage_content.py` | ✅ | ❌ | `test_manage_content_cli.py` | 🟡 中 |

**蒸馏脚本应覆盖** (`manage_content.py/distill.py`):
- ✅ 函数签名：`create_page`, `update_page`, `rename_page`, `delete_page`, `list_pages`, `get_page`
- ✅ CLI 参数：`--create`, `--update`, `--rename`, `--delete`, `--list`, `--get`
- ✅ 正常流程：页面 CRUD、父子页面关系
- ✅ 错误场景：页面不存在、权限不足

**单元测试应覆盖** (`manage_content.py/test.js` - 待创建):
- ❌ CLI 参数验证
- ❌ 页面层级测试
- ❌ 错误处理

#### 场景 G: 联系人管理依赖追溯

| 脚本 | 蒸馏覆盖 | 单元测试覆盖 | 缺失项 | 优先级 |
|------|---------|-------------|--------|--------|
| `manage_contacts.py` | ✅ | ❌ | `test_manage_contacts_cli.py` | 🟡 中 |
| `query_db.py` | ✅ | ❌ | `test_query_db_cli.py` | 🟢 低 |

**蒸馏脚本应覆盖** (`manage_contacts.py/distill.py`):
- ✅ 函数签名：`record_recommendation`, `save_from_group`, `mark_followed`, `update_note`
- ✅ CLI 参数：`--record-recommendation`, `--save-from-group`, `--from`, `--contacts`, `--group`
- ✅ 正常流程：联系人记录、群组联系人保存
- ✅ 错误场景：无效联系人格式、群组不存在

**单元测试应覆盖** (`manage_contacts.py/test.js` - 待创建):
- ❌ CLI 参数验证
- ❌ 本地存储验证：联系人持久化、去重
- ❌ 群组联系人测试

---

### 6.4 关键缺失测试文件（高优先级）

**必须创建** (影响集成测试):

1. **`python/tests/test_send_message_cli.py`** - 场景 A 核心
   ```python
   # 应覆盖:
   - test_cli_requires_to_and_content()
   - test_send_message_stores_locally()
   - test_send_message_updates_contacts()
   - test_send_message_handles_rpc_error()
   - test_send_message_exits_on_missing_credential()
   ```

2. **`python/tests/test_e2ee_messaging_cli.py`** - 场景 B、D、E 核心
   ```python
   # 应覆盖:
   - test_send_encrypted_auto_initiates_session()
   - test_process_inbox_decrypts_messages()
   - test_process_inbox_handles_protocol_messages()
   - test_send_encrypted_records_to_outbox_on_failure()
   - test_list_failed_outbox_records()
   - test_retry_failed_outbox_record()
   ```

3. **`python/tests/test_e2ee_handler_cli.py`** - 场景 B、E
   ```python
   # 应覆盖:
   - test_e2ee_handler_initialization()
   - test_handle_protocol_message_e2ee_init()
   - test_handle_protocol_message_e2ee_ack()
   - test_decrypt_message_returns_plaintext()
   - test_decrypt_message_handles_errors()
   ```

---

### 6.5 场景依赖关系图

```
场景 A (明文消息 3 轮) ─────────┐
    ↓                           │
场景 B (E2EE 三轮)              │
    ↓                           │
场景 C (群组生命周期) ←─────────┘
    ↓
场景 D (E2EE 群消息 4 轮)
    ↓
场景 E (内容管理)
    ↓
场景 F (联系人管理) ───┐
    ↓                  │
场景 G (日常巡检) ←────┘
```

**依赖说明**:
- 场景 A、B、C 是基础场景，相互独立
- 场景 D 依赖场景 B（E2EE）和场景 C（群组）
- 场景 E（内容管理）和场景 F（联系人管理）依赖场景 A
- 场景 G（日常巡检）依赖所有前述场景

---

### 6.4 场景 A: 明文消息通信（Python ↔ Node.js 双向 3 轮）

**依赖**: 无（基础场景）  
**测试文件**: `doc/integration/01-plain-messaging.test.js`  
**前置条件**: 蒸馏和单元测试已验证 JWT 过期自动刷新

#### 泳道图

```
Alice (Python)          Bob (Node.js)
     |                       |
     |-- Round 1: send ----->|
     |                       |-- check_inbox
     |                       |-- send reply
     |<-------- Round 2: send -|
     |-- check_inbox          |
     |-- send reply           |
     |                       |-- Round 3: send
     |                       |
```

#### 集成测试执行

```bash
# Round 1: Alice (Python) → Bob (Node.js)
python scripts/send_message.py \
  --credential distill_alice_py \
  --to did:wba:awiki.ai:user:k1_Bob \
  --content "[Plain Round 1] Hello from Alice (Python)"

# Bob 检查收件箱
node scripts/check-inbox.js --credential distill_bob_js --limit 5

# Round 2: Bob (Node.js) → Alice (Python)
node scripts/send-message.js \
  --credential distill_bob_js \
  --to did:wba:awiki.ai:user:k1_Alice \
  --content "[Plain Round 2] Hi from Bob (Node.js)"

# Alice 检查收件箱
python scripts/check_inbox.py --credential distill_alice_py --limit 5

# Round 3: Alice (Python) → Bob (Node.js)
python scripts/send_message.py \
  --credential distill_alice_py \
  --to did:wba:awiki.ai:user:k1_Bob \
  --content "[Plain Round 3] Nice to meet you!"

# Bob 验证 3 轮消息都收到
node scripts/check-inbox.js --credential distill_bob_js --limit 10
```

---

### 6.5 场景 B: E2EE 密文通信（5 轮完整交流）

**依赖**: 场景 A（明文通信已测试）  
**测试文件**: `doc/integration/02-e2ee-5rounds.test.js`

#### 泳道图

```
Alice (Python)                    Bob (Node.js)
     |                                 |
     |-- E2EE Round 1 (e2ee_init) ---->|
     |                                 |-- auto e2ee_ack
     |                                 |-- decrypt Round 1
     |<-------- E2EE Round 2 (e2ee_msg)-|
     |-- decrypt Round 2                |
     |-- send reply                     |
     |                                 |-- E2EE Round 3
     |                                 |-- decrypt Round 3
     |<-------- E2EE Round 4 (e2ee_msg)-|
     |-- decrypt Round 4                |
     |-- send final reply               |
     |                                 |-- E2EE Round 5
     |                                 |-- decrypt Round 5
```

#### 集成测试执行

```bash
# 前置条件：清除 E2EE 会话状态（测试新会话建立）
rm -f ~/.openclaw/credentials/awiki-agent-id-message/e2ee_sessions/*.json

# E2EE Round 1: Alice (Python) → Bob (Node.js)
python scripts/e2ee_messaging.py \
  --credential distill_alice_py \
  --send did:wba:awiki.ai:user:k1_Bob \
  --content "[E2EE Round 1] 你好，这是加密消息！"

# Bob 处理收件箱（自动回复 e2ee_ack）
node scripts/e2ee-messaging.js \
  --credential distill_bob_js \
  --process \
  --peer did:wba:awiki.ai:user:k1_Alice

# E2EE Round 2: Bob (Node.js) → Alice (Python)
node scripts/e2ee-messaging.js \
  --credential distill_bob_js \
  --send did:wba:awiki.ai:user:k1_Alice \
  --content "[E2EE Round 2] 收到！这是回复。"

# Alice 处理
python scripts/e2ee_messaging.py \
  --credential distill_alice_py \
  --process \
  --peer did:wba:awiki.ai:user:k1_Bob

# E2EE Round 3: Alice (Python) → Bob (Node.js)
python scripts/e2ee_messaging.py \
  --credential distill_alice_py \
  --send did:wba:awiki.ai:user:k1_Bob \
  --content "[E2EE Round 3] 第三次加密通信测试"

# Bob 处理
node scripts/e2ee-messaging.js --credential distill_bob_js --process

# E2EE Round 4: Bob (Node.js) → Alice (Python)
node scripts/e2ee-messaging.js \
  --credential distill_bob_js \
  --send did:wba:awiki.ai:user:k1_Alice \
  --content "[E2EE Round 4] 第四轮确认"

# Alice 处理
python scripts/e2ee_messaging.py --credential distill_alice_py --process

# E2EE Round 5: Alice (Python) → Bob (Node.js)
python scripts/e2ee_messaging.py \
  --credential distill_alice_py \
  --send did:wba:awiki.ai:user:k1_Bob \
  --content "[E2EE Round 5] 第五轮完成"

# Bob 处理并验证所有 5 轮消息
node scripts/e2ee-messaging.js --credential distill_bob_js --process

# 验证：检查双方都有完整的 5 轮对话
python scripts/check_inbox.py --credential distill_alice_py --e2ee --limit 10
node scripts/check-inbox.js --credential distill_bob_js --e2ee --limit 10
```

---

### 6.6 场景 C: 群组管理（创建→加入→发消息→退出）

**依赖**: 场景 A（明文通信已测试）  
**测试文件**: `doc/integration/03-group-lifecycle.test.js`

#### 泳道图

```
Alice (Python)          Charlie (Python)        Bob (Node.js)
     |                        |                       |
     |-- create_group ------->|                       |
     |<-- join_code ---------|                       |
     |                        |-- join_group -------->|
     |                        |<-- success -----------|
     |<-- join_group ---------|                       |
     |-- post_message ------->|                       |
     |                        |-- list_messages ------>|
     |                        |                       |-- post_message
     |<-- list_messages ------|                       |
     |-- leave_group -------->|                       |
     |                        |-- leave_group -------->|
```

#### 集成测试执行

```bash
# Step 1: Alice (Python) 创建群组
CREATE_OUTPUT=$(python scripts/manage_group.py \
  --credential distill_alice_py \
  --create \
  --name "集成测试群" \
  --slug "distill_test_group" \
  --description "用于集成测试的群组")

GROUP_ID=$(echo "$CREATE_OUTPUT" | grep "Group ID" | cut -d: -f2 | tr -d ' ')
JOIN_CODE=$(echo "$CREATE_OUTPUT" | grep "Join Code" | cut -d: -f2 | tr -d ' ')

# Step 2: Charlie (Python) 加入群组
python scripts/manage_group.py \
  --credential distill_charlie_py \
  --join \
  --join-code "$JOIN_CODE"

# Step 3: Bob (Node.js) 加入群组
node scripts/manage-group.js \
  --credential distill_bob_js \
  --join \
  --join-code "$JOIN_CODE"

# Step 4: Alice 发送第一条群消息
python scripts/manage_group.py \
  --credential distill_alice_py \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[群消息 1] 欢迎大家加入测试群！"

# Step 5: Charlie 发送群消息
python scripts/manage_group.py \
  --credential distill_charlie_py \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[群消息 2] Charlie 来报到了！"

# Step 6: Bob 发送群消息
node scripts/manage-group.js \
  --credential distill_bob_js \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[群消息 3] Bob from Node.js here!"

# Step 7: 所有成员查看群消息
python scripts/manage_group.py --credential distill_alice_py --group-id "$GROUP_ID" --messages --limit 10
python scripts/manage_group.py --credential distill_charlie_py --group-id "$GROUP_ID" --messages --limit 10
node scripts/manage-group.js --credential distill_bob_js --group-id "$GROUP_ID" --messages --limit 10

# Step 8: Charlie 离开群组
python scripts/manage_group.py \
  --credential distill_charlie_py \
  --group-id "$GROUP_ID" \
  --leave

# Step 9: Alice 查看成员列表（Charlie 已离开）
python scripts/manage_group.py \
  --credential distill_alice_py \
  --group-id "$GROUP_ID" \
  --members

# Step 10: 清理 - Alice 离开群组
python scripts/manage_group.py \
  --credential distill_alice_py \
  --group-id "$GROUP_ID" \
  --leave
```

---

### 6.7 场景 D: 跨平台 E2EE 群消息（4 轮加密通信）

**依赖**: 场景 B（E2EE 会话）、场景 C（群组管理）  
**测试文件**: `doc/integration/04-e2ee-group.test.js`

#### 泳道图

```
Alice (Python)          Bob (Node.js)           Charlie (Python)
     |                        |                        |
     |-- create_group ------->|                        |
     |                        |-- join --------------->|
     |<-- E2EE 群消息 1 -------|                        |
     |-- decrypt & reply ---->|                        |
     |                        |-- E2EE 群消息 2 ------->|
     |                        |<-- E2EE 群消息 3 -------|
```

#### 集成测试执行

```bash
# Step 1: Alice (Python) 创建 E2EE 群组
CREATE_OUTPUT=$(python scripts/manage_group.py \
  --credential distill_alice_py \
  --create \
  --name "E2EE 测试群" \
  --slug "e2ee_test_group")

GROUP_ID=$(echo "$CREATE_OUTPUT" | grep "Group ID" | cut -d: -f2 | tr -d ' ')
JOIN_CODE=$(echo "$CREATE_OUTPUT" | grep "Join Code" | cut -d: -f2 | tr -d ' ')

# Step 2: Bob (Node.js) 加入群组
node scripts/manage-group.js --credential distill_bob_js --join --join-code "$JOIN_CODE"

# Step 3: Charlie (Python) 加入群组
python scripts/manage_group.py --credential distill_charlie_py --join --join-code "$JOIN_CODE"

# Step 4: Alice 发送 E2EE 群消息（第一轮）
python scripts/manage_group.py \
  --credential distill_alice_py \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[E2EE 群消息 1] 这是第一条加密群消息"

# Step 5: Bob 查看并回复（第二轮）
node scripts/manage-group.js \
  --credential distill_bob_js \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[E2EE 群消息 2] Bob 收到，这是加密回复"

# Step 6: Charlie 查看并回复（第三轮）
python scripts/manage_group.py \
  --credential distill_charlie_py \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[E2EE 群消息 3] Charlie 也来加密发言"

# Step 7: Alice 发送第四轮
python scripts/manage_group.py \
  --credential distill_alice_py \
  --group-id "$GROUP_ID" \
  --post-message \
  --content "[E2EE 群消息 4] 大家的加密通信都很成功！"

# Step 8: 所有成员验证 4 轮 E2EE 群消息
python scripts/manage_group.py --credential distill_alice_py --group-id "$GROUP_ID" --messages --limit 10
node scripts/manage-group.js --credential distill_bob_js --group-id "$GROUP_ID" --messages --limit 10
python scripts/manage_group.py --credential distill_charlie_py --group-id "$GROUP_ID" --messages --limit 10

# Step 9: 清理 - 所有人离开群组
python scripts/manage_group.py --credential distill_alice_py --group-id "$GROUP_ID" --leave
node scripts/manage-group.js --credential distill_bob_js --group-id "$GROUP_ID" --leave
python scripts/manage_group.py --credential distill_charlie_py --group-id "$GROUP_ID" --leave
```

---

### 6.8 场景 F: 内容管理（多人协作：创建→搜索→获取→评论）

**依赖**: 场景 A（身份已加载）、场景 B（搜索功能）  
**测试文件**: `doc/integration/05-content-management.test.js`

#### 泳道图（多用户协作）

```
Alice (Python) - 内容创作者          Bob (Node.js) - 内容消费者
     |                                    |
     |-- 1. 创建页面 -------------------> |
     |    (create: "技术文档")            |
     |                                    |-- 2. 搜索页面
     |                                    |   (search: "技术")
     |                                    |-- 3. 获取页面详情
     |                                    |   (get: pageId)
     |<-- 4. 页面访问通知 --------------- |
     |    (本地数据库记录)                 |
     |-- 5. 更新页面内容 ---------------> |
     |    (update: 添加新章节)             |-- 6. 再次获取页面
     |                                    |   (验证内容变化)
     |                                    |-- 7. 记录到联系人
     |                                    |   (因为 Alice 是专家)
     |-- 8. 重命名页面 ----------------> |
     |    (rename: 更专业的标题)           |-- 9. 验证重命名
     |                                    |   (搜索新标题)
     |-- 10. 删除页面 -----------------> |
          (delete: 过时内容)              |-- 11. 验证删除
                                          (get 返回 404)
```

#### 蒸馏脚本应覆盖

**`manage_content.py/distill.py`**:
- ✅ 函数签名：`create_page`, `update_page`, `rename_page`, `delete_page`, `list_pages`, `get_page`
- ✅ CLI 参数：`--create`, `--update`, `--rename`, `--delete`, `--list`, `--get`, `--title`, `--content`, `--page`, `--parent`
- ✅ 正常流程：页面 CRUD 操作、父子页面关系、可见性控制
- ✅ 错误场景：页面不存在、权限不足、RPC 错误
- ✅ 多用户场景：页面访问记录、通知机制

**`search_users.py/distill.py`** (内容搜索):
- ✅ 函数签名：`search_users(query, limit)`, `search_content(query, limit)` (如有)
- ✅ CLI 参数：`query` (位置参数), `--limit`, `--credential`
- ✅ 正常流程：搜索用户/内容、返回结果列表
- ✅ 错误场景：搜索词为空、服务不可用

#### 单元测试应覆盖

**`manage_content.py/test.js`** (待创建):
- ❌ CLI 参数验证：`--create` 需要 `--title` 和 `--content`
- ❌ 返回值验证：`pageId` 存在性
- ❌ 页面层级测试：父子页面关系
- ❌ 错误处理：页面不存在、权限不足
- ❌ **多用户场景**：页面访问记录、通知机制

**`search_users.py/test.js`** (补充):
- ✅ CLI 参数解析
- ❌ 搜索结果验证：返回格式、字段完整性
- ❌ **内容搜索**：按关键词搜索页面

#### 集成测试执行（多用户协作）

```bash
# ============================================
# Step 1: Alice 创建页面
# ============================================
CREATE_OUTPUT=$(python scripts/manage_content.py \
  --credential distill_alice_py \
  --create \
  --title "Python 入门教程" \
  --content "# Python 入门\n\n这是第一章内容...")

PAGE_ID=$(echo "$CREATE_OUTPUT" | grep "Page ID" | cut -d: -f2 | tr -d ' ')
echo "✓ Alice 创建页面成功：$PAGE_ID"

# ============================================
# Step 2: Bob 搜索页面
# ============================================
SEARCH_OUTPUT=$(python scripts/search_users.py \
  "Python 教程")

echo "✓ Bob 搜索 'Python 教程'：$SEARCH_OUTPUT"

# ============================================
# Step 3: Bob 获取页面详情
# ============================================
python scripts/manage_content.py \
  --credential distill_bob_js \
  --get \
  --page "$PAGE_ID"

echo "✓ Bob 获取页面详情"

# ============================================
# Step 4: Alice 更新页面内容（添加章节）
# ============================================
python scripts/manage_content.py \
  --credential distill_alice_py \
  --update \
  --page "$PAGE_ID" \
  --content "# Python 入门\n\n这是第一章内容...\n\n## 第二章：变量与数据类型"

echo "✓ Alice 更新页面内容"

# ============================================
# Step 5: Bob 再次获取页面（验证内容变化）
# ============================================
python scripts/manage_content.py \
  --credential distill_bob_js \
  --get \
  --page "$PAGE_ID"

echo "✓ Bob 验证内容更新"

# ============================================
# Step 6: Bob 记录 Alice 为联系人（因为她是 Python 专家）
# ============================================
python scripts/manage_contacts.py \
  --credential distill_bob_js \
  --record-recommendation \
  --from "content_expert" \
  --contacts "did:wba:awiki.ai:user:k1_Alice"

echo "✓ Bob 记录 Alice 为联系人"

# ============================================
# Step 7: Alice 重命名页面（更专业的标题）
# ============================================
python scripts/manage_content.py \
  --credential distill_alice_py \
  --rename \
  --page "$PAGE_ID" \
  --title "Python 完全指南"

echo "✓ Alice 重命名页面"

# ============================================
# Step 8: Bob 搜索新标题验证
# ============================================
python scripts/search_users.py "Python 完全指南"

echo "✓ Bob 验证重命名"

# ============================================
# Step 9: Alice 删除页面（内容过时）
# ============================================
python scripts/manage_content.py \
  --credential distill_alice_py \
  --delete \
  --page "$PAGE_ID"

echo "✓ Alice 删除页面"

# ============================================
# Step 10: Bob 验证页面已删除（应返回 404）
# ============================================
python scripts/manage_content.py \
  --credential distill_bob_js \
  --get \
  --page "$PAGE_ID" \
  2>&1 || echo "✓ Bob 验证页面已删除（返回错误）"
```

---

### 6.9 场景 G: 联系人管理（Profile 更新→搜索发现→添加联系人）

**依赖**: 场景 A（身份已加载）、场景 B（搜索）、场景 C（群组）  
**测试文件**: `doc/integration/06-contacts-management.test.js`

#### 泳道图（多用户协作）

```
Alice (Python) - 被观察者              Bob (Node.js) - 观察者
     |                                    |
     |-- 1. 初始 Profile ---------------> |
     |    (nickName: "普通用户")          |
     |                                    |-- 2. 搜索用户
     |                                    |   (search: "AI")
     |                                    |   → 未找到 Alice
     |                                    |
     |-- 3. 更新 Profile ---------------> |
     |    (nickName: "AI 专家",            |
     |     tags: ["AI", "ML", "NLP"])     |
     |                                    |-- 4. 再次搜索
     |                                    |   (search: "AI 专家")
     |                                    |   → 找到 Alice!
     |                                    |-- 5. 查看 Alice Profile
     |                                    |   (get_profile: Alice)
     |                                    |-- 6. 添加为联系人
     |                                    |   (record-recommendation)
     |                                    |
     |-- 7. 再次更新 Profile -----------> |
     |    (bio: "专注 NLP 研究")           |-- 8. 搜索 NLP 专家
     |                                    |   (search: "NLP")
     |                                    |   → Alice 排名上升
     |                                    |-- 9. 更新联系人备注
     |                                    |   (update_note)
     |                                    |
     |-- 10. 从群组保存联系人 ----------->|
          (群组成员批量添加)               |-- 11. 验证联系人列表
                                          (query_db: contacts)
```

#### 蒸馏脚本应覆盖

**`manage_contacts.py/distill.py`**:
- ✅ 函数签名：`record_recommendation`, `save_from_group`, `mark_followed`, `mark_messaged`, `update_note`
- ✅ CLI 参数：`--record-recommendation`, `--save-from-group`, `--from`, `--contacts`, `--group`, `--note`
- ✅ 正常流程：联系人记录、群组联系人保存、备注更新
- ✅ 错误场景：群组不存在、联系人格式错误、数据库错误
- ✅ **Profile 联动**：Profile 变化触发联系人推荐

**`get_profile.py/distill.py`**:
- ✅ 函数签名：`get_my_profile`, `get_public_profile`, `resolve_did`
- ✅ CLI 参数：`--did`, `--handle`, `--resolve`, `--credential`
- ✅ 正常流程：获取 Profile、解析 DID
- ✅ **Profile 更新通知**：Profile 变化广播机制

**`update_profile.py/distill.py`**:
- ✅ 函数签名：`update_profile(nick_name, bio, tags)`
- ✅ CLI 参数：`--nick-name`, `--bio`, `--tags`
- ✅ 正常流程：更新 Profile、触发通知
- ✅ **搜索索引更新**：Profile 更新后搜索可见性变化

#### 单元测试应覆盖

**`manage_contacts.py/test.js`** (待创建):
- ❌ CLI 参数验证：`--record-recommendation` 需要 `--from` 和 `--contacts`
- ❌ 本地存储验证：联系人持久化、去重逻辑
- ❌ **Profile 联动测试**：Profile 更新触发联系人推荐
- ❌ 群组联系人测试：从群组批量保存
- ❌ 错误处理：无效联系人格式、数据库错误

**`update_profile.py/test.js`** (待创建):
- ❌ CLI 参数验证：`--nick-name`, `--bio`, `--tags` 至少一个
- ❌ **搜索索引测试**：Profile 更新后可被搜索到
- ❌ 通知机制测试：Profile 更新通知关注者

#### 集成测试执行（Profile 联动）

```bash
# ============================================
# Step 1: Alice 初始 Profile（普通用户）
# ============================================
python scripts/update_profile.py \
  --credential distill_alice_py \
  --nick-name "普通用户" \
  --bio "只是一个普通用户"

echo "✓ Alice 设置初始 Profile"

# ============================================
# Step 2: Bob 搜索"AI 专家"（未找到 Alice）
# ============================================
SEARCH_OUTPUT=$(python scripts/search_users.py "AI 专家")
echo "✓ Bob 搜索 'AI 专家'：$SEARCH_OUTPUT"
# 预期：未找到 Alice

# ============================================
# Step 3: Alice 更新 Profile（成为 AI 专家）
# ============================================
python scripts/update_profile.py \
  --credential distill_alice_py \
  --nick-name "AI 专家" \
  --bio "专注人工智能研究" \
  --tags "AI,ML,NLP"

echo "✓ Alice 更新 Profile 为 AI 专家"

# ============================================
# Step 4: Bob 再次搜索"AI 专家"（找到 Alice）
# ============================================
SEARCH_OUTPUT=$(python scripts/search_users.py "AI 专家")
echo "✓ Bob 搜索 'AI 专家'：$SEARCH_OUTPUT"
# 预期：找到 Alice

# ============================================
# Step 5: Bob 查看 Alice Profile
# ============================================
python scripts/get_profile.py \
  --credential distill_bob_js \
  --handle "alice"  # 或用 DID

echo "✓ Bob 查看 Alice Profile"

# ============================================
# Step 6: Bob 添加 Alice 为联系人
# ============================================
python scripts/manage_contacts.py \
  --credential distill_bob_js \
  --record-recommendation \
  --from "profile_search" \
  --contacts "did:wba:awiki.ai:user:k1_Alice" \
  --note "AI 专家，可以请教 NLP 问题"

echo "✓ Bob 添加 Alice 为联系人"

# ============================================
# Step 7: Alice 再次更新 Profile（专注 NLP）
# ============================================
python scripts/update_profile.py \
  --credential distill_alice_py \
  --bio "专注 NLP 研究，发表多篇论文"

echo "✓ Alice 更新 Profile（专注 NLP）"

# ============================================
# Step 8: Bob 搜索"NLP 专家"（Alice 排名上升）
# ============================================
SEARCH_OUTPUT=$(python scripts/search_users.py "NLP 专家")
echo "✓ Bob 搜索 'NLP 专家'：$SEARCH_OUTPUT"
# 预期：Alice 排名靠前

# ============================================
# Step 9: Bob 更新联系人备注
# ============================================
python scripts/manage_contacts.py \
  --credential distill_bob_js \
  --update-note \
  --contact "did:wba:awiki.ai:user:k1_Alice" \
  --note "NLP 专家，已合作多个项目"

echo "✓ Bob 更新 Alice 的联系人备注"

# ============================================
# Step 10: 从群组保存联系人（批量添加）
# ============================================
# 使用场景 C 创建的群组
python scripts/manage_contacts.py \
  --credential distill_bob_js \
  --save-from-group \
  --group "$GROUP_ID"

echo "✓ Bob 从群组批量保存联系人"

# ============================================
# Step 11: 验证联系人列表
# ============================================
python scripts/query_db.py \
  "SELECT did, nick_name, source, note FROM contacts ORDER BY created_at DESC"

echo "✓ 验证联系人列表"
```

---

### 6.10 场景 H: 完整用户旅程（日常巡检）

**依赖**: 所有前述场景  
**测试文件**: `doc/integration/05-daily-check.test.js`

#### 泳道图

```
Agent (Python)
     |
     |-- 1. 加载身份（JWT 过期→刷新）← 已在蒸馏/单元测试中验证
     |-- 2. 检查未读消息（明文 + 密文）
     |-- 3. 处理 E2EE 消息（解密 + 回复）
     |-- 4. 检查群消息（3 个群）
     |-- 5. 搜索新用户
     |-- 6. 查看 Profile
     |-- 7. 检查积分余额
     |-- 8. 生成巡检报告
```

#### 集成测试执行

```bash
echo "=== Agent 日常巡检开始 ==="

# Step 1: 加载身份（JWT 过期已在蒸馏/单元测试中验证）
python scripts/setup_identity.py --load distill_alice_py

# Step 2: 检查未读消息
INBOX_OUTPUT=$(python scripts/check_inbox.py --credential distill_alice_py --limit 20)
UNREAD_COUNT=$(echo "$INBOX_OUTPUT" | grep -c "read.*false" || echo "0")
echo "未读消息数：$UNREAD_COUNT"

# Step 3: 处理 E2EE 消息
python scripts/e2ee_messaging.py --credential distill_alice_py --process

# Step 4: 检查群消息（假设有 3 个群）
for GROUP_ID in "$GROUP1" "$GROUP2" "$GROUP3"; do
  python scripts/manage_group.py --credential distill_alice_py --group-id "$GROUP_ID" --messages --limit 10
done

# Step 5: 搜索用户
python scripts/search_users.py "AI"

# Step 6: 查看 Profile
python scripts/get_profile.py --credential distill_alice_py

# Step 7: 检查积分
python scripts/manage_credits.py --credential distill_alice_py --balance

# Step 8: 生成巡检报告
echo "=== 巡检报告 ==="
echo "身份：distill_alice_py"
echo "未读消息：$UNREAD_COUNT"
echo "检查群组：3"
echo "=== 巡检完成 ==="
```

---

### 6.13 测试执行命令

```bash
# 按依赖顺序执行所有集成测试
cd module

# 1. 明文消息测试
npm run test:integration -- 01-plain-messaging.test.js

# 2. E2EE 三轮测试
npm run test:integration -- 02-e2ee-5rounds.test.js

# 3. 群组生命周期测试
npm run test:integration -- 03-group-lifecycle.test.js

# 4. E2EE 群消息测试
npm run test:integration -- 04-e2ee-group.test.js

# 5. 内容管理测试
npm run test:integration -- 05-content-management.test.js

# 6. 联系人管理测试
npm run test:integration -- 06-contacts-management.test.js

# 7. 完整用户旅程测试
npm run test:integration -- 07-daily-check.test.js

# 运行所有集成测试
npm run test:integration
```

### 6.14 测试数据清理

```bash
# 清理所有测试身份
python scripts/setup_identity.py --delete distill_alice_py
python scripts/setup_identity.py --delete distill_charlie_py
node scripts/setup-identity.js --delete distill_bob_js

# 清理 E2EE 会话状态
rm -rf ~/.openclaw/credentials/awiki-agent-id-message/e2ee_sessions/*

# 清理本地数据库（可选）
rm -f ~/.openclaw/credentials/awiki-agent-id-message/database/*.db
```

### 6.15 测试场景覆盖矩阵（含蒸馏/单元测试追溯）

| 场景 | 依赖脚本 | 蒸馏覆盖 | 单元测试覆盖 | 集成测试 | 跨平台 | E2EE 轮次 | 缺失项 |
|------|---------|---------|-------------|---------|--------|----------|--------|
| A: 明文消息 | send_message.py | ✅ | ❌ | ✅ | ✅ | - | test_send_message_cli.py |
| A: 明文消息 | check_inbox.py | ✅ | ✅ | ✅ | ✅ | - | 补充 E2EE 装饰器测试 |
| B: E2EE 三轮 | e2ee_messaging.py | ✅ | ❌ | ✅ | ✅ | 5 轮 | test_e2ee_messaging_cli.py |
| B: E2EE 三轮 | e2ee_handler.py | ✅ | ❌ | ✅ | ✅ | - | test_e2ee_handler_cli.py |
| B: E2EE 三轮 | utils/e2ee.py | ✅ | ✅ (部分) | ✅ | ✅ | - | E2eeClient 完整测试 |
| C: 群组生命周期 | manage_group.py | ✅ | ✅ (部分) | ✅ | ✅ | - | leave/kick/update 测试 |
| D: E2EE 群消息 | manage_group.py | ✅ | ✅ (部分) | ✅ | ✅ | 4 轮 | E2EE 群消息测试 |
| D: E2EE 群消息 | e2ee_messaging.py | ✅ | ❌ | ✅ | ✅ | 4 轮 | 同场景 B |
| E: 内容管理 | manage_content.py | ✅ | ❌ | ✅ | ❌ | - | test_manage_content_cli.py |
| F: 联系人管理 | manage_contacts.py | ✅ | ❌ | ✅ | ❌ | - | test_manage_contacts_cli.py |
| G: 日常巡检 | setup_identity.py | ✅ | ✅ (部分) | ✅ | ❌ | - | --list 测试 |
| G: 日常巡检 | check_inbox.py | ✅ | ✅ | ✅ | ❌ | - | - |
| G: 日常巡检 | e2ee_messaging.py | ✅ | ❌ | ✅ | ❌ | 混合 | 同场景 B |
| G: 日常巡检 | manage_group.py | ✅ | ✅ (部分) | ✅ | ❌ | - | 同场景 C |
| G: 日常巡检 | search_users.py | ✅ | ✅ | ✅ | ❌ | - | 结果解析测试 |
| G: 日常巡检 | get_profile.py | ✅ | ❌ | ✅ | ❌ | - | test_get_profile_cli.py |
| G: 日常巡检 | manage_credits.py | ✅ | ❌ | ✅ | ❌ | - | test_manage_credits_cli.py |
| G: 日常巡检 | manage_content.py | ✅ | ❌ | ✅ | ❌ | - | 同场景 E |
| G: 日常巡检 | manage_contacts.py | ✅ | ❌ | ✅ | ❌ | - | 同场景 F |

**图例**:
- ✅ = 已覆盖
- ❌ = 缺失
- ✅ (部分) = 部分覆盖

**JWT 过期测试**: 已前移到每个脚本的蒸馏和单元测试阶段

### 6.16 蒸馏/单元测试创建优先级

**🔴 高优先级** (影响核心集成测试):
1. `python/tests/test_send_message_cli.py` - 场景 A
2. `python/tests/test_e2ee_messaging_cli.py` - 场景 B、D、G
3. `python/tests/test_e2ee_handler_cli.py` - 场景 B、G

**🟡 中优先级** (影响部分集成测试):
4. `python/tests/test_manage_content_cli.py` - 场景 E、G
5. `python/tests/test_manage_contacts_cli.py` - 场景 F、G
6. `python/tests/test_get_profile_cli.py` - 场景 G
7. `python/tests/test_manage_credits_cli.py` - 场景 G
8. `python/tests/test_manage_group_cli.py` (补充) - 场景 C、D

**🟢 低优先级** (完善测试覆盖):
9. `python/tests/test_setup_identity_cli.py` (补充) - 场景 G
10. `python/tests/test_search_users.py` (补充) - 场景 G
11. `python/tests/test_check_inbox_cli.py` (补充) - 场景 A、B
12. `python/tests/test_query_db_cli.py` - 场景 F

---

## 7. Python vs Node.js 交叉测试方案

### 7.1 交叉测试矩阵

| Python 版本 | Node.js 版本 | 测试场景 | 轮次要求 |
|------------|-------------|----------|----------|
| ✅ | ❌ | Python 发送 → Node.js 接收 | 3 轮 |
| ❌ | ✅ | Node.js 发送 → Python 接收 | 3 轮 |
| ✅ | ✅ | Python ↔ Node.js 双向通信 | 3 轮 |
| ✅ | ✅ | Python ↔ Python 对照测试 | 3 轮 |
| ✅ | ✅ | Node.js ↔ Node.js 自测试 | 3 轮 |

### 6.2 明文通信交叉测试

```javascript
// doc/scripts/send_message.py/test.js - 交叉测试部分
const { execSync } = require('child_process');
const assert = require('assert');

describe('Messaging Cross-Platform Tests', () => {
  const pythonDid = 'did:wba:awiki.ai:user:k1_python_test';
  const nodeDid = 'did:wba:awiki.ai:user:k1_node_test';
  
  it('Python → Node.js: 3 rounds of messaging', () => {
    // Round 1: Python sends, Node.js receives
    execSync(`python scripts/send_message.py --to ${nodeDid} --content "Round 1 from Python"`);
    const nodeInbox = execSync('node scripts/check-inbox.js --limit 1');
    assert.ok(nodeInbox.includes('Round 1 from Python'));
    
    // Round 2: Node.js sends, Python receives
    execSync(`node scripts/send-message.js --to ${pythonDid} --content "Round 2 from Node.js"`);
    const pythonInbox = execSync('python scripts/check_inbox.py --limit 1');
    assert.ok(pythonInbox.includes('Round 2 from Node.js'));
    
    // Round 3: Python sends again
    execSync(`python scripts/send_message.py --to ${nodeDid} --content "Round 3 from Python"`);
    const nodeInbox2 = execSync('node scripts/check-inbox.js --limit 2');
    assert.ok(nodeInbox2.includes('Round 3 from Python'));
  });
});
```

### 6.3 密文通信交叉测试

```javascript
// doc/scripts/e2ee_messaging.py/test.js - E2EE 交叉测试
describe('E2EE Cross-Platform Tests', () => {
  it('Python ↔ Node.js: 3 rounds of E2EE messaging', () => {
    // Round 1: Python initiates E2EE session
    execSync('python scripts/e2ee_messaging.py --send node_did --content "E2EE Round 1"');
    
    // Round 2: Node.js responds with E2EE
    execSync('node scripts/e2ee-messaging.js --send python_did --content "E2EE Round 2"');
    
    // Round 3: Python sends encrypted message
    execSync('python scripts/e2ee_messaging.py --send node_did --content "E2EE Round 3"');
    
    // Verify all messages decrypted correctly
    const nodeInbox = execSync('node scripts/check-inbox.js --e2ee');
    const pythonInbox = execSync('python scripts/check_inbox.py --e2ee');
    
    assert.ok(nodeInbox.includes('E2EE Round 1'));
    assert.ok(pythonInbox.includes('E2EE Round 2'));
    assert.ok(nodeInbox.includes('E2EE Round 3'));
  });
});
```

### 6.4 群组通信交叉测试

```javascript
// doc/scripts/manage_group.py/test.js - 群组交叉测试
describe('Group Cross-Platform Tests', () => {
  it('Python creates group, Node.js joins and exchanges messages', () => {
    // Python creates group
    const createResult = execSync('python scripts/manage_group.py --create --name "Test Group" --slug test');
    const groupId = JSON.parse(createResult).groupId;
    const joinCode = JSON.parse(createResult).join_code;
    
    // Round 1: Node.js joins group
    execSync(`node scripts/manage-group.js --join --group-id ${groupId} --join-code ${joinCode}`);
    
    // Round 2: Python sends group message
    execSync(`python scripts/manage_group.py --post-message --group-id ${groupId} --content "Group msg 1"`);
    
    // Round 3: Node.js sends group message
    execSync(`node scripts/manage-group.js --post-message --group-id ${groupId} --content "Group msg 2"`);
    
    // Verify group messages
    const groupMessages = execSync(`node scripts/manage-group.js --messages --group-id ${groupId} --limit 10`);
    assert.ok(groupMessages.includes('Group msg 1'));
    assert.ok(groupMessages.includes('Group msg 2'));
  });
});
```

### 6.5 交叉测试执行命令

```bash
# 运行所有交叉测试
npm run test:cross-platform

# 运行明文通信交叉测试
npm run test:cross-plain

# 运行密文通信交叉测试
npm run test:cross-e2ee

# 运行群组交叉测试
npm run test:cross-group

# Python vs Node.js 对比测试
npm run test:compare
```

## 7. 蒸馏脚本位置

| Python 文件 | 蒸馏脚本 | 蒸馏输出 |
|------------|----------|----------|
| python/scripts/utils/config.py | doc/scripts/utils/config.py/distill.py | doc/scripts/utils/config.py/py.json |
| python/scripts/utils/auth.py | doc/scripts/utils/auth.py/distill.py | doc/scripts/utils/auth.py/py.json |
| python/scripts/utils/e2ee.py | doc/scripts/utils/e2ee.py/distill.py | doc/scripts/utils/e2ee.py/py.json |
| python/scripts/send_message.py | doc/scripts/send_message.py/distill.py | doc/scripts/send_message.py/py.json |
| python/scripts/check_inbox.py | doc/scripts/check_inbox.py/distill.py | doc/scripts/check_inbox.py/py.json |
| ... | ... | ... |

## 8. 测试执行命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行交叉测试
npm run test:cross-platform

# 生成覆盖率报告
npm run test:coverage

# 监视模式
npm run test:watch
```

---

## 9. 任务描述模版

本节提供标准化的任务描述模版，用于委托 subagent 执行具体任务。每个任务描述文件应包含完整上下文，使 subagent 能够独立完成任务。

### 9.1 任务描述文件结构

每个任务描述文件应包含以下部分：

```markdown
# 任务描述：<任务名称>

## 任务信息
- **任务类型**: <蒸馏/测试创建/移植/测试/集成测试>
- **目标文件**: 1 个（xxx.py）
- **输出文件**: module/scripts/xxx.js
- **依赖文件**: py.md, py.json, test.js

**重要**: 本任务只移植 1 个文件，完成后等待用户确认再进行下一个文件。

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`
- module 目录：`D:\huangyg\git\sample\awiki\module\`

### 相关文件位置
- Python 源文件：`python/scripts/xxx.py`
- 蒸馏脚本：`doc/scripts/xxx.py/distill.py`
- 蒸馏输出：`doc/scripts/xxx.py/py.json`
- 分析报告：`doc/scripts/xxx.py/py.md`
- 测试文件：`doc/scripts/xxx.py/test.js`
- Node.js 源文件：`module/scripts/xxx.js`

## 移植前检查清单（步骤 5 专用）⭐

在开始移植前，请确认：
- [ ] 已阅读 py.md 和 py.json
- [ ] 已检查 test.js 中的引用（`require('../../scripts/utils/xxx')`）
- [ ] 已检查 module/index.js 中的导出引用
- [ ] 已确认文件名（是否与测试和导出一致）
- [ ] 已检查依赖模块是否已移植（如 lib/anp-0.6.8）

## 任务目标

移植 1 个 Python 文件到 Node.js，要求：
1. 函数名、参数、返回值与 Python 完全一致
2. 变量名保持一致
3. 实现逻辑一致
4. 不做猜测和简化

## 执行步骤（单个文件）

### 步骤 1: 阅读文档
1. 阅读 `doc/scripts/utils/xxx.py/py.md` - 了解函数签名和结构
2. 阅读 `doc/scripts/utils/xxx.py/py.json` - 了解测试输入输出
3. 阅读 `doc/scripts/utils/xxx.py/test.js` - 了解测试要求

### 步骤 2: 编写代码
编写 `module/scripts/utils/xxx.js`

### 步骤 3: 运行测试
```bash
cd module
npm test -- doc/scripts/utils/xxx.py/test.js
```

### 步骤 4: 修复直到通过
根据测试失败信息修复代码，直到所有测试通过

### 步骤 5: 提交前验证
- [ ] 所有核心测试通过
- [ ] 代码通过 `node --check` 语法检查
- [ ] 已记录已知问题（如有）

## 测试策略（步骤 5 专用）⭐

### 测试优先级
1. **核心功能测试**（必须通过）- 验证模块导入、函数存在、基本功能
2. **CLI 参数测试**（如适用）- 验证命令行参数处理
3. **集成测试**（必须通过）- 验证 SDKConfig 集成
4. **跨平台测试**（可选）- Python vs Node.js 行为对比

### 跨平台测试说明
- 跨平台测试失败可能是 Python 路径配置问题，不是移植问题
- 优先确保核心功能测试通过
- 跨平台测试可以稍后修复

## 验收标准

1. ✅ `module/scripts/utils/xxx.js` 已创建
2. ✅ 测试通过（核心功能测试必须通过）
3. ✅ 代码通过 `node --check` 语法检查
4. ✅ 函数签名与 Python 完全一致
5. ✅ 已记录已知问题（如有）

## 已知问题（步骤 5 专用）⭐

- 跨平台测试可能需要配置 Python 路径：`sys.path.insert(0, str(PROJECT_ROOT / 'python' / 'scripts'))`
- Python 测试失败不一定是移植问题，可能是路径配置问题
- 如遇到 `ModuleNotFoundError`，先检查路径配置
- 依赖模块未就绪时使用延迟加载策略

## 常见陷阱（步骤 5 专用）⭐

### Path 处理
- Python: `Path.home() / '.openclaw' / 'credentials'`
- JavaScript: `path.join(os.homedir(), '.openclaw', 'credentials')`

### 数据类
- Python: `@dataclass`
- JavaScript: `class` with constructor

### 可选参数
- Python: `def func(param=None)`
- JavaScript: `function func(param = defaultValue)`

### 环境变量
- Python: `os.environ.get('VAR', 'default')`
- JavaScript: `process.env.VAR || 'default'`

### 异步函数
- Python: `async def func(...)`
- JavaScript: `async function func(...)`

### 关键字参数
- Python: `*, auth: Any = None`
- JavaScript: 解构参数 `{ auth = null } = {}`

## 文件名约定（步骤 5 专用）⭐

- 保持与 Python 源文件一致，但使用 .js 扩展名
- 例外：
  - `logging_config.py` → `logging.js`（与测试文件和 index.js 引用保持一致）
  - `__init__.py` → `index.js`（Node.js 惯例）
  - `send_message.py` → `send-message.js`（连字符命名）

## 提交前验证（步骤 5 专用）⭐

在提交移植代码前，请确认：
- [ ] 所有核心测试通过
- [ ] 代码通过 `node --check` 语法检查
- [ ] 已记录已知问题（如有）

## 注意事项

- **逐个文件移植**：完成一个文件后再进行下一个
- **依赖检查**：如依赖模块未就绪，使用延迟加载策略
- **参考已移植代码**：config.js, rpc.js 可作为参考

## 参考资料

- [skill.js.md](../skill.js.md) - Node.js 移植方案
- [skill.py.md](../skill.py.md) - Python 版本分析
```

## 逐个文件委托原则 ⭐

**重要**: 主 agent 在委托 subagent 时必须遵守以下原则：

1. **每次只委托 1 个文件**
   - 不要批量委托多个文件
   - 完成一个文件后再委托下一个

2. **委托前检查**
   - 检查 py.md、py.json、test.js 是否存在
   - 检查依赖模块是否已移植
   - 如依赖未就绪，明确告知 subagent 使用延迟加载策略

3. **任务描述填充**
   - 根据实际文件修改路径
   - 根据依赖情况调整说明
   - 不要机械复制模板

4. **授权控制**
   - 单个文件委托避免批量授权阻塞
   - 如 subagent 请求读取多个文件，允许一次完成

---

## 10. 任务模版详情


## 步骤 1: Python 代码分析

**目标**: 为所有 Python 文件创建分析报告 `doc/*/py.md`

**输入**: 
- `python/scripts/**/*.py` (所有 Python 源文件)

**输出**:
- `doc/scripts/**/*.py/py.md` (每个 py 文件对应一个分析报告)
- `doc/tests/**/*.py/py.md` (测试文件分析报告)

**任务描述**:

```markdown
# 步骤 1: Python 代码分析

## 任务
为 python/scripts 下的每个 .py 文件创建分析报告 py.md

## 分析内容
每个 py.md 应包含：
1. 文件概述
2. 常量定义
3. 类定义（属性、方法）
4. 函数签名（参数、返回值）
5. 导入的模块
6. 调用关系（调用谁、被谁调用）
7. 环境变量（如有）

## 输出位置
- python/scripts/utils/config.py → doc/scripts/utils/config.py/py.md
- python/scripts/send_message.py → doc/scripts/send_message.py/py.md
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 py.md
- [ ] py.md 包含完整的函数/类签名
- [ ] py.md 包含调用关系
- [ ] doc/cli.md 已更新（CLI 命令文档）
- [ ] doc/web.md 已更新（API 文档）
- [ ] doc/skill.py.md 已更新（Python 版本分析）
- [ ] doc/skill.js.md 已更新（Node.js 移植方案）

## 验证
执行以下命令验证：
```bash
# 检查是否所有 py 文件都有 py.md
python scripts/verify_step1.py
```

**文件列表** (63 个 py 文件):
- scripts/utils/ (11 个): config, logging_config, auth, identity, client, rpc, handle, e2ee, resolve, ws, __init__
- scripts/ (32 个): setup_identity, register_handle, send_message, check_inbox, manage_group, etc.
- tests/ (19 个): test_*.py
- 根目录 (1 个): install_dependencies.py

---

## 步骤 2: 蒸馏脚本编写

**目标**: 为所有 Python 文件创建蒸馏脚本 `doc/*/distill.py`

**前置条件**: 步骤 1 完成（所有 py.md 已创建）

**输入**:
- `python/scripts/**/*.py` (Python 源文件)
- `doc/scripts/**/*.py/py.md` (分析报告)

**输出**:
- `doc/scripts/**/*.py/distill.py` (每个 py 文件对应一个蒸馏脚本)

**任务描述**:

```markdown
# 步骤 2: 蒸馏脚本编写

## 任务
为每个 Python 文件创建蒸馏脚本 distill.py

## 蒸馏脚本要求
每个 distill.py 应：
1. 导入目标 Python 模块
2. 为每个公共函数设计测试输入
3. 执行函数，捕获输出
4. 输出 JSON 格式的蒸馏数据

## 输出位置
- doc/scripts/utils/config.py/distill.py
- doc/scripts/send_message.py/distill.py
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 distill.py
- [ ] distill.py 可以执行（语法正确）
- [ ] distill.py 覆盖所有公共函数
- [ ] 包含常量导出
- [ ] 包含类信息

## 验证
```bash
# 检查是否所有文件都有 distill.py
python scripts/verify_step2.py

# 抽样执行蒸馏脚本
python doc/scripts/utils/config.py/distill.py
```

**注意**: 此步骤不需要 task-distill.md 文件，直接编写 distill.py

---

## 步骤 3: 蒸馏执行

**目标**: 执行所有蒸馏脚本，生成 `doc/*/py.json`

**前置条件**: 步骤 2 完成（所有 distill.py 已创建）

**输入**:
- `doc/scripts/**/*.py/distill.py` (所有蒸馏脚本)

**输出**:
- `doc/scripts/**/*.py/py.json` (蒸馏输出)

**任务描述**:

```markdown
# 步骤 3: 蒸馏执行

## 任务
执行所有蒸馏脚本，生成 py.json 文件

## 执行命令
```bash
cd D:\huangyg\git\sample\awiki

# 批量执行
for file in doc/scripts/*/distill.py; do
    python "$file" > "${file/distill.py/py.json}" 2>&1
done

# utils 子目录
for file in doc/scripts/utils/*/distill.py; do
    python "$file" > "${file/distill.py/py.json}" 2>&1
done

# tests 子目录
for file in doc/tests/*/distill.py; do
    python "$file" > "${file/distill.py/py.json}" 2>&1
done
```

## 完成标准
- [ ] 所有 py.json 文件已生成
- [ ] py.json 格式正确（JSON 可解析）
- [ ] py.json 包含 functions 数组
- [ ] py.json 包含测试输入输出

## 验证
```bash
# 验证 JSON 格式
python scripts/verify_step3.py

# 检查 py.json 内容
python -c "import json; json.load(open('doc/scripts/utils/config.py/py.json'))"
```

---

## 步骤 4: 测试代码编写

**目标**: 为所有文件创建 Node.js 单元测试代码 `doc/*/test.js`

**前置条件**: 步骤 3 完成（所有 py.json 已生成）

**输入**:
- `doc/scripts/**/*.py/py.json` (蒸馏数据)
- `doc/scripts/**/*.py/py.md` (分析报告)

**输出**:
- `doc/scripts/**/*.py/test.js` (Node.js 测试文件)

**任务描述**:

```markdown
# 步骤 4: Node.js 测试代码编写

## 任务
基于 py.json 和 py.md，为每个文件编写 Node.js 测试代码

## 测试代码要求
每个 test.js 应：
1. 导入蒸馏数据（py.json）
2. 为每个函数创建测试用例
3. 包含 CLI 测试（如适用）
4. 包含交叉测试（Python vs Node.js）

## 输出位置
- doc/scripts/utils/config.py/test.js
- doc/scripts/send_message.py/test.js
- ... (所有文件)

## 完成标准
- [ ] 所有 py 文件都有对应的 test.js
- [ ] test.js 基于 py.json 的测试数据
- [ ] test.js 使用 Jest 格式
- [ ] CLI 脚本包含命令行测试
- [ ] 包含 Python vs Node.js 交叉测试

## 验证
```bash
# 检查是否所有文件都有 test.js
python scripts/verify_step4.py
```

---

## 步骤 5: Node.js 代码移植

**目标**: 将所有 Python 文件移植到 Node.js，形成 `module/scripts/*.js` 和 `module/lib/*/index.js`

**前置条件**: 步骤 4 完成（所有 test.js 已创建）

**输入**:
- `python/scripts/**/*.py` (Python 源文件)
- `python/lib/**/*.py` (Python 依赖库，如有)
- `doc/scripts/**/*.py/py.json` (蒸馏数据)
- `doc/scripts/**/*.py/py.md` (分析报告)
- `doc/scripts/**/*.py/test.js` (测试文件)
- `doc/lib/**/*.py/py.json` (lib 蒸馏数据)
- `doc/lib/**/*.py/py.md` (lib 分析报告)
- `doc/lib/**/*.py/test.js` (lib 测试文件)

**输出**:
- `module/scripts/**/*.js` (Node.js 业务代码)
- `module/lib/**/*.js` (Node.js 适配器代码)

**执行原则**: 逐个文件移植，完成一个后再进行下一个

**建议顺序**（按依赖关系）:

### Phase 1: lib 适配器（优先）
1. `module/lib/anp-0.6.8/index.js` - ANP 库适配器（@node-rs/hpke）
2. `module/lib/httpx-0.28.0/index.js` - httpx 库适配器（undici）
3. `module/lib/websockets-14.0/index.js` - websockets 库适配器（ws）

### Phase 2: utils 模块
4. `module/scripts/utils/config.js` - 配置管理
5. `module/scripts/utils/logging.js` - 日志管理
6. `module/scripts/utils/rpc.js` - JSON-RPC
7. `module/scripts/utils/client.js` - HTTP 客户端
8. `module/scripts/utils/auth.js` - 认证
9. `module/scripts/utils/identity.js` - 身份创建
10. `module/scripts/utils/handle.js` - Handle 管理
11. `module/scripts/utils/e2ee.js` - E2EE 加密
12. `module/scripts/utils/resolve.js` - DID 解析
13. `module/scripts/utils/ws.js` - WebSocket

### Phase 3: 核心业务脚本
14. `module/scripts/credential-store.js` - 凭证存储
15. `module/scripts/local-store.js` - 本地存储
16. `module/scripts/setup-identity.js` - 身份设置
17. `module/scripts/send-message.js` - 发送消息
18. `module/scripts/check-inbox.js` - 检查收件箱

### Phase 4: 其他业务脚本
19-50. 其他业务脚本（按依赖顺序逐个移植）

**注意**: 
- 主 agent 在委托任务时应每次只委托 1 个文件
- lib 适配器优先移植，因为 utils 模块依赖它们
- 如 lib 适配器未就绪，utils 模块使用延迟加载策略

**任务描述**:

```markdown
# 步骤 5: Node.js 代码移植 - <文件名>

## 任务
移植 1 个 Python 文件到 Node.js

**源文件**: `python/scripts/utils/xxx.py` 或 `python/lib/xxx/xxx.py`
**目标**: `module/scripts/utils/xxx.js` 或 `module/lib/xxx/index.js`

**重要**: 本任务只处理 1 个文件。

## 移植要求
1. 函数名、参数、返回值与 Python 完全一致
2. 变量名保持一致
3. 实现逻辑一致
4. 不做猜测和简化

## 移植流程（单个文件）
1. 阅读 py.md 和 py.json
2. 编写 Node.js 代码
3. 运行 test.js 测试
4. 如失败，修复直到通过
5. Python vs Node.js 交叉验证
6. 通过后提交

## 输出位置
- module/scripts/utils/xxx.js（业务代码）
- module/lib/xxx/index.js（适配器代码）

## 完成标准
- [ ] 所有 test.js 测试通过
- [ ] 代码通过语法检查（node --check）

## 验证
```bash
cd module
npm test -- doc/scripts/utils/xxx.py/test.js
```

## lib 适配器特殊说明

如移植 lib 适配器（anp-0.6.8, httpx-0.28.0, websockets-14.0）:

1. **依赖 Node.js 库**:
   - anp-0.6.8 → @node-rs/hpke
   - httpx-0.28.0 → undici
   - websockets-14.0 → ws

2. **二进制兼容**: 加密/解密结果需与 Python 版本二进制一致

3. **测试要求**: 必须通过蒸馏数据验证
```

---

## 步骤 6: module 集成测试

**目标**: 完成 module 项目的集成测试

**前置条件**: 步骤 5 完成（所有 js 文件已移植且单元测试通过）

**输入**:
- `module/scripts/**/*.js` (所有 Node.js 代码)

**输出**:
- `module/tests/integration/**/*.test.js` (集成测试)
- 修复后的 module 代码

**任务描述**:

```markdown
# 步骤 6: module 集成测试

## 任务
编写集成测试，验证模块间协作

## 测试场景
1. 身份创建 → Handle 注册 → 发送消息
2. 创建群组 → 加入群组 → 群消息
3. E2EE 会话建立 → 加密通信
4. Python ↔ Node.js 交叉通信

## 输出位置
- module/tests/integration/messaging.test.js
- module/tests/integration/group.test.js
- module/tests/integration/e2ee.test.js
- module/tests/integration/cross-platform.test.js

## 完成标准
- [ ] 所有集成测试通过
- [ ] Python vs Node.js 行为一致
- [ ] 3 轮以上来回通信测试通过
- [ ] 性能达标（CLI < 500ms）

## 验证
```bash
cd module
npm run test:integration
```

---

## 步骤 7: nodejs-client 项目

**目标**: 将 module 的代码转移到 nodejs-client，完成最终产品

**前置条件**: 步骤 6 完成（module 集成测试通过）

**输入**:
- `module/scripts/**/*.js` (已验证的 Node.js 代码)
- `module/tests/**/*.js` (测试代码)

**输出**:
- `nodejs-client/` (完整的 Skill 项目)

**任务描述**:

```markdown
# 步骤 7: nodejs-client 项目

## 任务
将 module 的代码转移到 nodejs-client，创建完整的 Skill 项目

## 转移内容
1. scripts/ → nodejs-client/scripts/
2. lib/ → nodejs-client/lib/ (适配器)
3. 创建 nodejs-client/package.json
4. 创建 nodejs-client/SKILL.md
5. 创建 nodejs-client/README.md

## 输出位置
- nodejs-client/scripts/utils/config.js
- nodejs-client/scripts/send-message.js
- nodejs-client/SKILL.md
- nodejs-client/package.json
- ...

## 完成标准
- [ ] 所有代码已转移
- [ ] nodejs-client 可以独立运行
- [ ] 集成测试通过
- [ ] SKILL.md 符合 agentskills.io 规范
- [ ] 文档完整

## 验证
```bash
cd nodejs-client
npm install
npm test
```
---

## 步骤完成检查

| 步骤 | 输入 | 输出 | 完成标准 |
|------|------|------|----------|
| 1. Python 分析 | python/**/*.py | doc/*/py.md | 所有文件有 py.md |
| 2. 蒸馏脚本 | python/**/*.py, doc/*/py.md | doc/*/distill.py | 所有文件有 distill.py |
| 3. 蒸馏执行 | doc/*/distill.py | doc/*/py.json | 所有文件有 py.json |
| 4. 测试编写 | doc/*/py.json, doc/*/py.md | doc/*/test.js | 所有文件有 test.js |
| 5. 代码移植 | python/**/*.py, doc/*/* | module/scripts/*.js | 所有测试通过 |
| 6. 集成测试 | module/scripts/*.js | module/tests/integration/ | 集成测试通过 |
| 7. 最终项目 | module/* | nodejs-client/ | Skill 项目完成 |

## 验收标准

1. ✅ 集成测试文件已创建
2. ✅ 所有交叉测试通过（3 轮以上）
3. ✅ E2EE 测试通过（如果适用）
4. ✅ 群组测试通过（如果适用）
5. ✅ 测试报告已生成

## 注意事项

- **轮次要求**：每种场景至少 3 轮来回通信
- **手工测试**：需要手机号的场景改为手工测试
- **身份隔离**：使用不同的测试身份，避免数据污染
- **错误处理**：记录详细的错误信息和修复建议

## 参考资料

- [skill.js.md](../skill.js.md) - 第 6 节：Python vs Node.js 交叉测试方案
- [skill.py.md](../skill.py.md) - Python 版本分析
```

---

## 11. 任务执行流程

```
1. 蒸馏任务
   ↓ (生成 py.json)
2. 测试创建任务
   ↓ (生成 test.js)
3. 移植任务
   ↓ (生成 .js 文件)
4. 测试任务
   ↓ (验证正确性)
5. 集成测试任务
   ↓ (验证协作)
```

每个任务都可以独立委托给 subagent 执行，任务描述文件应包含完整的上下文信息。


## 9. 参考资料

- [Python 版本分析](skill.py.md)
- [CLI 命令文档](cli.md)
- [Web API 文档](web.md)
