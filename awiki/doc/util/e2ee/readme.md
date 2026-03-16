# e2ee.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/e2ee.py`

**主要功能**: 
- E2EE 端到端加密客户端（包装 ANP 库）
- HPKE 密钥协商和消息加密
- 会话管理和状态持久化
- 协议错误处理和自动恢复

**依赖关系**:
- `anp.e2e_encryption_hpke`: ANP 的 HPKE 加密模块
- `cryptography`: 密钥加载和签名
- `base64`: 状态序列化
- 本地模块：`identity`, `resolve`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `base64` | Base64 编码（状态导出） |
| `logging` | 日志记录 |
| `time` | 时间戳处理 |
| `cryptography.hazmat.primitives.asymmetric.ec` | 椭圆曲线加密 |
| `cryptography.hazmat.primitives.asymmetric.x25519.X25519PrivateKey` | X25519 密钥 |
| `cryptography.hazmat.primitives.serialization` | PEM 密钥加载 |
| `anp.e2e_encryption_hpke` | HPKE 会话管理 |
| `anp.authentication.resolve_did_wba_document` | DID 文档解析 |

---

## 3. 常量

| 常量 | 值 | 描述 |
|------|-----|------|
| `_STATE_VERSION` | `"hpke_v1"` | 状态版本号 |
| `SUPPORTED_E2EE_VERSION` | `"1.1"` | 支持的 E2EE 协议版本 |

---

## 4. 函数详解

### 4.1 `_extract_proof_verification_method`

**签名**:
```python
def _extract_proof_verification_method(proof: Any) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `proof` | `Any` | - | 证明对象 |

**返回值**: `str` - 验证方法 ID

**功能**: 
从证明对象中提取验证方法 ID，兼容 `verification_method`（蛇形）和 `verificationMethod`（驼峰）两种字段名。

---

### 4.2 `ensure_supported_e2ee_version`

**签名**:
```python
def ensure_supported_e2ee_version(content: dict[str, Any]) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `content` | `dict[str, Any]` | - | E2EE 内容 |

**返回值**: `str` - 版本号

**异常**: `ValueError` - 版本不支持

**功能**: 
验证 E2EE 内容版本，确保与运行时兼容。

---

### 4.3 `build_e2ee_error_content`

**签名**:
```python
def build_e2ee_error_content(
    error_code: str,
    *,
    session_id: str | None = None,
    failed_msg_id: str | None = None,
    failed_server_seq: int | None = None,
    retry_hint: str | None = None,
    required_e2ee_version: str | None = None,
    message: str | None = None,
) -> dict[str, Any]:
```

**功能**: 
构建 E2EE 错误响应内容。

**错误码**:
| 错误码 | 含义 |
|--------|------|
| `unsupported_version` | 版本不支持 |
| `session_not_found` | 会话未找到 |
| `session_expired` | 会话过期 |
| `decryption_failed` | 解密失败 |
| `invalid_seq` | 序列号无效 |
| `proof_expired` | 证明过期 |
| `proof_from_future` | 证明时间在未来 |

---

### 4.4 `build_e2ee_error_message`

**签名**:
```python
def build_e2ee_error_message(
    error_code: str,
    *,
    required_e2ee_version: str | None = None,
    detail: str | None = None,
) -> str:
```

**功能**: 
构建人类可读的 E2EE 错误消息。

---

### 4.5 `_classify_protocol_error`

**签名**:
```python
def _classify_protocol_error(exc: BaseException) -> tuple[str, str] | None:
```

**返回值**: `(error_code, retry_hint)` 或 `None`

**功能**: 
将协议错误分类为发送方可见的错误码。

---

## 5. 类详解

### 5.1 `E2eeClient`

**定义**:
```python
class E2eeClient:
    """E2EE 端到端加密客户端（HPKE 方案）。"""
```

