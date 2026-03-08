# Node.js 客户端完整测试计划

**版本**: 1.0
**创建日期**: 2026-03-08
**测试类型**: 跨环境互操作性测试
**测试平台**: awiki.ai 正式服务

---

## 1. 测试概述

### 1.1 测试目标

验证 Node.js 客户端所有功能与 Python 客户端行为一致，确保：
- 功能完整性：所有 Python 功能 Node.js 都支持
- 互操作性：Python 和 Node.js 可以互相通信
- 服务兼容性：都能与 awiki.ai 正常交互

### 1.2 测试场景

```
┌─────────────────────────────────────────────────────────────────┐
│                        awiki.ai 云服务                          │
│                                                                 │
│   ┌─────────────┐                           ┌─────────────┐    │
│   │  身份服务   │                           │   消息服务   │    │
│   │  DID Auth   │                           │   Message    │    │
│   └─────────────┘                           └─────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           ▲                                           ▲
           │                                           │
    ┌──────┴──────┐                             ┌──────┴──────┐
    │  局域网 A   │                             │  局域网 B   │
    │             │                             │             │
    │  ┌───────┐  │                             │  ┌───────┐  │
    │  │ PC-A  │  │                             │  │ PC-B  │  │
    │  │Python │  │◄─────── 互联网 ───────────►│  │Node.js│  │
    │  └───────┘  │                             │  └───────┘  │
    │             │                             │             │
    └─────────────┘                             └─────────────┘
```

### 1.3 测试环境要求

| 环境 | 配置要求 | 软件 |
|------|---------|------|
| **PC-A** | 任意 PC，可上网 | Python 3.10+ |
| **PC-B** | 任意 PC，可上网 | Node.js 18+ |
| **网络** | 能访问 awiki.ai | 不同局域网或同一网络 |

---

## 2. 测试环境搭建

### 2.1 PC-A: Python 环境

```bash
# 1. 克隆/下载 python-client
cd D:\huangyg\git\sample\awiki\python-client

# 2. 安装依赖
pip install -r requirements.txt

# 3. 验证安装
python -c "import anp; print(f'ANP version: {anp.__version__}')"
```

### 2.2 PC-B: Node.js 环境

```bash
# 1. 进入 nodejs-client 目录
cd D:\huangyg\git\sample\awiki\nodejs-client

# 2. 安装依赖
npm install

# 3. 验证安装
node -e "console.log('Node.js version:', process.version)"
```

### 2.3 测试凭证管理

**为每个测试创建独立凭证**，避免相互干扰：

| 测试 | Python 凭证名 | Node.js 凭证名 |
|------|-------------|---------------|
| 基础身份测试 | `py_test_base` | `node_test_base` |
| 消息测试 | `py_test_msg` | `node_test_msg` |
| E2EE 测试 | `py_test_e2ee` | `node_test_e2ee` |
| 社交测试 | `py_test_social` | `node_test_social` |
| 群组测试 | `py_test_group` | `node_test_group` |

---

## 3. 测试层次与依赖关系

```
Level 1: 基础功能（独立，可并行）
├── T01: DID 身份创建
├── T02: DID 注册
└── T03: JWT 认证

Level 2: 消息功能（依赖 Level 1）
├── T04: 明文消息发送
├── T05: 明文消息接收
└── T06: 消息历史

Level 3: E2EE 功能（依赖 Level 1+2）
├── T07: E2EE 握手
├── T08: E2EE 消息加密
├── T09: E2EE 消息解密
└── T10: E2EE 互操作

Level 4: 社交功能（依赖 Level 1）
├── T11: 关注/取消关注
├── T12: 粉丝/关注列表
└── T13: 个人资料

Level 5: 群组功能（依赖 Level 1+4）
├── T14: 创建群组
├── T15: 邀请成员
└── T16: 群组消息

Level 6: 高级功能（依赖前面所有）
├── T17: Handle 注册/解析
├── T18: 内容页面
└── T19: WebSocket 监听
```

---

## 4. 详细测试用例

### Level 1: 基础功能测试

#### T01: DID 身份创建

**目标**: 验证 Python 和 Node.js 都能创建符合规范的 DID 身份

