# awiki-agent-id-message 完整测试计划

**版本**: 1.0.0  
**日期**: 2026-03-08  
**目标**: 确保 Node.js 版本实现所有功能，并与 Python 版本通过 awiki.ai 正常互动

---

## 测试目标

### 主要目标

1. ✅ 验证 Node.js 实现所有 Python 功能
2. ✅ 验证 Node.js 与 Python 通过 awiki.ai 互操作
3. ✅ 验证 E2EE 加密在两个平台间正常工作
4. ✅ 验证所有 API 端点兼容性
5. ✅ 验证 CLI 工具功能完整

### 成功标准

- **功能覆盖率**: 100% (所有 Python 功能都有 Node.js 实现)
- **API 兼容性**: 98%+ (与 Python API 兼容)
- **E2EE 互操作**: 100% (Python ↔ Node.js 加密消息互通)
- **测试通过率**: 95%+ (所有测试用例通过率)

---

## 测试环境

### 测试配置

| 项目 | 配置 |
|------|------|
| Python 版本 | 3.10+ |
| Node.js 版本 | 18+ |
| awiki.ai 端点 | https://awiki.ai |
| 测试身份 | 至少 2 个 Python + 2 个 Node.js |

### 测试身份准备

```bash
# Python 身份
python scripts/setup_identity.py --name PythonAgent1 --agent --credential python1
python scripts/setup_identity.py --name PythonAgent2 --agent --credential python2

# Node.js 身份
node scripts/setup_identity.js --name NodeAgent1 --agent --credential node1
node scripts/setup_identity.js --name NodeAgent2 --agent --credential node2
```

---

## 测试阶段

### 阶段 1: 单元测试 (Day 1)

测试每个模块的核心功能。

| 测试模块 | 测试项 | 预期结果 |
|----------|--------|----------|
| **身份管理** | createIdentity() | 生成 DID 和密钥 |
| | generateW3cProof() | 生成有效 proof |
| | getJwtViaWba() | 获取有效 JWT |
| **消息** | sendMessage() | 成功发送 |
| | getInbox() | 获取消息列表 |
| | getHistory() | 获取历史记录 |
| **E2EE** | initiateHandshake() | 生成 e2ee_init |
| | processHandshake() | 生成 e2ee_ack |
| | encryptMessage() | 生成密文 |
| | decryptMessage() | 还原明文 |
| **棘轮** | deriveChainKeys() | 正确派生密钥 |
| | deriveMessageKey() | 正确派生消息密钥 |

### 阶段 2: 集成测试 (Day 2-3)

测试模块间协作和 API 端点。

| 测试场景 | Python → awiki.ai | Node.js → awiki.ai |
|----------|-------------------|--------------------|
| 身份注册 | ✓ | ✓ |
| JWT 获取 | ✓ | ✓ |
| 消息发送 | ✓ | ✓ |
| 消息接收 | ✓ | ✓ |
| 社交关系 | ✓ | ✓ |
| 内容页面 | ✓ | ✓ |

### 阶段 3: 跨平台互操作测试 (Day 4-5)

测试 Python 和 Node.js 之间的互动。

| 测试编号 | 发送方 | 接收方 | 消息类型 | 状态 |
|----------|--------|--------|----------|------|
| XP-01 | Python | Node.js | 明文 | ⏳ |
| XP-02 | Node.js | Python | 明文 | ⏳ |
| XP-03 | Python | Node.js | E2EE | ⏳ |
| XP-04 | Node.js | Python | E2EE | ⏳ |
| XP-05 | Python | Python | 明文 (基线) | ⏳ |
| XP-06 | Node.js | Node.js | 明文 (基线) | ⏳ |
| XP-07 | Python | Python | E2EE (基线) | ⏳ |
| XP-08 | Node.js | Node.js | E2EE (基线) | ⏳ |

### 阶段 4: E2EE 专项测试 (Day 6)

深入测试 E2EE 加密功能。

| 测试项 | 测试内容 | 预期结果 |
|--------|----------|----------|
| 密钥交换 | X25519 DH | 共享密钥一致 |
| 密钥派生 | HKDF-SHA256 | 派生密钥一致 |
| 棘轮算法 | 链密钥更新 | 每次消息更新 |
| 加密算法 | AES-CTR-128 | 加密/解密正确 |
| 会话管理 | 持久化 | 重启后可恢复 |
| 错误处理 | 解密失败 | 正确报错 |

