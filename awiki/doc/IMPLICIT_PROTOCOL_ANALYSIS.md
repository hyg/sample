# awiki.ai 隐性协议与未文档化接口分析报告

**分析日期**: 2026-03-16  
**分析范围**: `python/scripts/` 目录下的 Python 客户端代码  
**目标**: 识别 awiki-agent-id-message 与 awiki.ai 服务端之间的隐性协议和未文档化接口细节

---

## 1. 隐性协议列表

### 1.1 DID WBA 认证协议 (auth.py)

| 协议项 | 说明 | 代码位置 |
|--------|------|----------|
| **认证流程** | 生成 DID 文档 -> 注册 -> 通过 WBA 签名获取 JWT | `auth.py:create_authenticated_identity()` |
| **签名算法** | secp256k1 ECDSA-SHA256 | `auth.py:_secp256k1_sign_callback()` |
| **DID 格式** | `did:wba:{domain}:user:k1_{fingerprint}` | `auth.py:202-205` |
| **JWT 刷新** | 401 响应时自动清除过期令牌并重新获取 | `rpc.py:authenticated_rpc_call()` |
| **令牌存储** | JWT 从响应头 `Authorization: Bearer {token}` 或响应体 `access_token` 字段提取 | `auth.py:155-158`, `rpc.py:116-119` |

**隐性细节**:
```python
# 服务端在 update_document 响应中可能返回 access_token
# 优先级：响应体 > 响应头
auth_value = response.headers.get("authorization", "").strip()
if auth_value.lower().startswith("bearer ") and not result.get("access_token"):
    result["access_token"] = auth_value.split(" ", 1)[1]
```

### 1.2 JSON-RPC 2.0 调用协议 (rpc.py)

| 协议项 | 说明 | 代码位置 |
|--------|------|----------|
| **请求格式** | `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": 1}` | `rpc.py:46-52` |
| **错误处理** | `{"error": {"code": int, "message": str, "data": any}}` | `rpc.py:18-24` |
| **自动重试** | 收到 401 时自动清除令牌并重新认证重试 | `rpc.py:98-104` |
| **请求 ID** | 默认使用 `1`，WebSocket 中自增 | `rpc.py:49`, `ws.py:94-96` |

**隐性细节**:
- 服务端可能不返回 `result` 字段，此时返回空字典
- 错误码 `-32003` 表示 "DID already registered"
- 错误码 `-32004` 表示 "Slug already taken"

### 1.3 E2EE 端到端加密协议 (e2ee.py)

| 协议项 | 说明 | 代码位置 |
|--------|------|----------|
| **加密方案** | HPKE (RFC 9180) + Chain Ratchet | `e2ee.py:43-45` |
| **密钥体系** | 三密钥独立：key-1(secp256k1), key-2(secp256r1), key-3(X25519) | `e2ee.py:175-178` |
| **E2EE 版本** | `1.1` (硬编码) | `e2ee.py:52` |
| **会话过期** | 86400 秒 (24 小时) | `e2ee.py:468` |
| **序列号跳过** | 最大跳过 256 | `e2ee.py:523` |

**E2EE 消息类型**:
```python
_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"}
```

**E2EE 错误码**:
| 错误码 | 含义 | 重试提示 |
|--------|------|----------|
| `unsupported_version` | E2EE 版本不支持 | `drop` |
| `session_not_found` | 接收方无会话 | `rekey_then_resend` |
| `session_expired` | 会话过期 | `rekey_then_resend` |
| `decryption_failed` | 解密失败 | `resend` |
| `invalid_seq` | 序列号无效 | `rekey_then_resend` |
| `proof_expired` | 证明过期 | `resend` |
| `proof_from_future` | 证明时间戳在未来 | `drop` |

**隐性细节**:
```python
# E2EE 消息内容必须包含 e2ee_version 字段
content = {
    "e2ee_version": "1.1",  # 硬编码
    "session_id": "...",
    "ciphertext": "...",
    ...
}

# 证明字段兼容性：同时支持 snake_case 和 camelCase
verification_method = proof.get("verification_method") or proof.get("verificationMethod")
```

