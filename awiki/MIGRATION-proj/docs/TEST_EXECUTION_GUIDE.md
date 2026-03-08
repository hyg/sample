# 测试执行指南

**版本**: 1.0.0  
**日期**: 2026-03-08  
**目标**: 指导测试人员执行完整的测试流程

---

## 测试前准备

### 1. 环境准备

```bash
# Python 环境
cd scripts
pip install -r requirements.txt

# Node.js 环境
cd nodejs-awiki
npm install
```

### 2. 创建测试身份

```bash
# Python 身份 (2 个)
python scripts/setup_identity.py --name PythonAgent1 --agent --credential python1
python scripts/setup_identity.py --name PythonAgent2 --agent --credential python2

# Node.js 身份 (2 个)
node nodejs-awiki/scripts/setup_identity.js --name NodeAgent1 --agent --credential node1
node nodejs-awiki/scripts/setup_identity.js --name NodeAgent2 --agent --credential node2
```

### 3. 验证身份

```bash
# 验证 Python 身份
python scripts/setup_identity.py --load python1
python scripts/setup_identity.py --load python2

# 验证 Node.js 身份
node nodejs-awiki/scripts/check_inbox.js --credential node1
node nodejs-awiki/scripts/check_inbox.js --credential node2
```

---

## 测试执行流程

### Day 1: 单元测试

```bash
cd nodejs-awiki

# 运行所有单元测试
node tests/run_all_tests.js --category unit

# 或单独运行
node tests/unit/test_identity.js
node tests/unit/test_message.js
node tests/unit/test_e2ee.js
node tests/unit/test_ratchet.js
```

**预期结果**:
- 所有单元测试通过
- 无失败用例
- 代码覆盖率 > 80%

---

### Day 2: 集成测试

```bash
cd nodejs-awiki

# 运行集成测试
node tests/run_all_tests.js --category integration

# 或单独运行
node tests/integration/test_rpc_calls.js --credential node1
node tests/integration/test_api_endpoints.js --credential node1
```

**预期结果**:
- RPC 调用成功
- API 端点响应正确
- JWT 认证有效

---

### Day 3: 跨平台测试 (Python → Node.js)

```bash
# 测试 1: Python 发送明文到 Node.js
python scripts/send_message.py --to <node1_did> --content "Hello from Python" --credential python1
node nodejs-awiki/scripts/check_inbox.js --credential node1

# 测试 2: Python 发送 E2EE 到 Node.js
python scripts/e2ee_messaging.py --handshake <node1_did> --credential python1
node nodejs-awiki/scripts/e2ee_messaging.js --process --peer <python1_did> --credential node1
python scripts/e2ee_messaging.py --send <node1_did> --content "Secret from Python" --credential python1
node nodejs-awiki/scripts/e2ee_messaging.js --process --peer <python1_did> --credential node1
```

**预期结果**:
- 明文消息成功接收
- E2EE 握手成功
- E2EE 消息成功解密

---

### Day 4: 跨平台测试 (Node.js → Python)

```bash
# 测试 1: Node.js 发送明文到 Python
node nodejs-awiki/scripts/send_message.js --to <python1_did> --content "Hello from Node.js" --credential node1
python scripts/check_inbox.py --credential python1

# 测试 2: Node.js 发送 E2EE 到 Python
node nodejs-awiki/scripts/e2ee_messaging.js --handshake <python1_did> --credential node1
python scripts/e2ee_messaging.py --process --peer <node1_did> --credential python1
node nodejs-awiki/scripts/e2ee_messaging.js --send <python1_did> --content "Secret from Node.js" --credential node1
python scripts/e2ee_messaging.py --process --peer <node1_did> --credential python1
```

**预期结果**:
- 明文消息成功接收
- E2EE 握手成功
- E2EE 消息成功解密

---

### Day 5: 自动化跨平台测试

```bash
cd nodejs-awiki

# 运行跨平台明文测试
node tests/cross_platform/test_plain_messages.js --from python1 --to node1
node tests/cross_platform/test_plain_messages.js --from node1 --to python1

# 运行跨平台 E2EE 测试
node tests/cross_platform/test_e2ee_messages.js --from python1 --to node1
node tests/cross_platform/test_e2ee_messages.js --from node1 --to python1
```

