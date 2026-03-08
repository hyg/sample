# Python Work 工作区

**目的**: 所有对 Python 代码的分析、测试、修改都在此文件夹下进行

---

## 目录结构

```
python-work/
├── analysis/           # 分析脚本和输出
│   ├── code_analysis.py
│   ├── api_comparison.py
│   └── output/         # 分析结果输出
│
├── tests/              # 测试脚本和结果
│   ├── test_vectors.py
│   ├── compatibility_test.py
│   └── results/        # 测试结果输出
│
├── experiments/        # 实验性修改
│   ├── exp_001_signature_fix/
│   ├── exp_002_e2ee_improvement/
│   └── README.md       # 实验记录
│
└── patches/            # 补丁文件
    ├── patch_001_fix_auth.diff
    ├── patch_002_update_e2ee.diff
    └── README.md       # 补丁说明
```

---

## 使用规则

### ✅ 允许的操作

1. **在 python-work/ 下创建分析脚本**
   ```bash
   cd awiki/MIGRATION-proj/python-work/analysis
   python code_analysis.py ../../python-client/scripts/
   ```

2. **在 python-work/ 下运行测试**
   ```bash
   cd awiki/MIGRATION-proj/python-work/tests
   python test_vectors.py ../../python-client/scripts/
   ```

3. **在 experiments/ 下进行实验性修改**
   ```bash
   cd awiki/MIGRATION-proj/python-work/experiments
   mkdir exp_001_signature_fix
   # 复制需要修改的文件
   cp -r ../../python-client/scripts/utils exp_001_signature_fix/
   # 进行修改和测试
   ```

4. **生成补丁文件**
   ```bash
   cd awiki/MIGRATION-proj/python-work
   diff -ruN ../../python-client/scripts/utils experiments/exp_001_signature_fix/utils > patches/patch_001_fix_auth.diff
   ```

### ❌ 禁止的操作

1. **❌ 直接修改 python-client/ 下的文件**
   ```bash
   # 错误示例
   cd awiki/python-client/scripts
   vim utils/auth.py  # ❌ 禁止直接修改
   ```

2. **❌ 在 python-client/ 下创建临时文件**
   ```bash
   # 错误示例
   cd awiki/python-client/scripts
   touch test_temp.py  # ❌ 禁止创建临时文件
   ```

3. **❌ 删除 python-client/ 下的文件**
   ```bash
   # 错误示例
   cd awiki/python-client/scripts
   rm utils/old_file.py  # ❌ 禁止删除
   ```

---

## 工作流程

### 1. 代码分析流程

```
1. 在 analysis/ 创建分析脚本
   ↓
2. 指向 python-client/ 运行分析
   ↓
3. 输出保存到 analysis/output/
   ↓
4. 生成分析报告
   ↓
5. 清理临时输出（保留报告）
```

**示例**:
```bash
cd awiki/MIGRATION-proj/python-work/analysis
python api_comparison.py \
  --python ../../python-client/scripts \
  --nodejs ../../nodejs-client/src \
  --output output/api_comparison_2026-03-08.md
```

---

### 2. 测试流程

```
1. 在 tests/ 创建测试脚本
   ↓
2. 使用 python-client/ 作为测试源
   ↓
3. 运行测试
   ↓
4. 保存结果到 tests/results/
   ↓
5. 生成测试报告
```

**示例**:
```bash
cd awiki/MIGRATION-proj/python-work/tests
python test_vectors.py \
  --source ../../python-client/scripts \
  --output results/test_vectors_2026-03-08.json
```

---

### 3. 实验性修改流程

```
1. 在 experiments/ 创建实验文件夹
   ↓
2. 复制需要修改的 Python 代码
   ↓
3. 进行修改和测试
   ↓
4. 记录实验过程和结果
   ↓
5. 如果成功，生成补丁文件
```

**示例**:
```bash
cd awiki/MIGRATION-proj/python-work/experiments
mkdir exp_001_signature_fix
cd exp_001_signature_fix

# 复制需要修改的模块
cp -r ../../../python-client/scripts/utils .

# 进行修改
vim utils/auth.py

# 运行测试
python test_fix.py

# 记录实验
vim README.md
```

---

### 4. 补丁生成流程

```
1. 完成实验并验证
   ↓
2. 生成补丁文件
   ↓
3. 在 patches/README.md 记录补丁信息
   ↓
4. 应用补丁测试
   ↓
5. 提交补丁
```

