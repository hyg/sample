# python-client 文件夹使用原则澄清

**日期**: 2026-03-08
**类型**: 原则澄清与规则更新

---

## 用户原意澄清

用户最初的指示是：

> python-client 文件夹**只存放原始代码**，除了升级时可写外其他时候都只读。**对 python 原始代码的分析和升级记录，都放在 MIGRATION-proj 文件夹**。

我之前的理解有偏差，现在澄清如下：

---

## 正确理解

### 1. python-client/ 定位

**原始代码仓库** - 仅存放从官方来源下载的原始代码。

| 属性 | 说明 |
|------|------|
| **内容** | 100% 官方原始代码 |
| **写权限** | 仅在升级时可覆盖 |
| **读权限** | 任何时候可读取 |
| **派生内容** | ❌ 禁止 |

### 2. MIGRATION-proj/ 定位

**派生内容工作区** - 所有基于原始代码产生的派生内容。

| 属性 | 说明 |
|------|------|
| **内容** | 100% 派生内容 |
| **写权限** | 完全可写 |
| **派生内容** | ✅ 必须放在这里 |

---

## 关键原则

> **派生内容从一开始就放在 MIGRATION-proj/，不要先放 python-client/ 再移动。**

### 什么是派生内容？

**所有**基于 python-client 原始代码产生的内容都是派生内容：

| 派生内容 | 示例 | ❌ 错误位置 | ✅ 正确位置 |
|---------|------|-----------|-----------|
| 分析文档 | 代码分析报告 | `python-client/ANALYSIS.md` | `MIGRATION-proj/docs/ANALYSIS.md` |
| 测试报告 | 测试结果 | `python-client/TEST.md` | `MIGRATION-proj/docs/TEST.md` |
| 更新日志 | 升级记录 | `python-client/UPDATE_LOG.md` | `MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md` |
| 测试脚本 | 自定义测试 | `python-client/scripts/test.py` | `MIGRATION-proj/python-work/tests/test.py` |
| 测试输出 | 日志文件 | `python-client/output.log` | `MIGRATION-proj/python-work/outputs/output.log` |
| 修改版本 | 修改的代码 | `python-client/modified.py` | `MIGRATION-proj/python-work/experiments/modified.py` |
| 对比工具 | 工具脚本 | `python-client/compare.js` | `MIGRATION-proj/tools/compare.js` |

---

## 错误做法示例

### ❌ 错误：先放后移

```
1. 创建 python-client/UPDATE_LOG.md
2. 发现不对，移动到 MIGRATION-proj/docs/
```

### ✅ 正确：一开始就放对位置

```
1. 直接创建 MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md
```

---

## 本次更新的文件

### 已更新

| 文件 | 更新内容 |
|------|----------|
| `MIGRATION-proj/docs/PYTHON_CLIENT_READONLY_RULES.md` | 明确"派生内容从一开始就放在 MIGRATION-proj" |
| `README.md` | 更新 python-client 定位说明 |

### 已移动（纠正之前的错误）

| 文件 | 从 | 到 |
|------|---|---|
| UPDATE_LOG.md | `python-client/` | `MIGRATION-proj/docs/PYTHON_UPDATE_LOG.md` |

### 已删除

无 - python-client 现在是干净的原始代码仓库。

---

## 文件夹结构（正确版本）

```
awiki/
├── README.md
│
├── python-client/                    # 🔒 原始代码仓库（只读）
│   ├── scripts/                      # 官方脚本
│   ├── references/                   # 官方文档
│   ├── service/                      # 官方配置
│   ├── tests/                        # 官方测试
│   ├── pyproject.toml               # 官方配置
│   └── requirements.txt             # 官方依赖
│
├── python-client.backup.20260308/    # 旧版本备份
│
├── nodejs-client/                    # Node.js 实现
│
└── MIGRATION-proj/                   # ✅ 派生内容工作区
    ├── docs/                         # 分析文档、测试报告
    │   ├── PYTHON_CLIENT_READONLY_RULES.md
    │   ├── PYTHON_CLIENT_UPDATE_PROCESS.md
    │   ├── PYTHON_UPDATE_LOG.md
    │   ├── PYTHON_V2_ANALYSIS.md
    │   ├── NODEJS_TEST_REPORT.md
    │   ├── NODEJS_UPGRADE_PRINCIPLES.md
    │   └── WORK_SUMMARY_20260308.md
    ├── tools/                        # 工具脚本
    ├── python-work/                  # Python 工作区
    │   ├── tests/                    # 测试脚本
    │   ├── experiments/              # 实验性修改
    │   ├── outputs/                  # 测试输出
    │   └── patches/                  # 补丁文件
    └── npm-publish/                  # NPM 发布工具
```

---

## 遵守检查

### 检查清单

在提交代码前，检查：

- [ ] `python-client/` 中是否有非官方文件？
- [ ] `python-client/` 中是否有派生内容？
- [ ] 所有分析文档是否在 `MIGRATION-proj/docs/`？
- [ ] 所有测试脚本是否在 `MIGRATION-proj/python-work/`？
- [ ] 所有测试输出是否在 `MIGRATION-proj/python-work/outputs/`？
- [ ] 是否有"先放后移"的情况？

### 检查命令

```bash
# 检查 python-client 中是否有非官方文件
cd python-client
git status --porcelain  # 如果有未跟踪文件，需要清理

# 或手动检查
ls -la  # 查看是否有非官方文件
```

---

## 承诺

今后将严格遵守：

1. ✅ **python-client/** 仅存放官方原始代码
2. ✅ **所有派生内容从一开始就放在 MIGRATION-proj/**
3. ✅ 不先放 python-client 再移动
4. ✅ 保持 python-client 的原始性和整洁性

---

**记录人**: AI Assistant
**记录日期**: 2026-03-08
**原则来源**: 用户指示
