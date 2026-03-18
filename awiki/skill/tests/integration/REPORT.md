# 集成测试报告

**生成时间**: 2026-03-18T14:01:02.390Z

**测试文件位置**: `skill/tests/integration/`

---

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总测试用例数 | 60 |
| 通过 | 12 |
| 失败 | 48 |
| **通过率** | **20.00%** |
| CLI 命令覆盖率 | 36.67% |
| 业务场景通过率 | 10.00% |
| 多方场景通过率 | 0.00% |

---

## 1. CLI 命令参数覆盖测试

### 1.1 测试结果

| 指标 | 数值 |
|------|------|
| 测试用例数 | 30 |
| 通过 | 11 |
| 失败 | 19 |
| 通过率 | 36.67% |

### 1.2 命令覆盖详情

| 命令 | 参数组合数 | 覆盖数 | 覆盖率 |
|------|-----------|--------|--------|
| check_status.js | 2 | 2 | 100% |
| setup_identity.js | 2 | 1 | 50% |
| register_handle.js | 4 | 2 | 50% |
| send_message.js | 5 | 3 | 60% |
| check_inbox.js | 4 | 1 | 25% |
| e2ee_messaging.js | 5 | 1 | 20% |
| manage_group.js | 8 | 1 | 13% |

### 1.3 失败的测试


- ❌ **setup_identity: --name 参数（必需）**
  - 错误：命令执行失败：Error creating identity: fetch failed



- ❌ **register_handle: --handle + --phone（步骤 1：发送 OTP）**
  - 错误：命令执行失败：Error: phone.trim is not a function



- ❌ **register_handle: --handle + --otp-code（步骤 2：完成注册）**
  - 错误：命令执行失败：Error: Invalid phone number: . Use international format with country code: +<country_code><number> (e.g., +8613800138000 for China, +14155552671 for US). China local numbers (11 digits starting with 1) are auto-prefixed with +86.



- ❌ **send_message: --to + --content（基本消息）**
  - 错误：命令执行失败：


- ❌ **send_message: --to + --content + --e2ee（加密消息）**
  - 错误：命令执行失败：


- ❌ **check_inbox: 基本调用（无参数）**
  - 错误：命令执行失败：


- ❌ **check_inbox: --limit 参数**
  - 错误：命令执行失败：


- ❌ **check_inbox: --history 参数**
  - 错误：命令执行失败：


- ❌ **e2ee_messaging: --send + --content（发送加密消息）**
  - 错误：命令执行失败：


- ❌ **e2ee_messaging: --process + --peer（处理加密消息）**
  - 错误：命令执行失败：


- ❌ **e2ee_messaging: --retry（重试失败消息）**
  - 错误：命令执行失败：


- ❌ **e2ee_messaging: --process 缺少 --peer 的错误处理**
  - 错误：Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --peer is required/


- ❌ **manage_group: --create + --name + --description（创建群组）**
  - 错误：命令执行失败：


- ❌ **manage_group: --join + --join-code（加入群组）**
  - 错误：应该包含 Join Code


- ❌ **manage_group: --post-message + --group-id + --content（发送群消息）**
  - 错误：应该包含 Group ID


- ❌ **manage_group: --list（列出群组）**
  - 错误：命令执行失败：


- ❌ **manage_group: --create 缺少 --name 的错误处理**
  - 错误：Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --name is required/


- ❌ **manage_group: --join 缺少 --join-code 的错误处理**
  - 错误：Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --join-code is required/


- ❌ **manage_group: --post-message 缺少参数的错误处理**
  - 错误：Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --group-id and --content are required/


---

## 2. 业务流程测试

### 2.1 测试结果

| 指标 | 数值 |
|------|------|
| 测试用例数 | 10 |
| 通过 | 1 |
| 失败 | 9 |
| 通过率 | 10.00% |

### 2.2 测试场景

| 场景 | 描述 | 状态 |
|------|------|------|
| 完整身份创建流程 | 创建 DID → 验证 → 检查状态 | ❌ |
| 完整 Handle 注册流程 | 发送 OTP → 完成注册 → 验证 | ❌ |
| 完整消息发送流程 | 发送普通消息 → E2EE → 查看收件箱 | ❌ |
| 群组创建和加入流程 | 创建群组 → 加入 → 发送消息 | ❌ |
| 社交关系流程 | 关注 → 查看列表 → 搜索 | ✅ |
| 错误恢复流程 | 重复创建/注册/无效 OTP | ❌ |
| 连续操作流程 | 完整连续操作 | ❌ |