**前置条件**: 无

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/setup_identity.py --name "PyTest1" --credential py_test_base` | `node scripts/setup_identity.js --name "NodeTest1" --credential node_test_base` | 都成功创建 |
| 2 | 记录输出：DID、user_id、JWT | 记录输出：DID、user_id、JWT | 格式一致 |
| 3 | 检查凭证文件内容 | 检查凭证文件内容 | 结构一致 |

**验证点**:
- [ ] DID 格式：`did:wba:awiki.ai:user:k1_{fingerprint}`
- [ ] DID 文档包含 proof 字段
- [ ] 包含 E2EE 密钥 (key-2, key-3)
- [ ] 凭证文件包含所有必要字段

**通过标准**: Python 和 Node.js 创建的 DID 格式一致，都能成功注册

---

#### T02: DID 注册

**目标**: 验证 Python 和 Node.js 都能成功注册 DID 到 awiki.ai

**前置条件**: T01 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | 运行 setup_identity（自动注册） | 运行 setup_identity（自动注册） | 都返回 user_id |
| 2 | 记录注册响应 | 记录注册响应 | 响应格式一致 |
| 3 | 尝试重新注册同一 DID | 尝试重新注册同一 DID | 都返回已注册信息 |

**验证点**:
- [ ] 注册成功，返回 user_id
- [ ] 重复注册返回相同 user_id
- [ ] 无错误信息

**通过标准**: Python 和 Node.js 都能成功注册，返回的 user_id 格式一致

---

#### T03: JWT 认证

**目标**: 验证 Python 和 Node.js 都能通过 DID 签名获取 JWT

**前置条件**: T02 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | 运行 setup_identity（自动获取 JWT） | 运行 setup_identity（自动获取 JWT） | 都返回 JWT |
| 2 | 使用 JWT 调用需要认证的 API | 使用 JWT 调用需要认证的 API | 都成功 |
| 3 | 等待 JWT 过期后重试 | 等待 JWT 过期后重试 | 都自动刷新 |

**验证点**:
- [ ] JWT 格式正确（三段式）
- [ ] JWT 能用于认证 API 调用
- [ ] JWT 过期后能自动刷新

**通过标准**: Python 和 Node.js 都能获取和使用 JWT

---

### Level 2: 消息功能测试

#### T04: 明文消息发送

**目标**: 验证 Python 和 Node.js 都能发送明文消息

**前置条件**: T03 通过，需要两个测试身份

**测试步骤**:

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | PC-A: `python scripts/send_message.py --to {Node_DID} --content "Hello from Python"` | 发送成功 |
| 2 | PC-B: `node scripts/send_message.js --to {Py_DID} --content "Hello from Node.js"` | 发送成功 |
| 3 | 检查发送响应 | 响应格式一致 |

**验证点**:
- [ ] 消息发送成功
- [ ] 返回消息 ID
- [ ] 响应格式一致

---

#### T05: 明文消息接收

**目标**: 验证 Python 和 Node.js 都能接收消息

**前置条件**: T04 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/check_inbox.py` | `node scripts/check_inbox.js` | 都显示收到的消息 |
| 2 | 检查消息内容 | 检查消息内容 | 内容正确 |
| 3 | 检查消息元数据 | 检查消息元数据 | 元数据完整 |

**验证点**:
- [ ] 能收到对方发送的消息
- [ ] 消息内容正确
- [ ] 发件人、时间等元数据正确

---

#### T06: 消息历史

**目标**: 验证 Python 和 Node.js 都能获取消息历史

**前置条件**: T05 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/check_inbox.py --history {Node_DID}` | `node scripts/check_inbox.js --history {Py_DID}` | 都显示历史消息 |
| 2 | 检查历史消息列表 | 检查历史消息列表 | 列表一致 |
| 3 | 检查分页功能 | 检查分页功能 | 分页行为一致 |

---

### Level 3: E2EE 功能测试

#### T07: E2EE 握手

**目标**: 验证 Python 和 Node.js 能完成 E2EE 握手

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | PC-A: `python scripts/e2ee_messaging.py --init --peer {Node_DID}` | 发送 e2ee_init |
| 2 | PC-B: `node scripts/e2ee_messaging.js --accept --peer {Py_DID}` | 响应 e2ee_ack |
| 3 | 检查双方会话状态 | 都显示 ACTIVE |

**验证点**:
- [ ] e2ee_init 格式正确
- [ ] e2ee_ack 格式正确
- [ ] 双方会话状态都为 ACTIVE

---

#### T08: E2EE 消息加密

**目标**: 验证 Python 和 Node.js 都能加密 E2EE 消息

**前置条件**: T07 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/e2ee_messaging.py --send --peer {Node_DID} --content "Secret from Py"` | - | 加密成功 |
| 2 | - | `node scripts/e2ee_messaging.js --send --peer {Py_DID} --content "Secret from Node"` | 加密成功 |
| 3 | 检查加密消息格式 | 检查加密消息格式 | 格式一致 |