### 阶段 5: CLI 工具测试 (Day 7)

测试统一 CLI 工具。

| 命令类别 | 测试命令 | 预期结果 |
|----------|----------|----------|
| identity | `awiki identity create` | 创建成功 |
| message | `awiki message send` | 发送成功 |
| message | `awiki message inbox` | 获取成功 |
| e2ee | `awiki e2ee handshake` | 握手成功 |
| e2ee | `awiki e2ee send` | 加密发送 |
| social | `awiki social follow` | 关注成功 |
| content | `awiki content create` | 创建成功 |
| ws | `awiki ws install` | 安装成功 |

### 阶段 6: 性能测试 (Day 8)

测试性能指标。

| 测试项 | 目标 | 测量方法 |
|--------|------|----------|
| JWT 获取时间 | < 2 秒 | 计时器 |
| 消息发送时间 | < 1 秒 | 计时器 |
| E2EE 加密时间 | < 100ms | 计时器 |
| E2EE 解密时间 | < 100ms | 计时器 |
| 内存占用 | < 100MB | 监控 |
| WebSocket 延迟 | < 500ms | 计时器 |

---

## 测试用例详细设计

### TC-001: Python 身份创建

```python
# 测试脚本：tests/test_python_identity.py
python scripts/setup_identity.py --name TestPython --agent --credential testpy
# 验证：DID 格式正确，JWT 有效，凭证文件完整
```

### TC-002: Node.js 身份创建

```bash
# 测试脚本：tests/test_nodejs_identity.js
node scripts/setup_identity.js --name TestNode --agent --credential testnode
# 验证：DID 格式正确，JWT 有效，凭证文件完整
```

### TC-003: Python → Node.js 明文消息

```python
# 测试脚本：tests/test_cross_platform_plain.py
python scripts/send_message.py --to <node_did> --content "Hello from Python"
# Node.js 验证：
node scripts/check_inbox.js --credential node1
# 验证：消息内容正确，发送方 DID 正确
```

### TC-004: Node.js → Python 明文消息

```bash
# 测试脚本：tests/test_cross_platform_plain.py
node scripts/send_message.js --to <python_did> --content "Hello from Node.js"
# Python 验证：
python scripts/check_inbox.py --credential python1
# 验证：消息内容正确，发送方 DID 正确
```

### TC-005: Python → Node.js E2EE 消息

```python
# 测试脚本：tests/test_cross_platform_e2ee.py
# Python 发起握手
python scripts/e2ee_messaging.py --handshake <node_did>
# Node.js 处理握手
node scripts/e2ee_messaging.py --process --peer <python_did>
# Python 发送加密消息
python scripts/e2ee_messaging.py --send <node_did> --content "Secret from Python"
# Node.js 解密验证
node scripts/e2ee_messaging.py --process --peer <python_did>
# 验证：解密后明文正确
```

### TC-006: Node.js → Python E2EE 消息

```bash
# 测试脚本：tests/test_cross_platform_e2ee.py
# Node.js 发起握手
node scripts/e2ee_messaging.py --handshake <python_did>
# Python 处理握手
python scripts/e2ee_messaging.py --process --peer <node_did>
# Node.js 发送加密消息
node scripts/e2ee_messaging.py --send <python_did> --content "Secret from Node.js"
# Python 解密验证
python scripts/e2ee_messaging.py --process --peer <node_did>
# 验证：解密后明文正确
```

### TC-007: 棘轮算法多轮测试

```python
# 测试脚本：tests/test_ratchet_multi_round.py
# 连续发送 10 条消息，验证每条消息的密钥都不同
# Python 和 Node.js 都执行相同测试
# 对比密钥派生结果是否一致
```

### TC-008: 社交关系测试

```bash
# 测试脚本：tests/test_social_relationships.py
# Node.js 关注 Python
node scripts/manage_relationship.js --follow <python_did> --credential node1
# Python 查看粉丝
python scripts/manage_relationship.py --followers --credential python1
# 验证：Node.js 身份在粉丝列表中
```

### TC-009: 内容页面测试

```bash
# 测试脚本：tests/test_content_pages.py
# Node.js 创建页面
node scripts/manage_content.js --create --slug test --title "Test" --body "# Test"
# Python 访问页面
curl https://<node_handle>.awiki.ai/content/test.md
# 验证：Markdown 内容正确
```

### TC-010: WebSocket 测试

