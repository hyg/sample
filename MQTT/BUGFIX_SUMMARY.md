# Bug 修复总结

## 修复的 Bug 列表

### 1. CLI 公钥格式验证问题
**问题**: 用户在 CLI 中输入 P-256 格式的公钥（33 字节）时，系统没有正确处理，导致加密失败

**现象**: 
```
[警告] 检测到 P-256 压缩公钥 (33字节)，自动去掉前缀
[连接] 伙伴公钥已设置 (长度: 32 字节)
...
[E2EE] Sent e2ee_msg to did:key:...
[RPC] Request error: DOMException [OperationError]: The operation failed for an operation-specific reason
```

**修复**: 
- 在 `setPartnerPublicKey` 函数中添加公钥格式验证
- 自动检测并处理 P-256 压缩公钥（以 0x02 或 0x03 开头）
- 验证公钥长度必须为 32 字节（X25519）

**文件**: `src/cli.js:207-230`

### 2. HPKE 加密函数缺少输入验证
**问题**: `kemEncrypt` 函数没有验证公钥长度，导致加密失败时错误信息不明确

**修复**:
- 在 `kemEncrypt` 函数中添加公钥长度验证
- 如果公钥长度不是 32 字节，抛出明确的错误信息

**文件**: `src/e2ee/hpke-native.js:100-116`

### 3. CLI DID 方法生成错误
**问题**: 用户执行 `/create ethr` 命令时，代码错误地调用了 `didManager.generate('key', { keyType: 'ethr' })`，导致创建的是 did:key 身份而不是 did:ethr 身份

**现象**:
```
> /create ethr
[身份] 创建新的 ethr 身份...
✓ 身份创建成功!
  DID: did:key:DnaeVJuMpauUoNePijhE5AaAdhMeraR6gBQE9zHBNMmHFaJY
  密钥类型：ethr
```

**修复**:
- 修正 `createIdentity` 函数的参数解析逻辑
- 支持多种创建格式：
  - `/create x25519` - 创建 did:key 身份 (X25519 密钥)
  - `/create p256` - 创建 did:key 身份 (P-256 密钥)
  - `/create ethr` - 创建 did:ethr 身份 (X25519 密钥)
  - `/create wba` - 创建 did:wba 身份 (X25519 密钥)
  - `/create ethr x25519` - 创建 did:ethr 身份 (指定密钥类型)

**文件**: `src/cli.js:92-120`

### 4. HPKE-RFC9180 文件导入问题
**问题**: `hpke-rfc9180.js` 中存在重复导出和错误的导入路径

**修复**:
- 重命名导入的 `hkdf` 为 `nobleHkdf` 避免命名冲突
- 移除重复的导出语句 (`KEM`, `KDF`, `Mode`, `AEAD`)
- 修正 `x25519` 导入路径为 `@noble/curves/ed25519.js`

**文件**: `src/e2ee/hpke-rfc9180.js`

### 5. 测试脚本 API 不匹配
**问题**: 测试脚本使用了不存在的 `hpke.setupR()` 方法

**修复**: 改为使用 `hpke.setupBaseR()`

**文件**: `tests/test-hpke.js`

## 测试验证

### 所有测试通过
- ✅ 身份管理测试: 29/29 通过
- ✅ HPKE 加密测试: 15/15 通过
- ✅ 跨 DID 通信测试: 13/13 通过
- ✅ 私聊 E2EE 测试: 13/13 通过
- ✅ 群聊 E2EE 测试: 22/22 通过
- ✅ MQTT 集成测试: 8/8 通过
- **总计: 100/100 通过，成功率 100%**

### 新增测试
- `tests/test-cli-public-key.js` - 验证公钥处理逻辑
- `tests/test-cross-did-cli.js` - 验证跨 DID 通信流程

## 使用建议

### 创建身份的正确格式
```bash
# 创建 did:key 身份 (X25519)
/create x25519

# 创建 did:ethr 身份
/create ethr

# 创建 did:wba 身份
/create wba

# 创建 did:ethr 身份并指定密钥类型
/create ethr x25519
```

### 设置公钥的注意事项
- 项目使用 X25519 格式的公钥（32 字节）
- 如果用户提供 P-256 压缩公钥（33 字节，以 0x02 或 0x03 开头），系统会自动去掉前缀
- 确保公钥是有效的十六进制字符串

## 后续改进建议

1. **用户教育**: 在 CLI 中添加更详细的公钥格式说明
2. **文档更新**: 在 README 中说明支持的 DID 方法和公钥格式
3. **错误处理**: 提供更友好的错误信息，指导用户正确输入
4. **边界测试**: 测试更多边界情况，如无效的十六进制字符串等

## 修复日期
2026-03-17