**验证点**:
- [ ] 消息被正确加密
- [ ] 包含 session_id、seq、ciphertext
- [ ] original_type 正确

---

#### T09: E2EE 消息解密

**目标**: 验证 Python 和 Node.js 都能解密 E2EE 消息

**前置条件**: T08 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/e2ee_messaging.py --recv --peer {Node_DID}` | - | 解密成功 |
| 2 | - | `node scripts/e2ee_messaging.js --recv --peer {Py_DID}` | 解密成功 |
| 3 | 检查解密内容 | 检查解密内容 | 与原文一致 |

**验证点**:
- [ ] 能成功解密对方发送的消息
- [ ] 解密内容与原文一致
- [ ] 序列号正确处理

---

#### T10: E2EE 互操作性（关键测试）

**目标**: 验证 Python 和 Node.js 的 E2EE 完全互操作

**前置条件**: T09 通过

**测试步骤**:

| 轮次 | 发送方 | 接收方 | 消息内容 | 预期结果 |
|------|--------|--------|---------|---------|
| 1 | Python | Node.js | "测试消息 1" | Node.js 成功解密 |
| 2 | Node.js | Python | "测试消息 2" | Python 成功解密 |
| 3 | Python | Node.js | "测试消息 3" | Node.js 成功解密 |
| 4 | Node.js | Python | "测试消息 4" | Python 成功解密 |
| 5 | Python | Node.js | 中文测试：你好世界 | Node.js 成功解密 |
| 6 | Node.js | Python | 中文测试：你好世界 | Python 成功解密 |

**验证点**:
- [ ] 所有消息都能成功解密
- [ ] 解密内容与原文完全一致
- [ ] 支持多轮对话
- [ ] 支持中文等特殊字符

**通过标准**: 所有轮次都成功，这是验证 Ratchet 实现是否正确的关键测试

---

### Level 4: 社交功能测试

#### T11: 关注/取消关注

**目标**: 验证 Python 和 Node.js 都能管理关注关系

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/manage_relationship.py --follow {Node_DID}` | - | 关注成功 |
| 2 | - | `node scripts/manage_relationship.js --follow {Py_DID}` | 关注成功 |
| 3 | `python scripts/manage_relationship.py --unfollow {Node_DID}` | - | 取消成功 |

**验证点**:
- [ ] 关注成功
- [ ] 取消关注成功
- [ ] 响应格式一致

---

#### T12: 粉丝/关注列表

**目标**: 验证 Python 和 Node.js 都能获取粉丝和关注列表

**前置条件**: T11 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/manage_relationship.py --list following` | `node scripts/manage_relationship.js --list following` | 列表正确 |
| 2 | `python scripts/manage_relationship.py --list followers` | `node scripts/manage_relationship.js --list followers` | 列表正确 |

---

#### T13: 个人资料

**目标**: 验证 Python 和 Node.js 都能管理个人资料

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/get_profile.py` | `node scripts/get_profile.js` | 获取成功 |
| 2 | `python scripts/update_profile.py --nick-name "PyTest" --bio "Test bio"` | `node scripts/update_profile.js --nick-name "NodeTest" --bio "Test bio"` | 更新成功 |
| 3 | 再次获取资料 | 再次获取资料 | 显示更新内容 |

---

### Level 5: 群组功能测试

#### T14: 创建群组

