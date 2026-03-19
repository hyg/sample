# awiki-agent-id-message Node.js 移植开发和测试方案

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
| 步骤 1: Python 分析 | 🟡 进行中 | 2/63 文件 |
| 步骤 2: 蒸馏脚本 | ⚪ 待开始 | 0/63 |
| 步骤 3: 蒸馏执行 | ⚪ 待开始 | 0/63 |
| 步骤 4: 测试编写 | ⚪ 待开始 | 0/63 |
| 步骤 5: 代码移植 | ⚪ 待开始 | 0/63 |
| 步骤 6: 集成测试 | ⚪ 待开始 | 0/63 |
| 步骤 7: 最终项目 | ⚪ 待开始 | 0/63 |

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
│   │   ├── handle.js
│   │   ├── identity.js
│   │   ├── logging.js
│   │   ├── resolve.js
│   │   ├── rpc.js
│   │   └── ws.js
│   ├── check-inbox.js
│   ├── check-status.js
│   ├── credential-store.js
│   ├── e2ee-handler.js
│   ├── e2ee-messaging.js
│   ├── local-store.js
│   ├── manage-group.js
│   ├── manage-relationship.js
│   ├── send-message.js
│   ├── setup-identity.js
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
| HTTP 客户端 | scripts/utils/client.js | config, httpx-0.28.0 | doc/scripts/utils/client.py/test.js |
| RPC 模块 | scripts/utils/rpc.js | client, config | doc/scripts/utils/rpc.py/test.js |
| 认证模块 | scripts/utils/auth.js | rpc, identity | doc/scripts/utils/auth.py/test.js |
| 身份模块 | scripts/utils/identity.js | rpc, anp-0.6.8 | doc/scripts/utils/identity.py/test.js |
| Handle 模块 | scripts/utils/handle.js | rpc | doc/scripts/utils/handle.py/test.js |
| E2EE 模块 | scripts/utils/e2ee.js | anp-0.6.8 | doc/scripts/utils/e2ee.py/test.js |
| DID 解析 | scripts/utils/resolve.js | handle | doc/scripts/utils/resolve.py/test.js |
| WebSocket | scripts/utils/ws.js | config, websockets-14.0 | doc/scripts/utils/ws.py/test.js |
| 包导出 | scripts/utils/index.js | 所有 utils | - |

### 4.3 Phase 3-6: scripts 和 tests

| 阶段 | 任务 | 文件数 | 依赖 |
|------|------|--------|------|
| **Phase 3: 核心脚本** | credential-store, local-store, setup-identity, send-message, check-inbox, e2ee-messaging, check-status | 8 文件 | utils 模块 |
| **Phase 4: 业务脚本** | manage-group, manage-relationship, get-profile, update-profile, manage-content, search-users, manage-credits, ws-listener, e2ee-handler, e2ee-store, e2ee-outbox, recover-handle, resolve-handle, manage-contacts, query-db | 15 文件 | 核心脚本 |
| **Phase 5: 工具脚本** | database-migration, credential-migration, credential-layout, listener-config, service-manager, regenerate-e2ee-keys, migrate-credentials, migrate-local-database | 8 文件 | 核心脚本 |
| **Phase 6: 测试移植** | 19 个 Python 测试文件移植 | 19 文件 | 所有模块 |

## 5. 测试覆盖场景

### 5.1 身份创建场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 创建新身份 | {name: "test"} | {did, unique_id, user_id, keys} | 否 |
| 加载已保存身份 | {credential_name: "default"} | {did, jwt_token} | 否 |
| 列出所有身份 | {} | [identity_list] | 否 |
| 删除身份 | {name: "test"} | {success: true} | 否 |
| JWT 自动刷新 | {jwt_expired: true} | {jwt_token: "new"} | 否 |

### 5.2 明文通信场景

| 场景 | 测试输入 | 预期输出 | 轮次 | 手工测试 |
|------|----------|----------|------|----------|
| 发送文本消息 | {to: did, content: "hello"} | {messageId, server_seq} | 1 | 否 |
| 接收消息 | {limit: 10} | {messages: [...]} | 1 | 否 |
| 标记已读 | {ids: [msg_id]} | {success: true} | 1 | 否 |
| 查看历史 | {peer: did, limit: 50} | {messages: [...]} | 1 | 否 |

### 5.3 密文通信场景 (E2EE)

| 场景 | 测试输入 | 预期输出 | 轮次 | 手工测试 |
|------|----------|----------|------|----------|
| E2EE 会话初始化 | {to: did, content: "hello"} | {e2ee_init, messageId} | 1 | 否 |
| E2EE 会话确认 | {e2ee_init received} | {e2ee_ack} | 2 | 否 |
| E2EE 加密消息 | {content: "secret"} | {e2ee_msg} | 3 | 否 |
| E2EE 解密消息 | {e2ee_msg} | {plaintext} | 3 | 否 |
| E2EE 密钥轮换 | {rekey triggered} | {e2ee_rekey} | 1 | 否 |

