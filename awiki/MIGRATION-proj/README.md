# MIGRATION-proj 使用指南

**项目**: awiki-agent-id-message Node.js 迁移项目
**最后更新**: 2026-03-08

---

## 1. 项目概述

MIGRATION-proj 是 awiki-agent-id-message 项目的开发和迁移工作区，包含：

- **文档**: 所有分析文档、测试报告、规范说明
- **工作区**: Python 和 Node.js 的开发测试环境
- **工具**: 迁移工具、测试工具、发布工具

---

## 2. 文件夹结构

```
MIGRATION-proj/
│
├── README.md                       # 本文档
│
├── docs/                           # 文档库
│   ├── PYTHON_*                    # Python 相关文档
│   ├── NODEJS_*                    # Node.js 相关文档
│   ├── TEST_*                      # 测试相关文档
│   ├── SKILL_*                     # Skill 文件规范
│   └── LIB_ANP_STRUCTURE.md        # lib/anp 结构设计
│
├── python-work/                    # Python 工作区
│   ├── tests/                      # 测试脚本
│   ├── experiments/                # 实验性修改
│   ├── outputs/                    # 测试输出
│   └── patches/                    # 补丁文件
│
├── nodejs-work/                    # Node.js 工作区
│   ├── tests/                      # 测试文件（从 nodejs-client 移来）
│   ├── scripts/                    # 开发脚本（测试用）
│   ├── outputs/                    # 测试输出
│   ├── .credentials/               # 测试凭证
│   └── .e2ee_store/                # 测试数据
│
├── tools/                          # 工具脚本
│   ├── compare_python_nodejs.js    # Python/Node.js 对比工具
│   └── ...
│
└── npm-publish/                    # NPM 发布工具
    ├── publish.sh                  # 发布脚本
    └── ...
```

---

## 3. 核心原则

### 3.1 python-client 文件夹规则

> **规则**: `python-client/` 仅存放从官方来源下载的原始代码，只在升级时可覆盖。

**详细说明**:
- **来源**: 
  - http://awiki.info/static-files/awiki-agent-id-message.zip
  - https://github.com/AgentConnect/awiki-agent-id-message
- **用途**: 参考 Python 实现，运行官方测试
- **限制**: 不做任何修改，不添加任何文件

**派生内容位置**:
- 分析报告 → `MIGRATION-proj/docs/`
- 测试脚本 → `MIGRATION-proj/python-work/tests/`
- 测试输出 → `MIGRATION-proj/python-work/outputs/`
- 修改补丁 → `MIGRATION-proj/python-work/patches/`

### 3.2 nodejs-client 文件夹规则

> **规则**: `nodejs-client/` 存放 npm 发布的 Node.js 客户端文件。

**发布内容**:
- `lib/anp/` - 自研 ANP 实现（对应 Python anp 包）
- `scripts/` - 功能脚本（对应 Python scripts/）
- `scripts/utils/` - 工具封装（对应 Python scripts/utils/）
- `bin/` - CLI 工具
- `SKILL.md` 等文档
- `package.json` 等配置

**排除内容** (移到 MIGRATION-proj):
- `tests/` → `MIGRATION-proj/nodejs-work/tests/`
- `*_test.js` → `MIGRATION-proj/nodejs-work/tests/`
- `.credentials/` → `MIGRATION-proj/nodejs-work/.credentials/`
- `.e2ee_store/` → `MIGRATION-proj/nodejs-work/.e2ee_store/`
- 开发文档 → `MIGRATION-proj/docs/`

### 3.3 文件命名原则

> **原则**: nodejs-client 的路径和文件命名，尽量沿用 python-client 的同功能对象。

**示例**:
| Python | Node.js |
|--------|---------|
| `scripts/utils/config.py` | `scripts/utils/config.js` |
| `scripts/utils/identity.py` | `scripts/utils/identity.js` |
| `anp/authentication/did_wba.py` | `lib/anp/authentication/did_wba.js` |
| `anp/e2e_encryption_hpke/hpke.py` | `lib/anp/e2e_encryption_hpke/hpke.js` |

### 3.4 依赖管理原则

> **原则 1**: Python 使用外部 pip 包 → Node.js 优先找 npm 替代。

> **原则 2**: Python 使用 ANP 包 → Node.js 自己实现，放在 `lib/anp/`。

**替代对照**:
| Python (pip) | Node.js (npm) |
|-------------|--------------|
| `httpx` | `axios` |
| `websockets` | `ws` |
| `cryptography` | `@noble/curves` + `secp256k1` |
| `anp` (ANP 包) | `lib/anp/` (自研) |

---

## 4. 工作流程

### 4.1 Python 版本更新流程

```
1. 从官方来源下载最新代码
   ↓
2. 覆盖 python-client/ 全部内容
   ↓
3. 记录更新日志到 docs/PYTHON_UPDATE_LOG.md
   ↓
4. 在 python-work/ 运行分析脚本
   ↓
5. 生成对比报告到 docs/PYTHON_*_ANALYSIS.md
   ↓
6. 根据分析结果更新 nodejs-client/
   ↓
7. 在 nodejs-work/ 测试验证
   ↓
8. 生成测试报告到 docs/NODEJS_TEST_REPORT.md
```

