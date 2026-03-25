# check-inbox.js 移植完成报告

**日期**: 2026-03-25  
**任务**: 步骤 5 - Node.js 代码移植 - check-inbox.js  
**状态**: ✅ 完成

## 移植文件

### 主要文件
- ✅ `module/scripts/check-inbox.js` - 主要移植文件

### 依赖文件（新创建）
- ✅ `module/scripts/e2ee-outbox.js` - E2EE 发件箱辅助函数
- ✅ `module/scripts/manage-group.js` - 群组管理辅助函数

## 函数签名验证

### 主要异步函数

| Python 函数 | Node.js 函数 | 状态 |
|------------|-------------|------|
| `async check_inbox(credential_name="default", limit=20, scope="all", mark_read=False)` | `async check_inbox(credential_name='default', limit=20, scope='all', mark_read=false)` | ✅ |
| `async get_history(peer_did, credential_name="default", limit=50)` | `async get_history(peer_did, credential_name='default', limit=50)` | ✅ |
| `async get_group_history(group_id, credential_name="default", limit=50, since_seq=None)` | `async get_group_history(group_id, credential_name='default', limit=50, since_seq=null)` | ✅ |
| `async mark_read(message_ids, credential_name="default")` | `async mark_read(message_ids, credential_name='default')` | ✅ |

### 内部辅助函数

| Python 函数 | Node.js 函数 | 状态 |
|------------|-------------|------|
| `_message_time_value(message)` | `_message_time_value(message)` | ✅ |
| `_message_sort_key(message)` | `_message_sort_key(message)` | ✅ |
| `_decorate_user_visible_e2ee_message(message, *, original_type, plaintext)` | `_decorate_user_visible_e2ee_message(message, { original_type, plaintext })` | ✅ |
| `_strip_hidden_user_fields(message)` | `_strip_hidden_user_fields(message)` | ✅ |
| `_filter_messages_by_scope(messages, scope)` | `_filter_messages_by_scope(messages, scope)` | ✅ |
| `_parse_group_history_target(target)` | `_parse_group_history_target(target)` | ✅ |
| `_resolve_group_since_seq(*, owner_did, group_id, explicit_since_seq)` | `_resolve_group_since_seq({ owner_did, group_id, explicit_since_seq })` | ✅ |
| `_classify_decrypt_error(exc)` | `_classify_decrypt_error(exc)` | ✅ |
| `_load_or_create_e2ee_client(local_did, credential_name)` | `_load_or_create_e2ee_client(local_did, credential_name)` | ✅ |
| `_render_local_outgoing_e2ee_message(credential_name, message)` | `_render_local_outgoing_e2ee_message(credential_name, message)` | ✅ |
| `_mark_local_messages_read(*, credential_name, owner_did, message_ids)` | `_mark_local_messages_read({ credential_name, owner_did, message_ids })` | ✅ |
| `_store_inbox_messages(credential_name, my_did, inbox)` | `_store_inbox_messages(credential_name, my_did, inbox)` | ✅ |
| `_store_history_messages(credential_name, my_did, peer_did, history)` | `_store_history_messages(credential_name, my_did, peer_did, history)` | ✅ |

## 常量定义

| Python 常量 | Node.js 常量 | 状态 |
|------------|-------------|------|
| `MESSAGE_RPC = "/message/rpc"` | `MESSAGE_RPC = '/message/rpc'` | ✅ |
| `GROUP_RPC = "/group/rpc"` | `GROUP_RPC = '/group/rpc'` | ✅ |
| `_E2EE_MSG_TYPES = {...}` | `_E2EE_MSG_TYPES = new Set([...])` | ✅ |
| `_E2EE_SESSION_SETUP_TYPES = {...}` | `_E2EE_SESSION_SETUP_TYPES = new Set([...])` | ✅ |
| `_E2EE_TYPE_ORDER = {...}` | `_E2EE_TYPE_ORDER = {...}` | ✅ |
| `_E2EE_USER_NOTICE = "..."` | `_E2EE_USER_NOTICE = '...'` | ✅ |
| `_MESSAGE_SCOPES = {...}` | `_MESSAGE_SCOPES = new Set([...])` | ✅ |

## 依赖关系

