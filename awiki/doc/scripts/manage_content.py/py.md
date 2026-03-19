# manage_content.py 分析报告

## 文件概述
管理内容页面（创建、更新、重命名、删除、列表、获取）。发布自定义 Markdown 文档（招聘启事、活动页面等）。

## 函数签名

### 主要异步函数

#### `async create_page(credential_name: str, slug: str, title: str, body: str, visibility: str = "public") -> None`
创建内容页面。

#### `async update_page(credential_name: str, slug: str, title: str | None = None, body: str | None = None, visibility: str | None = None) -> None`
更新内容页面。

#### `async rename_page(credential_name: str, old_slug: str, new_slug: str) -> None`
重命名内容页面 slug。

#### `async delete_page(credential_name: str, slug: str) -> None`
删除内容页面。

#### `async list_pages(credential_name: str) -> None`
列出所有内容页面。

#### `async get_page(credential_name: str, slug: str) -> None`
获取特定内容页面（带完整正文）。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from utils import (
    SDKConfig,
    JsonRpcError,
    create_user_service_client,
    authenticated_rpc_call,
)
from utils.logging_config import configure_logging
from credential_store import create_authenticator
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, JsonRpcError, create_user_service_client, authenticated_rpc_call | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator | 身份验证 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
manage_content.py
├── utils (SDKConfig, RPC 客户端)
├── utils.logging_config (日志)
└── credential_store (身份验证)
```

## 使用说明

```bash
# 创建内容页面
python scripts/manage_content.py --create --slug jd --title "Job Description" --body "# We are hiring\n\n..."

# 创建草稿页面
python scripts/manage_content.py --create --slug draft-post --title "Draft" --body "WIP" --visibility draft

# 列出所有内容页面
python scripts/manage_content.py --list

# 获取特定内容页面
python scripts/manage_content.py --get --slug jd

# 更新内容页面
python scripts/manage_content.py --update --slug jd --title "Updated Title" --body "New content"

# 更改可见性
python scripts/manage_content.py --update --slug jd --visibility public

# 重命名 slug
python scripts/manage_content.py --rename --slug jd --new-slug hiring

# 删除内容页面
python scripts/manage_content.py --delete --slug jd

# 从文件读取正文
python scripts/manage_content.py --create --slug event --title "Event" --body-file ./event.md
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--create` | 创建内容页面 |
| `--update` | 更新内容页面 |
| `--rename` | 重命名页面 slug |
| `--delete` | 删除内容页面 |
| `--list` | 列出所有内容页面 |
| `--get` | 获取内容页面 |
| `--slug` | 页面 slug（URL 标识符） |
| `--title` | 页面标题 |
| `--body` | 页面正文（Markdown 内容） |
| `--body-file` | 从文件读取正文 |
| `--visibility` | 页面可见性（public/draft/unlisted） |
| `--new-slug` | 重命名的新 slug |
| `--credential` | 凭证名称 |
