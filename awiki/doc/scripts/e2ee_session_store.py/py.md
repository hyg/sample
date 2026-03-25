# e2ee_session_store.py 分析报告

## 1. 文件概述

**文件路径**: `python/scripts/e2ee_session_store.py`

**用途**: 提供基于 SQLite 的端到端加密 (E2EE) 会话状态存储。作为 E2EE 运行时代码与 awiki.db 之间的持久化桥梁，使用 SQLite 行和事务更新替代 JSON 文件会话存储。

**核心功能**:
- 从 SQLite 加载/保存 E2EE 客户端状态
- 支持从传统 JSON E2EE 状态迁移
- 提供事务包装器用于状态变更

**常量**:
| 常量名 | 值 | 说明 |
|--------|-----|------|
| `_STATE_VERSION` | `"hpke_v1"` | E2EE 状态版本号 |

---

## 2. 导入的模块

### 标准库
```python
from __future__ import annotations
import sqlite3
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
```

### 项目内部模块
| 模块 | 导入内容 | 用途 |
|------|----------|------|
| `credential_store` | `load_identity` | 加载凭证身份密钥 |
| `e2ee_store` | `delete_e2ee_state`, `load_e2ee_state` | 传统 E2EE 状态存储操作 |
| `utils` | `E2eeClient` | E2EE 客户端类 |
| `local_store` | (整个模块) | SQLite 连接和 schema 管理 |

---

## 3. 函数签名

### 3.1 `_utc_now_iso() -> str`
**用途**: 返回当前 UTC 时间的 ISO 8601 格式字符串

**参数**: 无

**返回值**: `str` - ISO 格式的时间戳

---

### 3.2 `_load_key_material(credential_name: str) -> tuple[str | None, str | None]`
**用途**: 加载凭证的 E2EE 私钥

**参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| `credential_name` | `str` | 凭证名称 |

**返回值**: `tuple[str | None, str | None]` - (签名私钥 PEM, 密钥协商私钥 PEM)

---

### 3.3 `_rows_to_state(...) -> dict[str, Any]`
**用途**: 从 SQLite 行构建 `E2eeClient.from_state` 载荷

**参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| `rows` | `list[sqlite3.Row]` | SQLite 行列表 |
| `local_did` | `str` | 本地 DID |
| `signing_pem` | `str | None` | 签名 PEM 密钥 |
| `x25519_pem` | `str | None` | X25519 PEM 密钥 |

**返回值**: `dict[str, Any]` - E2EE 状态字典，包含:
- `version`: 状态版本
- `local_did`: 本地 DID
- `signing_pem`: 签名 PEM
- `x25519_pem`: X25519 PEM
- `confirmed_session_ids`: 已确认的会话 ID 列表
- `sessions`: 会话列表

---

### 3.4 `_load_rows_locked(conn, *, local_did: str) -> list[sqlite3.Row]`
**用途**: 加载单个所有者的所有持久化 E2EE 会话

**参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| `conn` | `sqlite3.Connection` | SQLite 连接 |
| `local_did` | `str` | 本地 DID (关键字参数) |

**返回值**: `list[sqlite3.Row]` - 会话行列表

**SQL 查询字段**:
- `owner_did`, `peer_did`, `session_id`
- `is_initiator`, `send_chain_key`, `recv_chain_key`
- `send_seq`, `recv_seq`, `expires_at`
- `created_at`, `active_at`, `peer_confirmed`
- `credential_name`, `updated_at`

---

### 3.5 `_save_rows_locked(...)`
**用途**: 将当前 E2EE 客户端状态持久化到 SQLite 行

**参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| `conn` | `sqlite3.Connection` | SQLite 连接 |
| `local_did` | `str` | 本地 DID |
| `credential_name` | `str` | 凭证名称 |
| `client` | `E2eeClient` | E2EE 客户端 |
| `loaded_peer_dids` | `set[str]` | 已加载的对等 DID 集合 |

**返回值**: `None`