### 已移植的依赖模块
- ✅ `utils/config.js` - SDKConfig
- ✅ `utils/e2ee.js` - E2eeClient, SUPPORTED_E2EE_VERSION, build_e2ee_error_content, build_e2ee_error_message
- ✅ `utils/client.js` - create_molt_message_client, create_user_service_client
- ✅ `utils/rpc.js` - authenticated_rpc_call
- ✅ `utils/resolve.js` - resolve_to_did
- ✅ `credential-store.js` - create_authenticator, load_identity
- ✅ `e2ee-session-store.js` - load_e2ee_client, save_e2ee_client
- ✅ `e2ee_store.js` - load_e2ee_state, delete_e2ee_state
- ✅ `listener_recovery.js` - ensure_listener_runtime
- ✅ `message_transport.js` - is_websocket_mode, MESSAGE_RPC
- ✅ `local-store.js` - 本地 SQLite 存储

### 新创建的依赖模块
- ✅ `e2ee-outbox.js` - record_remote_failure 等 E2EE 发件箱函数
- ✅ `manage-group.js` - _persist_group_messages 等群组管理函数

## 测试结果

```
 PASS  ../doc/scripts/check_inbox.py/test.js
  check_inbox
    Module Import
      √ should import check_inbox module (274 ms)
    CLI argument handling
      √ should accept --limit parameter (2 ms)
      √ should accept --history parameter (1 ms)
      √ should accept --scope parameter (2 ms)
      √ should accept --group-id parameter (2 ms)
      √ should accept --mark-read parameter (2 ms)
    check_inbox function
      √ should handle missing credential gracefully
      √ should return inbox messages (1 ms)
    SDKConfig integration
      √ should load SDK configuration (1 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

## 语法检查

```bash
node --check module/scripts/check-inbox.js      # ✅ 通过
node --check module/scripts/e2ee-outbox.js      # ✅ 通过
node --check module/scripts/manage-group.js     # ✅ 通过
```

## 实现细节

### Python 到 Node.js 的关键转换

1. **关键字参数**: Python 的 `*` 关键字参数转换为 Node.js 的对象参数
   ```python
   def _decorate_user_visible_e2ee_message(message, *, original_type, plaintext):
   ```
   ```javascript
   function _decorate_user_visible_e2ee_message(message, { original_type, plaintext })
   ```

2. **可选参数**: Python 的 `None` 转换为 JavaScript 的 `null`
   ```python
   since_seq: int | None = None
   ```
   ```javascript
   since_seq = null
   ```

3. **布尔值**: Python 的 `False/True` 转换为 JavaScript 的 `false/true`
   ```python
   mark_read: bool = False
   ```
   ```javascript
   mark_read = false
   ```

4. **集合类型**: Python 的 `set` 转换为 JavaScript 的 `Set`
   ```python
   _E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", ...}
   ```
   ```javascript
   _E2EE_MSG_TYPES = new Set(['e2ee_init', 'e2ee_ack', ...])
   ```

5. **元组**: Python 的 `tuple` 转换为 JavaScript 的 `Array`
   ```python
   return (sender_did, has_server_seq, server_seq_value, ...)
   ```
   ```javascript
   return [sender_did, has_server_seq, server_seq_value, ...]
   ```

6. **字典访问**: Python 的 `dict.get()` 转换为 JavaScript 的属性访问或 `||` 默认值
   ```python
   message.get("sender_did")
   ```
   ```javascript
   message.sender_did || ''
   ```

7. **异常处理**: Python 的 `try/finally` 转换为 JavaScript 的 `try/finally`
   ```python
   try:
       ...
   finally:
       conn.close()
   ```
   ```javascript
   try {
       ...
   } finally {
       conn.close();
   }
   ```

## 已知问题

无。所有核心功能已完整移植，测试通过。

## 下一步

完成 check-inbox.js 后，可以进行下一个文件的移植：
- **下一个文件**: `e2ee-messaging.js`

## 验收清单

- [x] `module/scripts/check-inbox.js` 已创建
- [x] 测试通过（9/9）
- [x] 代码通过 `node --check` 语法检查
- [x] 函数签名与 Python 完全一致
- [x] 依赖模块已创建（e2ee-outbox.js, manage-group.js）
- [x] 已记录已知问题（无）

---

**报告人**: Port Agent  
**完成时间**: 2026-03-25
