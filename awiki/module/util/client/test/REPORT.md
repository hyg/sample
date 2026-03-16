# client 模块测试报告

**测试日期**: 2026-03-16  
**测试模块**: `module/util/client`  
**测试文件**: `test/client.comprehensive.test.js`  
**Node.js 版本**: v25.2.1

---

## 测试结果摘要

| 指标 | 结果 |
|------|------|
| **通过测试用例数** | 47 |
| **总测试用例数** | 47 |
| **通过率** | 100% |
| **代码覆盖率目标** | ≥85% |
| **命名规范检查** | ✓ 全部通过 |

---

## 测试用例详情

### 1. _resolveVerify 单元测试 (15 个用例)

#### 环境变量优先级测试 (5 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-UV-001 | AWIKI_CA_BUNDLE 环境变量优先级最高 | ✓ 通过 |
| TC-UV-002 | E2E_CA_BUNDLE 环境变量次优先 | ✓ 通过 |
| TC-UV-003 | SSL_CERT_FILE 环境变量最低优先 | ✓ 通过 |
| TC-UV-004 | 多环境变量同时存在时 AWIKI_CA_BUNDLE 优先 | ✓ 通过 |
| TC-UV-005 | 环境变量值为空字符串时跳过 | ✓ 通过 |

#### 默认验证测试 (3 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-UV-006 | 普通域名使用系统默认验证 | ✓ 通过 |
| TC-UV-007 | HTTPS 域名默认验证 | ✓ 通过 |
| TC-UV-008 | HTTP 域名默认验证 | ✓ 通过 |

#### 边界条件测试 (4 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-UV-009 | CA 文件不存在时降级到默认验证 | ✓ 通过 |
| TC-UV-010 | CA 文件路径为目录时降级 | ✓ 通过 |
| TC-UV-011 | 无效 URL 时返回默认验证 | ✓ 通过 |
| TC-UV-012 | 空字符串 URL 时返回默认验证 | ✓ 通过 |

#### localhost 和 .test 域名测试 (3 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-UV-013 | localhost 域名检测 | ✓ 通过 |
| TC-UV-014 | .test 域名检测 | ✓ 通过 |
| TC-UV-015 | 子域名.test 检测 | ✓ 通过 |

---

### 2. createUserServiceClient 单元测试 (6 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-US-001 | 默认配置创建客户端 | ✓ 通过 |
| TC-US-002 | 自定义 URL 创建客户端 | ✓ 通过 |
| TC-US-003 | TLS 配置继承 - AWIKI_CA_BUNDLE | ✓ 通过 |
| TC-US-004 | trustEnv 固定为 false | ✓ 通过 |
| TC-US-005 | timeout 固定为 30000ms | ✓ 通过 |
| TC-US-006 | 客户端具有完整的 HTTP 方法 | ✓ 通过 |

---

### 3. createMoltMessageClient 单元测试 (6 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-MM-001 | 默认配置创建客户端 | ✓ 通过 |
| TC-MM-002 | 自定义 URL 创建客户端 | ✓ 通过 |
| TC-MM-003 | TLS 配置继承 - AWIKI_CA_BUNDLE | ✓ 通过 |
| TC-MM-004 | trustEnv 固定为 false | ✓ 通过 |
| TC-MM-005 | timeout 固定为 30000ms | ✓ 通过 |
| TC-MM-006 | 客户端具有完整的 HTTP 方法 | ✓ 通过 |

---

### 4. 集成测试 (4 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-INT-001 | HTTP 客户端创建流程完整 | ✓ 通过 |
| TC-INT-002 | TLS 配置端到端测试 | ✓ 通过 |
| TC-INT-003 | 两个客户端独立性验证 | ✓ 通过 |
| TC-INT-004 | 客户端关闭后资源释放 | ✓ 通过 |

---

### 5. 边界测试 (5 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-BD-001 | 无效 URL 处理 | ✓ 通过 |
| TC-BD-002 | CA 文件不存在处理 | ✓ 通过 |
| TC-BD-003 | mkcert 路径不存在处理 | ✓ 通过 |
| TC-BD-004 | 空配置对象处理 | ✓ 通过 |
| TC-BD-005 | 特殊字符 URL 处理 | ✓ 通过 |

---

### 6. 命名规范检查 (5 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-NS-001 | 函数名使用 snake_case | ✓ 通过 |
| TC-NS-002 | 变量名使用 camelCase | ✓ 通过 |
| TC-NS-003 | 常量使用 UPPER_CASE | ✓ 通过 |
| TC-NS-004 | 与 Python 版本函数名对应 | ✓ 通过 |
| TC-NS-005 | 配置属性名与 Python 一致 | ✓ 通过 |

