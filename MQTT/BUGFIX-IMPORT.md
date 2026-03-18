# Bug 修复总结

## 问题：CLI 启动失败

### 错误信息
```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './x25519' is not defined by "exports" in D:\huangyg\git\sample\MQTT\node_modules\@noble\curves\package.json
```

### 原因分析

`@noble/curves` 包的 `package.json` 的 `exports` 字段没有定义 `./x25519` 子路径。

在 `@noble/curves` 包中，X25519 功能是从 `ed25519` 模块导出的，而不是独立的子路径。

### 解决方案

将所有 `import { x25519 } from '@noble/curves/x25519'` 改为 `import { x25519 } from '@noble/curves/ed25519'`

### 修复的文件

1. `src/did/did-wba.js` - 第 20 行
2. `src/did/verification-manager.js` - 第 15 行

### 验证

```bash
node src/cli.js
# 应该正常启动，显示欢迎界面
```

## @noble/curves 包导出规则

### 正确的导入路径

| 功能 | 正确的导入路径 | 错误的导入路径 |
|------|---------------|---------------|
| X25519 | `@noble/curves/ed25519` | ❌ `@noble/curves/x25519` |
| Ed25519 | `@noble/curves/ed25519` | ✅ |
| Ed448 | `@noble/curves/ed448` | ✅ |
| P-256 | `@noble/curves/p256` | ✅ |
| P-384 | `@noble/curves/p384` | ✅ |
| P-521 | `@noble/curves/p521` | ✅ |
| secp256k1 | `@noble/curves/secp256k1` | ✅ |

### 检查方法

```bash
# 查看包的导出配置
powershell -Command "Get-Content 'node_modules\@noble\curves\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty exports"
```

### 注意事项

1. **X25519 特殊处理**: X25519 从 `ed25519` 模块导出，不是独立路径
2. **检查 exports**: 导入前检查 `package.json` 的 `exports` 字段
3. **版本兼容**: 不同版本的 `@noble/curves` 可能有不同的导出规则
