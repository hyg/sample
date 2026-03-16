# handle.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/handle.py`

**主要功能**: 
- Handle（短名称）注册和解析
- OTP 验证码发送
- Handle 恢复
- 电话号码格式化

**依赖关系**:
- `httpx`: HTTP 客户端
- `re`: 正则表达式（电话号码验证）
- 本地模块：`config`, `identity`, `rpc`, `auth`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `httpx` | 异步 HTTP 客户端 |
| `re` | 正则表达式 |
| `utils.config.SDKConfig` | SDK 配置 |
| `utils.identity.DIDIdentity, create_identity` | DID 身份创建 |
| `utils.rpc.JsonRpcError, rpc_call` | JSON-RPC 调用 |
| `utils.auth.get_jwt_via_wba` | JWT 获取 |

---

## 3. 常量

| 常量 | 值 | 描述 |
|------|-----|------|
| `HANDLE_RPC` | `"/user-service/handle/rpc"` | Handle RPC 端点 |
| `DID_AUTH_RPC` | `"/user-service/did-auth/rpc"` | DID 认证端点 |
| `DEFAULT_COUNTRY_CODE` | `"+86"` | 默认国家代码（中国） |

---

## 4. 函数详解

### 4.1 `_sanitize_otp`

**签名**:
```python
def _sanitize_otp(code: str) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `code` | `str` | - | OTP 验证码 |

**返回值**: `str` - 清理后的验证码

**功能**: 
移除 OTP 验证码中的所有空白字符（空格、换行、制表符）。

**示例**:
```python
_sanitize_otp("123 456")  # -> "123456"
_sanitize_otp("12\n34\t56")  # -> "123456"
```

---

### 4.2 `normalize_phone`

**签名**:
```python
def normalize_phone(phone: str) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `phone` | `str` | - | 电话号码 |

**返回值**: `str` - 国际格式的电话号码

**异常**: `ValueError` - 无效的电话号码格式

**功能**: 
标准化电话号码为国际格式。

**规则**:
1. 已是国际格式（+XX...）-> 验证后返回
2. 中国本地格式（1XXXXXXXXXX）-> 自动添加 +86
3. 其他格式 -> 抛出异常

**示例**:
```python
normalize_phone("+8613800138000")  # -> "+8613800138000"
normalize_phone("13800138000")     # -> "+8613800138000"
normalize_phone("+14155552671")    # -> "+14155552671"
```

**调用位置**: 
- `send_otp()`
- `register_handle()`
- `recover_handle()`

---

### 4.3 `send_otp`

**签名**:
```python
async def send_otp(
    client: httpx.AsyncClient,
    phone: str,
) -> dict[str, Any]:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `phone` | `str` | - | 电话号码 |

**返回值**: `dict[str, Any]` - RPC 结果

**异常**:
- `ValueError`: 无效的电话号码
- `JsonRpcError`: 发送失败

**功能**: 
发送 OTP 验证码用于 Handle 注册。

**调用位置**: `register_handle.py`

**使用示例**:
```python
from utils.handle import send_otp

