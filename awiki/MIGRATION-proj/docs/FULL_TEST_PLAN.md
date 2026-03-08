# awiki Node.js 完整功能测试计划

**基于**: API_SPECIFICATION.md (v2026-03)  
**创建日期**: 2026-03-08  
**测试环境**: Windows, Python 3.14.3, Node.js v25.2.1  
**测试平台**: awiki.ai 正式服务

---

## 测试目标

1. **验证 API 覆盖**: 确保所有 API_SPECIFICATION.md 中定义的 API 都有对应实现
2. **功能一致性**: Python 和 Node.js 实现功能完全一致
3. **互操作性**: Python 和 Node.js 客户端可以互相通信
4. **错误处理**: 验证各种错误场景的正确处理

---

## 测试层次

```
Level 1: 身份认证 (4 个测试)
    ↓
Level 2: Handle 管理 (4 个测试)
    ↓
Level 3: 个人资料 (2 个测试)
    ↓
Level 4: 消息服务 (5 个测试)
    ↓
Level 5: E2EE 加密消息 (5 个测试)
    ↓
Level 6: 社交关系 (5 个测试)
    ↓
Level 7: 群组管理 (5 个测试)
    ↓
Level 8: 内容页面 (6 个测试)
    ↓
Level 9: WebSocket (1 个测试)
```

**总计**: 37 个测试用例

---

## Level 1: 身份认证 API

**端点**: `/user-service/did-auth/rpc`  
**优先级**: 🔴 高（基础功能）

### T01.1: 注册 DID 身份

**API**: `register`

**Python 测试**:
```bash
python scripts/setup_identity.py --name "PyTestReg" --agent --credential py_test_reg
```

**Node.js 测试**:
```bash
node scripts/setup_identity.js --name "NodeTestReg" --agent --credential node_test_reg
```

**验证点**:
- [ ] DID 格式正确：`did:wba:awiki.ai:user:k1_{43 字符}`
- [ ] 返回 user_id (UUID 格式)
- [ ] 返回 access_token (JWT)
- [ ] DID 文档包含 W3C proof
- [ ] 凭证文件保存完整

**预期结果**:
```json
{
  "status": "ok",
  "did": "did:wba:awiki.ai:user:k1_...",
  "user_id": "uuid-string",
  "access_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

---

### T01.2: 验证 DID 身份（获取 JWT）

**API**: `verify`

**Python 测试**:
```bash
python scripts/utils/test_verify.py --credential py_test_reg
```

**Node.js 测试**:
```bash
node scripts/utils/test_verify.js --credential node_test_reg
```

**验证点**:
- [ ] 返回新的 JWT token
- [ ] JWT 有效期 60 分钟
- [ ] token_type 为 "bearer"

**预期结果**:
```json
{
  "status": "ok",
  "did": "did:wba:awiki.ai:user:k1_...",
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "bearer"
}
```

---

### T01.3: 获取当前用户信息

**API**: `get_me`

**Python 测试**:
```bash
python scripts/get_profile.py --credential py_test_reg
```

**Node.js 测试**:
```bash
node scripts/get_profile.js --credential node_test_reg
```

**验证点**:
- [ ] 返回当前 DID
- [ ] 返回 user_id
- [ ] 返回 name（如果已设置）
- [ ] 返回 avatar（如果有）

**预期结果**:
```json
{
  "status": "ok",
  "did": "did:wba:awiki.ai:user:k1_...",
  "user_id": "uuid-string",
  "name": null,
  "avatar": null,
  "role": null,
  "is_public": false
}
```

---

### T01.4: 刷新过期 JWT

**API**: `verify` (刷新)

**Python 测试**:
```bash
# 等待 JWT 过期后
python scripts/setup_identity.py --load py_test_reg
```

**Node.js 测试**:
```bash
# 等待 JWT 过期后
node scripts/setup_identity.js --load node_test_reg
```

**验证点**:
- [ ] 自动检测 JWT 过期
- [ ] 自动刷新 JWT
- [ ] 更新凭证文件

---

## Level 2: Handle 管理 API

**端点**: `/user-service/handle/rpc`  
**优先级**: 🟡 中

### T02.1: 发送 OTP 验证码

**API**: `sendOtp`

**测试**:
```bash
# Python
python scripts/register_handle.py --phone "+8613800138000" --send-otp