**初始化参数**:
```python
def __init__(
    self,
    local_did: str,
    *,
    signing_pem: str | None = None,
    x25519_pem: str | None = None,
) -> None:
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `local_did` | `str` | 本地 DID |
| `signing_pem` | `str` | key-2 secp256r1 私钥 PEM |
| `x25519_pem` | `str` | key-3 X25519 私钥 PEM |

---

### 5.1.1 `initiate_handshake`

**签名**:
```python
async def initiate_handshake(self, peer_did: str) -> tuple[str, dict[str, Any]]:
```

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `peer_did` | `str` | 对等方 DID |

**返回值**: `(msg_type, content)` - `("e2ee_init", content_dict)`

**功能**: 
发起 E2EE 会话握手（一步初始化）。

**流程**:
1. 获取对等方 DID 文档
2. 提取 X25519 公钥
3. 创建 HPKE 会话
4. 发送 `e2ee_init` 消息

**调用位置**: `ensure_active_session()`

---

### 5.1.2 `process_e2ee_message`

**签名**:
```python
async def process_e2ee_message(
    self, msg_type: str, content: dict[str, Any]
) -> list[tuple[str, dict[str, Any]]]:
```

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `msg_type` | `str` | 消息类型 |
| `content` | `dict` | 消息内容 |

**返回值**: 要发送的消息列表

**处理的消息类型**:
- `e2ee_init`: 会话初始化
- `e2ee_ack`: 会话确认
- `e2ee_rekey`: 密钥更新
- `e2ee_error`: 错误响应
- `e2ee_msg`: 加密消息（需要调用 `decrypt_message`）

---

### 5.1.3 `encrypt_message`

**签名**:
```python
def encrypt_message(
    self, peer_did: str, plaintext: str, original_type: str = "text"
) -> tuple[str, dict[str, Any]]:
```

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `peer_did` | `str` | 对等方 DID |
| `plaintext` | `str` | 明文内容 |
| `original_type` | `str` | 原始消息类型 |

**返回值**: `("e2ee_msg", content_dict)`

**异常**: `RuntimeError` - 没有活跃会话

**功能**: 
加密消息。

---

### 5.1.4 `decrypt_message`

**签名**:
```python
def decrypt_message(self, content: dict[str, Any]) -> tuple[str, str]:
```

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `content` | `dict` | 加密消息内容 |

**返回值**: `(original_type, plaintext)`

**异常**: `RuntimeError` - 找不到会话

**功能**: 
解密消息。

---

### 5.1.5 `ensure_active_session`

**签名**:
```python
async def ensure_active_session(
    self, peer_did: str
) -> list[tuple[str, dict[str, Any]]]:
```

**功能**: 
确保与对等方有活跃会话，自动握手。

**返回值**: 要发送的握手消息（如果需要）

---

### 5.1.6 状态管理方法

| 方法 | 功能 |
|------|------|
| `has_active_session(peer_did)` | 检查是否有活跃会话 |
| `has_session_id(session_id)` | 检查会话 ID 是否存在 |
| `is_session_confirmed(session_id)` | 会话是否已被远程确认 |
| `cleanup_expired()` | 清理过期会话 |

---

### 5.1.7 状态持久化方法

#### `export_state`

**签名**:
```python
def export_state(self) -> dict[str, Any]:
```

**功能**: 
导出客户端状态（密钥 + 活跃会话），用于持久化。

**返回格式**:
```json
{
  "version": "hpke_v1",
  "local_did": "...",
  "signing_pem": "...",
  "x25519_pem": "...",
  "confirmed_session_ids": [...],
  "sessions": [...]
}
```

#### `from_state`

**签名**:
```python
@classmethod
def from_state(cls, state: dict[str, Any]) -> E2eeClient:
```

**功能**: 
从导出的状态恢复客户端。

---

## 6. E2EE 协议流程

### 6.1 会话建立

```
发送方                    接收方
   |                        |
   | 1. e2ee_init --------->| 创建会话
   |                        |
   | 2. e2ee_ack <----------| 确认会话
   |                        |
   | [会话已激活]            |
```

### 6.2 消息加密

```
发送方                    接收方
   |                        |
   | 1. e2ee_msg ---------->| 解密消息
   | (chain_key 前进)        |
```

### 6.3 密钥更新

```
发送方                    接收方
   |                        |
   | 1. e2ee_rekey -------->| 更新会话
   |                        |
   | 2. e2ee_ack <----------| 确认更新
```

---

## 7. 调用关系

### 被谁调用
- `e2ee_messaging.py`: E2EE 消息处理
- `e2ee_outbox.py`: E2EE 发件箱
- `send_message.py`: 发送消息
- `ws_listener.py`: 处理接收的消息

### 调用谁
- `anp.e2e_encryption_hpke`: HPKE 会话管理
- `anp.authentication`: DID 文档解析
- `cryptography`: 密钥操作

---

## 8. 使用示例

### 8.1 创建 E2EE 客户端

```python
from utils.e2ee import E2eeClient

client = E2eeClient(
    local_did="did:wba:awiki.ai:user:k1_abc123",
    signing_pem=e2ee_signing_pem,
    x25519_pem=e2ee_agreement_pem,
)
```

### 8.2 发送加密消息

```python
# 确保会话活跃
outgoing = await client.ensure_active_session(peer_did)
for msg_type, content in outgoing:
    await send_message(peer_did, content, msg_type)

# 加密并发送
msg_type, content = client.encrypt_message(peer_did, "Hello!", "text")
await send_message(peer_did, content, msg_type)
```

### 8.3 接收和解密消息

```python
# 处理 E2EE 协议消息
outgoing = await client.process_e2ee_message(msg_type, content)
for msg_type, content in outgoing:
    await send_message(peer_did, content, msg_type)

# 解密加密消息
original_type, plaintext = client.decrypt_message(content)
```

### 8.4 状态持久化

```python
# 导出状态
state = client.export_state()
save_to_file(state)

# 恢复状态
client = E2eeClient.from_state(state)
```