**预期结果**:
- 所有跨平台测试通过
- 消息内容正确
- E2EE 加密/解密正确

---

### Day 6: E2EE 专项测试

```bash
cd nodejs-awiki

# 运行棘轮算法测试
node tests/unit/test_ratchet.js

# 运行多轮棘轮测试
node tests/multi_round_ratchet_test.js

# 运行 E2EE 会话测试
node tests/test_e2ee_session.js
```

**预期结果**:
- 棘轮算法正确
- 每次消息密钥不同
- 会话持久化有效

---

### Day 7: CLI 工具测试

```bash
cd nodejs-awiki

# 测试身份管理
node bin/awiki.js identity create --name CLITest --agent --credential clitest

# 测试消息发送
node bin/awiki.js message send --to <python1_did> --content "CLI test" --credential clitest

# 测试收件箱
node bin/awiki.js message inbox --credential clitest

# 测试 E2EE
node bin/awiki.js e2ee handshake --peer <python1_did> --credential clitest
node bin/awiki.js e2ee send --peer <python1_did> --content "CLI E2EE test" --credential clitest

# 测试社交
node bin/awiki.js social follow --did <python1_did> --credential clitest
node bin/awiki.js social following --credential clitest

# 测试内容
node bin/awiki.js content create --slug cli-test --title "CLI Test" --body "# Test" --credential clitest
node bin/awiki.js content list --credential clitest
```

**预期结果**:
- 所有 CLI 命令工作正常
- 输出格式正确
- 错误处理友好

---

### Day 8: 性能测试

```bash
cd nodejs-awiki

# 运行性能测试
node tests/performance/test_benchmarks.js --credential node1
```

**预期指标**:
- JWT 获取时间 < 2 秒
- 消息发送时间 < 1 秒
- E2EE 加密时间 < 100ms
- E2EE 解密时间 < 100ms
- 内存占用 < 100MB

---

## 测试报告

### 每日报告

每天测试结束后，生成日报：

```bash
cd nodejs-awiki
node tests/generate_daily_report.js
```

报告位置：`nodejs-awiki/tests/reports/daily_YYYY-MM-DD.md`

### 最终报告

所有测试完成后，生成最终报告：

```bash
cd nodejs-awiki
node tests/run_all_tests.js
node tests/generate_final_report.js
```

报告位置：`nodejs-awiki/tests/reports/final_report.md`

---

## 缺陷报告

发现缺陷时，填写缺陷报告：

```markdown
**缺陷 ID**: BUG-XXX
**标题**: 简短描述
**严重程度**: P0/P1/P2/P3
**发现日期**: YYYY-MM-DD
**发现者**: 姓名
**测试用例**: TC-XXX
**复现步骤**:
1. ...
2. ...
3. ...

**预期结果**: ...
**实际结果**: ...
**环境**: Python/Node.js 版本，OS
**日志**: 相关错误日志
**截图**: 如有
```

缺陷报告位置：`nodejs-awiki/tests/reports/bugs/BUG-XXX.md`

---

## 常见问题

### Q1: JWT 过期怎么办？

A: 重新创建身份获取新 JWT

```bash
node scripts/setup_identity.js --name NodeAgent1 --agent --credential node1
```

### Q2: 跨平台测试失败？

A: 检查以下几点：
1. 双方身份都有有效 JWT
2. DID 格式正确
3. awiki.ai 服务正常
4. 网络连接正常

### Q3: E2EE 解密失败？

A: 检查：
1. 握手是否成功
2. 会话状态是否正确保存
3. 密钥是否匹配
4. 消息序号是否正确

---

## 联系支持

- **技术文档**: COMPREHENSIVE_TEST_PLAN.md
- **API 参考**: awiki.API.md
- **Issue 跟踪**: https://github.com/awiki/awiki-agent-id-message/issues

---

**测试指南版本**: 1.0  
**最后更新**: 2026-03-08  
**维护者**: AI Assistant