# Node.js
node scripts/register_handle.js --phone "+8613800138000" --send-otp
```

**验证点**:
- [ ] 返回 sent: true
- [ ] 返回 expires_in (300 秒)

**预期结果**:
```json
{
  "status": "ok",
  "sent": true,
  "expires_in": 300
}
```

---

### T02.2: 注册 Handle

**API**: `registerHandle`

**测试**:
```bash
# Python
python scripts/register_handle.py --handle "testhandle" --phone "+86..." --otp "123456"

# Node.js
node scripts/register_handle.js --handle "testhandle" --phone "+86..." --otp "123456"
```

**验证点**:
- [ ] 返回 DID
- [ ] 返回 user_id
- [ ] 返回 access_token
- [ ] Handle 格式正确

**预期结果**:
```json
{
  "status": "ok",
  "did": "did:wba:awiki.ai:testhandle:k1_...",
  "user_id": "uuid-string",
  "access_token": "..."
}
```

---

### T02.3: 解析 Handle

**API**: `resolveHandle`

**测试**:
```bash
# Python
python scripts/resolve_handle.py --handle "testhandle"

# Node.js
node scripts/resolve_handle.js --handle "testhandle"
```

**验证点**:
- [ ] 返回完整 DID
- [ ] 返回 Handle
- [ ] 返回 status: "active"

**预期结果**:
```json
{
  "status": "ok",
  "did": "did:wba:awiki.ai:testhandle:k1_...",
  "handle": "testhandle",
  "status": "active"
}
```

---

### T02.4: 查找 Handle

**API**: `lookupHandle`

**测试**:
```bash
# 通过 handle 查找
python scripts/register_handle.py --lookup --handle "testhandle"

# 通过 DID 查找
python scripts/register_handle.py --lookup --did "did:wba:..."
```

**验证点**:
- [ ] 返回 Handle
- [ ] 返回 DID
- [ ] 返回 status

---

## Level 3: 个人资料 API

**端点**: `/user-service/did/profile/rpc`  
**优先级**: 🟡 中

### T03.1: 获取公开资料

**API**: `getProfile`

**测试**:
```bash
# 获取自己的资料
python scripts/get_profile.py --credential py_test_reg

# 获取他人的资料
python scripts/get_profile.py --did "did:wba:awiki.ai:user:k1_..."
```

**验证点**:
- [ ] 返回 did
- [ ] 返回 name
- [ ] 返回 avatar
- [ ] 返回 bio
- [ ] 返回 is_public

**预期结果**:
```json
{
  "status": "ok",
  "did": "did:wba:awiki.ai:user:k1_...",
  "name": "UserName",
  "avatar": null,
  "bio": "User bio",
  "is_public": true
}
```

---

### T03.2: 更新个人资料

**API**: `updateProfile`

**测试**:
```bash
# Python
python scripts/update_profile.py --credential py_test_reg --nick-name "NewName" --bio "New bio"

# Node.js
node scripts/update_profile.js --credential node_test_reg --nick-name "NewName" --bio "New bio"
```

**验证点**:
- [ ] 返回 updated: true
- [ ] 再次获取资料确认更新

**预期结果**:
```json
{
  "status": "ok",
  "updated": true
}
```

---

## Level 4: 消息服务 API

**端点**: `/message/rpc`  
**优先级**: 🔴 高

### T04.1: 发送明文消息

**API**: `sendMessage`

**测试**:
```bash
# Python
python scripts/send_message.py --to <DID> --content "Hello from Python" --credential py_test_reg

# Node.js
node scripts/send_message.js --to <DID> --content "Hello from Node.js" --credential node_test_reg
```

**验证点**:
- [ ] 返回 msg_id
- [ ] 返回 server_seq
- [ ] 消息类型正确

**预期结果**:
```json
{
  "status": "ok",
  "msg_id": "msg-uuid",
  "server_seq": 1
}
```

---

### T04.2: 获取收件箱

**API**: `getInbox`

**测试**:
```bash
# Python
python scripts/check_inbox.py --credential py_test_reg --limit 20

