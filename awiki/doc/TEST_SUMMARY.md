# 测试计划总结

## 1. 概述

本文档总结三个 Node.js 项目的测试计划，确保测试覆盖完整、策略合理、执行可行。

---

## 2. 测试策略对比

| 项目 | 测试重点 | 测试类型 | 特殊要求 |
|------|---------|---------|---------|
| **Module** | 模块功能对等 | 单元 (60%)、集成 (25%)、交叉 (15%) | Python↔JS 互操作 |
| **Skill** | CLI 脚本功能 | CLI(50%)、场景 (30%)、端到端 (20%) | 多轮互动、超时 |
| **SDK** | API 函数接口 | 单元 (60%)、集成 (25%)、端到端 (15%) | TypeScript 类型 |

---

## 3. 测试覆盖要求

### 3.1 Module 项目

| 模块 | 语句覆盖率 | 分支覆盖率 | 行覆盖率 |
|------|-----------|-----------|---------|
| auth | ≥90% | ≥85% | ≥90% |
| client | ≥85% | ≥80% | ≥85% |
| config | ≥95% | ≥90% | ≥95% |
| e2ee | ≥85% | ≥80% | ≥85% |
| handle | ≥90% | ≥85% | ≥90% |
| identity | ≥90% | ≥85% | ≥90% |
| rpc | ≥90% | ≥85% | ≥90% |
| ws | ≥85% | ≥80% | ≥85% |
| resolve | ≥90% | ≥85% | ≥90% |
| logging | ≥80% | ≥75% | ≥80% |

### 3.2 Skill 项目

| 脚本类型 | 语句覆盖率 | 分支覆盖率 | 行覆盖率 |
|----------|-----------|-----------|---------|
| CLI 脚本 | ≥85% | ≥80% | ≥85% |
| 场景测试 | ≥80% | ≥75% | ≥80% |
| 交叉测试 | ≥90% | ≥85% | ≥90% |

### 3.3 SDK 项目

| API 类 | 语句覆盖率 | 分支覆盖率 | 行覆盖率 |
|--------|-----------|-----------|---------|
| identity | ≥90% | ≥85% | ≥90% |
| handle | ≥90% | ≥85% | ≥90% |
| message | ≥90% | ≥85% | ≥90% |
| group | ≥85% | ≥80% | ≥85% |
| relationship | ≥85% | ≥80% | ≥85% |
| profile | ≥90% | ≥85% | ≥90% |
| content | ≥85% | ≥80% | ≥85% |
| credits | ≥85% | ≥80% | ≥85% |
| listener | ≥85% | ≥80% | ≥85% |
| e2ee | ≥85% | ≥80% | ≥85% |

---

## 4. 特殊测试场景

### 4.1 多轮互动测试

| 项目 | 场景 | 轮次 | 文件 |
|------|------|------|------|
| Module | E2EE 对话 | 10-20 轮 | `tests/integration/e2ee-flow.test.js` |
| Skill | E2EE 对话 | 20 轮 | `tests/scenarios/e2ee-conversation.test.js` |
| SDK | E2EE 对话 | 20 轮 | `tests/scenarios/e2ee-conversation.test.ts` |
| Module | 群组互动 | 10+ 消息 | `tests/integration/group-flow.test.js` |
| Skill | 群组互动 | 10+ 消息 | `tests/scenarios/group-interaction.test.js` |
| SDK | 群组互动 | 10+ 消息 | `tests/scenarios/group-interaction.test.ts` |

### 4.2 超时测试

| 测试项 | 超时时间 | 测试文件 |
|--------|---------|---------|
| JWT 即将过期 | 5 秒 | `tests/timeout/jwt-timeout.test.*` |
| JWT 自动刷新 | 6 秒 | `tests/timeout/jwt-timeout.test.*` |
| 服务器超时 | 35 秒 | `tests/timeout/jwt-timeout.test.*` |
| E2EE 会话过期 | 5 分钟 | `tests/timeout/e2ee-timeout.test.*` |
| Proof 过期 | 1 小时 | `tests/timeout/e2ee-timeout.test.*` |

### 4.3 Python↔JS 交叉测试

| 测试项 | Python→JS | JS→Python | 测试文件 |
|--------|----------|----------|---------|
| 认证头验证 | ✅ | ✅ | `tests/interop/auth-interop.test.*` |
| E2EE 加密/解密 | ✅ | ✅ | `tests/interop/e2ee-interop.test.*` |
| 10 轮对话 | ✅ | ✅ | `tests/interop/e2ee-interop.test.*` |
| CLI 功能对等 | ✅ | ✅ | `tests/interop/cli-interop.test.js` |
| API 功能对等 | ✅ | ✅ | `tests/interop/api-interop.test.ts` |