**示例**:
```bash
cd awiki/MIGRATION-proj/python-work

# 生成补丁
diff -ruN \
  ../../python-client/scripts/utils \
  experiments/exp_001_signature_fix/utils \
  > patches/patch_001_fix_auth.diff

# 记录补丁信息
echo "## Patch 001: Fix Auth Signature" >> patches/README.md
echo "- Date: 2026-03-08" >> patches/README.md
echo "- Author: AI Assistant" >> patches/README.md
echo "- Description: Fixed signature generation to match Node.js" >> patches/README.md
```

---

## 文件命名规范

### 分析脚本
- `analysis_<type>.py` - 如 `analysis_code_structure.py`
- 输出：`output/<type>_YYYY-MM-DD.md`

### 测试脚本
- `test_<feature>.py` - 如 `test_e2ee_vectors.py`
- 输出：`results/<feature>_YYYY-MM-DD.json`

### 实验文件夹
- `exp_<number>_<description>/` - 如 `exp_001_signature_fix/`

### 补丁文件
- `patch_<number>_<description>.diff` - 如 `patch_001_fix_auth.diff`

---

## 清理策略

### 每日清理
- `analysis/output/` - 保留最近 7 天的输出
- `tests/results/` - 保留最近 30 天的结果

### 每周清理
- `experiments/` - 归档已完成的实验
- `patches/` - 合并已应用的补丁

### 每月清理
- 整理所有输出和结果
- 更新文档
- 清理临时文件

---

## 与 MIGRATION-proj 工具的集成

### 使用 compare_python_nodejs.js

```bash
cd awiki/MIGRATION-proj
node tools/compare_python_nodejs.js \
  --python ../python-client/scripts \
  --nodejs ../nodejs-client/src \
  --output docs/comparison_YYYY-MM-DD.md
```

### 使用 sync_from_python.js

```bash
cd awiki/MIGRATION-proj
node tools/sync_from_python.js \
  --python ../python-client \
  --nodejs ../nodejs-client \
  --work-dir ../python-work \
  --auto-apply
```

---

## 最佳实践

### ✅ 好的做法

1. **保持 python-client/ 原始性**
   - 只读访问
   - 不创建任何文件
   - 不修改任何文件

2. **在 python-work/ 下工作**
   - 所有分析在此进行
   - 所有测试在此运行
   - 所有修改在此实验

3. **记录所有修改**
   - 实验记录详细
   - 补丁描述清晰
   - 测试结果完整

4. **定期清理**
   - 清理临时文件
   - 归档旧实验
   - 合并旧补丁

### ❌ 坏的做法

1. **直接修改 python-client/**
   - 破坏原始代码
   - 难以追踪变化
   - 影响其他工具

2. **不记录修改**
   - 忘记为什么修改
   - 难以回滚
   - 难以分享

3. **不清理临时文件**
   - 浪费磁盘空间
   - 难以找到重要文件
   - 混乱的工作区

---

## 示例：完整的修改流程

### 场景：修复 Python 签名生成问题

```bash
# 1. 分析问题
cd awiki/MIGRATION-proj/python-work/analysis
python analyze_signature.py \
  --source ../../../python-client/scripts \
  --output output/signature_analysis.md

# 2. 创建实验
cd ../experiments
mkdir exp_002_signature_fix
cd exp_002_signature_fix

# 3. 复制需要修改的代码
cp -r ../../../python-client/scripts/utils .

# 4. 进行修改
vim utils/auth.py
# 修改签名生成逻辑

# 5. 测试修改
python test_signature_fix.py
# 验证修复有效

# 6. 记录实验
vim README.md
# 记录问题、修改、测试结果

# 7. 生成补丁
cd ../../
diff -ruN \
  ../../python-client/scripts/utils \
  experiments/exp_002_signature_fix/utils \
  > patches/patch_002_signature_fix.diff

# 8. 记录补丁信息
echo "## Patch 002: Fix Signature Generation" >> patches/README.md
echo "- Date: $(date +%Y-%m-%d)" >> patches/README.md
echo "- Issue: Signature format mismatch with Node.js" >> patches/README.md
echo "- Fix: Updated to use DER encoding" >> patches/README.md

# 9. 清理
rm -rf experiments/exp_002_signature_fix/utils/__pycache__
```

---

## 联系和支持

- **问题报告**: 在 MIGRATION-proj/docs/ 创建 issue 文档
- **补丁提交**: 在 patches/ 创建补丁文件
- **实验分享**: 在 experiments/ 记录实验过程

---

**最后更新**: 2026-03-08  
**维护者**: AI Assistant  
**状态**: ✅ 已创建