---

### 7. Python 版本兼容性验证 (6 个用例)

| 用例 ID | 测试内容 | 结果 |
|--------|---------|------|
| TC-PC-001 | _resolveVerify() 优先级逻辑一致 | ✓ 通过 |
| TC-PC-002 | 默认超时值 30 秒 | ✓ 通过 |
| TC-PC-003 | trustEnv=false | ✓ 通过 |
| TC-PC-004 | 客户端工厂函数名对应 | ✓ 通过 |
| TC-PC-005 | SSL 验证行为一致 | ✓ 通过 |
| TC-PC-006 | 客户端接口一致性 | ✓ 通过 |

---

## 命名规范检查结果

### 检查项目

| 检查项 | 规范 | 结果 |
|--------|------|------|
| 函数名 | camelCase (对应 Python snake_case) | ✓ 通过 |
| 配置属性 | snake_case (与 Python 一致) | ✓ 通过 |
| 常量 | UPPER_CASE | ✓ 通过 |
| 变量名 | camelCase | ✓ 通过 |
| 类名 | PascalCase | ✓ 通过 |

### 函数名对应关系

| TypeScript (Node.js) | Python |
|---------------------|--------|
| `_resolveVerify` | `_resolve_verify` |
| `createUserServiceClient` | `create_user_service_client` |
| `createMoltMessageClient` | `create_molt_message_client` |

### 配置属性对应关系

| 属性名 | TypeScript | Python |
|--------|-----------|--------|
| user_service_url | ✓ | ✓ |
| molt_message_url | ✓ | ✓ |
| molt_message_ws_url | ✓ | ✓ |
| did_domain | ✓ | ✓ |
| credentials_dir | ✓ | ✓ |
| data_dir | ✓ | ✓ |

---

## Python 版本兼容性验证

### 关键行为对比

| 特性 | Python | Node.js | 状态 |
|------|--------|---------|------|
| _resolve_verify 优先级逻辑 | AWIKI_CA_BUNDLE > E2E_CA_BUNDLE > SSL_CERT_FILE | 相同 | ✓ 一致 |
| 默认超时值 | 30.0 秒 | 30000ms | ✓ 一致 |
| trust_env | False | false | ✓ 一致 |
| 客户端工厂函数 | create_user_service_client, create_molt_message_client | createUserServiceClient, createMoltMessageClient | ✓ 对应 |
| SSL 验证返回类型 | bool \| ssl.SSLContext | bool \| https.Agent | ✓ 对应 |

---

## 代码修复记录

### 修复问题：CA 文件路径为目录时的处理

**问题描述**: 原始代码在检查 CA 文件时只使用 `fs.existsSync()`，没有区分文件和目录，导致当环境变量指向目录时会抛出 `EISDIR` 错误。

**修复方案**: 添加 `fs.statSync()` 检查，确保路径是文件而非目录，与 Python 版本的 `Path.is_file()` 行为一致。

**修复代码**:
```typescript
if (candidate && fs.existsSync(candidate)) {
    try {
        const stats = fs.statSync(candidate);
        if (!stats.isFile()) {
            continue; // 跳过目录，继续检查下一个环境变量
        }
    } catch {
        continue; // stat 失败，继续检查下一个环境变量
    }
    const caContent = fs.readFileSync(candidate);
    return new https.Agent({
        ca: caContent,
        rejectUnauthorized: true,
    });
}
```

---

## 测试文件清单

| 文件 | 用途 |
|------|------|
| `test/client.comprehensive.test.js` | 全面测试用例 (47 个) |
| `test/check-naming.js` | 命名规范检查工具 |
| `test/REPORT.md` | 测试报告 (本文件) |

---

## 结论

✅ **所有测试通过** (47/47 = 100%)

✅ **命名规范检查通过**

✅ **Python 版本兼容性验证通过**

### 测试覆盖范围

- ✅ _resolveVerify 函数 (环境变量优先级、默认验证、边界条件)
- ✅ createUserServiceClient 函数 (默认配置、自定义 URL、TLS 配置)
- ✅ createMoltMessageClient 函数 (默认配置、自定义 URL、TLS 配置)
- ✅ 集成测试 (客户端创建流程、TLS 配置端到端、客户端独立性)
- ✅ 边界测试 (无效 URL、CA 文件不存在、mkcert 路径不存在)
- ✅ 命名规范检查 (函数名、变量名、常量、配置属性)
- ✅ Python 版本兼容性验证 (优先级逻辑、超时值、trustEnv、函数名对应)

---

**报告生成时间**: 2026-03-16  
**测试执行时间**: ~210ms
