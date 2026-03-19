# test_e2ee_private_helpers.py 分析报告

## 文件概述
私有 E2EE 助手行为的单元测试。测试私有聊天特定错误映射和收件箱排序助手，无需网络访问或持久凭证。

## 测试类

### `TestDecryptErrorClassification`
私有解密错误应该映射到稳定代码和重试提示。

#### 测试方法

##### `test_handler_classifies_session_not_found()`
测试处理器分类 session_not_found 错误。

##### `test_cli_classifies_invalid_seq()`
测试 CLI 分类 invalid_seq 错误。

##### `test_cli_classifies_generic_failure()`
测试 CLI 分类通用失败错误。

##### `test_cli_classifies_unsupported_version()`
测试 CLI 分类 unsupported_version 错误。

### `TestProtocolErrorClassification`
协议证明失败应该映射到发送者可见错误。

#### 测试方法

##### `test_protocol_classifies_proof_expired()`
测试协议分类 proof_expired。

##### `test_protocol_classifies_proof_from_future()`
测试协议分类 proof_from_future。

##### `test_protocol_classifies_unsupported_version()`
测试协议分类 unsupported_version。

### `TestErrorMessageText`
人类可读的 e2ee_error 文本应该保持稳定和一致。

#### 测试方法

##### `test_upgrade_message_is_consistent()`
测试升级消息一致性。

### `TestInboxSortKey`
收件箱排序应该在发送者流内优先 server_seq。

#### 测试方法

##### `test_message_sort_key_prefers_server_seq()`
测试消息排序键优先 server_seq。

##### `test_check_inbox_sort_key_tolerates_missing_timestamps()`
测试 check_inbox 排序键容忍缺失时间戳。

##### `test_check_status_sort_key_tolerates_missing_timestamps()`
测试 check_status 排序键容忍缺失时间戳。

##### `test_e2ee_messaging_sort_key_tolerates_missing_timestamps()`
测试 e2ee_messaging 排序键容忍缺失时间戳。

##### `test_check_inbox_sort_key_tolerates_missing_sender_did()`
测试 check_inbox 排序键容忍缺失发送者 DID。

##### `test_check_status_sort_key_tolerates_missing_sender_did()`
测试 check_status 排序键容忍缺失发送者 DID。

##### `test_e2ee_messaging_sort_key_tolerates_missing_sender_did()`
测试 e2ee_messaging 排序键容忍缺失发送者 DID。

##### `test_e2ee_messaging_sender_did_value_uses_placeholder_for_none()`
测试发送者 DID 值对 None 使用占位符。

### `TestOutgoingHistoryRender`
outgoing 加密历史项应该可替换为本地明文。

#### 测试方法

##### `test_render_outgoing_message_without_local_copy_returns_none()`
测试渲染无本地副本的 outgoing 消息返回 None。

### `TestUserVisibleE2EEDecoration`
用户可见 E2EE 输出应该保持最小和稳定。

#### 测试方法

##### `test_check_inbox_decorates_decrypted_message_with_minimal_notice()`
测试 check_inbox 用最小通知装饰解密消息。

##### `test_cli_renders_minimal_encrypted_message_text()`
测试 CLI 渲染最小加密消息文本。

##### `test_cli_renders_send_first_auto_init_notice()`
测试 CLI 渲染发送优先自动初始化通知。

##### `test_check_status_hides_protocol_only_message_types()`
测试 check_status 隐藏仅协议消息类型。

##### `test_check_inbox_strips_hidden_title_field()`
测试 check_inbox 移除隐藏 title 字段。

##### `test_send_message_result_strips_hidden_title_field()`
测试 send_message 结果移除隐藏 title 字段。

## 导入的模块

```python
from __future__ import annotations

import sys
from pathlib import Path

import e2ee_messaging
import e2ee_handler
import check_inbox
import check_status
import send_message as send_message_script
from utils import e2ee as e2ee_utils
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| e2ee_messaging | _classify_decrypt_error, _message_sort_key, _render_user_visible_e2ee_text, _render_auto_session_notice, _sender_did_value | 被测试函数 |
| e2ee_handler | E2eeHandler._classify_error | 被测试函数 |
| check_inbox | _message_sort_key, _render_local_outgoing_e2ee_message, _decorate_user_visible_e2ee_message, _strip_hidden_user_fields | 被测试函数 |
| check_status | _message_sort_key, _is_user_visible_message_type | 被测试函数 |
| send_message_script | _strip_hidden_result_fields | 被测试函数 |
| utils.e2ee | _classify_protocol_error, build_e2ee_error_message | 被测试函数 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_e2ee_private_helpers.py
├── e2ee_messaging (被测试)
├── e2ee_handler (被测试)
├── check_inbox (被测试)
├── check_status (被测试)
├── send_message (被测试)
└── utils.e2ee (被测试)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| 错误分类 | session_not_found, invalid_seq, unsupported_version, decryption_failed |
| 协议错误 | proof_expired, proof_from_future |
| 排序键 | server_seq 优先，容忍缺失时间戳/发送者 DID |
| 用户呈现 | 最小通知，隐藏字段移除 |

## 运行测试

```bash
pytest tests/test_e2ee_private_helpers.py -v
```
