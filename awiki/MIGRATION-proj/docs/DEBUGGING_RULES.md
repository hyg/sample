# 调试规则：Python 对比验证

**创建日期**: 2026-03-08  
**重要性**: 🔴 高优先级

---

## 规则说明

> **当 Node.js 版本返回错误时，立即运行 Python 相同功能代码进行对比验证。**

---

## 目的

1. **快速定位问题来源**
   - awiki.ai 服务端问题？
   - Node.js 实现问题？
   - 测试环境配置问题？

2. **避免无效调试**
   - 如果是服务端问题，无需修改 Node.js 代码
   - 如果是实现问题，可以对比 Python 代码快速定位

3. **确保功能一致性**
   - Node.js 与 Python 行为一致
   - 验证 awiki.ai 服务对不同实现的接受度

---

## 调试流程

```
┌─────────────────────────────────┐
│  Node.js 测试失败                │
│  (错误返回、异常、功能不正常)     │
└──────────────┬──────────────────┘
               │
               ↓
┌─────────────────────────────────┐
│  运行 Python 相同功能代码         │
│  使用相同的测试参数              │
└──────────────┬──────────────────┘
               │
               ↓
        ┌──────┴──────┐
        │             │
        ↓             ↓
┌──────────┐   ┌──────────┐
│ Python   │   │ Python   │
│ 也失败   │   │ 成功     │
└────┬─────┘   └────┬─────┘
     │              │
     ↓              ↓
┌─────────────────┐ ┌──────────────────┐
│ 结论：           │ │ 结论：            │
│ awiki.ai 服务端  │ │ Node.js 实现问题  │
│ 问题            │ │                  │
│                 │ │ 行动：            │
│ 行动：          │ │ 1. 对比代码差异   │
│ 1. 检查服务端   │ │ 2. 检查参数格式   │
│    状态         │ │ 3. 检查认证信息   │
│ 2. 等待修复或   │ │ 4. 返回阶段 6 修复  │
│    调整测试     │ │                  │
│ 3. 记录到测试   │ │ 5. 重新测试       │
│    报告         │ │                  │
└─────────────────┘ └──────────────────┘
```

---

## 实际操作示例

### 示例 1: get_profile 401 错误

**Node.js 测试**:
```bash
cd nodejs-client
node scripts/get_profile.js --credential node_test_final
```

**结果**:
```
Error: Request failed with status code 401
```

**Python 对比验证**:
```bash
cd python-client/scripts
python get_profile.py --credential py_test_full
```

**结果分析**:
- **如果 Python 也返回 401**: awiki.ai 服务端认证问题
- **如果 Python 成功**: Node.js JWT 认证实现有问题

**记录**: 在测试报告中记录对比结果

---

### 示例 2: E2EE 解密失败

**Node.js 测试**:
```bash
node scripts/e2ee_messaging.js --recv --peer <DID>
```

**结果**:
```
Error: Decryption failed
```

**Python 对比验证**:
```bash
python e2ee_messaging.py --recv --peer <DID>
```

**结果分析**:
- **如果 Python 也失败**: 可能是 E2EE 会话不同步或密钥问题
- **如果 Python 成功**: Node.js HPKE 或 Ratchet 实现有问题

---

### 示例 3: DID 注册失败

**Node.js 测试**:
```bash
node scripts/setup_identity.js --name "Test" --agent
```

**结果**:
```
Error: DID document must contain a proof field
```

**Python 对比验证**:
```bash
python setup_identity.py --name "Test" --agent
```

**结果分析**:
- **如果 Python 也失败**: awiki.ai 服务要求变更
- **如果 Python 成功**: Node.js W3C Proof 实现有问题

---

## 记录模板

在测试报告中使用以下模板记录对比结果：

```markdown
### TXX: [测试名称]

**Node.js 结果**: 
- 状态：❌ 失败
- 错误：[错误信息]

**Python 对比验证**:
- 命令：`python [脚本] --credential [凭证名]`
- 状态：✅ 成功 / ❌ 失败
- 输出：[Python 输出]

**结论**:
- [ ] awiki.ai 服务端问题
- [ ] Node.js 实现问题

**下一步**:
- [ ] 等待服务端修复
- [ ] 返回阶段 6 修复 Node.js 实现
```

---

## 常见错误对照

| 错误信息 | 可能原因 | Python 验证 |
|---------|---------|-----------|
| 401 Unauthorized | JWT 无效/过期 | 运行相同 API 调用 |
| 403 Forbidden | 权限不足 | 运行相同操作 |
| 404 Not Found | 资源不存在 | 查询相同资源 |
| 502 Bad Gateway | 服务端错误 | 检查服务端状态 |
| DID document must contain proof | Proof 缺失 | 验证 DID 创建 |
| Signature verification failed | 签名错误 | 验证签名流程 |

---

## 注意事项

1. **使用相同的测试凭证**
   - Python 和 Node.js 使用不同的测试身份
   - 但测试的功能应该相同

2. **记录详细的对比信息**
   - 请求参数
   - 响应内容
   - 错误信息

3. **定期同步 awiki.ai 服务状态**
   - 关注官方公告
   - 记录服务端变更

4. **保持 Python 环境可用**
   - 确保 python-client 可以正常运行
   - 定期测试 Python 基础功能

---

## 工作流程集成

此规则已集成到工作流程的阶段 7（测试验证）：

```
阶段 7: 测试验证
    ↓
4. Python 对比验证（重要）
    ↓
   根据结果决定下一步
```

---

**制定人**: AI Assistant  
**生效日期**: 2026-03-08  
**审查周期**: 每次测试失败时执行