result = await send_otp(client, "13800138000")
print("OTP sent, please check your phone")
```

---

### 4.4 `register_handle`

**签名**:
```python
async def register_handle(
    client: httpx.AsyncClient,
    config: SDKConfig,
    phone: str,
    otp_code: str,
    handle: str,
    invite_code: str | None = None,
    name: str | None = None,
    is_public: bool = False,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `config` | `SDKConfig` | - | SDK 配置 |
| `phone` | `str` | - | 电话号码 |
| `otp_code` | `str` | - | OTP 验证码 |
| `handle` | `str` | - | Handle 名称 |
| `invite_code` | `str` | `None` | 邀请码（短 Handle 必需） |
| `name` | `str` | `None` | 显示名称 |
| `is_public` | `bool` | `False` | 是否公开 |
| `services` | `list` | `None` | 自定义服务 |

**返回值**: `DIDIdentity` - 包含 `user_id` 和 `jwt_token`

**异常**:
- `ValueError`: 无效的电话号码
- `JsonRpcError`: 注册失败

**功能**: 
一站式 Handle 注册：
1. 创建带 Handle 前缀的 DID
2. 注册 DID 并绑定 Handle
3. 获取 JWT

**DID 格式**:
```
did:wba:awiki.ai:<handle>:k1_<fingerprint>
```

**调用位置**: `register_handle.py`

**使用示例**:
```python
from utils.handle import register_handle

identity = await register_handle(
    client,
    config,
    phone="13800138000",
    otp_code="123456",
    handle="alice",
    name="Alice"
)
print(f"DID: {identity.did}")
print(f"Handle: @{identity.unique_id}")
```

---

### 4.5 `recover_handle`

**签名**:
```python
async def recover_handle(
    client: httpx.AsyncClient,
    config: SDKConfig,
    phone: str,
    otp_code: str,
    handle: str,
    *,
    services: list[dict[str, Any]] | None = None,
) -> tuple[DIDIdentity, dict[str, Any]]:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `config` | `SDKConfig` | - | SDK 配置 |
| `phone` | `str` | - | 电话号码 |
| `otp_code` | `str` | - | OTP 验证码 |
| `handle` | `str` | - | Handle 名称 |
| `services` | `list` | `None` | 自定义服务 |

**返回值**: `(DIDIdentity, recover_result)` - 身份对象和恢复结果

**功能**: 
通过将 Handle 重新绑定到新生成的 DID 来恢复 Handle。

**调用位置**: `recover_handle.py`

---

### 4.6 `resolve_handle`

**签名**:
```python
async def resolve_handle(
    client: httpx.AsyncClient,
    handle: str,
) -> dict[str, Any]:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `handle` | `str` | - | Handle 名称 |

**返回值**: `dict[str, Any]` - 包含 `handle`, `did`, `status`

**异常**: `JsonRpcError` - 解析失败（Handle 不存在）

**功能**: 
解析 Handle 为 DID 映射。

**调用位置**: `resolve_handle.py`

---

### 4.7 `lookup_handle`

**签名**:
```python
async def lookup_handle(
    client: httpx.AsyncClient,
    did: str,
) -> dict[str, Any]:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `did` | `str` | - | DID 标识符 |

**返回值**: `dict[str, Any]` - 包含 `handle`, `did`, `status`

**异常**: `JsonRpcError` - 查找失败（DID 未绑定 Handle）

**功能**: 
通过 DID 查找 Handle。

---

## 5. 调用关系

### 被谁调用
- `register_handle.py`: Handle 注册
- `recover_handle.py`: Handle 恢复
- `resolve_handle.py`: Handle 解析

### 调用谁
- `utils.identity`: 创建 DID 身份
- `utils.rpc`: JSON-RPC 调用
- `utils.auth`: JWT 获取
- `utils.config`: 获取配置

---

## 6. 使用示例

### 6.1 完整的 Handle 注册流程

```python
from utils.handle import send_otp, register_handle

# 步骤 1: 发送 OTP
await send_otp(client, "13800138000")
print("Please enter the OTP code from your phone")

# 步骤 2: 输入 OTP 并完成注册
otp = input("OTP: ")
identity = await register_handle(
    client,
    config,
    phone="13800138000",
    otp_code=otp,
    handle="alice",
    name="Alice"
)

print(f"Registered! DID: {identity.did}")
```

### 6.2 解析 Handle

```python
from utils.handle import resolve_handle

result = await resolve_handle(client, "alice")
print(f"@alice -> {result['did']}")
```

### 6.3 通过 DID 查找 Handle

```python
from utils.handle import lookup_handle

result = await lookup_handle(client, "did:wba:awiki.ai:user:k1_abc123")
print(f"DID -> @{result['handle']}")
```

---

## 7. 电话号码格式

### 7.1 国际格式

```
+{country_code}{number}
```

示例:
- 中国：`+8613800138000`
- 美国：`+14155552671`

### 7.2 中国本地格式

```
1[3-9]\d{9}
```

示例：`13800138000`（自动转换为 `+8613800138000`）

---

## 8. 错误处理

```python
from utils.handle import register_handle, normalize_phone
from utils.rpc import JsonRpcError

try:
    identity = await register_handle(...)
except ValueError as e:
    print(f"Invalid phone number: {e}")
except JsonRpcError as e:
    if "OTP" in e.message:
        print("Invalid OTP code")
    elif "handle" in e.message:
        print("Handle already taken")
    else:
        print(f"Registration failed: {e.message}")
```
