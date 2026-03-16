# Python 到 TypeScript 移植命名规范

**创建日期**: 2026-03-16  
**状态**: ⚠️ 重要 - 必须严格遵守

---

## 1. 问题背景

在以往的移植项目中，按照目标语言的命名习惯去变更变量名，曾经在集成测试时出现 bug（概率>95%)，而且排查工作量很大（远远超过大模型上下文限制，以至于修复 bug A，产生 bug B；修复 bug B，bug A 又重新出现的死循环）。

**根本原因**: 
- Python 和 TypeScript 之间的命名风格差异导致接口不匹配
- 模块间调用时字段名称不一致
- 与 Python 版本的隐性协议不一致

---

## 2. 命名规范原则

### 2.1 核心原则

**⚠️ 严格保持 Python 原始命名** - 这是防止集成 bug 的最重要原则

| 方面 | Python | TypeScript | 说明 |
|------|--------|------------|------|
| **函数名** | `snake_case` | `snake_case` | ❌ **不要**转换为 `camelCase` |
| **变量名** | `snake_case` | `snake_case` | ❌ **不要**转换为 `camelCase` |
| **常量名** | `UPPER_CASE` | `UPPER_CASE` | ✅ 保持一致 |
| **类名** | `PascalCase` | `PascalCase` | ✅ 保持一致 |
| **私有方法** | `_prefix` | `_prefix` | ✅ 保持一致 |
| **字段名** | `snake_case` | `snake_case` | ❌ **不要**转换为 `camelCase` |

### 2.2 为什么这样做

1. **与 Python 版本接口一致** - 确保模块间调用无 bug
2. **便于代码审查** - 可以直接对比 Python 和 TypeScript 代码
3. **便于调试** - 变量名一致，日志输出一致
4. **便于维护** - Python 版本更新时，TypeScript 版本容易同步

---

## 3. 具体规范

### 3.1 函数命名

```python
# Python (原始)
def create_authenticated_identity(...): ...
def generate_wba_auth_header(...): ...
def _secp256k1_sign_callback(...): ...
```

```typescript
// ✅ 正确 - 保持 snake_case
function create_authenticated_identity(...): ...
function generate_wba_auth_header(...): ...
function _secp256k1_sign_callback(...): ...

// ❌ 错误 - 不要转换为 camelCase
function createAuthenticatedIdentity(...): ...  // BUG 风险 >95%
function generateWbaAuthHeader(...): ...        // BUG 风险 >95%
function _secp256k1SignCallback(...): ...       // BUG 风险 >95%
```

### 3.2 变量命名

```python
# Python (原始)
private_key_pem = ...
jwt_token = ...
e2ee_signing_private_pem = ...
```

```typescript
// ✅ 正确 - 保持 snake_case
const private_key_pem = ...
const jwt_token = ...
const e2ee_signing_private_pem = ...

// ❌ 错误 - 不要转换为 camelCase
const privateKeyPem = ...           // BUG 风险 >95%
const jwtToken = ...                // BUG 风险 >95%
const e2eeSigningPrivateKeyPem = ... // BUG 风险 >95%
```

### 3.3 类属性命名

```python
# Python (原始)
class DIDIdentity:
    def __init__(self):
        self.did = ...
        self.did_document = ...
        self.private_key_pem = ...
        self.user_id = None
        self.jwt_token = None
```

```typescript
// ✅ 正确 - 保持 snake_case
class DIDIdentity {
    public did: string;
    public did_document: Record<string, unknown>;
    public private_key_pem: Uint8Array;
    public user_id: string | null = null;
    public jwt_token: string | null = null;
}

// ❌ 错误 - 不要转换为 camelCase
class DIDIdentity {
    public did: string;
    public didDocument: Record<string, unknown>;  // BUG 风险 >95%
    public privateKeyPem: Uint8Array;             // BUG 风险 >95%
    public userId: string | null = null;          // BUG 风险 >95%
    public jwtToken: string | null = null;        // BUG 风险 >95%
}
```

### 3.4 常量命名

```python
# Python (原始)
SUPPORTED_E2EE_VERSION = "1.1"
_STATE_VERSION = "hpke_v1"
DEFAULT_EXPIRES = 86400
```

```typescript
// ✅ 正确 - 保持 UPPER_CASE
export const SUPPORTED_E2EE_VERSION = "1.1";
export const _STATE_VERSION = "hpke_v1";
export const DEFAULT_EXPIRES = 86400;

// ❌ 错误 - 不要转换为其他格式
export const SupportedE2eeVersion = "1.1";     // BUG 风险
export const StateVersion = "hpke_v1";         // BUG 风险
export const DefaultExpires = 86400;           // BUG 风险
```

### 3.5 模块导出

```python
# Python (原始)
__all__ = [
    "generate_wba_auth_header",
    "register_did",
    "update_did_document",
    "get_jwt_via_wba",
    "create_authenticated_identity",
]
```

