# scripts/utils/identity.py 分析

## 文件信息

- **路径**: `python/scripts/utils/identity.py`
- **用途**: DID 身份创建 (封装 ANP 库)

## 类定义

### DIDIdentity

```python
@dataclass
class DIDIdentity:
    """完整的 DID 身份信息"""
    
    did: str                              # DID 标识符
    did_document: dict[str, Any]          # DID 文档 (包含 proof)
    private_key_pem: bytes                # secp256k1 私钥 PEM
    public_key_pem: bytes                 # 公钥 PEM
    user_id: str | None = None            # 用户 ID (注册后填充)
    jwt_token: str | None = None          # JWT token (认证后填充)
    e2ee_signing_private_pem: bytes | None = None    # key-2 secp256r1
    e2ee_signing_public_pem: bytes | None = None
    e2ee_agreement_private_pem: bytes | None = None  # key-3 X25519
    e2ee_agreement_public_pem: bytes | None = None
    
    @property
    def unique_id(self) -> str:
        """从 DID 提取 unique_id (最后一段路径)"""
        
    def get_private_key(self) -> ec.EllipticCurvePrivateKey:
        """加载 secp256k1 私钥对象"""
```

## 函数签名

### create_identity()

```python
def create_identity(
    hostname: str,
    path_prefix: list[str] | None = None,
    proof_purpose: str = "authentication",
    domain: str | None = None,
    challenge: str | None = None,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
    """创建密钥绑定的 DID 身份
    
    参数:
        hostname: DID 域名
        path_prefix: DID 路径前缀，如 ["user"] 或 ["agent"]
        proof_purpose: 证明用途 (默认 "authentication")
        domain: 证明绑定的服务域名
        challenge: 证明 nonce (自动生成)
        services: 自定义服务条目列表
    
    返回:
        DIDIdentity (did_document 包含 ANP 生成的 proof)
    """
```

### load_private_key()

```python
def load_private_key(pem_bytes: bytes) -> ec.EllipticCurvePrivateKey:
    """从 PEM 字节加载私钥"""
```

## 导入的模块

```python
import secrets
from dataclasses import dataclass, field
from typing import Any
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from anp.authentication import create_did_wba_document_with_key_binding
```

## 密钥类型

| 密钥 | 用途 | 算法 | 属性 |
|------|------|------|------|
| key-1 | DID 身份认证 | secp256k1 | `private_key_pem` |
| key-2 | E2EE 签名 | secp256r1 | `e2ee_signing_private_pem` |
| key-3 | E2EE 密钥协商 | X25519 | `e2ee_agreement_private_pem` |

## DID 格式

```
did:wba:{hostname}:{path_prefix}:{unique_id}
例如：did:wba:awiki.ai:user:k1_<fingerprint>
```

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/auth.py` | `DIDIdentity`, `create_identity` |
| `utils/handle.py` | `DIDIdentity`, `create_identity` |
| `utils/ws.py` | `DIDIdentity` |
| `scripts/setup_identity.py` | `DIDIdentity` |
| `scripts/register_handle.py` | `create_identity` |
| `scripts/recover_handle.py` | `DIDIdentity` |
| `scripts/regenerate_e2ee_keys.py` | `DIDIdentity`, `load_private_key` |

## 调用关系图

```
create_identity (utils/identity.py)
    │
    ├─→ utils/auth.py: create_authenticated_identity()
    ├─→ utils/handle.py: register_handle(), recover_handle()
    └─→ scripts/*.py: 直接调用
```
