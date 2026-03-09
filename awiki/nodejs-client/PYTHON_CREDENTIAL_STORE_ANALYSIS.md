# Python 版身份文件管理分析

**分析日期**: 2026-03-09  
**目的**: 严格复制 Python 版本的身份文件管理功能到 Node.js

---

## Python 版本身份管理结构

### 文件位置

**凭证目录**: `C:\Users\hyg\.openclaw\credentials\awiki-agent-id-message\`

### 文件结构（新版本）

```
awiki-agent-id-message/
├── index.json              # 身份索引（包含所有身份列表）
├── k1_<fingerprint>/       # 每个身份一个子目录
│   ├── identity.json       # 身份基本信息
│   ├── auth.json           # JWT token
│   ├── did_document.json   # DID 文档
│   ├── key1_private.pem    # 私钥
│   ├── key1_public.pem     # 公钥
│   ├── e2ee_signing_private.pem    # E2EE 签名私钥
│   └── e2ee_agreement_private.pem  # E2EE 密钥协商私钥
└── ...
```

### identity.json 内容

```json
{
  "did": "did:wba:awiki.ai:user:k1_...",
  "unique_id": "k1_...",
  "user_id": "uuid-string",
  "name": "Display Name",
  "handle": "handle.awiki.ai",
  "created_at": "2026-03-09T00:00:00.000Z"
}
```

### auth.json 内容

```json
{
  "jwt_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### index.json 内容

```json
{
  "default": {
    "credential_name": "default",
    "dir_name": "k1_...",
    "did": "did:wba:...",
    "unique_id": "k1_...",
    "user_id": "uuid",
    "name": "Name",
    "handle": "handle",
    "created_at": "2026-03-09T00:00:00.000Z",
    "is_default": true
  },
  "hyg4awiki": { ... }
}
```

---

## JWT 有效期说明

### 服务端决定

**JWT 有效期由 awiki.ai 服务端决定**，客户端无法设置。

**当前有效期**: 约 60 分钟（从测试观察）

### JWT 刷新机制

**Python 版本的 401 处理** (`utils/rpc.py`):

```python
if resp.status_code == 401:
    auth.clear_token(server_url)
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 从响应头获取新 JWT
auth_header_value = resp.headers.get("authorization", "")
new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
```

**关键点**:
1. 401 后清除缓存 JWT
2. 生成 DID WBA 签名头
3. 重试请求
4. **期望服务端在响应头返回新 JWT**

### 主动获取 JWT

如果服务端不返回 JWT，需要主动调用 `verify` 接口：

```python
async def get_jwt_via_wba(client, identity, domain):
    auth_header = generate_wba_auth_header(identity, domain)
    result = await rpc_call(
        client,
        "/user-service/did-auth/rpc",
        "verify",
        {"authorization": auth_header, "domain": domain}
    )
    return result["access_token"]
```

---

## Node.js 版本需要实现的功能

### 1. 凭证目录管理

```javascript
// credential_store.js
function getCredentialsDir() {
    if (isDebugMode()) {
        return path.join(process.cwd(), '.credentials');
    } else {
        return path.join(
            process.env.USERPROFILE || process.env.HOME,
            '.openclaw',
            'credentials',
            'awiki-agent-id-message'
        );
    }
}
```

### 2. 身份索引管理

```javascript
// index.json 管理
function getIndex() {
    const indexPath = path.join(getCredentialsDir(), 'index.json');
    if (fs.existsSync(indexPath)) {
        return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    }
    return {};
}

function setIndexEntry(name, entry) {
    const index = getIndex();
    index[name] = entry;
    const indexPath = path.join(getCredentialsDir(), 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
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
    
    const dirName = `k1_${uniqueId.split(':')[1] || uniqueId}`;
    const credDir = path.join(getCredentialsDir(), dirName);
    
    // 创建目录
    fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
    
    // 保存 identity.json
    writeSecureJson(path.join(credDir, 'identity.json'), {
        did,
        unique_id: uniqueId,
        user_id: userId,
        name: displayName,
        handle,
        created_at: new Date().toISOString()
    });
    
    // 保存 auth.json
    if (jwtToken) {
        writeSecureJson(path.join(credDir, 'auth.json'), {
            jwt_token: jwtToken
        });
    }
    
    // 保存 DID 文档
    if (didDocument) {
        writeSecureJson(path.join(credDir, 'did_document.json'), didDocument);
    }
    
    // 保存密钥
    writeSecureText(path.join(credDir, 'key1_private.pem'), privateKeyPem);
    writeSecureText(path.join(credDir, 'key1_public.pem'), publicKeyPem);
    
    if (e2eeSigningPrivatePem) {
        writeSecureText(
            path.join(credDir, 'e2ee_signing_private.pem'),
            e2eeSigningPrivatePem
        );
    }
    
    if (e2eeAgreementPrivatePem) {
        writeSecureText(
            path.join(credDir, 'e2ee_agreement_private.pem'),
            e2eeAgreementPrivatePem
        );
    }
    
    // 更新索引
    setIndexEntry(name, {
        credential_name: name,
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
    const index = getIndex();
    const entry = index[name];
    
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
    
    // 加载 auth.json
    const authPath = path.join(credDir, 'auth.json');
    if (fs.existsSync(authPath)) {
        const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
        identity.jwt_token = auth.jwt_token;
    }
    
    // 加载 DID 文档
    const didDocPath = path.join(credDir, 'did_document.json');
    if (fs.existsSync(didDocPath)) {
        identity.did_document = JSON.parse(
            fs.readFileSync(didDocPath, 'utf-8')
        );
    }
    
    // 加载私钥（用于 JWT 刷新）
    const keyPath = path.join(credDir, 'key1_private.pem');
    if (fs.existsSync(keyPath)) {
        identity.private_key_pem = fs.readFileSync(keyPath, 'utf-8');
    }
    
    return identity;
}
```

### 5. JWT 自动刷新

```javascript
// auth.js
async function getJwtViaWba(userServiceUrl, didDocument, privateKeyPem, domain) {
    // 生成 DID WBA 签名头
    const authHeader = generateWbaAuthHeader(
        didDocument,
        privateKeyPem,
        domain
    );
    
    // 调用 verify 接口
    const response = await axios.post(
        userServiceUrl,
        {
            jsonrpc: '2.0',
            method: 'verify',
            params: {
                authorization: authHeader,
                domain: domain
            },
            id: 1
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
    
    if (response.data.error) {
        throw new Error(response.data.error.message);
    }
    
    return response.data.result.access_token;
}

// rpc.js - 401 处理
if (resp.status === 401) {
    if (auth) {
        auth.clearToken(serverUrl);
        
        // 主动获取新 JWT
        const identity = loadIdentity(credentialName);
        if (identity && identity.private_key_pem) {
            const newJwt = await getJwtViaWba(
                serverUrl.replace('/message/rpc', '/user-service/did-auth/rpc'),
                identity.did_document,
                identity.private_key_pem,
                'awiki.ai'
            );
            
            // 保存新 JWT
            const authPath = path.join(
                getCredentialsDir(),
                identity.dir_name,
                'auth.json'
            );
            writeSecureJson(authPath, { jwt_token: newJwt });
            
            // 用新 JWT 重试
            authHeaders = { 'Authorization': `Bearer ${newJwt}` };
            resp = await client.post(endpoint, payload, { headers: authHeaders });
        }
    }
}
```

---

## 调试模式 vs 生产模式

### 环境变量

```bash
# 调试模式
set NODE_AWIKI_DEBUG=true

# 生产模式（默认）
set NODE_AWIKI_DEBUG=
```

### 凭证目录

| 模式 | 目录 | 用途 |
|------|------|------|
| **调试** | `./nodejs-awiki/.credentials/` | 开发测试 |
| **生产** | `%USERPROFILE%\.openclaw\credentials\...` | 正式使用 |

---

## JWT 有效期说明

### 无法自定义

**JWT 有效期由 awiki.ai 服务端决定**，客户端无法设置。

**当前有效期**: ~60 分钟

### 建议

1. **调试模式**: 频繁使用 `setup_identity.js --load <name>` 刷新 JWT
2. **生产模式**: 实现 401 自动刷新机制

---

**分析完成时间**: 2026-03-09  
**状态**: ⏳ 需要实现完整的身份管理功能