### 4.2 Node.js 开发流程

```
1. 在 nodejs-work/ 开发和测试
   ↓
2. 使用 npm link 或 npm pack 测试
   ↓
3. 验证功能与 Python 一致
   ↓
4. 将稳定代码移动到 nodejs-client/
   ↓
5. 更新 SKILL.md 等文档
   ↓
6. 准备 npm 发布
```

### 4.3 测试流程

```
1. 在 nodejs-work/tests/ 创建测试脚本
   ↓
2. 使用 MIGRATION-proj/nodejs-work/.credentials/ 测试凭证
   ↓
3. 运行测试，输出到 nodejs-work/outputs/
   ↓
4. 记录测试结果到 docs/TEST_RECORD_T*.md
   ↓
5. 汇总结果到 docs/TEST_EXECUTIVE_SUMMARY.md
```

---

## 5. 文档索引

### 5.1 Python 相关

| 文档 | 位置 | 说明 |
|------|------|------|
| Python 更新流程 | `docs/PYTHON_CLIENT_UPDATE_PROCESS.md` | 如何更新 python-client |
| 只读规则 | `docs/PYTHON_CLIENT_READONLY_RULES.md` | python-client 使用规则 |
| 更新日志 | `docs/PYTHON_UPDATE_LOG.md` | Python 版本更新记录 |
| 代码分析 | `docs/PYTHON_V2_ANALYSIS.md` | Python 代码分析报告 |

### 5.2 Node.js 相关

| 文档 | 位置 | 说明 |
|------|------|------|
| lib/anp 结构 | `docs/LIB_ANP_STRUCTURE.md` | lib/anp 目录设计 |
| 清理方案 | `docs/NODEJS_CLIENT_CLEANUP_PLAN.md` | nodejs-client 清理计划 |
| 依赖分析 | `docs/NODEJS_PYTHON_DEPENDENCY_ANALYSIS.md` | Python/Node.js 依赖对比 |
| 升级原则 | `docs/NODEJS_UPGRADE_PRINCIPLES.md` | Node.js 升级原则（测试驱动） |

### 5.3 测试相关

| 文档 | 位置 | 说明 |
|------|------|------|
| 测试计划 | `docs/NODEJS_TEST_PLAN.md` | 完整测试用例 |
| 执行摘要 | `docs/TEST_EXECUTIVE_SUMMARY.md` | 测试进度跟踪 |
| 测试报告 | `docs/TEST_PHASE_REPORT_*.md` | 阶段性测试报告 |
| 测试记录 | `python-work/tests/TEST_RECORD_T*.md` | 详细测试记录 |

### 5.4 Skill 相关

| 文档 | 位置 | 说明 |
|------|------|------|
| Skill 规范 | `docs/SKILL_SPECIFICATION.md` | Skill.md 编写规范 |
| Skill 模板 | `docs/SKILL_TEMPLATE.md` | Skill.md 模板 |

---

## 6. 快速开始

### 6.1 新用户

**场景**: 用户想使用 awiki Node.js 客户端

```bash
# 1. 安装
npm install nodejs-awiki

# 2. 阅读 Skill 文档
cat <install-path>/SKILL.md

# 3. 使用 CLI
npx awiki setup-identity --name "MyAgent"
```

### 6.2 开发者

**场景**: 参与项目开发和维护

```bash
# 1. 克隆项目
git clone <repo-url>

# 2. 阅读本文档
cat MIGRATION-proj/README.md

# 3. 在 nodejs-work/ 开发
cd MIGRATION-proj/nodejs-work
# 开发和测试

# 4. 稳定后移动到 nodejs-client/
# 按照文档规范执行
```

### 6.3 测试人员

**场景**: 执行测试验证

```bash
# 1. 阅读测试计划
cat MIGRATION-proj/docs/NODEJS_TEST_PLAN.md

# 2. 准备测试环境
cd MIGRATION-proj/nodejs-work

# 3. 运行测试
node tests/test_*.js

# 4. 记录结果
# 填写 TEST_RECORD_T*.md 模板
```

---

## 7. 重要提醒

### 7.1 python-client 使用

- ✅ 可以：读取参考、运行官方脚本
- ❌ 禁止：修改代码、添加文件、创建子目录

### 7.2 nodejs-client 使用

- ✅ 可以：开发、测试、准备发布
- ❌ 禁止：存放测试数据、个人凭证、临时文件

### 7.3 文档管理

- ✅ 所有文档放在 `MIGRATION-proj/docs/`
- ❌ 不要在 `nodejs-client/` 存放开发文档

---

## 8. 联系方式

- **项目仓库**: (待添加)
- **Issue 跟踪**: (待添加)
- **NPM 包**: nodejs-awiki (待发布)

---

**维护人**: AI Assistant
**最后更新**: 2026-03-08
**下次审查**: 清理工作完成后
