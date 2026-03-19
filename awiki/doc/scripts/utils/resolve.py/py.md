# `scripts/utils/resolve.py` 分析文档

**文件路径**: `D:\huangyg\git\sample\awiki\python\scripts\utils\resolve.py`  
**分析日期**: 2026-03-19

---

## 1. 文件概述

此文件提供 Handle 到 DID 的解析功能，通过 `.well-known/handle` 端点实现标识符解析。

**核心职责**：
- 将 Handle（如 "alice" 或 "alice.awiki.ai"）解析为 DID
- 支持 DID 字符串的直接返回（如果输入已经是 DID）
- 通过标准 HTTP 端点查询 Handle 绑定信息

**输入/输出/定位**：
- **[INPUT]**: `SDKConfig`（配置服务 URL）、`httpx`（HTTP 客户端）
- **[OUTPUT]**: `resolve_to_did()` 函数
- **[POS]**: 标识符解析工具，通过标准端点将 Handle 转换为 DID

**协议**：
1. 逻辑变更时更新文件头部注释
2. 更新后检查文件夹的 `CLAUDE.md`

---

## 2. 函数签名

### `resolve_to_did`

```python
async def resolve_to_did(
    identifier: str,
    config: SDKConfig | None = None,
) -> str:
```

**参数**：

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|--------|------|------|--------|------|
| `identifier` | `str` | 是 | - | DID 字符串或 Handle 本地部分（如 "alice"） |
| `config` | `SDKConfig \| None` | 否 | `None` | SDK 配置，用于获取服务 URL。为 `None` 时使用默认配置 |

**返回值**：

| 类型 | 描述 |
|------|------|
| `str` | 解析后的 DID 字符串 |

**异常**：

| 异常类型 | 触发条件 |
|----------|----------|
| `ValueError` | Handle 未找到（404） |
| `ValueError` | Handle 状态不是 "active" |
| `ValueError` | Handle 没有绑定 DID |
| `httpx.HTTPStatusError` | HTTP 请求失败（非 404） |

**处理逻辑**：

1. **DID 直返**：如果 `identifier` 以 `"did:"` 开头，直接返回
2. **域名剥离**：如果 Handle 包含已知域名后缀（如 `.awiki.ai`、`.awiki.test` 或配置的 `did_domain`），则剥离
3. **HTTP 查询**：调用 `GET /user-service/.well-known/handle/{identifier}`
4. **状态验证**：检查返回的 Handle 状态是否为 `"active"`
5. **DID 提取**：从响应中提取 `did` 字段并返回

---

## 3. 导入的模块

| 模块 | 导入内容 | 用途 |
|------|----------|------|
| `__future__` | `annotations` | 启用 PEP 563 延迟求值注解 |
| `httpx` | （整个模块） | 异步 HTTP 客户端 |
| `utils.client` | `_resolve_verify` | 解析 TLS 验证设置 |
| `utils.config` | `SDKConfig` | SDK 配置数据类 |

---

## 4. 调用其他文件的接口

### 4.1 直接调用

```
utils/resolve.py
├── utils/client.py
│   └── _resolve_verify(base_url: str) → bool | ssl.SSLContext
│       用途：为 HTTP 客户端配置 TLS 验证
│
└── utils/config.py
    └── SDKConfig
        ├── user_service_url: str
        │   用途：构建请求 URL
        └── did_domain: str
            用途：识别并剥离 Handle 中的域名后缀
```

### 4.2 外部服务调用

