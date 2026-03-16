# ANP 库实现细节文档

## 1. 概述

**包名**: `anp`  
**版本**: `0.6.8`  
**用途**: awiki Network Protocol - awiki.ai 网络协议库

---

## 2. 安装信息

```bash
pip install anp>=0.6.8
```

**查看安装位置**:
```bash
pip show anp
```

---

## 3. 模块结构

```
anp/
├── authentication/     # 认证模块
│   ├── __init__.py
│   ├── did_wba.py     # DID WBA 认证
│   └── header.py      # 认证头生成
├── e2e_encryption_hpke/ # E2EE 加密模块
│   ├── __init__.py
│   ├── session.py     # E2EE 会话管理
│   ├── key_manager.py # 密钥管理
│   └── message.py     # 消息类型检测
└── ...
```

---

## 4. 被调用的接口

### 4.1 anp.authentication 模块

#### 4.1.1 DIDWbaAuthHeader

**调用位置**: `python/scripts/utils/auth.py`

**功能**: DID WBA 认证头生成器

**实现细节**:
```python
class DIDWbaAuthHeader:
    def __init__(self, identity_path: str):
        self.identity_path = identity_path
        self.jwt = None
        self.last_refresh = 0
    
    def generate(self, method: str, path: str, body: dict = None) -> str:
        """生成认证头"""
        # 1. 加载身份凭证
        # 2. 检查 JWT 是否过期
        # 3. 如过期则刷新 JWT
        # 4. 生成签名：sign(timestamp + method + path + body_hash)
        # 5. 返回：DIDWba <did>:<signature>:<timestamp>
```

**调用流程**:
```
1. 创建 HTTP 请求
   ↓
2. 调用 auth_header.generate(method, path, body)
   ↓
3. 设置 Authorization 头
   ↓
4. 发送请求
   ↓
5. 如收到 401，刷新 JWT 后重试
```

#### 4.1.2 generate_auth_header

**调用位置**: `python/scripts/utils/auth.py`

**功能**: 生成认证头的便捷函数

**签名**:
```python
def generate_auth_header(identity_path: str, method: str, path: str, body: dict = None) -> str:
    """
    生成 DID WBA 认证头
    
    Args:
        identity_path: 身份凭证路径
        method: HTTP 方法
        path: 请求路径
        body: 请求体
    
    Returns:
        Authorization 头值
    """
```

#### 4.1.3 create_did_wba_document_with_key_binding

**调用位置**: `python/scripts/utils/identity.py`

**功能**: 创建 DID WBA 文档

**签名**:
```python
def create_did_wba_document_with_key_binding(
    public_key: str,
    key_id: str,
    did: str
) -> dict:
    """
    创建带有密钥绑定的 DID WBA 文档
    
    Args:
        public_key: secp256k1 公钥
        key_id: 密钥 ID
        did: DID 标识符
    
    Returns:
        DID 文档（JSON-LD 格式）
    """
```

**返回格式**:
```json
{
  "@context": ["https://www.w3.org/ns/did/v1", ...],
  "id": "did:wba:awiki.ai:user:k1_...",
  "verificationMethod": [{
    "id": "did:wba:...#key-1",
    "type": "EcdsaSecp256k1VerificationKey2019",
    "controller": "did:wba:...",
    "publicKeyMultibase": "z..."
  }],
  "authentication": ["did:wba:...#key-1"],
  "assertionMethod": ["did:wba:...#key-2"]
}
```

### 4.2 anp.e2e_encryption_hpke 模块

#### 4.2.1 E2eeHpkeSession

**调用位置**: `python/scripts/utils/e2ee.py`

**功能**: E2EE HPKE 会话管理

**实现细节**:
```python
class E2eeHpkeSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state = "init"  # init, active, closed
        self.send_key = None
        self.recv_key = None
    
    def init(self, peer_public_key: bytes) -> bytes:
        """初始化会话，返回本地公钥"""
        # 1. 生成 X25519 密钥对
        # 2. 执行 HPKE 密钥协商
        # 3. 派生发送/接收密钥
        # 4. 返回封装后的共享密钥
    
    def seal(self, plaintext: bytes) -> bytes:
        """加密消息"""
        # 1. 使用发送密钥加密
        # 2. 添加 nonce 和关联数据
        # 3. 返回密文
    
    def open(self, ciphertext: bytes) -> bytes:
        """解密消息"""
        # 1. 验证 nonce 和关联数据
        # 2. 使用接收密钥解密
        # 3. 返回明文
```

#### 4.2.2 HpkeKeyManager

**调用位置**: `python/scripts/utils/e2ee.py`

**功能**: HPKE 密钥管理器

**实现细节**:
```python
class HpkeKeyManager:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.keys = {}
    
    def get_key_pair(self, key_id: str) -> Tuple[bytes, bytes]:
        """获取密钥对"""
        # 1. 从存储加载
        # 2. 如不存在则生成
        # 3. 返回 (公钥，私钥)
    
    def save_key_pair(self, key_id: str, public_key: bytes, private_key: bytes):
        """保存密钥对"""
        # 1. 加密私钥
        # 2. 保存到文件
    
    def get_peer_public_key(self, did: str) -> bytes:
        """获取对等方公钥"""
        # 1. 从 DID 文档解析
        # 2. 提取 key-3 (X25519) 公钥
```

#### 4.2.3 detect_message_type

**调用位置**: `python/scripts/utils/e2ee.py`

**功能**: 检测消息类型

**签名**:
```python
def detect_message_type(message: dict) -> str:
    """
    检测消息类型
    
    Args:
        message: 消息字典
    
    Returns:
        消息类型：e2ee_init, e2ee_ack, e2ee_msg, e2ee_rekey, e2ee_error, text
    """
```

**实现逻辑**:
```python
def detect_message_type(message: dict) -> str:
    content = message.get("content", "")
    if content.startswith("e2ee_"):
        return content.split("_")[1]  # init, ack, msg, rekey, error
    return "text"
```

---

## 5. 调用位置汇总

| 模块 | 接口 | 调用文件 | 调用函数 |
|------|------|----------|----------|
| `anp.authentication` | `DIDWbaAuthHeader` | `utils/auth.py` | `create_auth_header()` |
| `anp.authentication` | `generate_auth_header` | `utils/auth.py` | `authenticated_rpc_call()` |
| `anp.authentication` | `create_did_wba_document_with_key_binding` | `utils/identity.py` | `create_identity()` |
| `anp.e2e_encryption_hpke` | `E2eeHpkeSession` | `utils/e2ee.py` | `ensure_active_session()` |
| `anp.e2e_encryption_hpke` | `HpkeKeyManager` | `utils/e2ee.py` | `get_key_manager()` |
| `anp.e2e_encryption_hpke` | `detect_message_type` | `utils/e2ee.py` | `classify_message()` |

---

## 6. 源码位置

由于 ANP 是 PyPI 包，源码位置可通过以下命令查看：

```bash
pip show anp
```

典型位置：
- **Windows**: `C:\Users\<user>\AppData\Roaming\Python\Python314\site-packages\anp\`
- **Linux/Mac**: `~/.local/lib/python3.14/site-packages/anp/`

---

## 7. 注意事项

1. **编译扩展**: ANP 可能包含 C 扩展模块，源码可能不完整
2. **版本兼容**: 确保使用 >=0.6.8 版本
3. **密钥安全**: 私钥加密存储，不要泄露
