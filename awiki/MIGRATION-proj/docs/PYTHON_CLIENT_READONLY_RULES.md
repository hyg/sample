# python-client 文件夹使用规则

**版本**: 1.0
**生效日期**: 2026-03-08
**最后更新**: 2026-03-08

---

## 核心原则

### 📌 python-client/ 文件夹定位

**原始代码仓库** - 仅存放从官方来源下载的原始代码。

### 📌 MIGRATION-proj/ 文件夹定位

**派生内容工作区** - 所有基于原始代码产生的派生内容，**从一开始**就放在这里。

---

## 详细规则

### 1. 文件夹用途

| 文件夹 | 用途 | 写权限 |
|--------|------|--------|
| `python-client/` | 官方原始代码仓库 | 🔒 **只读** (仅升级时可覆盖) |
| `MIGRATION-proj/` | 所有派生内容工作区 | ✅ **可写** |

### 2. python-client/ 规则

#### ✅ 允许的操作

| 操作 | 时机 | 说明 |
|------|------|------|
| 从官方来源下载 | 升级时 | 覆盖全部内容 |
| 读取参考 | 任何时候 | 分析、学习 |
| 运行原始脚本 | 测试时 | 直接运行，输出到 MIGRATION-proj |

#### ❌ 禁止的操作

| 操作 | 原因 | 正确做法 |
|------|------|----------|
| 创建任何新文件 | 保持原始性 | 在 MIGRATION-proj/ 创建 |
| 修改任何文件 | 保持原始性 | 在 MIGRATION-proj/ 修改 |
| 添加分析脚本 | 属于派生内容 | **从一开始**就放在 MIGRATION-proj/ |
| 添加测试输出 | 属于派生内容 | **从一开始**就放在 MIGRATION-proj/ |
| 添加日志/记录 | 属于派生内容 | **从一开始**就放在 MIGRATION-proj/ |
| 先放后移 | 违反原则 | **从一开始**就放在正确位置 |

### 3. MIGRATION-proj/ 规则

#### 派生内容分类

**所有**基于 python-client 原始代码产生的内容都属于派生内容，包括：

| 派生内容类型 | 示例 | 位置 |
|------------|------|------|
| 分析文档 | 代码分析报告、对比文档 | `MIGRATION-proj/docs/` |
| 测试报告 | 测试结果、互操作性报告 | `MIGRATION-proj/docs/` |
| 工作文档 | 笔记、草稿、临时文件 | `MIGRATION-proj/python-work/` |
| 修改版本 | 为测试修改的代码 | `MIGRATION-proj/python-work/` |
| 测试脚本 | 自定义测试脚本 | `MIGRATION-proj/python-work/tests/` |
| 测试输出 | 日志、抓包数据 | `MIGRATION-proj/python-work/outputs/` |
| 工具脚本 | 对比工具、迁移工具 | `MIGRATION-proj/tools/` |
| 补丁文件 | 代码修改补丁 | `MIGRATION-proj/python-work/patches/` |

#### 关键原则

> **派生内容从一开始就放在 MIGRATION-proj/，不要先放 python-client/ 再移动。**

#### 更新记录位置

| 记录类型 | 文件位置 |
|---------|----------|
| Python 版本更新日志 | `MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md` |
| 代码分析报告 | `MIGRATION-proj/docs/PYTHON_*_ANALYSIS.md` |
| 测试报告 | `MIGRATION-proj/docs/*_TEST_REPORT.md` |
| 对比文档 | `MIGRATION-proj/docs/PYTHON_NODEJS_*.md` |
| 流程文档 | `MIGRATION-proj/docs/*_PROCESS.md` |

---

## 工作流程

### Python 版本更新流程

```
1. 从官方来源下载最新代码
   ↓
2. 清空 python-client/ 并替换为新代码
   ↓
3. 在 MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md 记录更新
   ↓
4. 在 MIGRATION-proj/python-work/ 运行分析
   ↓
5. 在 MIGRATION-proj/docs/ 创建分析报告
   ↓
6. 基于分析结果更新 nodejs-client/
```

### 日常分析流程

