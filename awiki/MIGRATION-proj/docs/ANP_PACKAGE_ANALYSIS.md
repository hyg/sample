# ANP 包分析报告

**分析日期**: 2026-03-09  
**ANP 版本**: 0.6.8  
**分析目的**: 为 Node.js 移植提供技术参考

---

## ANP 包结构

**安装位置**:
```
C:\Users\hyg\AppData\Local\Python\pythoncore-3.14-64\Lib\site-packages\anp\
```

**核心模块**:
```
anp/
├── authentication/          # DID WBA 认证
│   ├── did_wba.py          # DID 文档生成和认证头生成
│   ├── did_wba_authenticator.py  # DIDWbaAuthHeader 类
│   ├── did_wba_verifier.py  # DID 验证器
│   └── verification_methods.py  # 验证方法
│
├── e2e_encryption_hpke/    # E2EE 加密
│   ├── hpke.py             # HPKE 实现
│   ├── ratchet.py          # Ratchet 算法
│   ├── session.py          # E2EE 会话管理
│   ├── key_manager.py      # 密钥管理
│   ├── message_builder.py  # 消息构建
│   ├── message_parser.py   # 消息解析
│   ├── seq_manager.py      # 序号管理
│   ├── crypto.py           # 加密原语
│   └── key_pair.py         # 密钥对生成
│
├── proof/                  # W3C Proof
│   └── proof.py            # W3C Data Integrity Proof
│
└── utils/                  # 工具函数
    └── crypto_tool.py      # 加密工具
```

---

## 核心类分析

### 1. DIDWbaAuthHeader (authentication/did_wba_authenticator.py)

**功能**: 管理 DID 认证头和 JWT token 自动刷新

**核心方法**:
```python
class DIDWbaAuthHeader:
    def __init__(self, did_document_path, private_key_path)
    def get_auth_header(self, server_url, force_new=False)
    def update_token(self, server_url, headers)
    def clear_token(self, server_url)
    def clear_all_tokens(self)
```

**工作流程**:
1. 初始化时加载 DID 文档和私钥
2. `get_auth_header()` 优先返回缓存的 JWT token
3. 如果 token 不存在或过期，生成 DID 签名认证头
4. `update_token()` 从响应头提取新 JWT 并缓存
5. `clear_token()` 清除过期 token（用于 401 重试）

**Node.js 移植状态**: ✅ 已完成
- 文件：`nodejs-client/lib/anp/authentication/did_wba_authenticator.js`
- 测试：`scripts/test_jwt_auto_refresh_mock.js` (100% 通过)

---

### 2. generate_auth_header (authentication/did_wba.py)

**功能**: 生成 DID WBA 认证头

**签名流程**:
```python
def generate_auth_header(did_document, service_domain, sign_callback):
    # 1. 构建认证数据
    auth_data = {
        "nonce": random_hex(32),
        "timestamp": utc_now(),
        "aud": service_domain,
        "did": did_document["id"]
    }
    
    # 2. JCS 规范化
    canonical_json = jcs.canonicalize(auth_data)
    
    # 3. SHA-256 哈希
    content_hash = hashlib.sha256(canonical_json).digest()
    
    # 4. ECDSA secp256k1 签名 (DER 格式)
    signature = sign_callback(content_hash, "key-1")
    
    # 5. Base64URL 编码
    signature_b64url = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()
    
    # 6. 构建认证头
    return f'DIDWba v="1.1", did="{did}", nonce="{nonce}", ...'
```

**Node.js 移植状态**: ✅ 已完成
- 文件：`nodejs-client/lib/anp/authentication/did_wba.js`

---

### 3. E2eeClient (e2e_encryption_hpke/session.py)

**功能**: E2EE 加密客户端

**核心方法**:
```python
class E2eeClient:
    def initiate_handshake(self, peer_did)      # 发起握手
    def process_e2ee_message(self, msg_type, content)  # 处理消息
    def encrypt_message(self, peer_did, plaintext)     # 加密消息
    def decrypt_message(self, content)                 # 解密消息
```

**加密流程**:
1. 使用 X25519 密钥协商生成共享密钥
2. 使用 HKDF 派生链密钥
3. 使用 AES-128-GCM 加密消息
4. 每次加密后更新链密钥（前向安全）

**Node.js 移植状态**: ⏸️ 进行中
- 已有文件：`nodejs-client/src/e2ee.js` (需要整理)

---

### 4. W3C Proof (proof/proof.py)

**功能**: 生成和验证 W3C Data Integrity Proof

**核心函数**:
```python
def generate_w3c_proof(document, private_key, verification_method, proof_purpose)
def verify_w3c_proof(document, public_key)
```

**签名流程**:
1. 规范化文档（排除 proof 字段）
2. 规范化 proof 选项
3. 哈希两者并拼接：`hash(options) || hash(document)`
4. ECDSA secp256k1 签名
5. Base64URL 编码为 proofValue

**Node.js 移植状态**: ⏸️ 已有代码
- 文件：`nodejs-client/src/w3c_proof.js` (需要整理)

---

## JWT 自动刷新机制

**Python 实现位置**: `scripts/utils/rpc.py`

**核心逻辑**:
```python
async def authenticated_rpc_call(...):
    # 第一次请求（使用缓存的 JWT）
    auth_headers = auth.get_auth_header(server_url)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)
    
    # 检测 401 -> 清除过期 token -> 重新认证 -> 重试
    if resp.status_code == 401:
        auth.clear_token(server_url)
        auth_headers = auth.get_auth_header(server_url, force_new=True)
        resp = await client.post(endpoint, json=payload, headers=auth_headers)
    
    # 保存新 JWT
    new_token = auth.update_token(server_url, resp.headers)
    if new_token:
        update_jwt(credential_name, new_token)
    
    return resp.data.result
```

**Node.js 移植状态**: ✅ 已完成
- 文件：`nodejs-client/scripts/utils/rpc.js`
- 测试：`scripts/test_jwt_integration.js` (100% 通过)

---

## 移植建议

### 已完成 (P0)
- ✅ DIDWbaAuthHeader 类
- ✅ generate_auth_header 函数
- ✅ JWT 自动刷新机制
- ✅ 完整测试套件

### 待完成 (P1)
- ⏸️ E2EE 客户端整理
- ⏸️ W3C Proof 整理
- ⏸️ 消息构建和解析

### 建议
1. **保持文件命名一致**: Python 的 `did_wba.py` → Node.js 的 `did_wba.js`
2. **保持函数命名一致**: Python 的 `generate_auth_header` → Node.js 的 `generateAuthHeader`
3. **保持目录结构一致**: Python 的 `authentication/` → Node.js 的 `authentication/`
4. **参考 Python 测试编写 Node.js 测试**: 确保功能一致

---

**分析人**: AI Assistant  
**分析日期**: 2026-03-09  
**用途**: Node.js 移植技术参考