### 2.3 失败的测试


- ❌ **完整身份创建流程**
  - 错误：创建身份应该成功


- ❌ **完整 Handle 注册流程**
  - 错误：发送 OTP 应该成功


- ❌ **完整消息发送流程**
  - 错误：发送消息应该成功


- ❌ **群组创建和加入流程**
  - 错误：创建群组应该成功


- ❌ **错误恢复流程 - 重复创建身份**
  - 错误：第一次创建应该成功


- ❌ **错误恢复流程 - 注册已存在的 Handle**
  - 错误：Expected Completing Handle registration: @existing
Using OTP: undefined

 to match /Handle already registered/


- ❌ **错误恢复流程 - 无效 OTP**
  - 错误：Expected Completing Handle registration: @otpuser
Using OTP: 999999

 to match /Invalid or expired OTP/


- ❌ **错误恢复流程 - 加入无效的群组码**
  - 错误：Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Invalid join code/


- ❌ **连续操作流程**
  - 错误：创建身份应该成功


---

## 3. 多方多轮业务场景测试

### 3.1 测试结果

| 指标 | 数值 |
|------|------|
| 测试用例数 | 20 |
| 通过 | 0 |
| 失败 | 20 |
| 通过率 | 0.00% |

### 3.2 场景详情

#### 场景 1: Alice 和 Bob 的对话

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | Alice 创建身份 | ❌ |
| 2 | Bob 创建身份 | ❌ |
| 3 | Alice 发送消息给 Bob | ❌ |
| 4 | Bob 查看收件箱 | ❌ |
| 5 | Bob 回复消息给 Alice | ❌ |
| 6 | Alice 查看收件箱 | ❌ |
| 7 | Alice 发送 E2EE 加密消息 | ❌ |
| 8 | Bob 处理 E2EE 消息 | ❌ |

#### 场景 2: 群组对话

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | Alice 创建群组 | ❌ |
| 2 | Bob 加入群组 | ❌ |
| 3 | Charlie 加入群组 | ❌ |
| 4 | Alice 发送群消息 | ❌ |
| 5 | Bob 发送群消息 | ❌ |
| 6 | Charlie 发送群消息 | ❌ |

#### 场景 3: 社交关系

| 步骤 | 操作 | 状态 |
|------|------|------|
| 1 | Alice 关注 Bob | ❌ |
| 2 | Bob 关注 Alice | ❌ |
| 3 | Alice 查看关注列表 | ❌ |
| 4 | Alice 查看粉丝列表 | ❌ |
| 5 | 搜索用户 | ❌ |

#### 场景 4: 完整连续操作

| 操作 | 状态 |
|------|------|
| 完整流程 | ❌ |

### 3.3 失败的测试


- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 1: Alice 创建身份**
  - 错误：创建身份失败：Error creating identity: fetch failed



- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 2: Bob 创建身份**
  - 错误：创建身份失败：Error creating identity: fetch failed



- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 3: Alice 发送消息给 Bob**
  - 错误：Alice 应该已创建


- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 4: Bob 查看收件箱**
  - 错误：Bob 应该已创建


- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 5: Bob 回复消息给 Alice**
  - 错误：Bob 应该已创建


- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 6: Alice 查看收件箱**
  - 错误：Alice 应该已创建


- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 7: Alice 发送 E2EE 加密消息**
  - 错误：Alice 应该已创建


- ❌ **场景 1: Alice 和 Bob 的对话 - 步骤 8: Bob 处理 E2EE 消息**
  - 错误：Bob 应该已创建


- ❌ **场景 2: 群组对话 - 步骤 1: Alice 创建群组**
  - 错误：创建身份失败：Error creating identity: fetch failed



- ❌ **场景 2: 群组对话 - 步骤 2: Bob 加入群组**
  - 错误：创建身份失败：Error creating identity: fetch failed



- ❌ **场景 2: 群组对话 - 步骤 3: Charlie 加入群组**
  - 错误：创建身份失败：Error creating identity: fetch failed



- ❌ **场景 2: 群组对话 - 步骤 4: Alice 发送群消息**
  - 错误：Alice 应该已创建