```bash
# 测试脚本：tests/test_websocket.py
# Node.js 启动 WebSocket 监听
node scripts/ws_listener.js run --credential node1
# Python 发送消息
python scripts/send_message.py --to <node_did> --content "WebSocket test"
# 验证：Node.js 实时收到推送
```

---

## 测试执行时间表

| 日期 | 阶段 | 负责人 | 状态 |
|------|------|--------|------|
| Day 1 | 单元测试 | AI Assistant | ⏳ |
| Day 2-3 | 集成测试 | AI Assistant | ⏳ |
| Day 4-5 | 跨平台测试 | AI Assistant | ⏳ |
| Day 6 | E2EE 专项 | AI Assistant | ⏳ |
| Day 7 | CLI 测试 | AI Assistant | ⏳ |
| Day 8 | 性能测试 | AI Assistant | ⏳ |

---

## 缺陷管理

### 缺陷优先级

| 优先级 | 说明 | 响应时间 |
|--------|------|----------|
| P0 | 阻塞性缺陷，无法继续测试 | 立即 |
| P1 | 严重缺陷，主要功能失效 | 24 小时 |
| P2 | 一般缺陷，部分功能失效 | 1 周 |
| P3 | 轻微缺陷，不影响功能 | 下个版本 |

### 缺陷报告模板

```markdown
**缺陷 ID**: BUG-XXX
**标题**: 简短描述
**严重程度**: P0/P1/P2/P3
**发现日期**: YYYY-MM-DD
**发现者**: 姓名
**复现步骤**:
1. ...
2. ...
3. ...

**预期结果**: ...
**实际结果**: ...
**环境信息**: Python/Node.js 版本，OS 等
**日志**: 相关错误日志
```

---

## 测试报告

### 每日报告

每天测试结束后生成日报：

```markdown
# 测试日报 - Day X

## 今日完成
- 测试用例执行数：XX
- 通过率：XX%
- 发现缺陷：XX 个

## 缺陷汇总
| ID | 标题 | 严重程度 | 状态 |
|----|------|----------|------|
| BUG-001 | ... | P1 | Open |

## 明日计划
- ...
```

### 最终报告

所有测试完成后生成最终报告：

```markdown
# 测试最终报告

## 测试总结
- 总测试用例：XX
- 通过：XX
- 失败：XX
- 跳过：XX
- 通过率：XX%

## 缺陷汇总
- 总缺陷：XX
- 已修复：XX
- 待修复：XX

## 发布建议
- [ ] 可以发布
- [ ] 需要修复后发布
- [ ] 不能发布
```

---

## 自动化测试

### 测试脚本结构

```
tests/
├── unit/                    # 单元测试
│   ├── test_identity.js
│   ├── test_message.js
│   ├── test_e2ee.js
│   └── test_ratchet.js
├── integration/             # 集成测试
│   ├── test_rpc_calls.js
│   └── test_api_endpoints.js
├── cross_platform/          # 跨平台测试
│   ├── test_plain_messages.js
│   └── test_e2ee_messages.js
├── performance/             # 性能测试
│   └── test_benchmarks.js
└── run_all_tests.js         # 总测试入口
```

### 自动化执行

```bash
# 运行所有测试
node tests/run_all_tests.js

# 运行特定类别
node tests/unit/test_identity.js
node tests/cross_platform/test_e2ee_messages.js

# 生成报告
node tests/generate_report.js
```

---

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| E2EE 互操作失败 | 中 | 高 | 详细日志，对比 Python 实现 |
| WebSocket 测试失败 | 中 | 中 | 备用测试方案 |
| API 变更 | 低 | 高 | 定期同步 Python 版本 |
| 测试环境不稳定 | 中 | 中 | 多环境备份 |

---

## 附录

### A. 测试身份列表

| 身份名 | 平台 | DID | JWT 状态 |
|--------|------|-----|----------|
| python1 | Python | did:wba:... | 有效 |
| python2 | Python | did:wba:... | 有效 |
| node1 | Node.js | did:wba:... | 有效 |
| node2 | Node.js | did:wba:... | 有效 |

### B. 参考文档

- [API 文档](awiki.API.md)
- [Python 实现](scripts/)
- [Node.js 实现](nodejs-awiki/)
- [测试报告模板](tests/report_template.md)

---

**测试计划版本**: 1.0  
**批准人**: AI Assistant  
**批准日期**: 2026-03-08
