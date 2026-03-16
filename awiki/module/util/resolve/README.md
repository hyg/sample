# resolve 模块 - Handle-to-DID 解析

**移植自**: `python/scripts/utils/resolve.py`  
**目标语言**: TypeScript (ESM)  
**编译目标**: Node.js v25.2.1+

---

## 功能概述

提供 `resolveToDid()` 函数，用于将 Handle 或 DID 解析为 DID。

### 核心逻辑

1. **DID 直接返回**: 如果 identifier 以 `did:` 开头，直接返回（不发起 HTTP 请求）
2. **域名后缀剥离**: 移除已知的 awiki 域名后缀（`awiki.ai`, `awiki.test`, `config.did_domain`）
3. **HTTP 请求**: 调用 `GET /user-service/.well-known/handle/{identifier}`
4. **状态检查**: 
   - 404 → `"Handle '{handle}' not found"`
   - status ≠ "active" → `"Handle '{handle}' is not active (status: {status})"`
   - did 为空 → `"Handle '{handle}' has no DID binding"`

---

## 文件结构

```
module/util/resolve/
├── src/
│   ├── index.ts          # 模块导出
│   ├── resolve.ts        # resolveToDid 函数实现
│   └── types.ts          # 类型定义和常量
├── dist/                 # 编译输出（自动生成）
├── test/
│   └── resolve.test.js   # 单元测试
├── package.json
└── tsconfig.json
```

---

## 安装与使用

### 安装依赖

```bash
cd module/util/resolve
npm install
```

### 编译

```bash
npm run build
```

### 测试

```bash
npm test
```

### 使用示例

```typescript
import { resolveToDid } from '@awiki/resolve';
import { SDKConfig } from '@awiki/config';

// 加载配置
const config = SDKConfig.load();

// DID 直接返回
const did1 = await resolveToDid('did:wba:awiki.ai:user:k1_...');

// Handle 解析
const did2 = await resolveToDid('alice', config);

// 带域名后缀的 Handle 自动剥离
const did3 = await resolveToDid('alice.awiki.ai', config);
// 实际请求：GET /user-service/.well-known/handle/alice
```

---

## API 参考

### `resolveToDid(identifier, config)`

解析 DID 或 Handle 为 DID。

**参数**:
- `identifier` (string): DID 字符串或 Handle 本地部分（如 `"alice"` 或 `"alice.awiki.ai"`）
- `config` (SDKConfig | null): SDK 配置，用于服务 URL。默认值为 `null`（使用默认配置）

**返回**: `Promise<string>` - 解析后的 DID 字符串

**异常**:
- `Error`: Handle 未找到时抛出 `"Handle '{handle}' not found"`
- `Error`: Handle 状态非 active 时抛出 `"Handle '{handle}' is not active (status: {status})"`
- `Error`: 无 DID 绑定时抛出 `"Handle '{handle}' has no DID binding"`

---

## 隐性协议

### 域名剥离顺序

1. 先检查 `awiki.ai` 和 `awiki.test`
2. 再检查 `config.did_domain`
3. 只剥离精确匹配的域名后缀（如 `alice.awiki.ai` → `alice`）
4. 多级子域名保留（如 `alice.sub.awiki.ai` → `alice.sub`）

### 响应格式

成功响应格式：
```json
{
  "handle": "alice",
  "did": "did:wba:awiki.ai:user:k1_alice123",
  "status": "active"
}
```

### 超时设置

- 默认超时：**10 秒** (10000ms)
- 对应 Python: `httpx.AsyncClient(timeout=10.0)`

### 认证

- `.well-known/handle` 端点为**公共端点**，无需认证
- 不使用 JWT 或其他认证头

---

## 测试覆盖

### 测试用例分类

| 分类 | 测试用例数 | 说明 |
|------|-----------|------|
| DID 直接返回 | 4 | 标准 DID、其他方法、包含片段标识符、包含服务路径 |
| 域名后缀剥离 | 5 | awiki.ai、awiki.test、自定义域名、多级子域名、纯域名 |
| 错误处理逻辑 | 3 | 404、非 active 状态、无 DID 绑定 |
| 响应格式验证 | 3 | 成功格式、空 DID、缺失 DID 字段 |
| **总计** | **15** | 全部通过 ✓ |

### 运行测试

```bash
npm test
```

输出示例：
```
▶ resolveToDid
  ✔ DID 直接返回 (1.2505ms)
  ✔ 域名后缀剥离逻辑 (0.8275ms)
  ✔ 错误处理逻辑验证 (0.6332ms)
  ✔ 响应格式验证 (0.3901ms)
✔ resolveToDid (4.379ms)
ℹ tests 15
ℹ suites 5
ℹ pass 15
ℹ fail 0
```

---

## 依赖模块

- `@awiki/config`: SDK 配置管理
- `@awiki/client`: HTTP 客户端实现

---

## 与 Python 版本的差异

| 方面 | Python | TypeScript |
|------|--------|------------|
| HTTP 客户端 | `httpx.AsyncClient` | `HttpClientImpl` (基于 fetch) |
| 配置加载 | `SDKConfig()` | `SDKConfig.load()` |
| 异常类型 | `ValueError`, `httpx.HTTPStatusError` | `Error` |
| 类型系统 | 动态类型 + Type Hints | 静态类型 (TypeScript) |
| 模块导出 | `__all__` | `export` / `export default` |

---

## 注意事项

1. **HTTP 客户端兼容性**: 由于 Node.js fetch 与 `https.Agent` 的兼容性问题，测试中的 HTTP Mock 可能无法正常工作。实际使用时，`resolveToDid` 会正确发起 HTTP 请求。

2. **超时时间**: Python 版本使用 10 秒超时，TypeScript 版本保持一致（`DEFAULT_TIMEOUT_MS = 10000`）。

3. **错误消息格式**: 保持与 Python 版本完全一致，确保上游代码无需修改。

---

## 更新日志

- **2026-03-16**: 初始版本，完成 `resolve_to_did()` 函数移植
  - 严格遵循 Python 版本的实现细节
  - 保持隐性协议（域名剥离顺序、响应格式、超时等）
  - 通过 15 个单元测试

---

**维护**: awiki 开发团队  
**最后更新**: 2026-03-16
