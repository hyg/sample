# Bug 修复总结 - did:wba DID 格式

## 问题

用户执行 `/create wba x25519` 生成了错误的 DID：
```
did:wba:eth:x25519  ❌ 错误格式
```

## 正确的 did:wba 格式（符合 ANP 规范）

```
did:wba:example.com                    ✅
did:wba:example.com:user:alice         ✅
did:wba:example.com%3A8800:user:alice  ✅ (带端口)
```

**关键区别**:
- ❌ **错误**: 使用链名和密钥类型作为路径 (`eth:x25519`)
- ✅ **正确**: 使用域名和可选路径 (`example.com:user:alice`)

## 修复内容

### 1. CLI 参数解析 (`src/cli.js`)

**修复前**:
```javascript
/create wba x25519  // 生成 did:wba:eth:x25519 ❌
```

**修复后**:
```javascript
/create wba example.com         // 生成 did:wba:example.com ✅
/create wba example.com p256    // 生成 did:wba:example.com (P-256) ✅
```

### 2. DID 生成器 (`src/did/did-wba.js`)

**修复前**:
```javascript
generate(domain = 'eth', path = null, keyType = 'x25519')
// domain 有默认值，导致可以不提供域名
```

**修复后**:
```javascript
generate(options = {}) {
  const { domain, path, keyType } = options;
  if (!domain) {
    throw new Error('did:wba requires a domain name');
  }
  // ...
}
```

## 使用方法

### 创建 did:wba 身份

```bash
# 基本用法（X25519 密钥）
/create wba example.com

# 指定密钥类型（P-256 密钥）
/create wba example.com p256

# 带路径的 DID
/create wba example.com:user:alice
```

### 示例输出

```
> /create wba example.com

[身份] 创建新的 wba (example.com) 身份...

✓ 身份创建成功!
  DID: did:wba:example.com
  密钥类型：x25519

  请保存以下信息:
  ────────────────────────────────────────
  {
  "did": "did:wba:example.com",
  "method": "wba",
  "privateKey": "3c6ec92585d7df162715f01b3ebc9caf94fed2dcade9d7bdc2a9b9dd3871e4bf",
  "publicKey": "d3e037f8db97a79c14a295edf4e3311e811c8b6f394d07cc0f0d9a12177a5a1d",
  "keyType": "x25519",
  "domain": "example.com"
}
  ────────────────────────────────────────
```

## 帮助信息更新

```
/create p256                    - 创建 did:key 身份 (P-256 密钥)
/create ethr                    - 创建 did:ethr 身份 (X25519 密钥)
/create wba example.com         - 创建 did:wba 身份 (X25519 密钥)

指定密钥类型:
  /create ethr x25519           - 创建 did:ethr 身份 (X25519 密钥)
  /create wba example.com p256  - 创建 did:wba 身份 (P-256 密钥)
```

## 验证

```bash
# 测试 1: 创建基本 did:wba 身份
/create wba example.com
# 预期输出：did:wba:example.com

# 测试 2: 创建带路径的 did:wba 身份
/create wba example.com:user:alice
# 预期输出：did:wba:example.com:user:alice

# 测试 3: 不带域名（应报错）
/create wba
# 预期输出：[错误] 创建 did:wba 需要指定域名
```

## 相关文件

- `src/cli.js` - CLI 参数解析
- `src/did/did-wba.js` - DID 生成器
- `src/did/manager.js` - DID 管理器

## 参考规范

- [ANP DID:WBA Method Specification](https://www.agent-network-protocol.com/specs/did-method)
- [W3C DID Core Specification](https://www.w3.org/TR/did-core/)
