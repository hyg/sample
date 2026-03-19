# manage_contacts.py 分析报告

## 文件概述
管理本地持久化的联系人沉淀和推荐事件。用于群组发现工作流的本地关系沉淀 CLI。

## 函数签名

### 内部辅助函数

#### `_identity_or_exit(credential_name: str) -> dict[str, Any]`
加载本地身份元数据或在用户可见错误时退出。

#### `_now_iso() -> str`
返回 ISO 8601 格式的当前 UTC 时间戳。

#### `_build_parser() -> argparse.ArgumentParser`
构建 CLI 解析器。

#### `_require_target_did(args: argparse.Namespace, parser: argparse.ArgumentParser) -> str`
要求并返回目标 DID。

#### `_require_group_context(args: argparse.Namespace, parser: argparse.ArgumentParser) -> None`
要求群组沉淀的最小源上下文。

### 主要函数

#### `record_recommendation(args: argparse.Namespace) -> None`
将 AI 推荐候选记录为待处理事件。

#### `save_from_group(args: argparse.Namespace) -> None`
持久化确认的联系人快照和接受事件。

#### `mark_followed(args: argparse.Namespace) -> None`
在本地标记一个联系人为已关注。

#### `mark_messaged(args: argparse.Namespace) -> None`
在本地标记一个联系人为已发消息。

#### `update_note(args: argparse.Namespace) -> None`
更新一个联系人的本地备注。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from typing import Any

import local_store
from credential_store import create_authenticator
from utils import SDKConfig
from utils.logging_config import configure_logging
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | get_connection, ensure_schema, append_relationship_event, upsert_contact | 本地存储操作 |
| credential_store | create_authenticator | 身份验证 |
| utils | SDKConfig | SDK 配置 |
| utils.logging_config | configure_logging | 日志配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
manage_contacts.py
├── local_store (联系人和事件存储)
├── credential_store (身份验证)
├── utils (SDKConfig)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 记录 AI 推荐候选
uv run python scripts/manage_contacts.py --record-recommendation \
  --target-did "did:wba:awiki.ai:user:bob" \
  --source-type meetup \
  --source-name "OpenClaw Meetup Hangzhou 2026" \
  --source-group-id grp_123 \
  --reason "Strong infra fit and clear collaboration intent"

# 从群组保存确认的联系人
uv run python scripts/manage_contacts.py --save-from-group \
  --target-did "did:wba:awiki.ai:user:bob" \
  --target-handle "bob.awiki.ai" \
  --source-type meetup \
  --source-name "OpenClaw Meetup Hangzhou 2026" \
  --source-group-id grp_123 \
  --reason "Strong infra fit and clear collaboration intent"

# 标记为已关注
uv run python scripts/manage_contacts.py --mark-followed --target-did "did:wba:awiki.ai:user:bob"

# 标记为已发消息
uv run python scripts/manage_contacts.py --mark-messaged --target-did "did:wba:awiki.ai:user:bob"

# 更新备注
uv run python scripts/manage_contacts.py --note --target-did "did:wba:awiki.ai:user:bob" --text "Met at the meetup."
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--record-recommendation` | 记录 AI 推荐候选 |
| `--save-from-group` | 从群组保存确认的联系人 |
| `--mark-followed` | 标记为已关注 |
| `--mark-messaged` | 标记为已发消息 |
| `--note` | 更新备注 |
| `--target-did` | 目标 DID |
| `--target-handle` | 目标 handle |
| `--source-type` | 源类型 |
| `--source-name` | 源名称 |
| `--source-group-id` | 源群组 ID |
| `--reason` | 推荐或保存原因 |
| `--score` | 推荐分数 |
| `--text` | 自由形式备注文本 |
| `--connected-at` | 连接时间戳 |
| `--credential` | 凭证名称 |
