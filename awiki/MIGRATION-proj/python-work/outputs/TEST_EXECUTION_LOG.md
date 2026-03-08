# 测试执行日志

**测试周期**: 2026-03-08
**测试人员**: AI Assistant
**测试环境**:
- PC-A: Python 3.14.3, ANP 0.6.4
- PC-B: Node.js v25.2.1, npm 11.6.2
**测试平台**: awiki.ai 正式服务

---

## 测试进度总览

| 层次 | 测试 ID | 测试名称 | 开始时间 | 完成时间 | 结果 | 备注 |
|------|--------|---------|---------|---------|------|------|
| Level 1 | T01 | DID 身份创建 | 08:00 | 08:04 | ✅ 通过 | Python 和 Node.js 都成功 |
| Level 1 | T02 | DID 注册 | 08:00 | 08:04 | ✅ 通过 | 包含在 T01 中 |
| Level 1 | T03 | JWT 认证 | 08:00 | 08:04 | ✅ 通过 | 包含在 T01 中 |
| Level 2 | T04 | 明文消息发送 | 08:04 | 08:05 | ✅ 通过 | Python 发送成功 |
| Level 2 | T05 | 明文消息接收 | - | - | ⏸️ 暂停 | 服务器 502 错误 |
| Level 2 | T06 | 消息历史 | - | - | ⏸️ 暂停 | 依赖 T05 |
| Level 3 | T07 | E2EE 握手 | - | - | ⏳ 待执行 | - |
| Level 3 | T08 | E2EE 加密 | - | - | ⏳ 待执行 | - |
| Level 3 | T09 | E2EE 解密 | - | - | ⏳ 待执行 | - |
| Level 3 | T10 | E2EE 互操作 | - | - | ⏳ 待执行 | - |
| Level 4 | T11 | 关注/取消 | - | - | ⏳ 待执行 | - |
| Level 4 | T12 | 粉丝/关注列表 | - | - | ⏳ 待执行 | - |
| Level 4 | T13 | 个人资料 | - | - | ⏳ 待执行 | - |
| Level 5 | T14 | 创建群组 | - | - | ⏳ 待执行 | - |
| Level 5 | T15 | 邀请成员 | - | - | ⏳ 待执行 | - |
| Level 5 | T16 | 群组消息 | - | - | ⏳ 待执行 | - |
| Level 6 | T17 | Handle 注册 | - | - | ⏳ 待执行 | - |
| Level 6 | T18 | 内容页面 | - | - | ⏳ 待执行 | - |
| Level 6 | T19 | WebSocket | - | - | ⏳ 待执行 | - |

**总体状态**: 4/19 完成 (21%), 1/19 暂停 (服务器问题), 14/19 待执行

---

## 详细执行记录

### T01: DID 身份创建 ✅ 通过

**开始时间**: 2026-03-08 08:00
**完成时间**: 2026-03-08 08:04

**Python 执行**:
```bash
python scripts/setup_identity.py --name "PyTest1" --agent --credential py_test_base
```

**输出**:
```
DID: did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g
user_id: 77ec3f44-f94f-4c19-b315-49c0f0bf4a37
JWT: eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1jZDRjYjI3ZiIsIn...
```

**Node.js 执行**:
```bash
node scripts/setup_identity.js --name "NodeTest1" --agent --credential node_test_base
```

**输出**:
```
DID: did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w
user_id: 087b4a1f-3bc9-44e9-a0b3-5ca5f3be3cd7
JWT: eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1jZDRjYjI3ZiIsIn...
```

**验证结果**:
- [x] DID 格式正确 ✅
- [x] DID 文档包含 proof ✅
- [x] 包含 E2EE 密钥 ✅
- [x] 凭证文件完整 ✅
- [x] Node.js R||S 签名被服务器接受 ✅

**问题修复**:
- Python `scripts/utils/e2ee.py` 导入错误（`validate_proof` → `verify_proof`）

**结论**: ✅ 通过

---

### T02: DID 注册 ✅ 通过

**说明**: 已在 T01 中自动完成，两个身份都成功注册并获取 user_id。

---

### T03: JWT 认证 ✅ 通过

**说明**: 已在 T01 中自动完成，两个身份都成功获取 JWT。

**重要验证**:
- Node.js 的 R||S 签名格式被服务器接受
- 无需改为 DER 格式

---

### T04: 明文消息发送 ✅ 通过

**开始时间**: 2026-03-08 08:04

**Python 发送**:
```bash
python scripts/send_message.py --to "did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w" --content "Hello from Python! 这是测试消息。"
```

**输出**:
```
Message sent successfully:
{
  "id": "cc020baa-ee9c-4f2f-8b80-ee975ad54b6e",
  "content": "Hello from Python! 这是测试消息。",
  "type": "text",
  "server_seq": 1,
  ...
}
```

**结论**: ✅ 发送成功

---

### T05: 明文消息接收 ⏸️ 暂停

**问题**: awiki.ai 消息服务返回 502 Bad Gateway 错误

**Python 检查收件箱**:
```
httpx.HTTPStatusError: Server error '502 Bad Gateway' for url 'https://awiki.ai/message/rpc'
```

**Node.js 检查收件箱**:
```
Error: 方法不存在：getInbox
```

**分析**:
1. 服务器 502 错误表明消息服务暂时不可用
2. Node.js 的 `getInbox` 方法可能未在服务端实现

**建议**:
- 稍后重试
- 或仅测试发送功能，接收功能待服务器恢复后验证

---

## 问题汇总

### 已修复

| ID | 问题 | 测试 | 修复方案 | 状态 |
|----|------|------|---------|------|
| P3-001 | Python `validate_proof` 导入错误 | T01 | 改为 `verify_proof` | ✅ 已修复 |

### 待解决

| ID | 问题 | 优先级 | 影响 | 状态 |
|----|------|--------|------|------|
| SRV-001 | awiki.ai 消息服务 502 错误 | P2 | T05 无法测试 | ⏳ 等待服务器恢复 |
| SRV-002 | `getInbox` 方法可能未实现 | P2 | Node.js 无法检查收件箱 | ⏳ 需要确认 API |

---

## 下一步行动

1. ✅ Level 1 测试完成
2. ✅ T04 发送测试完成
3. ⏸️ T05 接收测试等待服务器恢复
4. ⏭️ 继续执行 Level 3 E2EE 测试（如果 E2EE 使用不同的服务端点）

---

**最后更新**: 2026-03-08 08:05