```
┌─────────────────────────────────────────────────────────────┐
│                    utils/resolve.py                         │
│                                                             │
│  resolve_to_did()                                           │
│       │                                                     │
│       │ GET /user-service/.well-known/handle/{identifier}   │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              远程 HTTP 服务                            │   │
│  │  {user_service_url}/user-service/.well-known/handle │   │
│  │                                                      │   │
│  │  响应格式：                                          │   │
│  │  {                                                   │   │
│  │    "status": "active",                              │   │
│  │    "did": "did:wba:awiki.ai:user:k1_..."            │   │
│  │  }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 被哪些文件调用

通过搜索项目中的引用，以下文件调用了 `resolve_to_did` 函数：

### 5.1 脚本文件

| 文件 | 调用方式 | 使用场景 |
|------|----------|----------|
| `scripts/check_inbox.py` | `asyncio.run(resolve_to_did(args.history))` | 解析历史消息的发送者 |
| `scripts/e2ee_messaging.py` | `asyncio.run(resolve_to_did(...))` | 解析握手、发送、对等方的 DID |
| `scripts/manage_relationship.py` | `asyncio.run(resolve_to_did(args.follow/unfollow/status))` | 解析关注/取消关注/状态查询的目标 |
| `scripts/send_message.py` | `await resolve_to_did(receiver, config)` | 解析消息接收者的 DID |
| `scripts/utils/__init__.py` | `from utils.resolve import resolve_to_did` | 导出为公共 API |

### 5.2 调用示例

**send_message.py**:
```python
from utils import SDKConfig, create_molt_message_client, authenticated_rpc_call, resolve_to_did

async def send_message(...):
    receiver_did = await resolve_to_did(receiver, config)
    # 使用 receiver_did 发送消息
```

**manage_relationship.py**:
```python
from utils import SDKConfig, create_user_service_client, authenticated_rpc_call, resolve_to_did

# 关注用户
target_did = asyncio.run(resolve_to_did(args.follow))

# 取消关注
target_did = asyncio.run(resolve_to_did(args.unfollow))
```

**e2ee_messaging.py**:
```python
from utils import SDKConfig, E2eeClient, create_molt_message_client, authenticated_rpc_call, resolve_to_did

# 握手
peer_did = asyncio.run(resolve_to_did(args.handshake))

# 发送消息
peer_did = asyncio.run(resolve_to_did(args.send))
```

---

## 6. 依赖关系图

### 6.1 模块依赖结构

```
┌─────────────────────────────────────────────────────────────────┐
│                     scripts/utils/resolve.py                     │
│                                                                  │
│  async def resolve_to_did(identifier: str, config: SDKConfig)   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│              ▼               ▼               ▼                  │
│       ┌──────────┐    ┌──────────┐    ┌──────────────┐         │
│       │  httpx   │    │  utils/  │    │   utils/     │         │
│       │ (外部库) │    │ client.py│    │  config.py   │         │
│       │          │    │          │    │              │         │
│       │ AsyncClient│   │_resolve_ │    │  SDKConfig   │         │
│       └──────────┘    │  verify()│    │              │         │
│                       └──────────┘    └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP GET
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    远程服务 (user-service)                       │
│  GET /user-service/.well-known/handle/{identifier}              │
│                                                                  │
│  响应：{ "status": "active", "did": "did:wba:..." }             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 调用者依赖

