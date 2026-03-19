# anp-0.6.8

**用途**: awiki DID 身份认证和 E2EE 加密核心库

## 依赖信息

- **库名**: anp
- **版本**: >=0.6.8
- **来源**: requirements.txt, pyproject.toml

## 主要功能模块

### 1. 身份认证 (`anp.authentication`)

```python
from anp.authentication import DIDWbaAuthHeader, generate_auth_header
from anp.authentication import create_did_wba_document_with_key_binding
from anp.authentication import resolve_did_wba_document
```

**功能**:
- `DIDWbaAuthHeader`: DID WBA 认证头生成器，用于 JSON-RPC 请求认证
- `generate_auth_header`: 生成 DID WBA 授权头
- `create_did_wba_document_with_key_binding`: 创建带密钥绑定的 DID 文档
- `resolve_did_wba_document`: 解析 DID 文档

### 2. E2EE 加密 (`anp.e2e_encryption_hpke`)

```python
from anp.e2e_encryption_hpke import (
    E2eeHpkeSession,
    SessionState,
    HpkeKeyManager,
    MessageType,
    generate_proof,
    validate_proof,
    detect_message_type,
    extract_x25519_public_key_from_did_document,
    extract_signing_public_key_from_did_document,
)
```

**功能**:
- `E2eeHpkeSession`: HPKE 端到端加密会话
- `SessionState`: 会话状态枚举
- `HpkeKeyManager`: 密钥管理器
- `MessageType`: 消息类型枚举 (e2ee_init, e2ee_ack, e2ee_msg, e2ee_rekey, e2ee_error)
- `generate_proof`/`validate_proof`: 消息证明生成/验证
- `detect_message_type`: 检测 E2EE 消息类型

### 3. 证明生成 (`anp.proof.proof`)

```python
from anp.proof.proof import generate_w3c_proof
```

**功能**:
- `generate_w3c_proof`: 生成 W3C 标准的 DID 文档证明

## 在 awiki-did 中的使用

| 模块 | 使用位置 | 用途 |
|------|----------|------|
| `anp.authentication.DIDWbaAuthHeader` | `credential_store.py` | 创建认证器 |
| `anp.authentication.generate_auth_header` | `utils/auth.py` | 生成 WBA 认证头 |
| `anp.authentication.create_did_wba_document_with_key_binding` | `utils/identity.py` | 创建 DID 身份 |
| `anp.e2e_encryption_hpke.E2eeHpkeSession` | `utils/e2ee.py` | E2EE 会话管理 |
| `anp.e2e_encryption_hpke.HpkeKeyManager` | `utils/e2ee.py` | 密钥管理 |
| `anp.proof.proof.generate_w3c_proof` | `scripts/regenerate_e2ee_keys.py` | 重新签名 DID 文档 |

## 密钥类型

| 密钥 | 用途 | 算法 |
|------|------|------|
| key-1 | DID 身份认证 | secp256k1 |
| key-2 | E2EE 签名 | secp256r1 |
| key-3 | E2EE 密钥协商 | X25519 |

## E2EE 协议版本

- **当前支持版本**: 1.1 (`SUPPORTED_E2EE_VERSION = "1.1"`)
- **状态版本标记**: `hpke_v1`