### 1.4 WebSocket 推送协议 (ws.py)

| 协议项 | 说明 | 代码位置 |
|--------|------|----------|
| **认证方式** | JWT 通过查询参数 `?token={jwt}` 传递 | `ws.py:77` |
| **URL 格式** | `{wss_url}/message/ws?token={jwt}` | `ws.py:73-77` |
| **推送格式** | JSON-RPC 通知（无 `id` 字段） | `ws.py:174-189` |
| **请求格式** | JSON-RPC 请求（有 `id` 字段） | `ws.py:127-143` |
| **幂等投递** | `client_msg_id` 自动生成 (uuid4) | `ws.py:153-155` |

**隐性细节**:
```python
# WebSocket URL 自动从 HTTP URL 转换
ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://")

# 推送通知识别：无 id 字段
if "id" not in data:
    return data  # 这是推送通知
```

### 1.5 Handle 注册协议 (handle.py)

| 协议项 | 说明 | 代码位置 |
|--------|------|----------|
| **OTP 验证** | 注册前需发送 OTP 到手机 | `handle.py:send_otp()` |
| **电话格式** | 国际格式 `+{country_code}{number}` | `handle.py:34-35` |
| **中国号码** | 自动添加 `+86` 前缀 | `handle.py:37-38` |
| **DID 格式** | `did:wba:{domain}:{handle}:k1_{fingerprint}` | `handle.py:127-133` |
| **短 Handle** | ≤4 字符需要邀请码 | `handle.py:118` |

**隐性细节**:
```python
# OTP 代码自动去除空白字符
def _sanitize_otp(code: str) -> str:
    return re.sub(r"\s+", "", code)

# 电话规范化正则
_PHONE_INTL_RE = re.compile(r"^\+\d{1,3}\d{6,14}$")
_PHONE_CN_LOCAL_RE = re.compile(r"^1[3-9]\d{9}$")
```

---

## 2. 未文档化的接口细节

### 2.1 RPC 端点路径

| 端点 | 用途 | 代码位置 |
|------|------|----------|
| `/user-service/did-auth/rpc` | DID 注册、更新、认证 | `auth.py:88`, `handle.py:28` |
| `/user-service/handle/rpc` | Handle 查找、OTP | `handle.py:27` |
| `/user-service/.well-known/handle/{handle}` | Handle 解析为 DID | `resolve.py:54` |
| `/message/rpc` | 消息发送、接收 | `send_message.py:33` |
| `/message/ws` | WebSocket 连接 | `ws.py:77` |
| `/group/rpc` | 群组管理 | `manage_group.py:53` |

### 2.2 HTTP 头处理

| 头字段 | 用途 | 代码位置 |
|--------|------|----------|
| `Authorization: DIDWba ...` | DID WBA 认证 | `auth.py:44-51` |
| `Authorization: Bearer {jwt}` | JWT 认证 | `rpc.py:117` |
| `X-Handle: {handle}` | 公共文档获取的回退机制 | `manage_group.py:702-706` |

### 2.3 超时设置

| 场景 | 超时值 | 代码位置 |
|------|--------|----------|
| HTTP 客户端默认 | 30.0 秒 | `client.py:44`, `client.py:54` |
| WebSocket 接收 | 10.0 秒 | `ws.py:174` |
| Handle 解析 | 10.0 秒 | `resolve.py:57` |

### 2.4 错误码含义

| 错误码 | 含义 | 来源 |
|--------|------|------|
| `-32003` | DID already registered | `test_auth_update.py:93` |
| `-32004` | Slug already taken | `manage_group.py:353` |
| `401` | JWT expired/invalid | `rpc.py:98-104` |
| `404` | Handle not found | `resolve.py:63` |

### 2.5 认证令牌刷新机制

