# Python 版身份文件管理结构分析

**分析日期**: 2026-03-09  
**目的**: 严格复制 Python 版本的身份文件管理功能

---

## 文件结构

### 目录结构

```
%USERPROFILE%\.openclaw\credentials\awiki-agent-id-message\
├── index.json                  # 身份索引文件
├── .legacy-backup/             # 旧版本备份目录
│
├── k1_<unique_id>/             # 每个身份一个子目录（目录名 = unique_id）
│   ├── identity.json           # 身份基本信息
│   ├── auth.json               # JWT token
│   ├── did_document.json       # DID 文档
│   ├── key-1-private.pem       # 私钥文件
│   ├── key-1-public.pem        # 公钥文件
│   ├── e2ee-signing-private.pem    # E2EE 签名私钥
│   ├── e2ee-agreement-private.pem  # E2EE 密钥协商私钥
│   └── e2ee-state.json         # E2EE 状态
│
└── k1_<unique_id_2>/           # 另一个身份
    └── ...
```

### 文件名常量

```python
INDEX_FILE_NAME = "index.json"
IDENTITY_FILE_NAME = "identity.json"
AUTH_FILE_NAME = "auth.json"
DID_DOCUMENT_FILE_NAME = "did_document.json"
KEY1_PRIVATE_FILE_NAME = "key-1-private.pem"
KEY1_PUBLIC_FILE_NAME = "key-1-public.pem"
E2EE_SIGNING_PRIVATE_FILE_NAME = "e2ee-signing-private.pem"
E2EE_AGREEMENT_PRIVATE_FILE_NAME = "e2ee-agreement-private.pem"
E2EE_STATE_FILE_NAME = "e2ee-state.json"
```

---

## index.json 格式

### Schema Version 3

