# e2ee_handler.py 分析报告

## 文件概述
WebSocket 监听器的透明 E2EE 处理器。拦截 E2EE 消息并在 classify_message 之前处理，发送 e2ee_error 通知。

## 类定义

### `E2eeHandler`
E2EE 处理器，用于 WebSocket 监听器。

#### 属性
- `_credential_name`: 凭证名称
- `_save_interval`: 状态保存间隔（秒）
- `_decrypt_fail_action`: 解密失败动作
- `_client`: E2eeClient 实例
- `_lock`: asyncio 锁
- `_dirty`: 状态是否已修改
- `_last_save_time`: 上次保存时间

#### 方法

##### `__init__(credential_name: str, save_interval: float = 30.0, decrypt_fail_action: str = "drop") -> None`
初始化 E2EE 处理器。

##### `async initialize(local_did: str) -> bool`
初始化：从凭证加载 E2EE 密钥 + 从磁盘恢复会话状态。

##### `is_ready: bool` (属性)
E2EE 客户端是否已准备好。

##### `is_e2ee_type(msg_type: str) -> bool`
检查消息类型是否属于 E2EE 类别。

##### `is_protocol_type(msg_type: str) -> bool`
检查消息类型是否是 E2EE 协议消息（内部处理，不转发）。

##### `async handle_protocol_message(params: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]`
处理 E2EE 协议消息（init/rekey/error）。

##### `async decrypt_message(params: dict[str, Any]) -> DecryptResult`
解密 e2ee_msg 消息。

##### `async maybe_save_state() -> None`
定期保存：当 dirty 且 save_interval 已过时写入磁盘。

##### `async force_save_state() -> None`
强制保存：在关闭和断开连接期间使用。

##### `async _do_save() -> None`
执行状态保存。

##### `_classify_error(exc: BaseException) -> tuple[str, str]` (静态方法)
将解密异常映射为 E2EE 错误代码和重试提示。

##### `_on_decrypt_fail(params: dict[str, Any]) -> dict[str, Any] | None`
解密失败时的回退策略。

## 命名元组

### `DecryptResult`
decrypt_message 的结果：解密的参数 + 错误响应列表。
- **字段**:
  - `params`: 解密后的参数
  - `error_responses`: 要发送的错误响应列表

## 导入的模块

```python
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, NamedTuple

from credential_store import load_identity
from e2ee_store import load_e2ee_state, save_e2ee_state
from e2ee_outbox import record_remote_failure
from utils.e2ee import (
    E2eeClient,
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_store | load_identity | 加载 E2EE 密钥 |
| e2ee_store | load_e2ee_state, save_e2ee_state | E2EE 状态持久化 |
| e2ee_outbox | record_remote_failure | 记录远程失败 |
| utils.e2ee | E2eeClient, SUPPORTED_E2EE_VERSION, build_e2ee_error_content, build_e2ee_error_message | E2EE 加密/解密 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| ws_listener.py | E2eeHandler, DecryptResult | WebSocket 监听器 E2EE 处理 |

## 依赖关系图

```
e2ee_handler.py
├── credential_store (加载密钥)
├── e2ee_store (状态持久化)
├── e2ee_outbox (失败记录)
└── utils.e2ee (E2EE 客户端)
    ↓
ws_listener.py
```

## 常量定义

```python
_E2EE_ALL_TYPES = frozenset({"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"})
_E2EE_PROTOCOL_TYPES = frozenset({"e2ee_init", "e2ee_ack", "e2ee_rekey", "e2ee_error"})
_E2EE_USER_NOTICE = "This is an encrypted message."
```

## 导出接口

```python
__all__ = ["E2eeHandler", "DecryptResult"]
```