**目标**: 验证 Python 和 Node.js 都能创建群组

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/manage_group.py --create --name "TestGroup"` | `node scripts/manage_group.js --create --name "TestGroup"` | 创建成功 |
| 2 | 记录群组 ID | 记录群组 ID | 格式一致 |

---

#### T15: 邀请成员

**目标**: 验证 Python 和 Node.js 都能邀请成员入群

**前置条件**: T14 通过

**测试步骤**:

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | PC-A: `python scripts/manage_group.py --invite --group {group_id} --member {Node_DID}` | 邀请成功 |
| 2 | PC-B: 接受邀请 | 接受成功 |
| 3 | 检查群成员列表 | 列表正确 |

---

#### T16: 群组消息

**目标**: 验证 Python 和 Node.js 都能发送和接收群组消息

**前置条件**: T15 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/manage_group.py --send --group {group_id} --content "Hello"` | - | 发送成功 |
| 2 | - | `node scripts/manage_group.js --recv --group {group_id}` | 接收成功 |

---

### Level 6: 高级功能测试

#### T17: Handle 注册/解析

**目标**: 验证 Python 和 Node.js 都能注册和解析 Handle

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/register_handle.py --handle "test.py"` | `node scripts/register_handle.js --handle "test.node"` | 注册成功 |
| 2 | `python scripts/resolve_handle.py --handle "test.py"` | `node scripts/resolve_handle.js --handle "test.node"` | 解析成功 |

---

#### T18: 内容页面

**目标**: 验证 Python 和 Node.js 都能管理内容页面

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/manage_content.py --create --title "Test" --content "Content"` | `node scripts/manage_content.js --create --title "Test" --content "Content"` | 创建成功 |
| 2 | `python scripts/manage_content.py --list` | `node scripts/manage_content.js --list` | 列表正确 |

---

#### T19: WebSocket 监听

**目标**: 验证 Python 和 Node.js 都能通过 WebSocket 接收实时消息

**前置条件**: T03 通过

**测试步骤**:

| 步骤 | PC-A (Python) | PC-B (Node.js) | 预期结果 |
|------|--------------|---------------|---------|
| 1 | `python scripts/ws_listener.py` (后台运行) | `node scripts/ws_listener.js` (后台运行) | 连接成功 |
| 2 | 发送测试消息 | 检查是否收到推送 | 都收到推送 |

---

## 5. 测试结果记录

### 5.1 测试记录模板

```markdown
## T[编号]: [测试名称]

**测试日期**: YYYY-MM-DD HH:MM
**测试人员**: [姓名]
**环境**:
- PC-A: Python x.x.x, [网络环境]
- PC-B: Node.js x.x.x, [网络环境]

### 测试步骤执行

| 步骤 | Python 结果 | Node.js 结果 | 一致？ |
|------|-----------|-----------|--------|
| 1 | [结果] | [结果] | ✅/❌ |
| 2 | [结果] | [结果] | ✅/❌ |

### 验证点

- [ ] 验证点 1: [通过/失败]
- [ ] 验证点 2: [通过/失败]

### 问题记录

[如有问题，详细描述]

### 结论

[通过/失败]
```

### 5.2 总体测试结果汇总

| 测试 ID | 测试名称 | Python | Node.js | 互操作 | 状态 |
|--------|---------|--------|---------|--------|------|
| T01 | DID 身份创建 | ✅ | ✅ | N/A | ⏳ |
| T02 | DID 注册 | ✅ | ✅ | N/A | ⏳ |
| T03 | JWT 认证 | ✅ | ✅ | N/A | ⏳ |
| T04 | 明文消息发送 | ✅ | ✅ | N/A | ⏳ |
| T05 | 明文消息接收 | ✅ | ✅ | N/A | ⏳ |
| T06 | 消息历史 | ✅ | ✅ | N/A | ⏳ |
| T07 | E2EE 握手 | ✅ | ✅ | ✅ | ⏳ |
| T08 | E2EE 加密 | ✅ | ✅ | N/A | ⏳ |
| T09 | E2EE 解密 | ✅ | ✅ | N/A | ⏳ |
| T10 | E2EE 互操作 | ✅ | ✅ | ✅ | ⏳ |
| T11 | 关注/取消 | ✅ | ✅ | N/A | ⏳ |
| T12 | 粉丝/关注列表 | ✅ | ✅ | N/A | ⏳ |
| T13 | 个人资料 | ✅ | ✅ | N/A | ⏳ |
| T14 | 创建群组 | ✅ | ✅ | N/A | ⏳ |
| T15 | 邀请成员 | ✅ | ✅ | N/A | ⏳ |
| T16 | 群组消息 | ✅ | ✅ | N/A | ⏳ |
| T17 | Handle 注册/解析 | ✅ | ✅ | N/A | ⏳ |
| T18 | 内容页面 | ✅ | ✅ | N/A | ⏳ |
| T19 | WebSocket 监听 | ✅ | ✅ | N/A | ⏳ |

