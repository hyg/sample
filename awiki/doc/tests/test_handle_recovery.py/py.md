# test_handle_recovery.py 分析报告

## 文件概述
Handle 恢复客户端助手的单元测试。测试 recover_handle 使用新 RPC 和 access_token 的行为。

## 辅助函数

### `_make_identity(did: str) -> DIDIdentity`
为恢复测试创建最小 DID 身份。

## 测试函数

### `test_recover_handle_uses_new_rpc_and_access_token(monkeypatch)`
测试 recover_handle 应该调用新 RPC 并保留 access_token。

测试内容：
- 模拟 create_identity 返回测试身份
- 模拟 rpc_call 记录调用参数
- 调用 recover_handle
- 验证端点、方法、负载和结果

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from utils.config import SDKConfig
from utils.identity import DIDIdentity
from utils import handle as handle_utils
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.config | SDKConfig | SDK 配置 |
| utils.identity | DIDIdentity | 身份构建 |
| utils.handle | create_identity, rpc_call, recover_handle | 被测试函数 |
| asyncio | run | 运行异步测试 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_handle_recovery.py
├── utils.config (SDKConfig)
├── utils.identity (DIDIdentity)
└── utils.handle (被测试)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| recover_handle | RPC 端点、方法、负载、access_token 保留 |

## 验证点

| 验证项 | 预期值 |
|--------|--------|
| endpoint | /user-service/did-auth/rpc |
| method | recover_handle |
| payload.handle | alice |
| payload.otp_code | 123456 |
| identity.did | did:wba:awiki.ai:alice:k1_new |
| identity.jwt_token | jwt-token |
| result.full_handle | alice.awiki.ai |

## 运行测试

```bash
pytest tests/test_handle_recovery.py -v
```