**操作**:
1. 导出客户端状态
2. 删除不再存在的对等会话
3. 使用 `INSERT ... ON CONFLICT DO UPDATE` 更新/插入会话

---

### 3.6 `_migrate_legacy_json_locked(...) -> list[sqlite3.Row]`
**用途**: 首次访问时将传统 JSON E2EE 状态导入 SQLite

**参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| `conn` | `sqlite3.Connection` | SQLite 连接 |
| `local_did` | `str` | 本地 DID |
| `credential_name` | `str` | 凭证名称 |
| `signing_pem` | `str | None` | 签名 PEM |
| `x25519_pem` | `str | None` | X25519 PEM |

**返回值**: `list[sqlite3.Row]` - 迁移后的会话行

---

### 3.7 `_load_client_locked(...) -> tuple[E2eeClient, set[str]]`
**用途**: 在 SQLite 事务内加载磁盘优先的 E2EE 客户端

**参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| `conn` | `sqlite3.Connection` | SQLite 连接 |
| `local_did` | `str` | 本地 DID |
| `credential_name` | `str` | 凭证名称 |

**返回值**: `tuple[E2eeClient, set[str]]` - (E2EE 客户端，已加载的对等 DID 集合)

---

### 3.8 `load_e2ee_client(local_did: str, credential_name: str = "default") -> E2eeClient`
**用途**: 从 SQLite 加载最新 E2EE 状态（如需要则迁移传统 JSON）

**参数**:
| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `local_did` | `str` | - | 本地 DID |
| `credential_name` | `str` | `"default"` | 凭证名称 |

**返回值**: `E2eeClient` - 加载的 E2EE 客户端

---

### 3.9 `save_e2ee_client(client: E2eeClient, credential_name: str = "default") -> None`
**用途**: 将 E2EE 客户端持久化到 SQLite

**参数**:
| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `client` | `E2eeClient` | - | E2EE 客户端 |
| `credential_name` | `str` | `"default"` | 凭证名称 |

**返回值**: `None`

---

## 4. 类定义

### 4.1 `E2eeStateTransaction`

**装饰器**: `@dataclass`

**继承**: `AbstractContextManager["E2eeStateTransaction"]`

**用途**: 针对单个 E2EE 客户端变更的 SQLite 事务包装器

#### 属性
| 属性名 | 类型 | 说明 |
|--------|------|------|
| `local_did` | `str` | 本地 DID |
| `credential_name` | `str` | 凭证名称 (默认: `"default"`) |
| `_conn` | `sqlite3.Connection` | SQLite 连接 (内部) |
| `client` | `E2eeClient` | E2EE 客户端 (内部) |
| `_loaded_peer_dids` | `set[str]` | 已加载的对等 DID (内部) |
| `_closed` | `bool` | 是否已关闭 (内部) |

#### 方法

##### `__post_init__(self) -> None`
初始化事务：
1. 获取 `local_store` 连接
2. 确保 schema 存在
3. 开始 `BEGIN IMMEDIATE` 事务
4. 加载客户端和对等 DID

---

##### `commit(self) -> None`
**用途**: 将内存中的客户端持久化到 SQLite 并提交

**操作**:
1. 调用 `_save_rows_locked` 保存状态
2. 提交事务
3. 标记为已关闭

---

##### `commit_without_saving(self) -> None`
**用途**: 提交只读事务（仅用于迁移副作用）

**操作**:
1. 直接提交事务
2. 标记为已关闭

---

##### `rollback(self) -> None`
**用途**: 回滚任何待处理的 SQLite 变更

---

##### `close(self) -> None`
**用途**: 关闭底层 SQLite 连接

**逻辑**: 如果未关闭则先回滚，然后关闭连接

---

##### `__exit__(self, exc_type, exc, tb) -> None`
**用途**: 上下文管理器退出处理

**逻辑**: 调用 `close()`，返回 `None`

---

## 5. 调用关系

### 5.1 内部调用链

