# identity.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/identity.py`

**主要功能**: 
- 创建 DID 身份（包装 ANP 库）
- 生成 secp256k1 密钥对
- 生成 E2EE 密钥（key-2 secp256r1, key-3 X25519）
- 创建带证明的 DID 文档

**依赖关系**:
- `cryptography`: 密钥操作
- `anp.authentication`: ANP 库的 DID 创建功能
- 本地模块：无

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `secrets` | 生成随机 challenge |
| `dataclasses.dataclass, field` | 数据类定义 |
| `cryptography.hazmat.primitives.asymmetric.ec` | 椭圆曲线加密 |
| `cryptography.hazmat.primitives.serialization.load_pem_private_key` | PEM 密钥加载 |
| `anp.authentication.create_did_wba_document_with_key_binding` | DID 文档创建 |

---

## 3. 数据类详解

### 3.1 `DIDIdentity`

**定义**:
```python
@dataclass
class DIDIdentity:
    """完整的 DID 身份信息。"""
```

**属性**:

| 属性 | 类型 | 描述 |
|------|------|------|
| `did` | `str` | DID 标识符 |
| `did_document` | `dict[str, Any]` | DID 文档（包含 ANP 生成的证明） |
| `private_key_pem` | `bytes` | secp256k1 私钥（PEM 格式） |
| `public_key_pem` | `bytes` | secp256k1 公钥（PEM 格式） |
| `user_id` | `str | None` | 用户 ID（注册后填充） |
| `jwt_token` | `str | None` | JWT 令牌（认证后填充） |
| `e2ee_signing_private_pem` | `bytes | None` | key-2 secp256r1 私钥 |
| `e2ee_signing_public_pem` | `bytes | None` | key-2 secp256r1 公钥 |
| `e2ee_agreement_private_pem` | `bytes | None` | key-3 X25519 私钥 |
| `e2ee_agreement_public_pem` | `bytes | None` | key-3 X25519 公钥 |

**方法**:

#### `unique_id` (属性)

**签名**:
```python
@property
def unique_id(self) -> str:
```

**功能**: 从 DID 中提取 unique_id（最后一段路径）

**示例**:
```python
identity = DIDIdentity(did="did:wba:awiki.ai:user:k1_abc123", ...)
print(identity.unique_id)  # 输出：k1_abc123
```

#### `get_private_key`

**签名**:
```python
def get_private_key(self) -> ec.EllipticCurvePrivateKey:
```

**功能**: 从 PEM 加载 secp256k1 私钥对象

**返回值**: `ec.EllipticCurvePrivateKey` 对象

---

## 4. 函数详解

### 4.1 `create_identity`

**签名**:
```python
def create_identity(
    hostname: str,
    path_prefix: list[str] | None = None,
    proof_purpose: str = "authentication",
    domain: str | None = None,
    challenge: str | None = None,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
```

**参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `hostname` | `str` | - | DID 域名 |
| `path_prefix` | `list[str]` | `None` | DID 路径前缀，如 `["user"]` |
| `proof_purpose` | `str` | `"authentication"` | 证明用途 |
| `domain` | `str` | `None` | 证明绑定的服务域名 |
| `challenge` | `str` | `None` | 证明随机数（防止重放） |
| `services` | `list[dict]` | `None` | 自定义服务列表 |

**返回值**: `DIDIdentity` - 包含 DID 文档和密钥

**功能**: 
创建带密钥绑定的 DID 身份：
1. 生成 secp256k1 密钥对（key-1）
2. 生成 secp256r1 签名密钥对（key-2）
3. 生成 X25519 密钥协商密钥对（key-3）
4. 创建 DID 文档并生成证明

**DID 格式**:
```
did:wba:<hostname>:<path_prefix>:k1_<fingerprint>
```

**调用位置**:
- `auth.create_authenticated_identity()`
- `handle.register_handle()`
- `handle.recover_handle()`
- `setup_identity.py`

**使用示例**:
```python
from utils.identity import create_identity

# 创建用户身份
identity = create_identity(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
)

print(f"DID: {identity.did}")
print(f"Has E2EE keys: {identity.e2ee_signing_private_pem is not None}")
```

---

### 4.2 `load_private_key`

**签名**:
```python
def load_private_key(pem_bytes: bytes) -> ec.EllipticCurvePrivateKey:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `pem_bytes` | `bytes` | - | PEM 格式的私钥 |

**返回值**: `ec.EllipticCurvePrivateKey` - 私钥对象

**异常**: `TypeError` - 如果不是有效的椭圆曲线私钥

**功能**: 
从 PEM 字节加载私钥对象。

**调用位置**:
- `DIDIdentity.get_private_key()`
- `auth.py`

---

## 5. 密钥类型说明

### 5.1 key-1: secp256k1

- **用途**: DID 身份密钥
- **算法**: ECDSA secp256k1
- **文件**: `key-1.pem`
- **用于**: DID 文档认证、JWT 签名

### 5.2 key-2: secp256r1

- **用途**: E2EE 签名密钥
- **算法**: ECDSA secp256r1
- **文件**: `key-2.pem`
- **用于**: E2EE 消息证明签名

### 5.3 key-3: X25519

- **用途**: E2EE 密钥协商
- **算法**: X25519 (HPKE)
- **文件**: `key-3.pem`
- **用于**: HPKE 端到端加密

---

## 6. DID 文档结构

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1"
  ],
  "id": "did:wba:awiki.ai:user:k1_abc123",
  "verificationMethod": [
    {
      "id": "did:wba:awiki.ai:user:k1_abc123#key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:wba:awiki.ai:user:k1_abc123",
      "publicKeyMultibase": "z..."
    },
    {
      "id": "did:wba:awiki.ai:user:k1_abc123#key-2",
      "type": "EcdsaSecp256r1VerificationKey2019",
      "controller": "did:wba:awiki.ai:user:k1_abc123",
      "publicKeyMultibase": "z..."
    },
    {
      "id": "did:wba:awiki.ai:user:k1_abc123#key-3",
      "type": "X25519KeyAgreementKey2020",
      "controller": "did:wba:awiki.ai:user:k1_abc123",
      "publicKeyMultibase": "z..."
    }
  ],
  "authentication": ["did:wba:awiki.ai:user:k1_abc123#key-1"],
  "assertionMethod": ["did:wba:awiki.ai:user:k1_abc123#key-2"],
  "keyAgreement": ["did:wba:awiki.ai:user:k1_abc123#key-3"],
  "service": [...]
}
```

---

## 7. 调用关系

### 被谁调用
- `auth.py`: 创建认证身份
- `handle.py`: Handle 注册和恢复
- `setup_identity.py`: 身份管理脚本

### 调用谁
- `anp.authentication`: DID 文档创建
- `cryptography`: 密钥加载

---

## 8. 使用示例

### 8.1 创建基本身份

```python
from utils.identity import create_identity

identity = create_identity(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
)

# 访问身份信息
print(f"DID: {identity.did}")
print(f"Unique ID: {identity.unique_id}")
```

### 8.2 获取私钥进行签名

```python
from cryptography.hazmat.primitives import hashes

# 获取私钥对象
private_key = identity.get_private_key()

# 使用私钥签名
data = b"Hello, World!"
signature = private_key.sign(data, ec.ECDSA(hashes.SHA256()))
```

### 8.3 访问 E2EE 密钥

```python
# 检查是否有 E2EE 密钥
if identity.e2ee_signing_private_pem:
    print("E2EE signing key available")
if identity.e2ee_agreement_private_pem:
    print("E2EE agreement key available")
```