```
1. 读取 python-client/ 中的原始代码
   ↓
2. 在 MIGRATION-proj/python-work/ 创建分析脚本
   ↓
3. 运行分析脚本（输出到 python-work/）
   ↓
4. 在 MIGRATION-proj/docs/ 创建分析文档
```

### 测试流程

```
1. 运行 python-client/scripts/ 中的原始脚本
   ↓
2. 输出保存到 MIGRATION-proj/python-work/tests/
   ↓
3. 在 MIGRATION-proj/docs/ 创建测试报告
```

---

## 文件位置规范

### 正确位置示例

| 文件类型 | 正确位置 | 错误位置 |
|---------|----------|----------|
| Python 更新日志 | `MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md` | `python-client/UPDATE_LOG.md` ❌ |
| 代码分析报告 | `MIGRATION-proj/docs/PYTHON_V2_ANALYSIS.md` | `python-client/ANALYSIS.md` ❌ |
| 测试报告 | `MIGRATION-proj/docs/NODEJS_TEST_REPORT.md` | `python-client/TEST_REPORT.md` ❌ |
| 分析脚本 | `MIGRATION-proj/python-work/analyze/*.py` | `python-client/scripts/analyze/` ❌ |
| 测试输出 | `MIGRATION-proj/python-work/tests/output/` | `python-client/tests/output/` ❌ |
| 补丁文件 | `MIGRATION-proj/python-work/patches/*.patch` | `python-client/patches/` ❌ |

### python-client/ 中唯一允许的文件

| 文件 | 来源 | 说明 |
|------|------|------|
| 所有 `.py` 文件 | Python 官方 | 原始代码 |
| 所有 `.md` 文件 | Python 官方 | 官方文档 |
| `requirements.txt` | Python 官方 | 依赖列表 |
| `pyproject.toml` | Python 官方 | 项目配置 |
| `LICENSE` | Python 官方 | 许可证 |

---

## 违规检查清单

在提交代码前，检查是否有以下违规：

- [ ] `python-client/` 中是否有非官方文件？
- [ ] `python-client/` 中是否有分析脚本？
- [ ] `python-client/` 中是否有测试输出？
- [ ] `python-client/` 中是否有日志文件？
- [ ] 分析文档是否都在 `MIGRATION-proj/docs/`？
- [ ] 工作区文件是否都在 `MIGRATION-proj/python-work/`？

---

## 清理指南

如果发现 `python-client/` 中有非官方文件：

1. **识别非官方文件**
   ```bash
   cd python-client
   git status  # 如果是 git 仓库
   # 或手动检查
   ```

2. **移动到正确位置**
   ```bash
   # 移动分析文档
   mv python-client/UPDATE_LOG.md ../MIGRATION-proj/docs/
   
   # 移动分析脚本
   mv python-client/scripts/analyze.py ../MIGRATION-proj/python-work/
   
   # 移动测试输出
   mv python-client/tests/output/ ../MIGRATION-proj/python-work/tests/
   ```

3. **验证清理结果**
   ```bash
   # 确保 python-client/ 只有官方文件
   ls python-client/
   ```

---

## 例外情况

唯一例外：**升级时临时写入**

在 Python 版本升级过程中：
1. 可以临时写入 `python-client/`
2. 升级完成后立即清理
3. 所有记录移动到 `MIGRATION-proj/`

---

## 遵守检查

**定期检查**: 每次提交前检查 `python-client/` 文件夹

**检查命令**:
```bash
# 查看 python-client 中的非官方文件
cd python-client
git status --porcelain  # 如果有未跟踪文件，需要清理
```

**违规处理**: 发现违规立即清理并记录

---

## 相关文档

| 文档 | 位置 |
|------|------|
| Python 更新流程 | `MIGRATION-proj/docs/PYTHON_CLIENT_UPDATE_PROCESS.md` |
| Python 更新日志 | `MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md` |
| 代码分析报告 | `MIGRATION-proj/docs/PYTHON_*_ANALYSIS.md` |
| 测试报告 | `MIGRATION-proj/docs/*_TEST_REPORT.md` |

---

**制定人**: AI Assistant
**生效日期**: 2026-03-08
**审查周期**: 每次提交前