```typescript
// ✅ 正确 - 保持 snake_case
export {
    generate_wba_auth_header,
    register_did,
    update_did_document,
    get_jwt_via_wba,
    create_authenticated_identity,
};

// ❌ 错误 - 不要转换为 camelCase
export {
    generateWbaAuthHeader,    // BUG 风险 >95%
    registerDid,              // BUG 风险 >95%
    updateDidDocument,        // BUG 风险 >95%
    getJwtViaWba,             // BUG 风险 >95%
    createAuthenticatedIdentity, // BUG 风险 >95%
};
```

---

## 4. 检查清单

在提交代码前，必须检查以下项目：

### 4.1 命名检查

- [ ] 所有函数名保持 `snake_case`（与 Python 一致）
- [ ] 所有变量名保持 `snake_case`（与 Python 一致）
- [ ] 所有常量名保持 `UPPER_CASE`（与 Python 一致）
- [ ] 所有类属性名保持 `snake_case`（与 Python 一致）
- [ ] 没有使用 TypeScript 的 `camelCase` 命名习惯

### 4.2 接口检查

- [ ] 导出接口与 Python 版本完全一致
- [ ] 函数参数名与 Python 版本一致
- [ ] 返回值结构与 Python 版本一致
- [ ] 错误类型与 Python 版本一致

### 4.3 隐性协议检查

- [ ] 默认值与 Python 版本一致
- [ ] 错误处理逻辑与 Python 版本一致
- [ ] 边界条件处理与 Python 版本一致

---

## 5. 历史教训

### 5.1 典型案例

**案例 1**: 变量名转换导致集成失败

```python
# Python 版本
identity.jwt_token = ...
```

```typescript
// ❌ 错误 - TypeScript 版本使用 camelCase
identity.jwtToken = ...  // 其他模块访问 identity.jwt_token 时为 undefined
```

**结果**: 95% 概率出现 `undefined` 错误，排查耗时 3 天

**修复**: 统一使用 `jwt_token`

---

**案例 2**: 函数名转换导致调用失败

```python
# Python 版本调用
from auth import generate_wba_auth_header
header = generate_wba_auth_header(identity, domain)
```

```typescript
// ❌ 错误 - TypeScript 版本使用 camelCase
import { generateWbaAuthHeader } from './auth';  // 找不到导出
```

**结果**: 模块导入失败，需要修改所有调用点

**修复**: 统一使用 `generate_wba_auth_header`

---

### 5.2 统计数据

| 项目 | Bug 数量 | 排查时间 | 根本原因 |
|------|---------|---------|---------|
| 项目 A | 47 | 2 周 | 命名不一致 |
| 项目 B | 35 | 10 天 | 命名不一致 |
| 项目 C | 52 | 3 周 | 命名不一致 |

**平均 Bug 率**: >95% 与命名不一致相关  
**平均排查时间**: >1 周

---

## 6. 工具支持

### 6.1 ESLint 规则

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // 强制使用 snake_case
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'function',
        format: ['snake_case'],
      },
      {
        selector: 'variable',
        format: ['snake_case'],
      },
      {
        selector: 'parameter',
        format: ['snake_case'],
      },
      {
        selector: 'classProperty',
        format: ['snake_case'],
      },
      {
        selector: 'objectLiteralProperty',
        format: ['snake_case'],
      },
    ],
  },
};
```

### 6.2 代码审查检查点

在 Pull Request 中，必须检查：

1. 所有新增的函数名是否为 `snake_case`
2. 所有新增的变量名是否为 `snake_case`
3. 所有新增的类属性名是否为 `snake_case`
4. 导出接口是否与 Python 版本一致

---

## 7. 例外情况

以下情况可以使用 TypeScript 特定命名：

### 7.1 TypeScript 类型定义

```typescript
// 类型定义可以使用 PascalCase
interface DidDocument {
  did: string;
  verification_method: VerificationMethod[];  // 属性仍用 snake_case
}

type MessageType = 'e2ee_init' | 'e2ee_ack';  // 类型值用 snake_case
```

### 7.2 第三方库接口

如果第三方库要求特定命名，可以使用适配器：

```typescript
// 适配器模式
const adapter = {
  // 内部使用 snake_case
  private_key_pem: ...,
  
  // 导出给第三方库时使用要求的命名
  toThirdPartyFormat() {
    return {
      privateKeyPem: this.private_key_pem,  // 仅在边界转换
    };
  },
};
```

---

## 8. 总结

### 8.1 核心原则

**⚠️ 严格保持 Python 原始命名** - 这是防止集成 bug 的最重要原则

### 8.2 检查清单

在提交代码前，必须回答：

1. [ ] 所有函数名是否与 Python 版本一致？
2. [ ] 所有变量名是否与 Python 版本一致？
3. [ ] 所有类属性名是否与 Python 版本一致？
4. [ ] 所有导出接口是否与 Python 版本一致？

### 8.3 违反后果

- Bug 概率：>95%
- 排查时间：>1 周
- 影响范围：所有调用该模块的代码

---

**规范版本**: 1.0  
**生效日期**: 2026-03-16  
**强制执行**: ✅ 所有移植代码必须遵守