---

## 5. 测试执行命令

### 5.1 Module 项目

```bash
# 单元测试
npm test -- tests/unit/

# 集成测试
npm test -- tests/integration/

# 交叉测试
npm test -- tests/interop/

# 超时测试
npm test -- tests/timeout/

# 覆盖率
npm test -- --coverage
```

### 5.2 Skill 项目

```bash
# CLI 测试
npm test -- tests/cli/

# 场景测试
npm test -- tests/scenarios/

# 交叉测试
npm test -- tests/interop/

# 超时测试
npm test -- tests/timeout/

# SKILL.md 验证
npx skills-ref validate .
```

### 5.3 SDK 项目

```bash
# 单元测试
npm test -- tests/unit/

# 场景测试
npm test -- tests/scenarios/

# 交叉测试
npm test -- tests/interop/

# 超时测试
npm test -- tests/timeout/

# 类型测试
npm run test:types
```

---

## 6. CI/CD 集成

### 6.1 Module 项目

```yaml
# .github/workflows/module-test.yml
name: Module Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        python-version: ['3.10', '3.11']
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    - name: Install dependencies
      run: npm ci
    - name: Run unit tests
      run: npm test -- tests/unit/
    - name: Run interop tests
      run: npm test -- tests/interop/
    - name: Check coverage
      run: npm test -- --coverage
```

### 6.2 Skill 项目

```yaml
# .github/workflows/skill-test.yml
name: Skill Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        python-version: ['3.10', '3.11']
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    - name: Install dependencies
      run: npm ci && pip install -r requirements.txt
    - name: Run CLI tests
      run: npm test -- tests/cli/
    - name: Run scenario tests
      run: npm test -- tests/scenarios/
    - name: Validate SKILL.md
      run: npx skills-ref validate .
    - name: Check coverage
      run: npm test -- --coverage
```

### 6.3 SDK 项目

```yaml
# .github/workflows/sdk-test.yml
name: SDK Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - name: Install dependencies
      run: npm ci
    - name: Run unit tests
      run: npm test -- tests/unit/
    - name: Run scenario tests
      run: npm test -- tests/scenarios/
    - name: Run type tests
      run: npm run test:types
    - name: Check coverage
      run: npm test -- --coverage
```

---

## 7. 测试报告

### 7.1 测试执行报告模板

```
Test Suites: XX passed, XX total
Tests:       XX passed, XX total
Snapshots:   XX total
Time:        XX s
Coverage:    XX%

Detailed Coverage:
  - Module A: XX%
  - Module B: XX%
  - ...
```

### 7.2 交叉测试报告模板

```
Python ↔ JS Interop Tests:
  Auth: XX passed
  E2EE: XX passed
  HTTP: XX passed
  WebSocket: XX passed
  CLI: XX passed
Total: XX passed, XX failed
```

---

## 8. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Python/JS 环境不一致 | 高 | 中 | Docker 容器化测试环境 |
| 交叉测试配置复杂 | 中 | 高 | 提供测试脚本和文档 |
| 超时测试时间长 | 中 | 高 | 并行执行，设置超时上限 |
| 多轮测试状态管理 | 中 | 高 | 每个测试独立凭证 |
| awiki.ai 服务不稳定 | 高 | 中 | mock + 真实服务混合 |

---

## 9. 文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| **Module 测试计划** | [module.test.md](module.test.md) | Module 项目完整测试计划 |
| **Skill 测试计划** | [skill.test.md](skill.test.md) | Skill 项目完整测试计划 |
| **SDK 测试计划** | [npm.test.md](npm.test.md) | SDK 项目完整测试计划 |

---

## 10. 下一步行动

### 10.1 立即可开始

1. **搭建测试环境**: 配置 Node.js、Python、数据库环境
2. **编写测试框架**: 配置 Jest/Mocha、覆盖率工具
3. **创建测试数据**: 准备测试凭证、mock 数据

### 10.2 测试开发顺序

1. **单元测试**: 优先编写核心模块单元测试
2. **集成测试**: 测试模块间协作
3. **交叉测试**: 验证 Python↔JS 互操作性
4. **超时测试**: 验证超时和刷新机制
5. **场景测试**: 模拟真实用户场景

### 10.3 测试验收标准

1. **覆盖率达标**: 所有模块达到覆盖率要求
2. **交叉测试通过**: Python↔JS 互操作测试 100% 通过
3. **超时测试通过**: 所有超时场景正确处理
4. **多轮测试通过**: 20 轮对话无错误

---

**测试计划完成**: ✅  
**可以开始测试开发**: ✅