```python
# rpc.py:authenticated_rpc_call()
# 1. 首次请求使用缓存的 JWT
auth_headers = auth.get_auth_header(server_url)
resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 2. 收到 401 时清除过期令牌
if resp.status_code == 401:
    auth.clear_token(server_url)
    # 3. 重新生成 DIDWBA 认证头（触发新的 WBA 签名）
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 4. 从响应头缓存新 JWT
auth_header_value = resp.headers.get("authorization", "")
new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
```

### 2.6 E2EE 消息格式细节

**e2ee_init 消息格式**:
```json
{
  "e2ee_version": "1.1",
  "session_id": "<uuid>",
  "sender_did": "did:wba:...",
  "recipient_did": "did:wba:...",
  "sender_x25519_key_id": "did:wba:...#key-3",
  "expires": 86400,
  "proof": {
    "verification_method": "did:wba:...#key-2",
    "signature": "<DER-encoded>",
    "timestamp": "<ISO8601>"
  }
}
```

**e2ee_msg 消息格式**:
```json
{
  "e2ee_version": "1.1",
  "session_id": "<uuid>",
  "ciphertext": "<base64>",
  "sender_did": "did:wba:..."
}
```

**e2ee_error 消息格式**:
```json
{
  "e2ee_version": "1.1",
  "error_code": "session_not_found",
  "session_id": "<uuid>",
  "failed_msg_id": "<msg_id>",
  "failed_server_seq": 123,
  "retry_hint": "rekey_then_resend",
  "message": "E2EE session has expired..."
}
```

### 2.7 WebSocket 推送格式

**推送通知** (无 `id` 字段):
```json
{
  "jsonrpc": "2.0",
  "method": "message",
  "params": {
    "id": "msg_123",
    "sender_did": "did:wba:...",
    "content": "...",
    "type": "text",
    "server_seq": 456,
    "sent_at": "2026-03-16T12:00:00Z"
  }
}
```

**请求响应** (有 `id` 字段):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "msg_123",
    "server_seq": 456,
    "sent_at": "2026-03-16T12:00:00Z"
  }
}
```

---

## 3. 魔法值汇总

### 3.1 URL 路径

```python
# 硬编码的 RPC 端点
HANDLE_RPC = "/user-service/handle/rpc"
DID_AUTH_RPC = "/user-service/did-auth/rpc"
MESSAGE_RPC = "/message/rpc"
GROUP_RPC = "/group/rpc"

# Well-known 端点
WELL_KNOWN_HANDLE = "/user-service/.well-known/handle/{handle}"
```

### 3.2 版本号

```python
SUPPORTED_E2EE_VERSION = "1.1"  # e2ee.py:52
_STATE_VERSION = "hpke_v1"      # e2ee.py:51
_SCHEMA_VERSION = 9             # local_store.py:34
```

### 3.3 时间限制

```python
# E2EE 会话过期时间
DEFAULT_EXPIRES = 86400  # 24 小时

# 序列号最大跳过
MAX_SKIP = 256  # e2ee.py:523

# HTTP 超时
DEFAULT_TIMEOUT = 30.0  # client.py:44

# WebSocket 接收超时
WS_RECEIVE_TIMEOUT = 10.0  # ws.py:174
```

### 3.4 字段名称

```python
# DID 文档字段
DID_PATH_PREFIX = ["user"]  # auth.py:203

# E2EE 密钥 ID
SIGNING_KEY_ID = "key-2"      # secp256r1
AGREEMENT_KEY_ID = "key-3"    # X25519
DID_IDENTITY_KEY = "key-1"    # secp256k1

# 凭证存储字段
CREDENTIAL_FIELDS = [
    "did", "unique_id", "user_id", "jwt_token",
    "private_key_pem", "public_key_pem",
    "e2ee_signing_private_pem", "e2ee_agreement_private_pem"
]
```

### 3.5 错误码

```python
# JSON-RPC 错误码
ERROR_DID_REGISTERED = -32003
ERROR_SLUG_TAKEN = -32004