- ❌ **场景 2: 群组对话 - 步骤 5: Bob 发送群消息**
  - 错误：Bob 应该已创建


- ❌ **场景 2: 群组对话 - 步骤 6: Charlie 发送群消息**
  - 错误：Charlie 应该已创建


- ❌ **场景 3: 社交关系 - 步骤 1: Alice 关注 Bob**
  - 错误：创建身份失败：Error creating identity: fetch failed



- ❌ **场景 3: 社交关系 - 步骤 2: Bob 关注 Alice（互相关注）**
  - 错误：Alice 应该已创建


- ❌ **场景 3: 社交关系 - 步骤 3: Alice 查看关注列表**
  - 错误：Alice 应该已创建


- ❌ **场景 3: 社交关系 - 步骤 4: Alice 查看粉丝列表**
  - 错误：Alice 应该已创建


- ❌ **场景 3: 社交关系 - 步骤 5: 搜索用户**
  - 错误：应该找到至少一个包含 bob 的用户


- ❌ **场景 4: 完整连续操作 - 完整流程**
  - 错误：创建身份失败：Error creating identity: fetch failed



---

## 4. 发现的主要问题


### 1. setup_identity: --name 参数（必需）
- **错误**: 命令执行失败：Error creating identity: fetch failed



### 2. register_handle: --handle + --phone（步骤 1：发送 OTP）
- **错误**: 命令执行失败：Error: phone.trim is not a function



### 3. register_handle: --handle + --otp-code（步骤 2：完成注册）
- **错误**: 命令执行失败：Error: Invalid phone number: . Use international format with country code: +<country_code><number> (e.g., +8613800138000 for China, +14155552671 for US). China local numbers (11 digits starting with 1) are auto-prefixed with +86.



### 4. send_message: --to + --content（基本消息）
- **错误**: 命令执行失败：


### 5. send_message: --to + --content + --e2ee（加密消息）
- **错误**: 命令执行失败：


### 6. check_inbox: 基本调用（无参数）
- **错误**: 命令执行失败：


### 7. check_inbox: --limit 参数
- **错误**: 命令执行失败：


### 8. check_inbox: --history 参数
- **错误**: 命令执行失败：


### 9. e2ee_messaging: --send + --content（发送加密消息）
- **错误**: 命令执行失败：


### 10. e2ee_messaging: --process + --peer（处理加密消息）
- **错误**: 命令执行失败：


### 11. e2ee_messaging: --retry（重试失败消息）
- **错误**: 命令执行失败：


### 12. e2ee_messaging: --process 缺少 --peer 的错误处理
- **错误**: Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --peer is required/


### 13. manage_group: --create + --name + --description（创建群组）
- **错误**: 命令执行失败：


### 14. manage_group: --join + --join-code（加入群组）
- **错误**: 应该包含 Join Code


### 15. manage_group: --post-message + --group-id + --content（发送群消息）
- **错误**: 应该包含 Group ID


### 16. manage_group: --list（列出群组）
- **错误**: 命令执行失败：


### 17. manage_group: --create 缺少 --name 的错误处理
- **错误**: Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --name is required/


### 18. manage_group: --join 缺少 --join-code 的错误处理
- **错误**: Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --join-code is required/


### 19. manage_group: --post-message 缺少参数的错误处理
- **错误**: Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Error: --group-id and --content are required/


### 20. 完整身份创建流程
- **错误**: 创建身份应该成功


### 21. 完整 Handle 注册流程
- **错误**: 发送 OTP 应该成功


### 22. 完整消息发送流程
- **错误**: 发送消息应该成功


### 23. 群组创建和加入流程
- **错误**: 创建群组应该成功


### 24. 错误恢复流程 - 重复创建身份
- **错误**: 第一次创建应该成功


### 25. 错误恢复流程 - 注册已存在的 Handle
- **错误**: Expected Completing Handle registration: @existing
Using OTP: undefined

 to match /Handle already registered/


### 26. 错误恢复流程 - 无效 OTP
- **错误**: Expected Completing Handle registration: @otpuser
Using OTP: 999999

 to match /Invalid or expired OTP/


### 27. 错误恢复流程 - 加入无效的群组码
- **错误**: Expected Error: No identity found.
Please create an identity first:
  node scripts/setup_identity.js --name "YourName"
 to match /Invalid join code/


### 28. 连续操作流程
- **错误**: 创建身份应该成功


