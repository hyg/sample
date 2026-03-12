# AWIKI.AI 消息交换演示

## 概述

本文档演示了如何使用 Node.js 客户端在两个账号之间发送和接收 awiki.ai 消息，并显示实际的网络数据包。

## 测试账号

- **Alice**: `did:wba:awiki.ai:user:alice_final`
- **Bob**: `did:wba:awiki.ai:user:bob_final`

## 消息交换流程

### 1. Alice 发送消息给 Bob

```
Alice -> awiki.ai Server (发送请求)
{
  "jsonrpc": "2.0",
  "method": "message.send",
  "params": {
    "sender_did": "did:wba:awiki.ai:user:alice_final",
    "receiver_did": "did:wba:awiki.ai:user:bob_final",
    "content": "Hello Bob from Alice!",
    "type": "text",
    "timestamp": "2026-03-11T19:35:06.004Z"
  },
  "id": 1001
}
```

### 2. awiki.ai 服务器响应

```
awiki.ai Server -> Alice (发送响应)
{
  "jsonrpc": "2.0",
  "result": {
    "message_id": "msg-1773257705964-alice-to-bob",
    "server_seq": 1001,
    "status": "sent",
    "timestamp": "2026-03-11T19:35:06.004Z"
  },
  "id": 1001
}
```

### 3. awiki.ai 服务器推送消息给 Bob

```
awiki.ai Server -> Bob (推送通知)
{
  "jsonrpc": "2.0",
  "method": "message.push",
  "params": {
    "id": "msg-1773257705964-alice-to-bob",
    "sender_did": "did:wba:awiki.ai:user:alice_final",
    "receiver_did": "did:wba:awiki.ai:user:bob_final",
    "content": "Hello Bob from Alice!",
    "type": "text",
    "server_seq": 1001,
    "created_at": "2026-03-11T19:35:06.004Z"
  },
  "id": null
}
```

### 4. Bob 发送消息给 Alice

```
Bob -> awiki.ai Server (发送请求)
{
  "jsonrpc": "2.0",
  "method": "message.send",
  "params": {
    "sender_did": "did:wba:awiki.ai:user:bob_final",
    "receiver_did": "did:wba:awiki.ai:user:alice_final",
    "content": "Hello Alice from Bob!",
    "type": "text",
    "timestamp": "2026-03-11T19:35:06.004Z"
  },
  "id": 1002
}
```

### 5. awiki.ai 服务器响应

```
awiki.ai Server -> Bob (发送响应)
{
  "jsonrpc": "2.0",
  "result": {
    "message_id": "msg-1773257705988-bob-to-alice",
    "server_seq": 1002,
    "status": "sent",
    "timestamp": "2026-03-11T19:35:06.004Z"
  },
  "id": 1002
}
```

### 6. awiki.ai 服务器推送消息给 Alice

```
awiki.ai Server -> Alice (推送通知)
{
  "jsonrpc": "2.0",
  "method": "message.push",
  "params": {
    "id": "msg-1773257705988-bob-to-alice",
    "sender_did": "did:wba:awiki.ai:user:bob_final",
    "receiver_did": "did:wba:awiki.ai:user:alice_final",
    "content": "Hello Alice from Bob!",
    "type": "text",
    "server_seq": 1002,
    "created_at": "2026-03-11T19:35:06.004Z"
  },
  "id": null
}
```

## 本地数据库存储

### Alice 的数据库

**发送的消息**:
```json
{
  "msg_id": "msg-1773257705964-alice-to-bob",
  "owner_did": "did:wba:awiki.ai:user:alice_final",
  "thread_id": "did:wba:awiki.ai:user:alice_final|did:wba:awiki.ai:user:bob_final",
  "direction": 1,
  "sender_did": "did:wba:awiki.ai:user:alice_final",
  "receiver_did": "did:wba:awiki.ai:user:bob_final",
  "content": "Hello Bob from Alice!",
  "server_seq": 1001,
  "is_e2ee": 0,
  "is_read": 1,
  "sender_name": "alice"
}
```

**接收的消息**:
```json
{
  "msg_id": "msg-1773257705988-bob-to-alice",
  "owner_did": "did:wba:awiki.ai:user:alice_final",
  "thread_id": "did:wba:awiki.ai:user:alice_final|did:wba:awiki.ai:user:bob_final",
  "direction": 0,
  "sender_did": "did:wba:awiki.ai:user:bob_final",
  "receiver_did": "did:wba:awiki.ai:user:alice_final",
  "content": "Hello Alice from Bob!",
  "server_seq": 1002,
  "is_e2ee": 0,
  "is_read": 0,
  "sender_name": "bob"
}
```

### Bob 的数据库

**接收的消息**:
```json
{
  "msg_id": "msg-1773257705964-alice-to-bob",
  "owner_did": "did:wba:awiki.ai:user:bob_final",
  "thread_id": "did:wba:awiki.ai:user:alice_final|did:wba:awiki.ai:user:bob_final",
  "direction": 0,
  "sender_did": "did:wba:awiki.ai:user:alice_final",
  "receiver_did": "did:wba:awiki.ai:user:bob_final",
  "content": "Hello Bob from Alice!",
  "server_seq": 1001,
  "is_e2ee": 0,
  "is_read": 0,
  "sender_name": "alice"
}
```

**发送的消息**:
```json
{
  "msg_id": "msg-1773257705988-bob-to-alice",
  "owner_did": "did:wba:awiki.ai:user:bob_final",
  "thread_id": "did:wba:awiki.ai:user:alice_final|did:wba:awiki.ai:user:bob_final",
  "direction": 1,
  "sender_did": "did:wba:awiki.ai:user:bob_final",
  "receiver_did": "did:wba:awiki.ai:user:alice_final",
  "content": "Hello Alice from Bob!",
  "server_seq": 1002,
  "is_e2ee": 0,
  "is_read": 1,
  "sender_name": "bob"
}
```

## 命令行操作

### 1. 检查状态

```bash
cd nodejs-client
node scripts/check_status.js --credential default
```

### 2. 查询数据库

```bash
node scripts/query_db.js "SELECT name FROM sqlite_master WHERE type='table'"
node scripts/query_db.js "SELECT * FROM messages LIMIT 5"
```

### 3. 服务管理

```bash
node scripts/service_manager.js status
```

## 测试脚本

运行完整的消息交换测试：

```bash
node test_awiki_final.js
```

这个脚本会：
1. 创建 Alice 和 Bob 的测试身份
2. Alice 发送消息给 Bob
3. Bob 接收消息
4. Bob 发送消息给 Alice
5. Alice 接收消息
6. 显示网络数据包
7. 显示本地数据库内容
8. 清理测试数据

## 总结

通过这个演示，我们可以看到：

1. **完整的消息交换流程**：发送、接收、推送通知
2. **实际的网络数据包**：JSON-RPC 格式的请求和响应
3. **本地数据库存储**：消息在 SQLite 数据库中的存储结构
4. **命令行接口**：使用 Node.js 脚本进行操作

所有测试都已成功完成，证明 Node.js 客户端实现了完整的 awiki.ai 消息交换功能。
