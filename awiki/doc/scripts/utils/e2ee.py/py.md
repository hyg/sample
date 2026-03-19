# scripts/utils/e2ee.py 分析

## 文件信息

- **路径**: `python/scripts/utils/e2ee.py`
- **用途**: E2EE 端到端加密客户端 (封装 ANP HPKE)

## 常量

```python
SUPPORTED_E2EE_VERSION = "1.1"   # 支持的 E2EE 版本
_STATE_VERSION = "hpke_v1"       # 状态版本标记
```

## 类定义

### E2eeClient

```python
class E2eeClient:
    """E2EE 端到端加密客户端 (HPKE 方案)
    
    封装 ANP E2eeHpkeSession 和 HpkeKeyManager，提供:
    - 一步会话初始化 (无需多步握手)
    - 消息加密和解密 (Chain Ratchet 前向保密)
    - 过期会话清理
    """
    
    def __init__(
        self,
        local_did: str,
        *,
        signing_pem: str | None = None,   # secp256r1 签名密钥
        x25519_pem: str | None = None,    # X25519 密钥协商密钥
    ) -> None:
        """初始化 E2EE 客户端"""
    
    async def initiate_handshake(self, peer_did: str) -> tuple[str, dict[str, Any]]:
        """发起 E2EE 会话 (一步初始化)
        
        返回:
            (msg_type, content_dict) 元组，msg_type 为 "e2ee_init"
        """
    
    async def process_e2ee_message(
        self, msg_type: str, content: dict[str, Any]
    ) -> list[tuple[str, dict[str, Any]]]:
        """处理接收的 E2EE 协议消息
        
        参数:
            msg_type: 消息类型 (e2ee_init/e2ee_rekey/e2ee_error)
            content: 消息内容 dict
        
        返回:
            要发送的消息列表 (HPKE 方案通常为空)
        """
    
    def has_active_session(self, peer_did: str) -> bool:
        """检查是否存在与指定 peer 的活跃会话"""
    
    def has_session_id(self, session_id: str | None) -> bool:
        """检查指定的 session_id 是否存在且活跃"""
    
    def is_session_confirmed(self, session_id: str | None) -> bool:
        """检查会话是否已通过 e2ee_ack 远程确认"""
    
    async def ensure_active_session(
        self, peer_did: str
    ) -> list[tuple[str, dict[str, Any]]]:
        """确保与 peer 存在活跃会话，自动握手
        
        返回:
            要发送的握手消息列表 (空或 [("e2ee_init", ...)])
        """
    
    def encrypt_message(
        self, peer_did: str, plaintext: str, original_type: str = "text"
    ) -> tuple[str, dict[str, Any]]:
        """加密消息
        
        返回:
            (msg_type, content_dict) 元组，msg_type 为 "e2ee_msg"
        """
    
    def decrypt_message(
        self, content: dict[str, Any]
    ) -> tuple[str, str]:
        """解密消息
        
        返回:
            (original_type, plaintext) 元组
        """
    
    def cleanup_expired(self) -> None:
        """清理过期会话"""
    
    def export_state(self) -> dict[str, Any]:
        """导出客户端状态 (用于持久化)"""
    
    @classmethod
    def from_state(cls, state: dict[str, Any]) -> E2eeClient:
        """从导出 dict 恢复客户端"""
```

## 辅助函数

### ensure_supported_e2ee_version()

```python
def ensure_supported_e2ee_version(content: dict[str, Any]) -> str:
    """验证 E2EE 内容版本"""
```

### build_e2ee_error_content()

```python
def build_e2ee_error_content(
    error_code: str,
    *,
    session_id: str | None = None,
    failed_msg_id: str | None = None,
    failed_server_seq: int | None = None,
    retry_hint: str | None = None,
    required_e2ee_version: str | None = None,
    message: str | None = None,
) -> dict[str, Any]:
    """构建 E2EE 错误载荷"""
```

### build_e2ee_error_message()

```python
def build_e2ee_error_message(
    error_code: str,
    *,
    required_e2ee_version: str | None = None,
    detail: str | None = None,
) -> str:
    """构建人类可读的 e2ee_error 消息文本"""
```

### _classify_protocol_error()

```python
def _classify_protocol_error(exc: BaseException) -> tuple[str, str] | None:
    """将协议处理失败映射到发送方可视的错误码"""
```

### _extract_proof_verification_method()

```python
def _extract_proof_verification_method(proof: Any) -> str:
    """提取证明验证方法 (兼容 snake_case 和 camelCase)"""
```

## 导入的模块

```python
import base64
import logging
import time
from typing import Any
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from anp.e2e_encryption_hpke import (
    E2eeHpkeSession, SessionState, HpkeKeyManager,
    MessageType, generate_proof, validate_proof,
    detect_message_type, extract_x25519_public_key_from_did_document,
    extract_signing_public_key_from_did_document,
)
from anp.authentication import resolve_did_wba_document
```

## E2EE 错误码

| 错误码 | 重试提示 | 说明 |
|--------|----------|------|
| `unsupported_version` | drop | 版本不支持 |
| `session_not_found` | rekey_then_resend | 会话不存在 |
| `session_expired` | rekey_then_resend | 会话过期 |
| `decryption_failed` | resend | 解密失败 |
| `invalid_seq` | rekey_then_resend | 序列号无效 |
| `proof_expired` | resend | 证明过期 |
| `proof_from_future` | drop | 证明时间在未来 |

## E2EE 消息类型

| 类型 | 用途 | 处理 |
|------|------|------|
| `e2ee_init` | 会话初始化 | 创建并激活会话，返回 e2ee_ack |
| `e2ee_ack` | 会话确认 | 内部处理 |
| `e2ee_msg` | 加密消息 | 解密 |
| `e2ee_rekey` | 重新密钥 | 重建会话 |
| `e2ee_error` | 错误响应 | 更新 outbox 状态 |

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出 `E2eeClient` |
| `scripts/check_inbox.py` | `E2eeClient`, 错误处理函数 |
| `scripts/check_status.py` | `E2eeClient`, 错误处理函数 |
| `scripts/e2ee_messaging.py` | `E2eeClient`, 错误处理函数 |
| `scripts/e2ee_handler.py` | `E2eeClient`, 错误处理函数 |
| `scripts/ws_listener.py` | 通过 `e2ee_handler.E2eeHandler` |
| `scripts/regenerate_e2ee_keys.py` | 间接使用 (通过 credential_store) |
| `tests/test_e2ee_private_helpers.py` | 错误分类函数测试 |

## 状态导出格式

```python
{
    "version": "hpke_v1",
    "local_did": "did:wba:...",
    "signing_pem": "<PEM>",
    "x25519_pem": "<PEM>",
    "confirmed_session_ids": ["sess-1", ...],
    "sessions": [
        {
            "session_id": "sess-1",
            "local_did": "...",
            "peer_did": "...",
            "is_initiator": True,
            "send_chain_key": "<base64>",
            "recv_chain_key": "<base64>",
            "send_seq": 0,
            "recv_seq": 0,
            "expires_at": 1234567890,
            "created_at": 1234567890,
            "active_at": 1234567890
        }
    ]
}
```