### 5.4 群组场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 创建群组 | {name, slug, description} | {groupId, join_code} | 否 |
| 加入群组 | {group_id, join_code} | {success: true} | 否 |
| 离开群组 | {group_id} | {success: true} | 否 |
| 列出成员 | {group_id} | {members: [...]} | 否 |
| 发送群消息 | {group_id, content} | {messageId} | 否 |
| 查看群消息 | {group_id, limit} | {messages: [...]} | 否 |

### 5.5 内容管理场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 创建页面 | {title, content, parent_id?} | {pageId} | 否 |
| 更新页面 | {page_id, content} | {success: true} | 否 |
| 重命名页面 | {page_id, title} | {success: true} | 否 |
| 删除页面 | {page_id} | {success: true} | 否 |
| 列出页面 | {parent_id?} | {pages: [...]} | 否 |
| 获取页面 | {page_id} | {page} | 否 |

### 5.6 搜索场景

| 场景 | 测试输入 | 预期输出 | 手工测试 |
|------|----------|----------|----------|
| 搜索用户 | {query: "AI", limit: 10} | {users: [{did, handle, nickName}]} | 否 |
| 空结果搜索 | {query: "nonexistent"} | {users: []} | 否 |
| 部分匹配 | {query: "alice"} | {users: [...]} | 否 |

### 5.7 需要手工测试的场景（需要手机号）

| 场景 | 测试输入 | 预期输出 | 手工测试步骤 |
|------|----------|----------|-------------|
| Handle 注册（发送 OTP） | {handle, phone} | {success: true} | 1. 输入手机号 2. 接收短信 3. 输入 OTP |
| Handle 注册（验证 OTP） | {handle, otp_code} | {did, handle} | 1. 输入 OTP 2. 验证完成 |
| Handle 恢复 | {handle, phone} | {success: true} | 1. 输入手机号 2. 接收短信 3. 输入 OTP |

## 6. Python vs Node.js 交叉测试方案

### 6.1 交叉测试矩阵

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
- **目标文件**: <文件路径>
- **输出文件**: <输出文件路径>
- **依赖文件**: <依赖的文件列表>

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

## 任务目标

<详细描述任务要完成的目标>

## 执行步骤

### 步骤 1: <步骤名称>
<详细说明>

### 步骤 2: <步骤名称>
<详细说明>

...

## 验收标准

1. <标准 1>
2. <标准 2>
3. <标准 3>

## 注意事项

- <注意事项 1>
- <注意事项 2>

## 参考资料

- [skill.js.md](../skill.js.md) - Node.js 移植方案
- [skill.py.md](../skill.py.md) - Python 版本分析
```

---

## 10. 任务模版详情

### 10.1 Python 文件蒸馏任务模版

```markdown
# 任务描述：Python 文件蒸馏

## 任务信息
- **任务类型**: 蒸馏
- **目标文件**: `python/scripts/<path>/<file>.py`
- **输出文件**: `doc/scripts/<path>/<file>.py/py.json`
- **依赖文件**: 
  - `doc/scripts/<path>/<file>.py/py.md` (分析报告)
  - `python/scripts/<path>/<file>.py` (Python 源文件)

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`

### 相关文件位置
- Python 源文件：`python/scripts/<path>/<file>.py`
- 蒸馏脚本输出：`doc/scripts/<path>/<file>.py/distill.py`
- 蒸馏输出：`doc/scripts/<path>/<file>.py/py.json`
- 分析报告：`doc/scripts/<path>/<file>.py/py.md`

## 任务目标

为指定的 Python 文件创建蒸馏脚本并执行蒸馏，提取所有公共函数/类的输入输出作为"黄金标准"，保存到 py.json 文件中。

## 前置任务确认

### 步骤 0: 确认前置任务完成（必需！）

**在执行任何操作之前，必须确认前置任务已完成！**

#### 检查清单

- [ ] `python/scripts/<path>/<file>.py` 存在（Python 源文件）
- [ ] `doc/scripts/<path>/<file>.py/py.md` 存在（分析报告）

#### 如果前置任务未完成

**退出当前任务**，并通知主 agent：

```
【前置任务未完成】
任务：Python 文件蒸馏 - <file>.py
缺失的前置条件：
- Python 源文件不存在：python/scripts/<path>/<file>.py
或
- 分析报告不存在：doc/scripts/<path>/<file>.py/py.md

请先执行前置任务：
1. 确认 Python 源文件路径正确
2. 阅读分析报告 py.md

当前任务已暂停，等待前置任务完成。
```

**不要继续执行**，直到前置任务完成！

## 执行步骤

### 步骤 1: 阅读分析报告

读取 `doc/scripts/<path>/<file>.py/py.md`，了解：
- 文件的功能概述
- 所有公共函数/类的签名
- 导入的模块和依赖
- 调用关系

### 步骤 2: 阅读 Python 源文件

读取 `python/scripts/<path>/<file>.py`，理解：
- 每个函数的实现逻辑
- 参数类型和返回值
- 异常处理
- 常量定义

### 步骤 3: 设计测试场景

为每个公共函数/类设计测试场景：

**纯函数**：直接调用，记录输入输出

**有外部依赖的函数**：
- 使用 mock 或模拟数据
- 记录 mock 的配置和预期行为

**CLI 脚本**：
- 记录命令行参数
- 记录标准输出
- 记录退出码

### 步骤 4: 编写蒸馏脚本

创建 `doc/scripts/<path>/<file>.py/distill.py`：

```python
#!/usr/bin/env python3
"""蒸馏脚本 - <file>.py"""