```
load_e2ee_client()
  └─> E2eeStateTransaction.__post_init__()
        └─> _load_client_locked()
              ├─> _load_key_material()
              │     └─> load_identity() [外部]
              ├─> _migrate_legacy_json_locked()
              │     ├─> _load_rows_locked()
              │     ├─> load_e2ee_state() [外部]
              │     ├─> E2eeClient.from_state() [外部]
              │     ├─> _save_rows_locked()
              │     └─> delete_e2ee_state() [外部]
              └─> _rows_to_state()
  └─> tx.commit_without_saving()
  └─> tx.close()

save_e2ee_client()
  └─> E2eeStateTransaction.__post_init__()
  └─> tx.commit()
        └─> _save_rows_locked()
              └─> E2eeClient.export_state() [外部]
              └─> _utc_now_iso()
  └─> tx.close()
```

### 5.2 被调用关系

| 函数/类 | 被谁调用 |
|---------|----------|
| `_utc_now_iso()` | `_save_rows_locked()` |
| `_load_key_material()` | `_load_client_locked()` |
| `_rows_to_state()` | `_load_client_locked()` |
| `_load_rows_locked()` | `_migrate_legacy_json_locked()`, 自身 |
| `_save_rows_locked()` | `_migrate_legacy_json_locked()`, `E2eeStateTransaction.commit()` |
| `_migrate_legacy_json_locked()` | `_load_client_locked()` |
| `_load_client_locked()` | `E2eeStateTransaction.__post_init__()` |
| `E2eeStateTransaction` | `load_e2ee_client()`, `save_e2ee_client()` |

---

## 6. 依赖关系图

### 6.1 外部依赖

```
e2ee_session_store.py
│
├── 标准库
│   ├── sqlite3
│   ├── contextlib.AbstractContextManager
│   ├── dataclasses.dataclass
│   ├── datetime.datetime, datetime.timezone
│   └── typing.Any
│
├── 项目模块
│   ├── credential_store.load_identity
│   ├── e2ee_store.delete_e2ee_state, load_e2ee_state
│   ├── utils.E2eeClient
│   └── local_store (get_connection, ensure_schema)
│
└── 导出接口
    ├── E2eeStateTransaction
    ├── load_e2ee_client
    └── save_e2ee_client
```

### 6.2 数据库依赖

**表**: `e2ee_sessions`

**字段**:
| 字段名 | 用途 |
|--------|------|
| `owner_did` | 所有者 DID (主键部分) |
| `peer_did` | 对等 DID (主键部分) |
| `session_id` | 会话 ID |
| `is_initiator` | 是否发起者 |
| `send_chain_key` | 发送链密钥 |
| `recv_chain_key` | 接收链密钥 |
| `send_seq` | 发送序列号 |
| `recv_seq` | 接收序列号 |
| `expires_at` | 过期时间 |
| `created_at` | 创建时间 |
| `active_at` | 活跃时间 |
| `peer_confirmed` | 对等确认标志 |
| `credential_name` | 凭证名称 |
| `updated_at` | 更新时间 |

**约束**: `UNIQUE(owner_did, peer_did)`

---

## 7. 总结

### 7.1 核心职责

1. **状态持久化**: 将 E2EE 会话状态存储到 SQLite 而非 JSON 文件
2. **迁移支持**: 自动从传统 JSON 格式迁移到 SQLite
3. **事务安全**: 使用 SQLite 事务确保状态变更的原子性
4. **凭证集成**: 从 `credential_store` 加载身份密钥

### 7.2 设计模式

- **上下文管理器**: `E2eeStateTransaction` 实现资源自动清理
- **数据类**: 使用 `@dataclass` 简化类定义
- **锁定命名约定**: `_locked` 后缀函数表示需要在事务内调用

### 7.3 导出 API

```python
__all__ = [
    "E2eeStateTransaction",
    "load_e2ee_client",
    "save_e2ee_client",
]
```

---

**文档生成日期**: 2026-03-25  
**分析工具**: Qwen Code Agent
