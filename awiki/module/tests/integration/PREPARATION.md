# 步骤 6 集成测试 - 准备指南

## 前置条件

集成测试需要真实的、有效的测试身份才能执行。以下是准备步骤：

## 1. 创建测试身份

### 1.1 创建 Alice 身份（Python）

```bash
cd D:\huangyg\git\sample\awiki

# 使用 Python 脚本创建 Alice 身份
python python\scripts\setup_identity.py --credential distill_alice_py --name "Alice Test"
```

**预期输出**:
```
Identity created successfully
DID: did:wba:awiki.ai:user:k1_...
Handle: @alice_test
```

### 1.2 创建 Bob 身份（Node.js）

```bash
cd D:\huangyg\git\sample\awiki\module

# 使用 Node.js 脚本创建 Bob 身份
node scripts\setup-identity.js --credential distill_bob_js --name "Bob Test"
```

**预期输出**:
```
Identity created successfully
DID: did:wba:awiki.ai:user:k1_...
Handle: @bob_test
```

## 2. 刷新 JWT 令牌

由于 JWT 令牌会过期，在运行集成测试前需要确保令牌有效。

### 2.1 刷新 Alice 的 JWT（Python）

```bash
python python\scripts\setup_identity.py --credential distill_alice_py --refresh
```

### 2.2 刷新 Bob 的 JWT（Node.js）

```bash
node scripts\setup-identity.js --credential distill_bob_js --refresh
```

## 3. 验证身份

### 3.1 检查 Alice 身份

```bash
python python\scripts\check_status.py --credential distill_alice_py
```

**验证点**:
- ✅ 身份存在
- ✅ JWT 令牌有效
- ✅ Handle 已绑定

### 3.2 检查 Bob 身份

```bash
node scripts\check-status.js --credential distill_bob_js
```

**验证点**:
- ✅ 身份存在
- ✅ JWT 令牌有效
- ✅ Handle 已绑定

## 4. 运行集成测试

### 4.1 运行场景 A：明文消息通信

```bash
cd D:\huangyg\git\sample\awiki\module
npm test -- tests/integration/01-plain-messaging.test.js
```

**预期结果**:
- ✅ Round 1: Alice → Bob 成功
- ✅ Round 2: Bob → Alice 成功
- ✅ Round 3: Alice → Bob 成功
- ✅ 消息顺序和内容完整性验证通过

### 4.2 使用环境变量自定义身份名称

```bash
# Windows PowerShell
$env:TEST_ALICE_CREDENTIAL="my_alice"
$env:TEST_BOB_CREDENTIAL="my_bob"
npm test -- tests/integration/01-plain-messaging.test.js

# Windows CMD
set TEST_ALICE_CREDENTIAL=my_alice
set TEST_BOB_CREDENTIAL=my_bob
npm test -- tests/integration/01-plain-messaging.test.js
```

## 5. 常见问题

### Q1: 身份创建失败

**错误**: `Credential already exists`

**解决**: 使用不同的凭证名称，或删除现有凭证：
```bash
# 删除现有凭证（谨慎操作）
rm -rf C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\distill_alice_py
```

### Q2: JWT 刷新失败

**错误**: `Authentication failed` 或 `JWT refresh failed`

**解决**: 
1. 检查凭证文件中的 `refresh_token` 是否存在
2. 重新创建身份
3. 检查网络连接

### Q3: 消息发送失败

**错误**: `RPC call failed` 或 `HTTP error`

**解决**:
1. 检查 JWT 令牌是否有效
2. 检查目标 DID 是否正确
3. 检查网络连接
4. 查看服务器日志

### Q4: 测试跳过

**提示**: `⚠️  跳过集成测试。前置条件不满足`

**解决**: 
1. 确保两个测试身份都存在
2. 确保两个身份都有有效的 JWT 令牌
3. 运行 `check_status` 验证身份状态

## 6. 测试数据清理

测试完成后，可选择清理测试数据：

### 6.1 删除测试身份

```bash
# Windows PowerShell
Remove-Item -Path "C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\distill_*" -Recurse -Force
```

### 6.2 删除测试消息

```bash
# 删除本地数据库中的测试消息
python python\scripts\query_db.py --credential distill_alice_py --sql "DELETE FROM messages WHERE peer_did LIKE '%distill%'"
```

## 7. 测试报告

测试完成后，生成测试报告：

```bash
npm test -- tests/integration/01-plain-messaging.test.js --json > test-report.json
```

**报告内容**:
- 测试结果（通过/失败）
- 执行时间
- 错误详情
- 跨平台兼容性验证

## 8. 下一步

场景 A 测试通过后，继续执行其他集成测试场景：

1. ✅ 场景 A: 明文消息通信
2. ⏭️ 场景 B: E2EE 密文通信（5 轮完整交流）
3. ⏭️ 场景 C: 群组管理（创建→加入→发消息→退出）
4. ⏭️ 场景 D: 跨平台 E2EE 群消息（4 轮加密通信）
5. ⏭️ 场景 E: 内容管理（多人协作）
6. ⏭️ 场景 F: 联系人管理（Profile 联动）
7. ⏭️ 场景 G: 日常巡检

详细测试场景请参阅 [`README.md`](README.md)。

## 9. 联系支持

如有问题，请查看：
- [`skill.js.md`](../../doc/skill.js.md) - 完整移植和测试方案
- [`WORKFLOW.md`](../../doc/skill.js.md) - 工作流程文档
- [`COVERAGE_AUDIT.md`](../../doc/COVERAGE_AUDIT.md) - 测试覆盖审计报告
