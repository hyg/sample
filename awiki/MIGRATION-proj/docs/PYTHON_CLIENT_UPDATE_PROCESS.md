# python-client 更新流程

**文档版本**: 1.0
**创建日期**: 2026-03-08
**最后更新**: 2026-03-08

---

## 概述

本文档描述如何从官方来源获取最新的 Python 客户端代码，并基于新代码验证和更新 Node.js 客户端。

---

## 官方代码来源

`python-client/` 文件夹的代码**仅**从以下两个官方来源获取：

| 来源 | URL | 适用场景 |
|------|-----|----------|
| **静态文件下载** | `http://awiki.info/static-files/awiki-agent-id-message.zip` | 快速下载最新版本 |
| **GitHub 仓库** | `https://github.com/AgentConnect/awiki-agent-id-message` | 查看历史、Issue 跟踪 |

---

## 更新步骤

### 步骤 1：下载最新代码

#### 方法 A：ZIP 下载（推荐）

```bash
# 1. 下载 ZIP 文件
# 访问：http://awiki.info/static-files/awiki-agent-id-message.zip
# 或使用命令行工具（如 curl、wget）

# 2. 备份旧版本（可选）
cd D:\huangyg\git\sample\awiki
cp -r python-client python-client.backup.YYYYMMDD

# 3. 清空旧版本
rm -rf python-client/*

# 4. 解压新代码
unzip awiki-agent-id-message.zip -d python-client/
```

#### 方法 B：Git 克隆

```bash
cd D:\huangyg\git\sample\awiki

# 1. 备份旧版本（可选）
cp -r python-client python-client.backup.YYYYMMDD

# 2. 删除旧版本
rm -rf python-client

# 3. 克隆新代码
git clone https://github.com/AgentConnect/awiki-agent-id-message.git python-client
```

---

### 步骤 2：记录更新日志

创建或更新 `python-client/UPDATE_LOG.md`：

```markdown
# python-client 更新日志

## 2026-03-08

- **来源**: http://awiki.info/static-files/awiki-agent-id-message.zip
- **版本**: (从代码中获取，如 package version 或 git tag)
- **更新内容**:
  - 替换全部内容
  - 记录主要变更（如有 CHANGELOG）
```

---

### 步骤 3：验证代码结构

检查下载的内容是否完整：

```bash
cd D:\huangyg\git\sample\awiki/python-client

# 检查关键目录
ls -la anp_src/
ls -la scripts/

# 检查关键文件
ls -la anp_src/anp_package/authentication/
ls -la anp_src/anp_package/e2e_encryption_hpke/
ls -la anp_src/anp_package/proof/
```

**预期结构**:
```
python-client/
├── anp_src/
│   └── anp_package/
│       ├── authentication/
│       ├── e2e_encryption_hpke/
│       ├── proof/
│       └── ...
├── scripts/
│   ├── setup_identity.py
│   ├── send_message.py
│   └── ...
└── ...
```

---

### 步骤 4：基于新代码分析 Python 实现

在 `MIGRATION-proj/python-work/` 下运行分析：

```bash
cd D:\huangyg\git\sample\awiki/MIGRATION-proj/python-work

# 1. 运行代码对比工具
node ../tools/compare_python_nodejs.js

# 2. 生成差异报告
node ../tools/generate_migration_plan.js

# 3. 记录关键变更
```

---

### 步骤 5：测试 nodejs-client 功能

#### 5.1 基础功能测试

```bash
cd D:\huangyg\git\sample\awiki/nodejs-client

# 1. 安装依赖
npm install

# 2. 运行单元测试
npm test

# 3. 运行对比测试
npm run test:python-compare
```

#### 5.2 集成测试

使用 Python 和 Node.js 客户端进行互操作测试：