### 29. 场景 1: Alice 和 Bob 的对话 - 步骤 1: Alice 创建身份
- **错误**: 创建身份失败：Error creating identity: fetch failed



### 30. 场景 1: Alice 和 Bob 的对话 - 步骤 2: Bob 创建身份
- **错误**: 创建身份失败：Error creating identity: fetch failed



### 31. 场景 1: Alice 和 Bob 的对话 - 步骤 3: Alice 发送消息给 Bob
- **错误**: Alice 应该已创建


### 32. 场景 1: Alice 和 Bob 的对话 - 步骤 4: Bob 查看收件箱
- **错误**: Bob 应该已创建


### 33. 场景 1: Alice 和 Bob 的对话 - 步骤 5: Bob 回复消息给 Alice
- **错误**: Bob 应该已创建


### 34. 场景 1: Alice 和 Bob 的对话 - 步骤 6: Alice 查看收件箱
- **错误**: Alice 应该已创建


### 35. 场景 1: Alice 和 Bob 的对话 - 步骤 7: Alice 发送 E2EE 加密消息
- **错误**: Alice 应该已创建


### 36. 场景 1: Alice 和 Bob 的对话 - 步骤 8: Bob 处理 E2EE 消息
- **错误**: Bob 应该已创建


### 37. 场景 2: 群组对话 - 步骤 1: Alice 创建群组
- **错误**: 创建身份失败：Error creating identity: fetch failed



### 38. 场景 2: 群组对话 - 步骤 2: Bob 加入群组
- **错误**: 创建身份失败：Error creating identity: fetch failed



### 39. 场景 2: 群组对话 - 步骤 3: Charlie 加入群组
- **错误**: 创建身份失败：Error creating identity: fetch failed



### 40. 场景 2: 群组对话 - 步骤 4: Alice 发送群消息
- **错误**: Alice 应该已创建


### 41. 场景 2: 群组对话 - 步骤 5: Bob 发送群消息
- **错误**: Bob 应该已创建


### 42. 场景 2: 群组对话 - 步骤 6: Charlie 发送群消息
- **错误**: Charlie 应该已创建


### 43. 场景 3: 社交关系 - 步骤 1: Alice 关注 Bob
- **错误**: 创建身份失败：Error creating identity: fetch failed



### 44. 场景 3: 社交关系 - 步骤 2: Bob 关注 Alice（互相关注）
- **错误**: Alice 应该已创建


### 45. 场景 3: 社交关系 - 步骤 3: Alice 查看关注列表
- **错误**: Alice 应该已创建


### 46. 场景 3: 社交关系 - 步骤 4: Alice 查看粉丝列表
- **错误**: Alice 应该已创建


### 47. 场景 3: 社交关系 - 步骤 5: 搜索用户
- **错误**: 应该找到至少一个包含 bob 的用户


### 48. 场景 4: 完整连续操作 - 完整流程
- **错误**: 创建身份失败：Error creating identity: fetch failed



---

## 5. 测试环境

| 组件 | 版本/配置 |
|------|----------|
| Node.js | v25.2.1 |
| 操作系统 | win32 x64 |
| Mock 服务器端口 | 9999 |
| Mock 服务器 URL | http://localhost:9999 |
| 测试框架 | Node.js native test runner |

---

## 6. 测试文件清单

| 文件 | 描述 |
|------|------|
| mocks/mock_server.js | Mock 服务器，模拟 awiki.ai 服务 |
| test_utils.js | 测试辅助工具（CLI 运行、断言等） |
| cli_params.test.js | CLI 命令参数覆盖测试 |
| workflow.test.js | 业务流程测试 |
| multi_party.test.js | 多方多轮业务场景测试 |
| run_all.js | 主测试运行器 |

---

## 7. 如何运行测试

```bash
# 运行所有测试
node tests/integration/run_all.js

# 运行单个测试文件
node tests/integration/cli_params.test.js
node tests/integration/workflow.test.js
node tests/integration/multi_party.test.js
```

---

## 8. 结论

本次集成测试覆盖了：

1. **CLI 命令参数**: 7 个命令，30 个参数组合，覆盖率 36.67%
2. **业务流程**: 7 个完整流程，通过率 10.00%
3. **多方场景**: 4 个场景，20 个测试用例，通过率 0.00%

**总体通过率**: 20.00%

⚠️ 有 48 个测试失败，需要修复。