# Node.js
node scripts/check_inbox.js --credential node_test_reg --limit 20
```

**验证点**:
- [ ] 返回 messages 数组
- [ ] 每条消息包含 msg_id, sender_did, content, type
- [ ] 返回 total 和 has_more
- [ ] 消息按时间排序

**预期结果**:
```json
{
  "status": "ok",
  "messages": [...],
  "total": 10,
  "has_more": false
}
```

---

### T04.3: 标记消息为已读

**API**: `markRead`

**测试**:
```bash
# Python
python scripts/check_inbox.py --credential py_test_reg --mark-read "msg-id-1,msg-id-2"

# Node.js
node scripts/check_inbox.js --credential node_test_reg --mark-read "msg-id-1,msg-id-2"
```

**验证点**:
- [ ] 返回 marked_count
- [ ] 再次获取收件箱确认 is_read 为 true

**预期结果**:
```json
{
  "status": "ok",
  "marked_count": 2
}
```

---

### T04.4: 获取聊天历史

**API**: `getHistory`

**测试**:
```bash
# Python
python scripts/check_inbox.py --credential py_test_reg --history <peer_did> --limit 20

# Node.js
node scripts/check_inbox.js --credential node_test_reg --history <peer_did> --limit 20
```

**验证点**:
- [ ] 返回与指定 peer 的消息历史
- [ ] 消息按时间排序
- [ ] 返回 total

---

### T04.5: 消息类型验证

**API**: `sendMessage` (各种类型)

**测试**:
```bash
# text 类型
node scripts/send_message.js --to <DID> --content "Text" --type text

# event 类型
node scripts/send_message.js --to <DID> --content '{"event":"test"}' --type event
```

**验证点**:
- [ ] text 类型正常发送
- [ ] event 类型正常发送
- [ ] 不支持的类型返回错误

---

## Level 5: E2EE 加密消息 API

**端点**: `/message/rpc`  
**优先级**: 🔴 高

### T05.1: E2EE 会话初始化

**API**: `e2eeInit`

**测试**:
```bash
# Python
python scripts/e2ee_messaging.py --init --peer <DID> --credential py_test_reg

# Node.js
node scripts/e2ee_messaging.js --init --peer <DID> --credential node_test_reg
```

**验证点**:
- [ ] 返回 sessionId
- [ ] e2ee_version: "1.1"
- [ ] 创建 E2EE 会话

**预期结果**:
```json
{
  "status": "ok",
  "sessionId": "session-uuid"
}
```

---

### T05.2: E2EE 会话确认

**API**: `e2eeAck`

**测试**:
```bash
# Python
python scripts/e2ee_messaging.py --ack --peer <DID> --session <id>

# Node.js
node scripts/e2ee_messaging.js --ack --peer <DID> --session <id>
```

**验证点**:
- [ ] 返回 acknowledged: true
- [ ] 会话状态变为 active

---

### T05.3: 发送 E2EE 消息

**API**: `e2eeMsg`

**测试**:
```bash
# Python
python scripts/e2ee_messaging.py --send --peer <DID> --content "Secret message"

# Node.js
node scripts/e2ee_messaging.js --send --peer <DID> --content "Secret message"
```

**验证点**:
- [ ] 返回 msg_id
- [ ] 返回 server_seq
- [ ] ciphertext 正确加密

---

### T05.4: 接收 E2EE 消息

**API**: `e2eeMsg` (接收)

**测试**:
```bash
# Python
python scripts/e2ee_messaging.py --recv --peer <DID>

