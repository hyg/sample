# regenerate_e2ee_keys.py 分析报告

## 文件概述
为现有 DID 身份重新生成 E2EE 密钥。当凭证文件缺少 E2EE 私钥时，此脚本生成新的 key-2（secp256r1）和 key-3（X25519）密钥对。

## 函数签名

### 主要异步函数

#### `async regenerate_e2ee_keys(credential_name: str = "default", force: bool = False) -> None`
为现有凭证重新生成 E2EE 密钥。

步骤：
1. 加载现有凭证并验证 key-1 存在
2. 通过 ANP 生成新的 key-2（secp256r1）和 key-3（X25519）
3. 更新 DID 文档：替换 key-2/key-3 条目，更新 keyAgreement，重新签名
4. 在服务器上更新 DID 文档并刷新 JWT
5. 保存更新的凭证到本地

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
import argparse
import asyncio
import copy
import logging
import secrets
import sys

from utils import (
    SDKConfig,
    create_user_service_client,
    update_did_document,
    get_jwt_via_wba,
)
from utils.identity import DIDIdentity, load_private_key
from utils.logging_config import configure_logging
from credential_store import load_identity, save_identity

# ANP 内部用于 E2EE 密钥生成和证明签名
from anp.authentication.did_wba import _build_e2ee_entries
from anp.proof.proof import generate_w3c_proof
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_user_service_client, update_did_document, get_jwt_via_wba | SDK 配置和 DID 文档更新 |
| utils.identity | DIDIdentity, load_private_key | 身份管理和密钥加载 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | load_identity, save_identity | 凭证加载和保存 |
| anp.authentication.did_wba | _build_e2ee_entries | E2EE 密钥生成 |
| anp.proof.proof | generate_w3c_proof | DID 文档签名 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
regenerate_e2ee_keys.py
├── utils (DID 文档更新)
├── utils.identity (身份管理)
├── credential_store (凭证管理)
├── anp.authentication.did_wba (E2EE 密钥生成)
├── anp.proof.proof (DID 文档签名)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 重新生成 E2EE 密钥
python scripts/regenerate_e2ee_keys.py --credential default

# 强制重新生成（即使密钥已存在）
python scripts/regenerate_e2ee_keys.py --credential default --force
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--credential` | 凭证名称（默认：default） |
| `--force` | 即使 E2EE 密钥已存在也强制重新生成 |

## 使用场景

1. 凭证文件丢失 E2EE 私钥
2. 密钥泄露需要重新生成
3. 升级 E2EE 密钥算法