---

## 6. 问题修复流程

### 6.1 问题分类

| 类别 | 描述 | 优先级 |
|------|------|--------|
| **P0** | 功能完全失败，无法使用 | 紧急 |
| **P1** | 互操作失败，Python↔Node.js 无法通信 | 高 |
| **P2** | 功能可用但与 Python 行为不一致 | 中 |
| **P3** | 边缘情况问题，不影响主要功能 | 低 |

### 6.2 修复流程

```
发现问题
   ↓
记录问题现象和复现步骤
   ↓
在 awiki.ai 验证问题
   ↓
分析问题原因
   ↓
制定修复方案
   ↓
实施修复
   ↓
重新运行测试
   ↓
验证修复
   ↓
记录修复过程
```

---

## 7. 测试执行计划

### 7.1 第一阶段：基础功能（预计 1 天）

- T01: DID 身份创建
- T02: DID 注册
- T03: JWT 认证

### 7.2 第二阶段：消息功能（预计 1 天）

- T04: 明文消息发送
- T05: 明文消息接收
- T06: 消息历史

### 7.3 第三阶段：E2EE 功能（预计 2 天）

- T07: E2EE 握手
- T08: E2EE 加密
- T09: E2EE 解密
- T10: E2EE 互操作（关键）

### 7.4 第四阶段：社交功能（预计 1 天）

- T11: 关注/取消
- T12: 粉丝/关注列表
- T13: 个人资料

### 7.5 第五阶段：群组功能（预计 1 天）

- T14: 创建群组
- T15: 邀请成员
- T16: 群组消息

### 7.6 第六阶段：高级功能（预计 1 天）

- T17: Handle 注册/解析
- T18: 内容页面
- T19: WebSocket 监听

---

## 8. 测试报告

测试完成后，创建完整测试报告：

**文件**: `MIGRATION-proj/docs/INTEROPERABILITY_TEST_REPORT.md`

**内容**:
1. 测试概述
2. 测试环境
3. 测试结果汇总
4. 问题清单
5. 修复记录
6. 最终结论
7. 后续建议

---

## 9. 附录

### 9.1 测试脚本位置

| 功能 | Python 脚本 | Node.js 脚本 |
|------|-----------|-----------|
| 身份创建 | `scripts/setup_identity.py` | `scripts/setup_identity.js` |
| 发送消息 | `scripts/send_message.py` | `scripts/send_message.js` |
| 检查收件箱 | `scripts/check_inbox.py` | `scripts/check_inbox.js` |
| E2EE 消息 | `scripts/e2ee_messaging.py` | `scripts/e2ee_messaging.js` |
| 管理关系 | `scripts/manage_relationship.py` | `scripts/manage_relationship.js` |
| 管理群组 | `scripts/manage_group.py` | `scripts/manage_group.js` |
| 获取资料 | `scripts/get_profile.py` | `scripts/get_profile.js` |
| 更新资料 | `scripts/update_profile.py` | `scripts/update_profile.js` |
| 注册 Handle | `scripts/register_handle.py` | `scripts/register_handle.js` |
| 解析 Handle | `scripts/resolve_handle.py` | `scripts/resolve_handle.js` |
| 管理内容 | `scripts/manage_content.py` | `scripts/manage_content.js` |
| WebSocket | `scripts/ws_listener.py` | `scripts/ws_listener.js` |

### 9.2 常见问题

**Q: 测试失败如何排查？**

A: 
1. 检查网络连接
2. 检查凭证是否有效
3. 查看详细错误日志
4. 对比 Python 和 Node.js 的请求差异

**Q: E2EE 解密失败怎么办？**

A:
1. 确认握手成功
2. 检查会话状态
3. 对比 Ratchet 派生算法
4. 检查序列号是否同步

---

**文档版本**: 1.0
**创建日期**: 2026-03-08
**审查周期**: 每次 Node.js 更新后
