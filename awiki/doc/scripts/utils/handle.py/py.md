# scripts/utils/handle.py 分析

## 文件信息

- **路径**: `python/scripts/utils/handle.py`
- **用途**: Handle 注册和解析工具

## 常量

```python
HANDLE_RPC = "/user-service/handle/rpc"
DID_AUTH_RPC = "/user-service/did-auth/rpc"
DEFAULT_COUNTRY_CODE = "+86"
```

## 函数签名

### normalize_phone()

```python
def normalize_phone(phone: str) -> str:
    """规范化手机号到国际格式
    
    规则:
    - 已有国际格式 (+XX...) → 保持不变
    - 中国本地格式 (1XXXXXXXXXX) → 自动加 +86
    - 其他 → 抛出 ValueError
    
    返回:
        国际格式手机号 (如 +8613800138000)
    """
```

### _sanitize_otp()

```python
def _sanitize_otp(code: str) -> str:
    """去除 OTP 代码中的所有空白字符 (空格、换行、制表符)"""
```

### send_otp()

```python
async def send_otp(
    client: httpx.AsyncClient,
    phone: str,
) -> dict[str, Any]:
    """发送 OTP 验证码
    
    参数:
        client: HTTP 客户端
        phone: 国际格式手机号
    
    返回:
        RPC 结果 dict
    """
```

### register_handle()

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
    """一站式 Handle 注册
    
    流程:
    1. 创建密钥绑定 DID (handle 作为路径前缀)
    2. 注册 DID (带 Handle 参数)
    3. 获取 JWT token
    
    返回:
        DIDIdentity (包含 user_id 和 jwt_token)
    """
```

### recover_handle()

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
    """通过重新绑定到新 DID 来恢复 Handle
    
    返回:
        (DIDIdentity, 恢复结果 dict)
    """
```

### resolve_handle()

```python
async def resolve_handle(
    client: httpx.AsyncClient,
    handle: str,
) -> dict[str, Any]:
    """解析 Handle 到 DID 映射
    
    返回:
        查找结果 dict (包含 handle, did, status)
    """
```

### lookup_handle()

```python
async def lookup_handle(
    client: httpx.AsyncClient,
    did: str,
) -> dict[str, Any]:
    """通过 DID 查找 Handle
    
    返回:
        查找结果 dict
    """
```

## 导入的模块

```python
import re
from typing import Any
import httpx
from utils.config import SDKConfig
from utils.identity import DIDIdentity, create_identity
from utils.rpc import JsonRpcError, rpc_call
from utils.auth import get_jwt_via_wba
```

## 手机号格式验证

```python
# 国际格式：+{国家代码}{号码}
_PHONE_INTL_RE = re.compile(r"^\+\d{1,3}\d{6,14}$")

# 中国本地格式：11 位数字，1[3-9] 开头
_PHONE_CN_LOCAL_RE = re.compile(r"^1[3-9]\d{9}$")
```

## 规范化逻辑

```python
def normalize_phone(phone: str) -> str:
    phone = phone.strip()
    
    if phone.startswith("+"):
        # 已有国际格式
        if _PHONE_INTL_RE.fullmatch(phone):
            return phone
        raise ValueError(...)
    
    if _PHONE_CN_LOCAL_RE.fullmatch(phone):
        # 中国本地格式 → 自动加 +86
        return f"{DEFAULT_COUNTRY_CODE}{phone}"
    
    raise ValueError(...)
```

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出所有公共函数 |
| `utils/auth.py` | 间接使用 (通过 create_identity) |
| `scripts/register_handle.py` | `send_otp`, `register_handle`, `normalize_phone` |
| `scripts/recover_handle.py` | `recover_handle`, `normalize_phone` |
| `scripts/resolve_handle.py` | `resolve_handle`, `lookup_handle` |
| `tests/test_handle_recovery.py` | `recover_handle` |
| `tests/test_handle_utils.py` | `normalize_phone` |
| `tests/test_sanitize_otp.py` | `_sanitize_otp`, `register_handle`, `recover_handle` |

## Handle 注册流程

```
1. normalize_phone() → 规范化手机号
2. create_identity(path_prefix=[handle]) → 生成 DID
   DID 格式：did:wba:{domain}:{handle}:k1_<fingerprint>
3. rpc_call(register) → 注册到服务器
4. get_jwt_via_wba() → 获取 JWT token
5. 返回 DIDIdentity
```

## OTP 清理

```python
def _sanitize_otp(code: str) -> str:
    """去除所有空白字符"""
    return re.sub(r"\s+", "", code)

# 示例:
# "123 456" → "123456"
# "12\n34\t56" → "123456"
```
