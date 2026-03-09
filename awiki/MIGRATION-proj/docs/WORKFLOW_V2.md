# awiki Node.js 升级工作流程

**版本**: 1.1
**生效日期**: 2026-03-08
**最后更新**: 2026-03-08

---

## 核心规则

### 规则 1: 文档更新触发

> **每次更新 python-client，都必须重新更新 API_SPECIFICATION.md 和 FULL_TEST_PLAN.md**

**原因**:
- API_SPECIFICATION.md 是 API 规范，必须与 Python 版本同步
- FULL_TEST_PLAN.md 是测试计划模板，必须基于最新 API

### 规则 2: 测试记录分离

> **测试记录单独保存，不要放在 FULL_TEST_PLAN.md 文件里面**

**原因**:
- FULL_TEST_PLAN.md 是模板，可重复使用
- 测试记录是执行结果，每次不同
- 便于版本对比和历史追溯

**文件结构**:
```
MIGRATION-proj/docs/
├── API_SPECIFICATION.md           # API 规范（每次更新）
├── FULL_TEST_PLAN.md              # 测试计划模板（每次更新）
├── TEST_RECORDS_20260308.md       # 测试结果（按日期）
├── TEST_RECORDS_20260315.md       # 下次测试结果
└── ...
```

---

## 工作流程

```
用户触发 → 代码分析 → 文档更新 → 真实测试 → 计划设计 → 
用户确认 → 执行升级 → 测试验证 → 文档更新 → 发布验证 → npm 发布
```

---

## 详细流程

### 阶段 1: 用户触发

**输出**:
- ✅ python-client/ 已更新
- ✅ docs/PYTHON_UPDATE_LOG.md

### 阶段 2: 代码分析与文档更新 🔴

**步骤**:

1. **对比 Python 新旧版本**
   - 识别变更内容
   - 新增/修改/删除的 API

2. **更新 API_SPECIFICATION.md** 🔴
   - 根据新版 Python 代码更新
   - 记录新增/修改的 API 端点
   - 更新请求/响应格式
   - 更新错误代码

3. **更新 FULL_TEST_PLAN.md** 🔴
   - 根据新版 API_SPECIFICATION.md 更新
   - 添加新 API 的测试用例
   - 修改变更功能的测试步骤
   - **注意**: 只更新计划，不记录结果

4. **生成分析报告**
   - docs/PYTHON_CHANGE_ANALYSIS.md

**输出**:
- ✅ docs/API_SPECIFICATION.md (已更新)
- ✅ docs/FULL_TEST_PLAN.md (已更新)
- ✅ docs/PYTHON_CHANGE_ANALYSIS.md

### 阶段 3: 真实测试验证

**输出**:
- ✅ docs/TEST_RECORDS_YYYYMMDD.md (测试结果，单独保存)
- ✅ docs/PYTHON_TEST_RESULTS.md
- ✅ docs/NODEJS_UPGRADE_REQUIREMENTS.md

### 阶段 4-12: 后续流程

（同版本 1.0，包含用户确认、执行升级、测试验证、文档更新、发布等）

---

## 文档管理

### 文档分类

| 类别 | 文档 | 更新时机 |
|------|------|---------|
| **规范类** | API_SPECIFICATION.md | 每次 Python 更新 |
| **计划类** | FULL_TEST_PLAN.md | 每次 Python 更新 |
| **记录类** | TEST_RECORDS_*.md | 每次测试执行 |
| **报告类** | UPGRADE_TEST_REPORT.md | 升级完成后 |

### 文件命名

- **测试记录**: `TEST_RECORDS_YYYYMMDD.md`（按日期）
- **测试报告**: `UPGRADE_TEST_REPORT_v1.x.x.md`（按版本）

---

**制定人**: AI Assistant
**生效日期**: 2026-03-08
**审查周期**: 每次升级后审查