```
┌─────────────────────────────────────────────────────────────────┐
│                        脚本层 (调用者)                           │
├─────────────────────────────────────────────────────────────────┤
│  send_message.py                                                │
│  manage_relationship.py                                         │
│  check_inbox.py                                                 │
│  e2ee_messaging.py                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ from utils import resolve_to_did
                              │ 或
                              │ from utils.resolve import resolve_to_did
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   utils/resolve.py                              │
│                                                                 │
│  resolve_to_did()                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ from utils.client import _resolve_verify
                              │ from utils.config import SDKConfig
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   依赖模块层                                     │
│  ┌──────────────┐              ┌──────────────┐                │
│  │ utils/client │              │ utils/config │                │
│  │ .py          │              │ .py          │                │
│  │              │              │              │                │
│  │ _resolve_    │              │ SDKConfig    │                │
│  │ verify()     │              │              │                │
│  └──────────────┘              └──────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ import httpx
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     外部库层                                     │
│  ┌──────────────┐                                               │
│  │    httpx     │                                               │
│  │  (AsyncClient)│                                              │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 依赖层级

| 层级 | 模块 | 描述 |
|------|------|------|
| L1 | `scripts/*.py` | 业务脚本层，调用 `resolve_to_did` |
| L2 | `utils/resolve.py` | 解析工具层，实现 Handle→DID 转换 |
| L3 | `utils/client.py`, `utils/config.py` | 基础工具层，提供 HTTP 客户端和配置 |
| L4 | `httpx` | 外部 HTTP 库 |
| L5 | 远程 HTTP 服务 | `user-service/.well-known/handle` 端点 |

---

## 7. 代码流程分析

### 7.1 执行流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    resolve_to_did() 入口                         │
│              参数：identifier, config (可选)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ identifier 以 "did:"   │
                  │ 开头？                 │
                  └───────────┬───────────┘
                         是   │   否
                    ┌────────┘   └────────┐
                    │                     │
                    ▼                     ▼
          ┌─────────────────┐   ┌───────────────────────┐
          │ 直接返回        │   │ 配置处理：            │
          │ identifier      │   │ - 使用默认或传入 config│
          └─────────────────┘   │ - 构建域名剥离列表    │
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ 域名后缀匹配与剥离     │
                                │ (awiki.ai, awiki.test)│
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ 构建请求 URL:          │
                                │ {user_service_url}/    │
                                │ user-service/.well-    │
                                │ known/handle/{id}      │
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ HTTP GET 请求          │
                                │ (httpx.AsyncClient)    │
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ 状态码 == 404?        │
                                └───────────┬───────────┘
                                      是    │    否
                            ┌───────────────┘    │
                            │                    │
                            ▼                    ▼
                  ┌─────────────────┐   ┌───────────────────┐
                  │ 抛出 ValueError │   │ resp.raise_for_   │
                  │ "Handle not     │   │ status() 检查     │
                  │ found"          │   └─────────┬─────────┘
                  └─────────────────┘             │
                                                  ▼
                                      ┌───────────────────────┐
                                      │ 解析 JSON 响应          │
                                      │ data = resp.json()    │
                                      └───────────┬───────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │ status != "active"?   │
                                      └───────────┬───────────┘
                                            是    │    否
                                  ┌───────────────┘    │
                                  │                    │
                                  ▼                    ▼
                        ┌─────────────────┐   ┌───────────────────┐
                        │ 抛出 ValueError │   │ did = data.get    │
                        │ "Handle not     │   │ ("did", "")       │
                        │ active"         │   └─────────┬─────────┘
                        └─────────────────┘             │
                                                        ▼
                                              ┌───────────────────────┐
                                              │ did 为空？            │
                                              └───────────┬───────────┘
                                                    是    │    否
                                          ┌───────────────┘    │
                                          │                    │
                                          ▼                    ▼
                                ┌─────────────────┐   ┌───────────────────┐
                                │ 抛出 ValueError │   │ 返回 did          │
                                │ "Handle has no  │   │ (成功)            │
                                │ DID binding"    │   └───────────────────┘
                                └─────────────────┘
```

### 7.2 错误处理

| 错误场景 | 异常类型 | 错误消息 |
|----------|----------|----------|
| Handle 不存在 | `ValueError` | `Handle '{identifier}' not found` |
| Handle 未激活 | `ValueError` | `Handle '{identifier}' is not active (status: {status})` |
| Handle 无 DID 绑定 | `ValueError` | `Handle '{identifier}' has no DID binding` |
| HTTP 请求失败 | `httpx.HTTPStatusError` | （由 `raise_for_status()` 抛出） |

---

## 8. 总结

`scripts/utils/resolve.py` 是一个专注的标识符解析工具，具有以下特点：

1. **单一职责**：仅负责将 Handle 解析为 DID，逻辑清晰
2. **智能处理**：
   - 支持 DID 直返（避免重复解析）
   - 自动剥离已知域名后缀（如 `alice.awiki.ai` → `alice`）
3. **严格验证**：
   - 检查 Handle 存在性（404）
   - 验证 Handle 状态（必须为 "active"）
   - 确保 DID 绑定存在
4. **异步设计**：使用 `async/await` 和 `httpx.AsyncClient`，适合高并发场景
5. **配置灵活**：支持传入自定义 `SDKConfig`，也支持使用默认配置

此文件是 awiki SDK 中标识符解析的核心组件，被多个脚本用于将用户友好的 Handle 转换为系统内部的 DID 标识符。