import sys
import json
from pathlib import Path

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'python' / 'scripts'))

# 导入目标模块
from <path>.<file> import <function_name>

def distill():
    """执行蒸馏，返回输入输出对"""
    results = {
        "file": "python/scripts/<path>/<file>.py",
        "doc_path": "doc/scripts/<path>/<file>.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 为每个函数添加测试
    # 示例：
    test_input = {"param1": "value1"}
    test_output = <function_name>(**test_input)
    results["functions"].append({
        "name": "<function_name>",
        "type": "function",
        "signature": "(param1) -> return_type",
        "tests": [{
            "input": test_input,
            "output": test_output,
            "scenario": "测试场景描述"
        }]
    })
    
    # 导出常量
    results["constants"] = {
        "CONSTANT_NAME": "value"
    }
    
    return results

if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
```

### 步骤 5: 执行蒸馏脚本

```bash
cd D:\huangyg\git\sample\awiki
python doc/scripts/<path>/<file>.py/distill.py > doc/scripts/<path>/<file>.py/py.json
```

### 步骤 6: 验证输出

检查生成的 `py.json`：
- JSON 格式正确
- 所有公共函数都有测试
- 输入输出数据完整
- 场景描述清晰

### 步骤 7: 更新 py.md（必需！）

**重要**：蒸馏完成后必须更新 py.md，添加蒸馏数据章节：

```markdown
## 蒸馏数据

### 测试输入

| 函数 | 输入 | 场景 |
|------|------|------|
| function_name | {} | 场景描述 |

### 测试输出

| 函数 | 输出 | 验证点 |
|------|------|--------|
| function_name | {key: value} | 验证点描述 |

### 蒸馏输出

蒸馏数据已保存到 `py.json`，包含：
- 函数输入输出
- 常量定义
- 类信息

### 蒸馏脚本

`distill.py` 已保存到同路径下。
```

### 步骤 8: 完整性检查（防遗漏）

**任务完成检查清单**：

- [ ] distill.py 已创建
- [ ] py.json 已生成（执行蒸馏脚本）
- [ ] py.md 已更新（添加"蒸馏数据"章节）
- [ ] py.json 内容验证（JSON 格式、覆盖所有函数）

**只有所有复选框都勾选，任务才算完成！**

## 验收标准

1. ✅ 蒸馏脚本 `distill.py` 已创建并可执行
2. ✅ 蒸馏输出 `py.json` 格式正确
3. ✅ 所有公共函数/类都有测试场景
4. ✅ 测试场景覆盖正常流程和边界情况
5. ✅ CLI 脚本包含命令行参数和输出测试
6. ✅ 常量定义已导出
7. ✅ **py.md 已更新**（包含"蒸馏数据"章节）
8. ✅ **完整性检查通过**（检查清单全部勾选）

## 注意事项

- **不要修改 Python 源文件**：蒸馏只读取，不修改
- **处理外部依赖**：使用 mock 或模拟数据隔离外部依赖
- **覆盖所有场景**：包括正常流程、错误处理、边界情况
- **CLI 测试**：对于用户通过 CLI 使用的脚本，必须测试命令行模式
- **敏感数据**：不要记录真实的凭证、密钥等敏感信息
- **必须更新 py.md**：蒸馏完成后立即更新 py.md，不要跳过

## 常见遗漏错误

❌ **错误 1**：蒸馏成功就认为完成，忘记更新 py.md
   - **防止**：执行步骤 7 和步骤 8 完整性检查

❌ **错误 2**：用快速测试代替正式 test.js
   - **防止**：测试任务有独立的 test.js 创建步骤

❌ **错误 3**：py.json 生成后不验证内容
   - **防止**：步骤 6 明确要求验证 JSON 内容和覆盖度

## 参考资料

- [skill.js.md](../skill.js.md) - 第 3 节：开发流程
- [skill.py.md](../skill.py.md) - Python 版本分析
- `doc/scripts/<path>/<file>.py/py.md` - 分析报告
```

---

### 10.2 JS 测试文件创建任务模版

```markdown
# 任务描述：Node.js 测试文件创建

## 任务信息
- **任务类型**: 测试创建
- **目标文件**: `doc/scripts/<path>/<file>.py/test.js`
- **依赖文件**: 
  - `doc/scripts/<path>/<file>.py/py.json` (蒸馏输出)
  - `doc/scripts/<path>/<file>.py/py.md` (分析报告)
  - `module/scripts/<path>/<file>.js` (Node.js 源文件，如已移植)
  - 依赖模块的测试文件

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`
- module 目录：`D:\huangyg\git\sample\awiki\module\`

### 相关文件位置
- 蒸馏输出：`doc/scripts/<path>/<file>.py/py.json`
- 分析报告：`doc/scripts/<path>/<file>.py/py.md`
- 测试文件输出：`doc/scripts/<path>/<file>.py/test.js`
- Node.js 源文件：`module/scripts/<path>/<file>.js`

## 任务目标

基于蒸馏数据 (py.json) 和分析报告 (py.md)，为 Node.js 移植代码创建单元测试文件。测试应覆盖：
1. 目标文件的所有公共函数/类
2. 依赖文件的接口（确保依赖正确传递）
3. CLI 命令行模式（如果适用）

## 前置任务确认

### 步骤 0: 确认前置任务完成（必需！）

**在执行任何操作之前，必须确认前置任务已完成！**

#### 检查清单

- [ ] `doc/scripts/<path>/<file>.py/py.json` 存在（蒸馏输出）
- [ ] `doc/scripts/<path>/<file>.py/py.json` 包含"functions"数组
- [ ] `doc/scripts/<path>/<file>.py/py.md` 存在（分析报告）
- [ ] `doc/scripts/<path>/<file>.py/py.md` 包含"蒸馏数据"章节

#### 如果前置任务未完成

**退出当前任务**，并通知主 agent：

```
【前置任务未完成】
任务：Node.js 测试文件创建 - <file>.py
缺失的前置条件：
- 蒸馏输出不存在：doc/scripts/<path>/<file>.py/py.json
或
- 蒸馏数据不完整：py.json 缺少 functions 数组
或
- 分析报告未更新：doc/scripts/<path>/<file>.py/py.md 缺少"蒸馏数据"章节

请先执行前置任务：
1. 执行蒸馏任务，生成 py.json
2. 更新 py.md，添加"蒸馏数据"章节

当前任务已暂停，等待前置任务完成。
```

**不要继续执行**，直到前置任务完成！

## 执行步骤

### 步骤 1: 阅读蒸馏数据

读取 `doc/scripts/<path>/<file>.py/py.json`，了解：
- 所有函数/类的签名
- 测试输入和预期输出
- 测试场景描述

### 步骤 2: 阅读分析报告

读取 `doc/scripts/<path>/<file>.py/py.md`，了解：
- 文件的功能概述
- 调用其他文件的接口
- 被哪些文件调用

### 步骤 3: 检查 Node.js 源文件（如已移植）

如果 `module/scripts/<path>/<file>.js` 已存在，阅读了解：
- 函数实现
- 参数处理
- 返回值格式

### 步骤 4: 编写测试文件

创建 `doc/scripts/<path>/<file>.py/test.js`：

```javascript
/**
 * <file>.py 的 Node.js 测试文件
 * 
 * 基于蒸馏数据生成，确保与 Python 版本行为一致
 */

const assert = require('assert');

// 导入目标模块（如已移植）
// const { <function_name> } = require('../../../module/scripts/<path>/<file>.js');

// 导入依赖模块（如需要）
// const { <dep_function> } = require('../../../module/scripts/<path>/<dep>.js');

describe('<file> - <功能描述>', () => {
  
  // 测试每个函数
  describe('<function_name>', () => {
    it('should <行为描述> - <场景描述>', () => {
      // 从 py.json 获取测试输入
      const input = { param1: 'value1' };
      
      // 调用函数（如已移植）
      // const result = <function_name>(input.param1);
      
      // 从 py.json 获取预期输出
      const expected = { /* 预期输出 */ };
      
      // 断言
      assert.deepStrictEqual(result, expected);
    });
    
    // 添加更多测试场景
    it('should handle edge case - <场景描述>', () => {
      // 边界情况测试
    });
  });
  
  // 测试依赖接口（如果目标模块调用其他模块）
  describe('dependency interfaces', () => {
    it('should call <dep_module>.<dep_function> with correct args', () => {
      // 测试依赖调用
    });
  });
  
  // CLI 测试（如果适用）
  describe('CLI mode', () => {
    const { execSync } = require('child_process');
    
    it('should work with CLI arguments', () => {
      // 执行 CLI 命令
      const output = execSync('node module/scripts/<path>/<file>.js --arg1 value1', {
        encoding: 'utf8'
      });
      
      // 验证输出
      assert.ok(output.includes('expected output'));
    });
  });
});
```

### 步骤 5: 添加交叉测试（如目标模块已移植）

如果目标模块和依赖模块都已移植，添加 Python vs Node.js 交叉测试：

```javascript
describe('Cross-platform tests', () => {
  const { execSync } = require('child_process');
  
  it('Python → Node.js: <场景描述>', () => {
    // Python 执行
    execSync('python scripts/<file>.py <args>');
    
    // Node.js 验证
    const nodeOutput = execSync('node module/scripts/<path>/<file>.js <args>', {
      encoding: 'utf8'
    });
    
    // 验证
    assert.ok(nodeOutput.includes('expected'));
  });
});
```

### 步骤 6: 验证测试文件

```bash
# 运行测试
cd D:\huangyg\git\sample\awiki\module
npm test -- doc/scripts/<path>/<file>.py/test.js
```

## 验收标准

1. ✅ 测试文件 `test.js` 已创建
2. ✅ 所有公共函数/类都有测试
3. ✅ 测试覆盖正常流程和边界情况
4. ✅ 依赖接口测试已添加
5. ✅ CLI 测试已添加（如果适用）
6. ✅ 交叉测试已添加（如果模块已移植）
7. ✅ 测试可以执行并通过

## 注意事项

- **基于蒸馏数据**：测试输入输出应与 py.json 一致
- **依赖测试**：测试依赖接口确保数据正确传递
- **CLI 测试**：对于用户通过 CLI 使用的脚本，必须测试命令行模式
- **交叉测试**：如模块已移植，添加 Python vs Node.js 对比测试
- **独立执行**：测试文件应可独立运行，不依赖其他测试

## 参考资料

- [skill.js.md](../skill.js.md) - 第 3.4 节：编写单元测试
- `doc/scripts/<path>/<file>.py/py.json` - 蒸馏数据
- `doc/scripts/<path>/<file>.py/py.md` - 分析报告
```

---

### 10.3 JS 文件移植任务模版

```markdown
# 任务描述：Node.js 文件移植

## 任务信息
- **任务类型**: 移植
- **目标文件**: `module/scripts/<path>/<file>.js`
- **依赖文件**: 
  - `doc/scripts/<path>/<file>.py/py.md` (分析报告)
  - `doc/scripts/<path>/<file>.py/py.json` (蒸馏数据)
  - `python/scripts/<path>/<file>.py` (Python 源文件)
  - 依赖模块的 Node.js 版本（如已移植）

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`
- module 目录：`D:\huangyg\git\sample\awiki\module\`

### 相关文件位置
- Python 源文件：`python/scripts/<path>/<file>.py`
- 分析报告：`doc/scripts/<path>/<file>.py/py.md`
- 蒸馏数据：`doc/scripts/<path>/<file>.py/py.json`
- Node.js 输出：`module/scripts/<path>/<file>.js`

## 任务目标

根据 Python 源文件、分析报告和蒸馏数据，将 Python 代码移植到 Node.js，保持：
1. 函数名、参数、返回值完全一致
2. 变量名保持一致（如可能）
3. 实现逻辑一致
4. 不做任何猜测和简化

## 前置任务确认

### 步骤 0: 确认前置任务完成（必需！）

**在执行任何操作之前，必须确认前置任务已完成！**

#### 检查清单

- [ ] `python/scripts/<path>/<file>.py` 存在（Python 源文件）
- [ ] `doc/scripts/<path>/<file>.py/py.md` 存在（分析报告）
- [ ] `doc/scripts/<path>/<file>.py/py.md` 包含"蒸馏数据"章节
- [ ] `doc/scripts/<path>/<file>.py/py.json` 存在（蒸馏输出）
- [ ] `doc/scripts/<path>/<file>.py/py.json` 包含完整的 functions 数组
- [ ] `doc/scripts/<path>/<file>.py/test.js` 存在（测试文件，如已创建）

#### 如果前置任务未完成

**退出当前任务**，并通知主 agent：

```
【前置任务未完成】
任务：Node.js 文件移植 - <file>.py
缺失的前置条件：
- Python 源文件不存在：python/scripts/<path>/<file>.py
或
- 分析报告未更新：doc/scripts/<path>/<file>.py/py.md 缺少"蒸馏数据"章节
或
- 蒸馏输出不存在：doc/scripts/<path>/<file>.py/py.json
或
- 测试文件未创建：doc/scripts/<path>/<file>.py/test.js

请先执行前置任务：
1. 蒸馏任务 - 生成 py.json
2. 更新 py.md - 添加"蒸馏数据"章节
3. 测试文件创建 - 创建 test.js

当前任务已暂停，等待前置任务完成。
```

**不要继续执行**，直到前置任务完成！

## 执行步骤

### 步骤 1: 阅读分析报告

读取 `doc/scripts/<path>/<file>.py/py.md`，了解：
- 文件的功能概述
- 所有函数/类的签名
- 导入的模块和依赖
- 调用其他文件的接口
- 被哪些文件调用

### 步骤 2: 阅读蒸馏数据

读取 `doc/scripts/<path>/<file>.py/py.json`，了解：
- 测试输入和预期输出
- 常量定义
- 类结构

### 步骤 3: 阅读 Python 源文件

读取 `python/scripts/<path>/<file>.py`，理解：
- 每个函数的实现逻辑
- 参数处理方式
- 返回值格式
- 异常处理
- 使用的 Python 特有语法

### 步骤 4: 检查依赖模块

检查依赖的模块是否已移植：
- 如已移植：记录导入路径
- 如未移植：标记为待处理，使用占位实现

### 步骤 5: 编写 Node.js 代码

创建 `module/scripts/<path>/<file>.js`：

```javascript
/**
 * <file>.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/<path>/<file>.py
 * 分析报告：doc/scripts/<path>/<file>.py/py.md
 * 蒸馏数据：doc/scripts/<path>/<file>.py/py.json
 */

// 导入依赖（如已移植）
// const { <function> } = require('./<dep>.js');

// 导入 Node.js 内置模块
const path = require('path');
const fs = require('fs');
const os = require('os'); // 用于 home directory 等

/**
 * <函数描述>
 *
 * Python 签名：<function_name>(param1, param2) -> return_type
 *
 * @param {type} param1 - 参数描述
 * @param {type} param2 - 参数描述
 * @returns {type} 返回值描述
 */
function <function_name>(param1, param2) {
  // 实现逻辑与 Python 版本一致
  // ...

  return result;
}

/**
 * 类描述
 */
class <ClassName> {
  /**
   * 构造函数
   * @param {type} param - 参数描述
   */
  constructor(param) {
    this.param = param;
  }

  /**
   * 方法描述
   * @returns {type} 返回值描述
   */
  methodName() {
    // 实现
  }
}

// 导出公共 API
module.exports = {
  <function_name>,
  <ClassName>
};
```

**经验教训** (从 config.js 移植中获得):

1. **路径处理**: Python 的 `Path` 对象在 Node.js 中使用 `path.join()` 处理
2. **数据类转换**: Python 的 `@dataclass` 转换为 Node.js 的 `class` + 构造函数
3. **frozen=True**: 使用 `Object.freeze(this)` 模拟 Python 的 frozen dataclass
4. **环境变量**: Node.js 使用 `process.env.VAR_NAME` 对应 Python 的 `os.environ.get()`
5. **默认值**: Python 的 `field(default_factory=...)` 转换为 JS 的构造函数默认参数
6. **Path 对象**: Python 的 `Path.home()` 对应 Node.js 的 `os.homedir()`

### 步骤 6: Python vs Node.js 语法转换

| Python | Node.js |
|--------|---------|
| `def func():` | `function func() {` |
| `class Name:` | `class Name {` |
| `self.param` | `this.param` |
| `None` | `null` |
| `True/False` | `true/false` |
| `import x` | `const x = require('x')` |
| `with x as y:` | `using` 或 try/finally |
| `list.append()` | `array.push()` |
| `dict.get(key)` | `obj[key]` |
| `f-string` | 模板字符串 |
| `async def` | `async function` |
| `await` | `await` |

### 步骤 7: 处理外部依赖

**lib 适配器**：
```javascript
// 使用 lib 适配器
const anp = require('../../lib/anp-0.6.8/index.js');
const httpx = require('../../lib/httpx-0.28.0/index.js');
const websockets = require('../../lib/websockets-14.0/index.js');
```

**Node.js 内置模块**：
```javascript
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
```

**第三方库**：
```javascript
// package.json 中已安装的库
const undici = require('undici');
const ws = require('ws');
const betterSqlite3 = require('better-sqlite3');
```

### 步骤 8: 验证代码

```bash
# 语法检查
cd D:\huangyg\git\sample\awiki\module
node --check scripts/<path>/<file>.js

# 运行测试（如测试文件已存在）
npm test -- doc/scripts/<path>/<file>.py/test.js
```

### 步骤 9: 完整性检查（防遗漏）

**任务完成检查清单**：

- [ ] Node.js 源文件已创建
- [ ] 所有公共函数/类都已移植
- [ ] 函数名、参数、返回值与 Python 一致
- [ ] 依赖导入正确（检查 require 路径）
- [ ] 代码通过语法检查（node --check）
- [ ] 测试通过（如有 test.js）
- [ ] 交叉测试验证（Python vs Node.js 输出对比）

**只有所有复选框都勾选，任务才算完成！**

## 验收标准

1. ✅ Node.js 代码 `module/scripts/<path>/<file>.js` 已创建
2. ✅ 所有公共函数/类都已移植
3. ✅ 函数名、参数、返回值与 Python 版本一致
4. ✅ 变量名保持一致（如可能）
5. ✅ 实现逻辑与 Python 版本一致
6. ✅ 依赖处理正确（导入/导出）
7. ✅ 代码可以通过语法检查
8. ✅ 测试通过（如测试文件已存在）
9. ✅ **完整性检查通过**（检查清单全部勾选）

## 注意事项

- **不做猜测**：严格按照 Python 版本实现，不做任何猜测和简化
- **保持一致**：函数名、参数、返回值完全一致
- **依赖检查**：确保依赖的模块已移植或有替代方案
- **CLI 支持**：对于用户通过 CLI 使用的脚本，保留命令行参数处理
- **注释完整**：添加 JSDoc 注释，说明函数功能、参数、返回值
- **快速测试≠正式测试**：node -e 验证不能替代 test.js 文件

## 常见遗漏错误

❌ **错误 1**：用 node -e 快速测试代替正式 test.js
   - **防止**：测试任务有独立的 test.js 创建步骤，必须执行

❌ **错误 2**：移植后不做交叉验证
   - **防止**：步骤 9 要求 Python vs Node.js 输出对比

❌ **错误 3**：依赖模块未检查
   - **防止**：步骤 4 明确要求检查依赖是否已移植

## 参考资料

- [skill.js.md](../skill.js.md) - 第 3.5 节：移植模块
- [skill.py.md](../skill.py.md) - Python 版本分析
- `doc/scripts/<path>/<file>.py/py.md` - 分析报告
- `doc/scripts/<path>/<file>.py/py.json` - 蒸馏数据
- `python/scripts/<path>/<file>.py` - Python 源文件
```

---

### 10.4 JS 文件测试任务模版

```markdown
# 任务描述：Node.js 文件测试

## 任务信息
- **任务类型**: 测试
- **目标文件**: `module/scripts/<path>/<file>.js`
- **测试文件**: `doc/scripts/<path>/<file>.py/test.js`
- **依赖文件**: 
  - `doc/scripts/<path>/<file>.py/py.json` (蒸馏数据)
  - `doc/scripts/<path>/<file>.py/test.js` (测试文件)

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`
- module 目录：`D:\huangyg\git\sample\awiki\module\`

### 相关文件位置
- Node.js 源文件：`module/scripts/<path>/<file>.js`
- 蒸馏数据：`doc/scripts/<path>/<file>.py/py.json`
- 测试文件：`doc/scripts/<path>/<file>.py/test.js`

## 任务目标

运行测试文件验证 Node.js 移植代码的正确性，确保：
1. 所有测试通过
2. 行为与 Python 版本一致
3. 蒸馏数据验证通过

## 执行步骤

### 步骤 1: 检查前置条件

确认以下文件存在：
- [ ] `module/scripts/<path>/<file>.js` (Node.js 源文件)
- [ ] `doc/scripts/<path>/<file>.py/test.js` (测试文件)
- [ ] `doc/scripts/<path>/<file>.py/py.json` (蒸馏数据)

### 步骤 2: 安装依赖

```bash
cd D:\huangyg\git\sample\awiki\module
npm install
```

### 步骤 3: 运行单元测试

```bash
# 运行单个测试文件
npm test -- doc/scripts/<path>/<file>.py/test.js

# 或运行特定测试
npm test -- --testNamePattern="<测试名称>"
```

### 步骤 4: 运行 CLI 测试（如果适用）

```bash
# 直接执行 CLI 脚本
node module/scripts/<path>/<file>.js --arg1 value1

# 验证输出
node module/scripts/<path>/<file>.js --arg1 value1 | findstr "expected"
```

### 步骤 5: 运行交叉测试（如果适用）

```bash
# Python vs Node.js 对比测试
npm run test:compare -- doc/scripts/<path>/<file>.py/test.js
```

### 步骤 6: 分析测试结果

**通过**：
- ✅ 所有测试通过
- ✅ 输出与预期一致
- ✅ 无错误和警告

**失败**：
- ❌ 记录失败的测试
- ❌ 分析失败原因
- ❌ 生成修复建议

### 步骤 7: 生成测试报告

```markdown
## 测试报告：<file>.js

### 测试概览
- 总测试数：X
- 通过：Y
- 失败：Z
- 跳过：W

### 通过的测试
1. ✅ <测试名称 1>
2. ✅ <测试名称 2>

### 失败的测试
1. ❌ <测试名称>
   - 原因：<失败原因>
   - 建议：<修复建议>

### CLI 测试
- ✅/❌ CLI 命令执行成功
- ✅/❌ 输出与预期一致

### 交叉测试
- ✅/❌ Python vs Node.js 行为一致
```

## 验收标准

1. ✅ 所有单元测试通过
2. ✅ CLI 测试通过（如果适用）
3. ✅ 交叉测试通过（如果适用）
4. ✅ 测试报告已生成
5. ✅ 失败测试有修复建议

## 注意事项

- **蒸馏数据验证**：确保测试使用 py.json 中的蒸馏数据
- **CLI 测试**：对于用户通过 CLI 使用的脚本，必须测试命令行模式
- **交叉测试**：如可能，运行 Python vs Node.js 对比测试
- **错误分析**：详细记录失败原因和修复建议

## 参考资料

- [skill.js.md](../skill.js.md) - 第 3.6 节：单元测试验证
- `doc/scripts/<path>/<file>.py/py.json` - 蒸馏数据
- `doc/scripts/<path>/<file>.py/test.js` - 测试文件
```

---

### 10.5 集成测试编写任务模版

```markdown
# 任务描述：集成测试编写

## 任务信息
- **任务类型**: 集成测试
- **目标文件**: `module/tests/integration/<scenario>.test.js`
- **依赖文件**: 
  - 多个已移植的模块
  - Python 版本的对应场景脚本

## 项目上下文

### 项目根目录
- Python 版本：`D:\huangyg\git\sample\awiki\python\`
- 文档目录：`D:\huangyg\git\sample\awiki\doc\`
- module 目录：`D:\huangyg\git\sample\awiki\module\`

### 测试场景
- **场景名称**: <场景描述，如"明文通信">
- **涉及模块**: <模块列表>
- **轮次要求**: 3 轮以上来回通信

## 任务目标

编写集成测试验证多个模块协作的正确性，包括：
1. Python vs Node.js 交叉测试
2. 多轮来回通信
3. 端到端场景验证

## 执行步骤

### 步骤 1: 确定测试场景

根据需求确定测试场景：

**明文通信场景**：
- Python 发送 → Node.js 接收
- Node.js 发送 → Python 接收
- 双向通信（3 轮以上）

**密文通信场景**：
- E2EE 会话初始化
- E2EE 加密消息
- E2EE 解密消息

**群组通信场景**：
- 创建群组 → 加入 → 发送消息
- 多成员消息交换

### 步骤 2: 准备测试身份

```javascript
// 测试身份配置
const TEST_IDENTITIES = {
  python: {
    did: 'did:wba:awiki.ai:user:k1_python_test',
    credential: 'python_test'
  },
  node: {
    did: 'did:wba:awiki.ai:user:k1_node_test',
    credential: 'node_test'
  }
};
```

### 步骤 3: 编写集成测试

创建 `module/tests/integration/<scenario>.test.js`：

```javascript
/**
 * 集成测试：<场景名称>
 * 
 * 测试 Python vs Node.js 交叉通信
 */

const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');

// 项目路径
const PYTHON_DIR = path.join(__dirname, '../../..', 'python');
const MODULE_DIR = path.join(__dirname, '../..');

describe('Integration Tests: <场景名称>', () => {
  
  // 测试身份
  const pythonDid = '<Python DID>';
  const nodeDid = '<Node.js DID>';
  
  before(() => {
    // 前置条件检查
    // 确保 Python 和 Node.js 身份都已创建
  });
  
  // 场景 1: Python → Node.js
  describe('Python → Node.js', () => {
    it('should receive message from Python (Round 1)', () => {
      // Python 发送
      execSync(
        `python scripts/send_message.py --to ${nodeDid} --content "Round 1 from Python"`,
        { cwd: PYTHON_DIR, stdio: 'pipe' }
      );
      
      // Node.js 接收
      const inbox = execSync(
        'node scripts/check-inbox.js --limit 1',
        { cwd: MODULE_DIR, encoding: 'utf8' }
      );
      
      // 验证
      assert.ok(inbox.includes('Round 1 from Python'));
    });
    
    // 添加更多轮次...
  });
  
  // 场景 2: Node.js → Python
  describe('Node.js → Python', () => {
    it('should receive message from Node.js (Round 2)', () => {
      // Node.js 发送
      execSync(
        `node scripts/check-inbox.js --to ${pythonDid} --content "Round 2 from Node.js"`,
        { cwd: MODULE_DIR, stdio: 'pipe' }
      );
      
      // Python 接收
      const inbox = execSync(
        'python scripts/check_inbox.py --limit 1',
        { cwd: PYTHON_DIR, encoding: 'utf8' }
      );
      
      // 验证
      assert.ok(inbox.includes('Round 2 from Node.js'));
    });
  });
  
  // 场景 3: 双向通信（3 轮以上）
  describe('Bidirectional Communication (3+ rounds)', () => {
    const messages = [];
    
    it('Round 1: Python → Node.js', () => {
      // 实现
    });
    
    it('Round 2: Node.js → Python', () => {
      // 实现
    });
    
    it('Round 3: Python → Node.js', () => {
      // 实现
    });
    
    it('Round 4: Node.js → Python', () => {
      // 实现
    });
  });
});
```

### 步骤 4: 添加 E2EE 测试（如果适用）

```javascript
describe('E2EE Cross-Platform Tests', () => {
  it('should complete E2EE handshake and exchange messages', () => {
    // Round 1: Python initiates E2EE
    execSync(
      `python scripts/e2ee_messaging.py --send ${nodeDid} --content "E2EE Round 1"`,
      { cwd: PYTHON_DIR }
    );
    
    // Round 2: Node.js responds
    execSync(
      `node scripts/e2ee-messaging.js --send ${pythonDid} --content "E2EE Round 2"`,
      { cwd: MODULE_DIR }
    );
    
    // Round 3: Verify decryption
    const inbox = execSync(
      'node scripts/check-inbox.js --e2ee --limit 2',
      { cwd: MODULE_DIR, encoding: 'utf8' }
    );
    
    assert.ok(inbox.includes('E2EE'));
  });
});
```

### 步骤 5: 添加群组测试（如果适用）

```javascript
describe('Group Cross-Platform Tests', () => {
  let groupId;
  let joinCode;
  
  it('Python creates group', () => {
    const result = execSync(
      'python scripts/manage_group.py --create --name "Test" --slug test',
      { cwd: PYTHON_DIR, encoding: 'utf8' }
    );
    const data = JSON.parse(result);
    groupId = data.groupId;
    joinCode = data.join_code;
  });
  
  it('Node.js joins group', () => {
    execSync(
      `node scripts/manage-group.js --join --group-id ${groupId} --join-code ${joinCode}`,
      { cwd: MODULE_DIR }
    );
  });
  
  it('Exchange group messages (3 rounds)', () => {
    // 实现 3 轮群消息交换
  });
});
```

### 步骤 6: 运行集成测试

```bash
cd D:\huangyg\git\sample\awiki\module

# 运行所有集成测试
npm run test:integration

# 运行特定场景测试
npm run test:integration -- --testNamePattern="<场景名称>"
```

### 步骤 7: 分析测试结果

生成测试报告：

```markdown
## 集成测试报告：<场景名称>

### 测试概览
- 总测试数：X
- 通过：Y
- 失败：Z

### 交叉测试结果
| 方向 | 轮次 | 结果 |
|------|------|------|
| Python → Node.js | 1 | ✅ |
| Node.js → Python | 2 | ✅ |
| Python → Node.js | 3 | ✅ |
| Node.js → Python | 4 | ✅ |

### 问题记录
1. <问题描述>
   - 原因：<原因分析>
   - 建议：<修复建议>
```

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
