# 已注册的 DID 身份列表

## Python 注册的身份

### 1. pythonagent
- **DID**: `did:wba:awiki.ai:user:k1_4pfzOaJ3z4fJ1QLdk0YF_sDKuCBjC1ETCfzh_h7D0UE`
- **User ID**: `411b67df-2b6c-4ac6-a2e2-21add0094880`
- **Credential Path**: `C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\pythonagent.json`
- **注册状态**: ✓ 成功（有 JWT token）
- **JWT 验证测试**: ✗ 失败（Signature verification failed）

### 2. testfresh
- **DID**: `did:wba:awiki.ai:user:k1_YyAuYBpZnBFunOHFBOBLmh1WL8kxOe8nvmlWc1MKaXw`
- **User ID**: `01947b20-2627-429e-8f6a-474101af8bac`
- **Credential Path**: `C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\testfresh.json`
- **注册状态**: ✓ 成功（有 JWT token）
- **JWT 验证测试**: ⏳ 未测试

### 3. NodeAgentFinal (Node.js 注册)
- **DID**: `did:wba:awiki.ai:user:k1_-EI8nKTWbYH0YcO9X4tfztUwNqG3M19FUqgt0LqQVS8`
- **User ID**: `e32bac90-8c31-4c13-8aea-5c7d281b96f0`
- **Credential Path**: `D:\huangyg\git\awiki-agent-id-skill\nodejs-awiki\.credentials\nodeagentfinal.json`
- **注册状态**: ✓ 成功（但 JWT 验证失败）
- **JWT 验证测试**: ✗ 失败（Signature verification failed）

## 测试结果（2026-03-07）

使用 Node.js 测试所有已注册 DID 的 JWT 验证：

| DID | 注册方式 | JWT 验证结果 | 错误信息 |
|-----|----------|-------------|----------|
| pythonagent | Python | ✗ 失败 | Signature verification failed |
| testfresh | Python | ✗ 失败 | Signature verification failed |
| nodeagentfinal | Node.js | ✗ 失败 | Private key parse error |

**结论**：所有测试都失败，错误都是 "Signature verification failed"。

这说明问题不是特定的 DID，而是**系统性的问题**。

### 可能的原因

1. awiki.ai 服务端的签名验证逻辑有 Bug
2. 服务端期望的签名格式与文档不符
3. 需要额外的参数或特定的时间窗口
4. 服务端可能更新了验证逻辑但未更新文档

### 建议

1. 联系 awiki.ai 技术支持，提供此测试结果
2. 询问是否有额外的验证要求未文档化
3. 确认服务端签名验证逻辑是否正确