```json
{
  "schema_version": 3,
  "default_credential_name": "default",
  "credentials": {
    "hyg4awiki": {
      "credential_name": "hyg4awiki",
      "dir_name": "k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw",
      "did": "did:wba:awiki.ai:user:k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw",
      "unique_id": "k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw",
      "user_id": "e9fb8c8f-06c3-4f05-9457-479e1c3a4ef1",
      "name": "hyg4awiki",
      "handle": "hyg4awiki.awiki.ai",
      "created_at": "2026-03-06T13:28:00.030758+00:00",
      "is_default": false
    },
    "default": {
      "credential_name": "default",
      "dir_name": "k1_...",
      "did": "did:wba:...",
      "unique_id": "k1_...",
      "user_id": "uuid",
      "name": "Default",
      "handle": null,
      "created_at": "2026-03-09T00:00:00.000Z",
      "is_default": true
    }
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `schema_version` | int | 索引格式版本（当前为 3） |
| `default_credential_name` | string|null | 默认身份名称 |
| `credentials` | object | 身份列表，key 为身份名称 |

### credentials 条目字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `credential_name` | string | 身份名称（与 key 相同） |
| `dir_name` | string | 子目录名（= unique_id） |
| `did` | string | DID 标识符 |
| `unique_id` | string | 唯一 ID（k1_开头） |
| `user_id` | string|null | 用户 ID（UUID） |
| `name` | string|null | 显示名称 |
| `handle` | string|null | Handle（如 hyg4awiki.awiki.ai） |
| `created_at` | string | 创建时间（ISO 8601） |
| `is_default` | boolean | 是否为默认身份 |

---

## identity.json 格式

```json
{
  "did": "did:wba:awiki.ai:user:k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw",
  "unique_id": "k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw",
  "user_id": "e9fb8c8f-06c3-4f05-9457-479e1c3a4ef1",
  "name": "hyg4awiki",
  "handle": "hyg4awiki.awiki.ai",
  "created_at": "2026-03-06T13:28:00.030758+00:00"
}
```

---

## auth.json 格式

```json
{
  "jwt_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleS1jZDRjYjI3ZiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 目录命名规则

### 子目录名 = unique_id

```python
def preferred_credential_dir_name(*, handle: str | None, unique_id: str) -> str:
    """目录名总是从 unique_id 派生，确保稳定性"""
    if not unique_id:
        raise ValueError("Credential directory name requires unique_id")
    return sanitize_credential_dir_name(unique_id)

def sanitize_credential_dir_name(raw_value: str) -> str:
    """清理目录名，只保留安全字符"""
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", raw_value).strip("._-")
    if not sanitized:
        raise ValueError(f"Unable to derive safe name from: {raw_value!r}")
    return sanitized
```

**示例**:
- `unique_id = "k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw"`
- `dir_name = "k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw"`

---

## 文件权限

Python 版本使用安全权限：

```python
def write_secure_json(path: Path, payload: dict[str, Any]) -> None:
    """Write JSON with 600 permissions (owner read/write only)"""
    write_secure_text(path, json.dumps(payload, indent=2, ensure_ascii=False))

def write_secure_text(path: Path, content: str) -> None:
    """Write text file with 600 permissions"""
    path.write_text(content, encoding="utf-8")
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 0o600
```

**权限**: `0o600` (只有所有者可读写)

---

## 凭证根目录

```python
def _get_credentials_root(config: SDKConfig | None = None) -> Path:
    """Return the credential storage root directory."""
    resolved_config = config or SDKConfig()
    return resolved_config.credentials_dir
```

**默认路径**:
- Windows: `C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\`
- Linux/macOS: `~/.openclaw/credentials/awiki-agent-id-message/`

---

## JWT 有效期

### 服务端决定

**JWT 有效期由 awiki.ai 服务端决定**，客户端**无法设置**。

**当前有效期**: ~60 分钟（从测试观察）

### 刷新机制

1. **被动刷新**: 401 后自动获取新 JWT
2. **主动刷新**: 调用 `setup_identity.py --load <name>`

### 无法自定义有效期

Python 代码中没有设置 JWT 有效期的参数。`get_jwt_via_wba()` 函数只是从服务端获取 JWT，无法指定期限。

---

## Node.js 版本需要实现的功能

### 1. 目录结构

```javascript
const FILE_NAMES = {
    INDEX: 'index.json',
    IDENTITY: 'identity.json',
    AUTH: 'auth.json',
    DID_DOCUMENT: 'did_document.json',
    KEY1_PRIVATE: 'key-1-private.pem',
    KEY1_PUBLIC: 'key-1-public.pem',
    E2EE_SIGNING_PRIVATE: 'e2ee-signing-private.pem',
    E2EE_AGREEMENT_PRIVATE: 'e2ee-agreement-private.pem',
    E2EE_STATE: 'e2ee-state.json'
};
```

### 2. index.json 管理

```javascript
function loadIndex() {
    const indexPath = path.join(getCredentialsDir(), 'index.json');
    if (!fs.existsSync(indexPath)) {
        return {
            schema_version: 3,
            default_credential_name: null,
            credentials: {}
        };
    }
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

function saveIndex(index) {
    const indexPath = path.join(getCredentialsDir(), 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), {
        mode: 0o600
    });
}

function setIndexEntry(name, entry) {
    const index = loadIndex();
    index.credentials[name] = {
        ...entry,
        credential_name: name,
        is_default: name === index.default_credential_name
    };
    saveIndex(index);
}
```

### 3. 身份保存

```javascript
function saveIdentity(options) {
    const {
        did,
        uniqueId,
        userId,
        privateKeyPem,
        publicKeyPem,
        jwtToken,
        displayName,
        handle,
        name = 'default',
        didDocument,
        e2eeSigningPrivatePem,
        e2eeAgreementPrivatePem
    } = options;
    
    // 目录名 = unique_id
    const dirName = uniqueId;
    const credDir = path.join(getCredentialsDir(), dirName);
    
    // 创建目录 (0o700)
    fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
    
    // identity.json
    writeSecureJson(path.join(credDir, 'identity.json'), {
        did,
        unique_id: uniqueId,
        user_id: userId,
        name: displayName,
        handle,
        created_at: new Date().toISOString()
    });
    
    // auth.json
    if (jwtToken) {
        writeSecureJson(path.join(credDir, 'auth.json'), {
            jwt_token: jwtToken
        });
    }
    
    // did_document.json
    if (didDocument) {
        writeSecureJson(path.join(credDir, 'did_document.json'), didDocument);
    }
    
    // 密钥文件
    writeSecureText(path.join(credDir, 'key-1-private.pem'), privateKeyPem);
    writeSecureText(path.join(credDir, 'key-1-public.pem'), publicKeyPem);
    
    if (e2eeSigningPrivatePem) {
        writeSecureText(
            path.join(credDir, 'e2ee-signing-private.pem'),
            e2eeSigningPrivatePem
        );
    }
    
    if (e2eeAgreementPrivatePem) {
        writeSecureText(
            path.join(credDir, 'e2ee-agreement-private.pem'),
            e2eeAgreementPrivatePem
        );
    }
    
    // 更新 index.json
    setIndexEntry(name, {
        dir_name: dirName,
        did,
        unique_id: uniqueId,
        user_id: userId,
        name: displayName,
        handle,
        created_at: new Date().toISOString(),
        is_default: name === 'default'
    });
}
```

### 4. 身份加载

```javascript
function loadIdentity(name) {
    const index = loadIndex();
    const entry = index.credentials[name];
    
    if (!entry) {
        return null;
    }
    
    const credDir = path.join(getCredentialsDir(), entry.dir_name);
    
    // 加载 identity.json
    const identityPath = path.join(credDir, 'identity.json');
    if (!fs.existsSync(identityPath)) {
        return null;
    }
    
    const identity = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
    
    // 加载 auth.json (JWT)
    const authPath = path.join(credDir, 'auth.json');
    if (fs.existsSync(authPath)) {
        const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
        identity.jwt_token = auth.jwt_token;
    }
    
    // 加载 DID 文档
    const didDocPath = path.join(credDir, 'did_document.json');
    if (fs.existsSync(didDocPath)) {
        identity.did_document = JSON.parse(fs.readFileSync(didDocPath, 'utf-8'));
    }
    
    // 加载私钥（用于 JWT 刷新）
    const keyPath = path.join(credDir, 'key-1-private.pem');
    if (fs.existsSync(keyPath)) {
        identity.private_key_pem = fs.readFileSync(keyPath, 'utf-8');
    }
    
    return identity;
}
```

### 5. 调试模式 vs 生产模式

```javascript
function getCredentialsDir() {
    if (process.env.NODE_AWIKI_DEBUG === 'true') {
        // 调试模式：本地 .credentials 目录
        const debugDir = path.join(process.cwd(), '.credentials');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true, mode: 0o700 });
        }
        return debugDir;
    } else {
        // 生产模式：系统凭证目录（与 Python 共用）
        return path.join(
            process.env.USERPROFILE || process.env.HOME,
            '.openclaw',
            'credentials',
            'awiki-agent-id-message'
        );
    }
}
```

---

## JWT 有效期说明

### 无法自定义

**重要**: JWT 有效期由 awiki.ai 服务端决定，客户端无法设置。

**当前有效期**: ~60 分钟

### 调试模式建议

由于无法设置 JWT 有效期，调试模式下建议：

1. **频繁刷新**: 使用 `setup_identity.js --load <name>` 刷新 JWT
2. **自动刷新**: 实现 401 自动刷新机制
3. **使用短期测试账号**: 创建专门用于调试的账号

---

**分析完成时间**: 2026-03-09  
**状态**: ⏳ 需要实现完整的 Node.js 版本
