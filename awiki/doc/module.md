# @awiki/module 项目设计文档

## 1. 项目概述

### 1.1 项目名称

**@awiki/module** (npm 包名)

### 1.2 项目目标

将 Python 版本的 `utils` 目录下所有模块移植为 JavaScript，保持功能和接口不变。

### 1.3 项目结构

```
module/
├── package.json
├── src/
│   ├── index.js          # 包入口
│   ├── auth.js           # 认证模块
│   ├── client.js         # HTTP 客户端
│   ├── config.js         # 配置管理
│   ├── e2ee.js           # E2EE 加密
│   ├── handle.js         # Handle 管理
│   ├── identity.js       # DID 身份创建
│   ├── resolve.js        # 标识符解析
│   ├── rpc.js            # JSON-RPC 客户端
│   └── ws.js             # WebSocket 客户端
├── types/                # TypeScript 类型定义
├── tests/                # 测试文件
└── docs/                 # 文档
```

---

## 2. 模块移植概览

### 2.1 已设计文档的模块

| 模块 | Python 源文件 | JS 目标文件 | 设计文档 |
|------|--------------|-------------|----------|
| auth | utils/auth.py | src/auth.js | [doc/util/auth/js.md](util/auth/js.md) |
| client | utils/client.py | src/client.js | [doc/util/client/js.md](util/client/js.md) |
| config | utils/config.py | src/config.js | [doc/util/config/js.md](util/config/js.md) |
| identity | utils/identity.py | src/identity.js | [doc/util/identity/js.md](util/identity/js.md) |

### 2.2 已完成设计文档的模块

| 模块 | Python 源文件 | JS 目标文件 | 说明 | 设计文档 |
|------|--------------|-------------|------|---------|
| e2ee | utils/e2ee.py | src/e2ee.js | E2EE 端到端加密 | [util/e2ee/js.md](util/e2ee/js.md) ✅ |
| handle | utils/handle.py | src/handle.js | Handle 注册和解析 | [util/handle/js.md](util/handle/js.md) ✅ |
| resolve | utils/resolve.py | src/resolve.js | 标识符解析 | [util/resolve/js.md](util/resolve/js.md) ✅ |
| rpc | utils/rpc.py | src/rpc.js | JSON-RPC 客户端 | [util/rpc/js.md](util/rpc/js.md) ✅ |
| ws | utils/ws.py | src/ws.js | WebSocket 客户端 | [util/ws/js.md](util/ws/js.md) ✅ |
| logging_config | utils/logging_config.py | src/logging.js | 日志配置 | [util/logging_config/js.md](util/logging_config/js.md) ✅ |

---

## 3. 通用设计规范

### 3.1 模块导出格式

所有模块使用 ES Module 格式导出：

```javascript
// 命名导出
export { functionName, ClassName, CONSTANT };

// 默认导出
export default { functionName, ClassName };
```

### 3.2 函数命名规范

Python (snake_case) -> JavaScript (camelCase):

| Python | JavaScript |
|--------|------------|
| `register_did` | `registerDid` |
| `create_identity` | `createIdentity` |
| `get_jwt_via_wba` | `getJwtViaWba` |

### 3.3 类型定义

所有模块提供 TypeScript 类型定义：

```typescript
// types/module.d.ts
export function functionName(param: Type): ReturnType;
export class ClassName { ... }
```

---

## 4. 依赖关系

### 4.1 第三方依赖

```json
{
  "dependencies": {
    "@noble/curves": "^1.0.0",
    "@noble/hashes": "^1.0.0",
    "@noble/hpke": "^1.0.0",
    "axios": "^1.6.0",
    "ws": "^8.14.0"
  }
}
```

### 4.2 Python 依赖映射

| Python 库 | Node.js 替代 | 说明 | 状态 |
|-----------|-------------|------|------|
| `anp` (authentication) | `@awiki/anp-auth` | DID WBA 认证 | ⏳ 需要移植 |
| `anp` (e2e_encryption_hpke) | `@awiki/anp-hpke` | HPKE 加密 | ⏳ 需要移植 |
| `httpx` | `axios` | HTTP 客户端 | ✅ 成熟替代 |
| `websockets` | `ws` | WebSocket 客户端 | ✅ 成熟替代 |
| `cryptography` | `@noble/curves` + Web Crypto | 加密原语 | ✅ 成熟替代 |

详细依赖设计见：[DEPENDENCIES.md](DEPENDENCIES.md)

### 4.3 依赖树

```
@awiki/module
├── @noble/curves       # 椭圆曲线加密 (secp256k1, secp256r1, X25519)
├── @noble/hashes       # 哈希函数 (SHA-256 等)
├── @noble/hpke         # HPKE 加密协议
├── axios               # HTTP 客户端 (替代 httpx)
└── ws                  # WebSocket 客户端 (替代 websockets)
```

