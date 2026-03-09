# Python vs Node.js DID WBA Authentication - 完整对比

## 1. 已知工作的 Python 请求

```json
{
  "jsonrpc": "2.0",
  "method": "verify",
  "params": {
    "authorization": "DIDWba v=\"1.1\", did=\"did:wba:awiki.ai:user:k1_YyAuYBpZnBFunOHFBOBLmh1WL8kxOe8nvmlWc1MKaXw\", nonce=\"ec216a9c04a953a49a059a95aedacaca\", timestamp=\"2026-03-07T17:43:56Z\", verification_method=\"key-1\", signature=\"jctDEmv8t5FxtRnTE5YGCN00JuGt9kKkGK5Cal0opwoDYQqfS3uNva1WgoAsZwVbqz6QID5cTGiG0Dh3GM9-sQ\"",
    "domain": "awiki.ai"
  },
  "id": 1
}
```

## 2. Python 请求解析

| 字段 | 值 |
|------|-----|
| did | `did:wba:awiki.ai:user:k1_YyAuYBpZnBFunOHFBOBLmh1WL8kxOe8nvmlWc1MKaXw` |
| nonce | `ec216a9c04a953a49a059a95aedacaca` (32 hex chars) |
| timestamp | `2026-03-07T17:43:56Z` |
| domain (aud) | `awiki.ai` (仅域名，无https://) |
| verification_method | `key-1` |
| signature | DER编码 → base64url |

### 2.1 Python 签名数据

**Auth Data (JCS canonicalized)**:
```json
{"aud":"awiki.ai","did":"did:wba:awiki.ai:user:k1_YyAuYBpZnBFunOHFBOBLmh1WL8kxOe8nvmlWc1MKaXw","nonce":"ec216a9c04a953a49a059a95aedacaca","timestamp":"2026-03-07T17:43:56Z"}
```

**SHA-256 Hash**:
```
79489d51a3e7e2e97355adc93562ee995f7962c5b8cd54fc1835ff2ca26f95c6
```

**签名流程**:
1. Python: `hashlib.sha256(canonical_json).digest()` → 32 bytes
2. Python: `private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))` 
   - cryptography 库会在内部对输入进行SHA256哈希
3. Python: DER编码签名
4. Python: base64url编码

## 3. Node.js 当前失败的请求

```json
{
  "jsonrpc": "2.0",
  "method": "verify",
  "params": {
    "authorization": "DIDWba v=\"1.1\", did=\"did:wba:awiki.ai:user:k1_tlypNeWNWl13TZNH3CrlKYSpqrMoEygQqB2bcL5l0ms\", nonce=\"7af3d62372ea0df07fccaceaf862dace\", timestamp=\"2026-03-07T17:50:53Z\", verification_method=\"key-1\", signature=\"Ltge7w7vcpV8up07SVdTs1DKgNxcHEiHb9lo_F-Lo4Viia4pW619NPGlzvJXB_gMHR_Lcj9x8Sp6gwRYqVyOYg\"",
    "domain": "awiki.ai"
  },
  "id": 1
}
```

## 4. 核心差异分析

### 4.1 签名格式

| 实现 | 签名格式 | 编码 |
|------|----------|------|
| Python | DER | base64url |
| Node.js (当前) | R\|\|S | base64url |

**问题**: 服务器期望DER格式还是R||S格式？

从ANP库的`encode_signature`函数看：
- 它尝试解析DER格式
- 如果成功，转为R||S格式
- 然后base64url编码

但服务器端验证时可能直接期望某种格式。

### 4.2 签名算法

Python cryptography:
```python
private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
```

noble-curves:
```javascript
secp256k1.sign(contentHash, privateKeyBytes)
```

两者都会对输入进行内部哈希。问题在于：
- Python: 输入是已经哈希过的32字节，cryptography会再次哈希
- Node.js: 输入是已经哈希过的32字节，noble-curves也会再次哈希

### 4.3 测试结果

使用Python创建的identity + Node.js签名:
- 失败: "Signature verification failed"

使用Python创建的identity + Python签名:
- 成功

这说明问题在于签名过程，而不是DID文档或公钥。

## 5. 需要验证的关键点

1. **签名格式**: 服务器期望DER还是R||S？
2. **哈希次数**: 是否需要双哈希？
3. **其他**: 字段顺序、编码等

## 6. 下一步建议

需要查看awiki.ai服务器的验证代码，或尝试不同的签名格式来确定服务器期望什么。