# Node.js
node scripts/e2ee_messaging.js --recv --peer <DID>
```

**验证点**:
- [ ] 成功解密消息
- [ ] 返回 plaintext
- [ ] 返回 original_type

---

### T05.5: E2EE 互操作性测试

**测试场景**:
1. Python 发起握手 → Node.js 确认
2. Python 发送加密消息 → Node.js 解密
3. Node.js 发送加密消息 → Python 解密
4. 多轮对话测试

**验证点**:
- [ ] 跨平台握手成功
- [ ] 跨平台加密解密成功
- [ ] Ratchet 同步正确
- [ ] 序号管理正确

---

## Level 6: 社交关系 API

**端点**: `/user-service/did/relationships/rpc`  
**优先级**: 🟡 中

### T06.1: 关注用户

**API**: `follow`

**测试**:
```bash
# Python
python scripts/manage_relationship.py --follow <DID> --credential py_test_reg

# Node.js
node scripts/manage_relationship.js --follow <DID> --credential node_test_reg
```

**验证点**:
- [ ] 返回 status: "following"
- [ ] 返回 created_at

---

### T06.2: 取消关注

**API**: `unfollow`

**测试**:
```bash
node scripts/manage_relationship.js --unfollow <DID> --credential node_test_reg
```

**验证点**:
- [ ] 返回 status: "none"

---

### T06.3: 获取关系状态

**API**: `getRelationship`

**测试**:
```bash
node scripts/manage_relationship.js --status <DID> --credential node_test_reg
```

**验证点**:
- [ ] 返回 following (bool)
- [ ] 返回 followed_by (bool)
- [ ] 返回 status: "following" / "follower" / "none"

---

### T06.4: 获取关注列表

**API**: `getFollowing`

**测试**:
```bash
node scripts/manage_relationship.js --following --limit 20 --credential node_test_reg
```

**验证点**:
- [ ] 返回 list 数组
- [ ] 每个元素包含 did, name, followed_at
- [ ] 返回 total

---

### T06.5: 获取粉丝列表

**API**: `getFollowers`

**测试**:
```bash
node scripts/manage_relationship.js --followers --limit 20 --credential node_test_reg
```

**验证点**:
- [ ] 返回 list 数组
- [ ] 返回 total

---

## Level 7: 群组管理 API

**端点**: `/user-service/did/relationships/rpc`  
**优先级**: 🟢 低

### T07.1: 创建群组

**API**: `createGroup`

**测试**:
```bash
node scripts/manage_group.js --create --name "Test Group" --credential node_test_reg
```

**验证点**:
- [ ] 返回 groupId
- [ ] 返回 groupName

---

### T07.2: 邀请用户入群

**API**: `inviteToGroup`

**测试**:
```bash
node scripts/manage_group.js --invite --group <id> --target <DID> --credential node_test_reg
```

**验证点**:
- [ ] 返回 inviteId

---

### T07.3: 加入群组

**API**: `joinGroup`

**测试**:
```bash
node scripts/manage_group.js --join --group <id> --invite-id <id> --credential node_test_reg
```

**验证点**:
- [ ] 返回 joined: true

---

### T07.4: 获取群成员列表

**API**: `getGroupMembers`

**测试**:
```bash
node scripts/manage_group.js --members --group <id> --credential node_test_reg
```

**验证点**:
- [ ] 返回 members 数组
- [ ] 每个元素包含 did, name, role
- [ ] 返回 total

---

### T07.5: 群组消息

**测试**: 在群组中发送和接收消息

---

## Level 8: 内容页面 API

**端点**: `/content/rpc`  
**优先级**: 🟢 低

### T08.1: 创建内容页面

**API**: `create`

**测试**:
```bash
node scripts/manage_content.js --create --slug "test" --title "Test Page" --body "# Test" --credential node_test_reg
```

**验证点**:
- [ ] 返回 page 对象
- [ ] 包含 slug, title, created_at

---

### T08.2: 列出内容页面

**API**: `listContents`

**测试**:
```bash
node scripts/manage_content.js --list --credential node_test_reg
```

**验证点**:
- [ ] 返回 pages 数组
- [ ] 每个元素包含 slug, title, visibility

---

### T08.3: 获取内容页面

**API**: `getContent`

**测试**:
```bash
node scripts/manage_content.js --get --slug "test" --credential node_test_reg
```

**验证点**:
- [ ] 返回 page 对象
- [ ] 包含 body 内容

---

### T08.4: 更新内容页面

**API**: `update`

**测试**:
```bash
node scripts/manage_content.js --update --slug "test" --body "Updated" --credential node_test_reg
```

**验证点**:
- [ ] 返回 updated: true

---

### T08.5: 重命名内容页面

**API**: `rename`

**测试**:
```bash
node scripts/manage_content.js --rename --slug "test" --new-slug "renamed" --credential node_test_reg
```

**验证点**:
- [ ] 返回 renamed: true
- [ ] 新 slug 可用

---

### T08.6: 删除内容页面

**API**: `delete`

**测试**:
```bash
node scripts/manage_content.js --delete --slug "renamed" --credential node_test_reg
```

**验证点**:
- [ ] 返回 deleted: true
- [ ] 再次获取返回错误

---

## Level 9: WebSocket 实时推送

**端点**: `wss://awiki.ai/ws`  
**优先级**: 🟢 低

