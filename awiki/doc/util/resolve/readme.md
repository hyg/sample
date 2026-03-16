# resolve.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/resolve.py`

**主要功能**: 
- Handle 到 DID 的解析
- 支持 `.well-known/handle` 端点
- 自动识别 DID 和 Handle

**依赖关系**:
- `httpx`: HTTP 客户端
- 本地模块：`client`, `config`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `httpx` | 异步 HTTP 客户端 |
| `utils.client._resolve_verify` | SSL 验证配置 |
| `utils.config.SDKConfig` | SDK 配置 |

---

## 3. 函数详解

### 3.1 `resolve_to_did`

**签名**:
```python
async def resolve_to_did(
    identifier: str,
    config: SDKConfig | None = None,
) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `identifier` | `str` | - | DID 或 Handle |
| `config` | `SDKConfig` | `None` | SDK 配置 |

**返回值**: `str` - 解析后的 DID

**异常**:
- `ValueError`: Handle 未找到或未激活

**功能**: 
解析 DID 或 Handle 为 DID。

**规则**:
1. 如果以 `did:` 开头 -> 直接返回
2. 否则作为 Handle 处理：
   - 移除已知的 awiki 域名后缀
   - 调用 `GET /user-service/.well-known/handle/{local_part}`

**端点**:
```
GET {user_service_url}/user-service/.well-known/handle/{handle}
```

**响应格式**:
```json
{
  "handle": "alice",
  "did": "did:wba:awiki.ai:user:k1_abc123",
  "status": "active"
}
```

**调用位置**: 
- `send_message.py`
- `get_profile.py`
- `manage_relationship.py`

---

## 4. Handle 解析流程

```
1. 检查是否为 DID（以 "did:" 开头）
   ↓ (不是 DID)
2. 移除域名后缀（如 "alice.awiki.ai" -> "alice"）
   ↓
3. 发送 GET 请求到 .well-known/handle 端点
   ↓
4. 检查状态码
   ├─ 404: 抛出 "Handle not found"
   └─ 其他错误：抛出 HTTP 错误
   ↓
5. 检查 status 字段
   ├─ 不是 "active": 抛出 "Handle not active"
   └─ 是 "active": 返回 did 字段
```

---

## 5. 支持的域名后缀

| 域名 | 描述 |
|------|------|
| `awiki.ai` | 生产环境 |
| `awiki.test` | 本地开发环境 |
| `config.did_domain` | 配置中指定的域名 |

**示例**:
```python
# 以下输入都会解析为 "alice"
"alice"
"alice.awiki.ai"
"alice.awiki.test"
```

---

## 6. 调用关系

### 被谁调用
- `send_message.py`: 解析接收方标识符
- `get_profile.py`: 解析用户标识符
- `manage_relationship.py`: 解析目标用户
- `manage_group.py`: 解析群组成员

### 调用谁
- `httpx`: HTTP 请求
- `utils.config`: 获取服务 URL
- `utils.client`: SSL 验证配置

---

## 7. 使用示例

### 7.1 解析 Handle

```python
from utils.resolve import resolve_to_did

did = await resolve_to_did("alice")
print(f"@alice -> {did}")
```

### 7.2 解析完整 Handle

```python
did = await resolve_to_did("alice.awiki.ai")
print(f"alice.awiki.ai -> {did}")
```

### 7.3 DID 直接返回

```python
did = await resolve_to_did("did:wba:awiki.ai:user:k1_abc123")
# 直接返回，不发送请求
```

### 7.4 错误处理

```python
from utils.resolve import resolve_to_did

try:
    did = await resolve_to_did("nonexistent")
except ValueError as e:
    print(f"Resolution failed: {e}")
    # Handle 'nonexistent' not found
    # 或
    # Handle 'nonexistent' is not active (status: suspended)
```

---

## 8. 与其他解析方式对比

| 方法 | 端点 | 用途 |
|------|------|------|
| `resolve_to_did()` | `.well-known/handle` | Handle -> DID |
| `resolve_handle()` | `/user-service/handle/rpc` | Handle -> DID (RPC) |
| `lookup_handle()` | `/user-service/handle/rpc` | DID -> Handle (RPC) |

**推荐使用**: `resolve_to_did()` 用于简单的 Handle 解析，因为它使用标准的 REST 端点。

---

## 9. HTTP 请求详情

**请求**:
```http
GET /user-service/.well-known/handle/alice HTTP/1.1
Host: awiki.ai
Accept: application/json
```

**成功响应 (200)**:
```json
{
  "handle": "alice",
  "did": "did:wba:awiki.ai:user:k1_abc123",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**未找到 (404)**:
```json
{
  "error": "Handle not found"
}
```

**未激活 (200)**:
```json
{
  "handle": "bob",
  "did": "did:wba:...",
  "status": "suspended"
}
```

---

## 10. 完整使用示例

```python
import asyncio
from utils.config import SDKConfig
from utils.resolve import resolve_to_did

async def main():
    config = SDKConfig()
    
    # 解析 Handle
    identifiers = ["alice", "bob.awiki.ai", "did:wba:..."]
    
    for ident in identifiers:
        try:
            did = await resolve_to_did(ident, config)
            print(f"{ident} -> {did}")
        except ValueError as e:
            print(f"{ident}: {e}")

asyncio.run(main())
```