---

## 5. 实现优先级

### Phase 1: 基础模块 (Week 1)
1. **config.js** - 配置管理（无外部依赖）
2. **rpc.js** - JSON-RPC 客户端（依赖 client）
3. **client.js** - HTTP 客户端（依赖 config）

### Phase 2: 身份模块 (Week 2)
4. **identity.js** - DID 身份创建（依赖 ANP）
5. **auth.js** - 认证模块（依赖 identity, rpc）
6. **handle.js** - Handle 管理（依赖 auth, identity）

### Phase 3: 通信模块 (Week 3)
7. **ws.js** - WebSocket 客户端
8. **resolve.js** - 标识符解析
9. **logging.js** - 日志配置

### Phase 4: E2EE 模块 (Week 4)
10. **e2ee.js** - E2EE 加密（最复杂，依赖 ANP）

---

## 6. 测试策略

### 6.1 单元测试

```javascript
// tests/auth.test.js
import { describe, it, expect } from '@jest/globals';
import { generateWbaAuthHeader } from '../src/auth.js';

describe('auth module', () => {
    it('should generate WBA auth header', async () => {
        // ...
    });
});
```

### 6.2 集成测试

```javascript
// tests/integration/identity.test.js
import { describe, it, expect } from '@jest/globals';
import { createIdentity } from '../src/identity.js';

describe('Identity Integration', () => {
    it('should create and register identity', async () => {
        // ...
    });
});
```

### 6.3 互操作测试

验证与 Python 版本的互操作性：

```javascript
// tests/interop/e2ee.test.js
// JavaScript 客户端发送的消息应该能被 Python 客户端解密
```

---

## 7. 构建和发布

### 7.1 package.json

```json
{
  "name": "@awiki/module",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.js",
  "types": "./types/index.d.ts",
  "exports": {
    ".": {
      "import": "./src/index.js",
      "types": "./types/index.d.ts"
    }
  },
  "files": [
    "src/",
    "types/",
    "package.json"
  ]
}
```

### 7.2 构建步骤

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 类型检查
npm run type-check

# 发布到 npm
npm publish --access public
```

---

## 8. 风险和挑战

### 8.1 技术风险

1. **ANP 库移植**: `anp.authentication` 和 `anp.e2e_encryption_hpke` 需要完整移植
2. **加密兼容性**: JavaScript 和 Python 的加密实现需要完全兼容
3. **性能**: JavaScript 的加密性能可能低于 Python

### 8.2 缓解措施

1. 使用成熟的加密库（`@noble/curves`）
2. 使用 Web Crypto API 进行硬件加速
3. 保持协议和格式完全一致

---

## 9. 模块详细设计索引

### 9.1 已完成的模块设计

| 模块 | 设计文档 | 状态 |
|------|----------|------|
| auth | [util/auth/js.md](util/auth/js.md) | ✅ 完成 |
| client | [util/client/js.md](util/client/js.md) | ✅ 完成 |
| config | [util/config/js.md](util/config/js.md) | ✅ 完成 |
| identity | [util/identity/js.md](util/identity/js.md) | ✅ 完成 |

### 9.2 已完成的模块设计

| 模块 | 设计文档 | 状态 |
|------|----------|------|
| e2ee | [util/e2ee/js.md](util/e2ee/js.md) | ✅ 完成 |
| handle | [util/handle/js.md](util/handle/js.md) | ✅ 完成 |
| resolve | [util/resolve/js.md](util/resolve/js.md) | ✅ 完成 |
| rpc | [util/rpc/js.md](util/rpc/js.md) | ✅ 完成 |
| ws | [util/ws/js.md](util/ws/js.md) | ✅ 完成 |
| logging_config | [util/logging_config/js.md](util/logging_config/js.md) | ✅ 完成 |

---

## 10. 开发检查清单

### 10.1 代码质量

- [ ] ESLint 配置
- [ ] Prettier 配置
- [ ] 代码审查流程

### 10.2 测试覆盖

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试
- [ ] 互操作测试

### 10.3 文档

- [ ] API 文档
- [ ] 使用示例
- [ ] 迁移指南

### 10.4 发布准备

- [ ] npm 包配置
- [ ] TypeScript 类型定义
- [ ] CHANGELOG

---

## 11. 时间估算

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 1 | 基础模块 (config, client, rpc) | 1 周 |
| Phase 2 | 身份模块 (identity, auth, handle) | 1 周 |
| Phase 3 | 通信模块 (ws, resolve, logging) | 1 周 |
| Phase 4 | E2EE 模块 (e2ee) | 2 周 |
| Phase 5 | 测试和文档 | 1 周 |
| **总计** | | **6 周** |
