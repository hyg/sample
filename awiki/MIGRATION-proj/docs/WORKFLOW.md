# awiki Node.js 升级工作流程

**版本**: 1.2
**生效日期**: 2026-03-08
**最后更新**: 2026-03-08

---

## 核心规则

### 规则 1: 文档更新触发

> **每次更新 python-client，都必须重新更新 API_SPECIFICATION.md 和 FULL_TEST_PLAN.md**

### 规则 2: 测试记录分离

> **测试记录单独保存，不要放在 FULL_TEST_PLAN.md 文件里面**

**文件结构**:
```
MIGRATION-proj/docs/
├── API_SPECIFICATION.md           # API 规范（每次更新）
├── FULL_TEST_PLAN.md              # 测试计划模板（每次更新）
├── TEST_RECORDS_YYYYMMDD.md       # 测试结果（按日期）
└── ...
```

### 规则 3: Git 提交规范

> **每次更新 python-client 之前，必须先提交当前 git 仓库**

**目的**:
- 保留工作现场
- 便于回滚
- 清晰记录每次变更

---

## 详细流程

### 阶段 0: Git 提交（更新前准备）

**负责人**: AI Assistant

**步骤**:

1. **检查 git 状态**
   ```bash
   cd D:\huangyg\git\sample\awiki
   git status
   ```

2. **添加所有更改**
   ```bash
   git add .
   ```

3. **提交当前状态**
   ```bash
   git commit -m "chore: pre-python-client-update snapshot"
   ```

4. **推送到远程（可选）**
   ```bash
   git push
   ```

5. **记录提交哈希**
   - 文件：`MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md`
   - 记录：`pre_update_commit: <commit-hash>`

**输出**:
- ✅ Git 仓库已提交
- ✅ 提交哈希已记录

---

### 阶段 1: 用户触发

**触发条件**: 用户指示更新 python-client

**步骤**:

1. **备份旧版本**
   ```bash
   cd D:\huangyg\git\sample\awiki
   if exist "python-client" (
       move /Y "python-client" "python-client.backup.YYYYMMDD.HHMM"
   )
   ```

2. **下载新版本**
   ```bash
   # 方法 A: ZIP 下载（推荐）
   curl -o python-client.zip http://awiki.info/static-files/awiki-agent-id-message.zip
   unzip -q python-client.zip -d python-client-temp/
   move python-client-temp\* python-client\
   
   # 方法 B: Git 克隆
   git clone https://github.com/AgentConnect/awiki-agent-id-message.git python-client
   ```

3. **清理临时文件**
   ```bash
   del /Q python-client.zip 2>nul
   rmdir /Q python-client-temp 2>nul
   ```

4. **记录更新日志**
   - 文件：`MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md`

**输出**:
- ✅ python-client/ 已更新
- ✅ 旧版本已备份
- ✅ docs/PYTHON_UPDATE_LOG.md 已记录

---

### 阶段 2: 代码分析与文档更新

**步骤**:

1. **对比 Python 新旧版本**
   ```bash
   # 使用对比工具
   node MIGRATION-proj/tools/compare_python_versions.js
   ```

2. **更新 API_SPECIFICATION.md**
   - 根据新版 Python 代码更新 API 文档
   - 记录新增/修改的 API 端点
   - 更新请求/响应格式

3. **更新 FULL_TEST_PLAN.md**
   - 根据新版 API_SPECIFICATION.md 更新测试计划
   - 添加新 API 的测试用例
   - **注意**: 只更新计划，不记录结果

4. **生成分析报告**
   - 文件：`MIGRATION-proj/docs/PYTHON_CHANGE_ANALYSIS.md`

**输出**:
- ✅ docs/API_SPECIFICATION.md (已更新)
- ✅ docs/FULL_TEST_PLAN.md (已更新)
- ✅ docs/PYTHON_CHANGE_ANALYSIS.md

---

### 阶段 3: 真实测试验证

**输出**:
- ✅ docs/TEST_RECORDS_YYYYMMDD.md (测试结果，单独保存)
- ✅ docs/PYTHON_TEST_RESULTS.md
- ✅ docs/NODEJS_UPGRADE_REQUIREMENTS.md

---

### 阶段 4-12: 后续流程

（包含升级计划设计、用户确认、执行升级、测试验证、文档更新、发布验证、npm 发布等）

---

## Git 操作规范

### 提交时机

| 时机 | 操作 | 提交信息示例 |
|------|------|-------------|
| 更新 python-client 前 | 提交当前状态 | `chore: pre-python-client-update snapshot` |
| 更新 nodejs-client 代码后 | 提交代码变更 | `feat: implement new API endpoint` |
| 完成升级后 | 提交所有变更 | `chore: complete python-client sync to YYYYMMDD` |
| 发布新版本 | 提交并发布 | `release: v1.x.x` |

### 分支策略

```
main          - 主分支，稳定版本
develop       - 开发分支
upgrade/*     - 升级分支（临时）
```

### 标签管理

```bash
# 发布前打 tag
git tag v1.x.x
git push origin --tags

# 保留升级前状态
git tag pre-upgrade-YYYYMMDD
git push origin --tags
```

---

## 文档索引

| 阶段 | 文档 | 位置 | 说明 |
|------|------|------|------|
| 0 | - | Git 提交 | 更新前快照 |
| 1 | PYTHON_UPDATE_LOG.md | MIGRATION-proj/docs/ | Python 版本更新记录 |
| 2 | API_SPECIFICATION.md | MIGRATION-proj/docs/ | **每次更新** |
| 2 | FULL_TEST_PLAN.md | MIGRATION-proj/docs/ | **每次更新** |
| 2 | PYTHON_CHANGE_ANALYSIS.md | MIGRATION-proj/docs/ | 代码变更分析 |
| 3 | TEST_RECORDS_YYYYMMDD.md | MIGRATION-proj/docs/ | 测试结果（单独保存） |
| 3 | PYTHON_TEST_RESULTS.md | MIGRATION-proj/docs/ | Python 测试结果 |
| 3 | NODEJS_UPGRADE_REQUIREMENTS.md | MIGRATION-proj/docs/ | 升级需求 |

---

## 快速参考

### 完整更新命令序列

```bash
# 0. Git 提交
cd D:\huangyg\git\sample\awiki
git status
git add .
git commit -m "chore: pre-python-client-update snapshot"
git tag pre-upgrade-$(date +%Y%m%d)
git push --tags

# 1. 备份旧版本
move /Y "python-client" "python-client.backup.YYYYMMDD.HHMM"

# 2. 下载新版本
curl -o python-client.zip http://awiki.info/static-files/awiki-agent-id-message.zip
unzip -q python-client.zip -d python-client/

# 3. 记录更新日志
# 编辑 MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md

# 4. 更新文档
# 更新 API_SPECIFICATION.md
# 更新 FULL_TEST_PLAN.md

# 5. 执行测试
# 运行测试脚本，记录到 TEST_RECORDS_YYYYMMDD.md

# 6. 提交变更
git add .
git commit -m "chore: complete python-client sync to YYYYMMDD"
```

---

**制定人**: AI Assistant
**生效日期**: 2026-03-08
**审查周期**: 每次升级后审查