### T09.1: WebSocket 连接测试

**测试**:
```bash
node scripts/ws_listener.js --credential node_test_reg
```

**验证点**:
- [ ] 成功连接 WebSocket
- [ ] 收到新消息推送
- [ ] 推送格式正确

---

## 错误处理测试

### 通用错误测试

| 错误代码 | 测试方法 | 预期行为 |
|---------|---------|---------|
| `INVALID_DID` | 使用无效 DID 调用 API | 返回错误 |
| `DID_NOT_FOUND` | 使用不存在的 DID | 返回错误 |
| `HANDLE_TAKEN` | 注册已占用的 Handle | 返回错误 |
| `INVALID_OTP` | 使用错误 OTP | 返回错误 |
| `JWT_EXPIRED` | 使用过期 JWT | 自动刷新或返回错误 |
| `JWT_INVALID` | 使用无效 JWT | 返回错误 |
| `SIGNATURE_INVALID` | 使用无效签名 | 返回错误 |
| `MESSAGE_TOO_LONG` | 发送超长消息 | 返回错误 |
| `E2EE_VERSION_UNSUPPORTED` | 使用不支持的 E2EE 版本 | 返回错误 |
| `E2EE_SESSION_NOT_FOUND` | 使用不存在的会话 ID | 返回错误 |

---

## 测试执行顺序

### 阶段 1: 基础功能 (Day 1-2)

1. Level 1: 身份认证 (T01.1-T01.4)
2. Level 2: Handle 管理 (T02.1-T02.4)
3. Level 3: 个人资料 (T03.1-T03.2)

### 阶段 2: 消息功能 (Day 3-4)

4. Level 4: 消息服务 (T04.1-T04.5)
5. Level 5: E2EE 加密消息 (T05.1-T05.5)

### 阶段 3: 社交功能 (Day 5)

6. Level 6: 社交关系 (T06.1-T06.5)

### 阶段 4: 高级功能 (Day 6-7)

7. Level 7: 群组管理 (T07.1-T07.5)
8. Level 8: 内容页面 (T08.1-T08.6)
9. Level 9: WebSocket (T09.1)

---

## 测试记录模板

```markdown
### TXX.X: [测试名称]

**测试日期**: YYYY-MM-DD HH:MM
**测试人员**: [姓名]

**Python 测试**:
```bash
[命令]
```
**结果**: ✅ 通过 / ❌ 失败
**输出**: [实际输出]

**Node.js 测试**:
```bash
[命令]
```
**结果**: ✅ 通过 / ❌ 失败
**输出**: [实际输出]

**Python 对比验证**:
- Python 结果: [结果]
- 结论: [服务端问题/Node.js 问题]

**问题记录**:
[如有问题，详细描述]

**状态**: ✅ 通过 / ❌ 失败 / ⏳ 待执行
```

---

## 测试完成标准

- [ ] 所有 37 个测试用例执行完毕
- [ ] 核心功能 (Level 1-5) 通过率 100%
- [ ] 高级功能 (Level 6-9) 通过率 90%+
- [ ] 所有错误处理验证完毕
- [ ] Python 对比验证完成
- [ ] 测试报告生成

---

**制定人**: AI Assistant  
**制定日期**: 2026-03-08  
**审查周期**: 每次 API 更新后审查