# E2EE 错误码
E2EE_ERROR_UNSUPPORTED_VERSION = "unsupported_version"
E2EE_ERROR_SESSION_NOT_FOUND = "session_not_found"
E2EE_ERROR_SESSION_EXPIRED = "session_expired"
E2EE_ERROR_DECRYPTION_FAILED = "decryption_failed"
E2EE_ERROR_INVALID_SEQ = "invalid_seq"
E2EE_ERROR_PROOF_EXPIRED = "proof_expired"
E2EE_ERROR_PROOF_FROM_FUTURE = "proof_from_future"
```

---

## 4. 服务端行为假设

### 4.1 响应格式假设

```python
# 假设服务端总是返回有效的 JSON-RPC 响应
body = resp.json()
result = body["result"]  # 可能抛出 KeyError

# 假设错误响应包含 error 字段
if body.get("error") is not None:
    error = body["error"]
    raise JsonRpcError(error["code"], error["message"], error.get("data"))
```

### 4.2 认证头注入假设

```python
# 假设服务端从 Authorization 头提取 sender_did
# 客户端不需要显式发送 sender_did
params = {
    "receiver_did": receiver_did,
    "content": content,
    # sender_did 由服务端从 JWT 中提取并注入
}
```

### 4.3 幂等性假设

```python
# 假设 client_msg_id 用于幂等投递
# 相同的 client_msg_id 不会被重复处理
client_msg_id = str(uuid.uuid4())  # 每次发送生成新的
```

### 4.4 会话状态假设

```python
# 假设 E2EE 会话在发送 e2ee_init 后立即激活（无需等待响应）
# HPKE 方案：单向握手
session = E2eeHpkeSession(...)
msg_type, content = session.initiate_session(peer_pk, peer_key_id)
self._key_manager.register_session(session)  # 立即注册为 ACTIVE
```

### 4.5 令牌刷新假设

```python
# 假设 401 响应表示 JWT 过期，可以通过重新签名获取新令牌
# 假设服务端在成功响应中返回新的 Authorization 头
if resp.status_code == 401:
    auth.clear_token(server_url)
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)
```

---

## 5. 移植风险

### 5.1 高风险项

| 风险 | 描述 | 影响 | 缓解方案 |
|------|------|------|----------|
| **E2EE 协议版本** | 硬编码版本 "1.1"，服务端可能升级 | 消息无法解密 | 实现版本协商机制 |
| **JWT 刷新逻辑** | 依赖 401 响应触发刷新 | 令牌过期导致请求失败 | 实现主动刷新（过期前） |
| **会话状态持久化** | 复杂的 HPKE 状态导出/恢复 | 跨进程/重启后会话丢失 | 严格测试状态序列化 |
| **签名算法** | secp256k1 DER 编码签名 | 签名格式不兼容 | 使用相同加密库 |

### 5.2 中风险项

| 风险 | 描述 | 影响 | 缓解方案 |
|------|------|------|----------|
| **URL 路径变更** | 硬编码的 RPC 端点 | 请求失败 | 配置化端点路径 |
| **错误码含义** | 未文档化的错误码 | 错误处理不当 | 实现错误码映射表 |
| **超时设置** | 硬编码的超时值 | 网络波动时失败 | 配置化超时 + 重试 |
| **电话格式** | 中国号码特殊处理 | 国际用户注册失败 | 完善电话格式验证 |

### 5.3 低风险项

| 风险 | 描述 | 影响 | 缓解方案 |
|------|------|------|----------|
| **字段名称兼容性** | snake_case vs camelCase | 解析失败 | 同时支持两种格式 |
| **日志格式** | 日志级别和格式差异 | 调试困难 | 统一日志配置 |
| **文件路径** | Windows vs Unix 路径 | 文件操作失败 | 使用跨平台路径库 |

---

## 6. 克服方案

### 6.1 信息获取策略

| 方法 | 描述 | 优先级 |
|------|------|--------|
| **代码逆向分析** | 详细分析 Python 代码中的协议实现 | 高 |
| **网络抓包** | 捕获实际通信数据验证协议细节 | 高 |
| **测试驱动** | 编写测试用例验证协议行为 | 高 |
| **与服务端联调** | 直接测试服务端响应 | 高 |
| **文档补充** | 将发现记录到文档 | 中 |

### 6.2 协议验证测试

```javascript
// 建议的 Node.js 测试用例
describe('Implicit Protocol Tests', () => {
  it('should handle 401 and refresh JWT', async () => {
    // 模拟 401 响应，验证自动刷新
  });

  it('should parse E2EE message with e2ee_version 1.1', async () => {
    // 验证 E2EE 消息格式
  });

  it('should handle WebSocket push without id field', async () => {
    // 验证推送通知识别
  });

  it('should normalize phone number to +86 format', async () => {
    // 验证电话格式化
  });
});
```

### 6.3 配置化设计

```javascript
// 建议的配置结构
const config = {
  endpoints: {
    didAuth: '/user-service/did-auth/rpc',
    handle: '/user-service/handle/rpc',
    message: '/message/rpc',
    group: '/group/rpc',
  },
  timeouts: {
    http: 30000,
    wsReceive: 10000,
  },
  e2ee: {
    supportedVersion: '1.1',
    sessionExpires: 86400,
    maxSeqSkip: 256,
  },
  errorCodes: {
    didRegistered: -32003,
    slugTaken: -32004,
  },
};
```

### 6.4 渐进式移植策略

1. **阶段 1**: 基础 HTTP 客户端 + JSON-RPC 封装
2. **阶段 2**: DID WBA 认证 + JWT 管理
3. **阶段 3**: Handle 注册 + 解析
4. **阶段 4**: WebSocket 客户端 + 推送处理
5. **阶段 5**: E2EE 加密 + 会话管理
6. **阶段 6**: 完整集成测试

---

## 7. 总结

### 7.1 识别的隐性协议数量

**共识别 5 个主要隐性协议**:
1. DID WBA 认证协议
2. JSON-RPC 2.0 调用协议
3. E2EE 端到端加密协议
4. WebSocket 推送协议
5. Handle 注册协议

### 7.2 主要风险点

1. **E2EE 协议版本硬编码** - 服务端升级可能导致不兼容
2. **JWT 刷新依赖 401 触发** - 可能在高延迟网络下失败
3. **会话状态持久化复杂** - HPKE 状态序列化容易出错
4. **未文档化的错误码** - 错误处理可能不完整

### 7.3 建议的克服方案

1. **实现协议版本协商** - 支持多个 E2EE 版本
2. **主动 JWT 刷新** - 在过期前主动刷新
3. **严格的单元测试** - 覆盖所有协议边界情况
4. **网络抓包验证** - 验证实际通信格式
5. **配置化设计** - 将魔法值提取到配置

---

## 附录：关键代码位置索引

| 文件 | 关键函数/类 | 行号 |
|------|------------|------|
| `auth.py` | `generate_wba_auth_header()` | 36-51 |
| `auth.py` | `register_did()` | 54-95 |
| `auth.py` | `update_did_document()` | 98-159 |
| `auth.py` | `create_authenticated_identity()` | 189-224 |
| `rpc.py` | `authenticated_rpc_call()` | 73-125 |
| `e2ee.py` | `E2eeClient` 类 | 162-652 |
| `e2ee.py` | `build_e2ee_error_content()` | 93-113 |
| `ws.py` | `WsClient` 类 | 43-203 |
| `handle.py` | `register_handle()` | 102-161 |
| `handle.py` | `normalize_phone()` | 37-56 |
| `resolve.py` | `resolve_to_did()` | 24-72 |

---

**报告生成时间**: 2026-03-16  
**分析工具**: Qwen Code  
**Python 版本**: 3.14.3