```bash
# 1. 使用 Python 创建身份
cd D:\huangyg\git\sample\awiki/python-client/scripts
python setup_identity.py --name "TestPy" --agent --credential testpy

# 2. 使用 Node.js 加载凭证并测试
cd D:\huangyg\git\sample\awiki/nodejs-client
node scripts/setup_identity.js --name "TestNode" --agent --credential testnode

# 3. 测试消息互通
# Python 发送 → Node.js 接收
# Node.js 发送 → Python 接收
```

#### 5.3 测试清单

| 测试项 | Python | Node.js | 互操作 | 状态 |
|--------|--------|---------|--------|------|
| DID 创建 | ✅ | ✅ | N/A | ⏳ |
| DID 注册 | ✅ | ✅ | N/A | ⏳ |
| JWT 获取 | ✅ | ✅ | N/A | ⏳ |
| 明文消息 | ✅ | ✅ | ✅ | ⏳ |
| E2EE 握手 | ✅ | ✅ | ✅ | ⏳ |
| E2EE 消息 | ✅ | ✅ | ✅ | ⏳ |
| 群聊 E2EE | ✅ | ❌ | N/A | ⏳ |

---

### 步骤 6：修订文档

根据测试结果更新相关文档：

| 文档 | 位置 | 更新内容 |
|------|------|----------|
| 对比文档 | `nodejs-client/PYTHON_NODEJS_COMPARISON.md` | 更新代码差异 |
| 差异文档 | `nodejs-client/PYTHON_NODEJS_DIFF.md` | 记录功能差距 |
| API 规范 | `MIGRATION-proj/docs/API_SPECIFICATION.md` | 更新 API 变更 |
| 测试报告 | `MIGRATION-proj/docs/TEST_REPORT.md` | 记录测试结果 |

---

## 文档清理原则

项目文件夹下存在大量过时和错误的文档，更新时遵循以下原则：

### 删除标准

1. **过时信息**: 包含旧版本号、旧 API、旧流程的文档
2. **错误信息**: 与当前代码实现不符的文档
3. **重复信息**: 多处重复且不一致的文档
4. **测试性文档**: 临时测试、调试产生的中间文档

### 保留标准

1. **核心规范**: API 规范、E2EE 规范等
2. **使用指南**: 用户文档、CLI 使用指南
3. **测试报告**: 最新的测试结果和对比报告
4. **发布文档**: 发布清单、版本说明

### 更新流程

```
1. 列出所有文档
   ↓
2. 标记过时/错误/重复
   ↓
3. 删除或合并
   ↓
4. 基于新代码更新内容
   ↓
5. 验证文档准确性
```

---

## 更新记录模板

### python-client/UPDATE_LOG.md

```markdown
# python-client 更新日志

## [YYYY-MM-DD]

- **来源**: (URL)
- **版本**: (version)
- **Git Commit**: (如从 GitHub 获取)
- **主要变更**:
  - 变更 1
  - 变更 2
- **影响**:
  - 对 Node.js 的影响
  - 需要更新的功能
```

### nodejs-client/CHANGELOG.md

```markdown
# Node.js 客户端更新日志

## [YYYY-MM-DD] - v1.x.x

### 基于 Python 版本更新

- **Python 版本**: (version)
- **同步内容**:
  - 同步的功能
  - 未同步的功能（说明原因）

### 新增功能

- 功能 1
- 功能 2

### 修复

- Bug 修复 1
- Bug 修复 2
```

---

## 注意事项

1. **保持 python-client 只读**: 所有修改在 `MIGRATION-proj/python-work/` 进行
2. **记录所有变更**: 使用 UPDATE_LOG.md 追踪更新历史
3. **测试优先**: 基于测试结果修订文档，而非假设
4. **文档一致性**: 确保多处文档信息一致
5. **版本对应**: 记录 Node.js 与 Python 版本的对应关系

---

## 联系方式

- **Python 官方仓库**: https://github.com/AgentConnect/awiki-agent-id-message
- **Node.js 社区实现**: (项目仓库 URL)
- **Issue 跟踪**: (Issue 页面 URL)

---

**最后更新**: 2026-03-08
