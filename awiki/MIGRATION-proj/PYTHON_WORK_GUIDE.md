# Python 代码修改指南

**重要**: 所有对 Python 代码的修改都必须在 `MIGRATION-proj/python-work/` 下进行

---

## 目录

1. [为什么不能直接修改 python-client](#为什么不能直接修改-python-client)
2. [python-work 使用指南](#python-work-使用指南)
3. [常见场景示例](#常见场景示例)
4. [最佳实践](#最佳实践)

---

## 为什么不能直接修改 python-client

### ❌ 错误做法

```bash
# 错误！不要这样做
cd awiki/python-client/scripts
vim utils/auth.py  # ❌ 直接修改原始代码
```

### 原因

1. **保持参考性** - python-client 是 Python 版本的原始参考
2. **可追溯性** - 清楚地知道哪些是原始代码，哪些是修改
3. **版本管理** - 当 Python 版本更新时，可以轻松对比差异
4. **补丁管理** - 使用补丁文件记录所有修改

---

## python-work 使用指南

### 目录结构

```
MIGRATION-proj/python-work/
├── analysis/           # 分析脚本和输出
├── tests/              # 测试脚本和结果
├── experiments/        # 实验性修改
└── patches/            # 补丁文件
```

### 场景 1: 分析 Python 代码

```bash
# 1. 在 analysis/ 下创建分析脚本
cd awiki/MIGRATION-proj/python-work/analysis
cat > analyze_signature.py << 'EOF'
import sys
sys.path.insert(0, '../../python-client/scripts')

from utils.auth import generate_wba_auth_header
# ... 分析代码
EOF

# 2. 运行分析（指向 python-client）
python analyze_signature.py ../../python-client/scripts/

# 3. 保存输出
mkdir -p output
python analyze_signature.py ../../python-client/scripts/ > output/signature_analysis_$(date +%Y-%m-%d).md
```

### 场景 2: 测试 Python 功能

```bash
# 1. 在 tests/ 下创建测试脚本
cd awiki/MIGRATION-proj/python-work/tests
cat > test_e2ee_vectors.py << 'EOF'
import sys
sys.path.insert(0, '../../python-client/scripts')

from utils.e2ee import encrypt_message
# ... 测试代码
EOF

# 2. 运行测试
python test_e2ee_vectors.py

# 3. 保存结果
mkdir -p results
python test_e2ee_vectors.py > results/e2ee_test_$(date +%Y-%m-%d).json
```

### 场景 3: 实验性修改

```bash
# 1. 创建实验文件夹
cd awiki/MIGRATION-proj/python-work/experiments
mkdir exp_001_signature_fix
cd exp_001_signature_fix

# 2. 复制需要修改的模块（不是整个目录）
cp -r ../../../python-client/scripts/utils .

# 3. 进行修改
vim utils/auth.py
# 修改签名生成逻辑

# 4. 测试修改
cat > test_fix.py << 'EOF'
import sys
sys.path.insert(0, '.')

from utils.auth import generate_wba_auth_header
# ... 测试修改后的代码
EOF
python test_fix.py

# 5. 记录实验
cat > README.md << 'EOF'
# Experiment 001: Signature Fix

## Problem
Python signature format doesn't match Node.js

## Solution
Updated DER encoding in utils/auth.py

## Test Result
✓ PASS - Signature now matches Node.js
EOF
```

### 场景 4: 生成补丁

```bash
# 1. 完成实验后，生成补丁
cd awiki/MIGRATION-proj/python-work

diff -ruN \
  ../../python-client/scripts/utils \
  experiments/exp_001_signature_fix/utils \
  > patches/patch_001_signature_fix.diff

# 2. 记录补丁信息
cat >> patches/README.md << 'EOF'
## Patch 001: Fix Signature Generation
- Date: 2026-03-08
- Author: AI Assistant
- Issue: Signature format mismatch with Node.js
- Fix: Updated to use DER encoding
- File: patches/patch_001_signature_fix.diff
EOF

# 3. 验证补丁
cd ../../python-client/scripts
patch -p1 --dry-run < ../../MIGRATION-proj/python-work/patches/patch_001_signature_fix.diff
```

### 场景 5: 应用补丁

```bash
# 1. 在测试环境应用补丁
cd /tmp/test-env
cp -r awiki/python-client/scripts .
cd scripts

# 2. 应用补丁
patch -p1 < ../MIGRATION-proj/python-work/patches/patch_001_signature_fix.diff

# 3. 运行测试
python -m pytest tests/test_auth.py

# 4. 如果测试通过，记录补丁状态
cd awiki/MIGRATION-proj/python-work/patches
echo "- Status: ✓ Tested and working" >> README.md
```

---

## 常见场景示例

### 示例 1: 分析签名差异

```bash
cd awiki/MIGRATION-proj/python-work/analysis

cat > compare_signatures.py << 'EOF'
#!/usr/bin/env python3
"""Compare Python and Node.js signature generation"""

import sys
import json
sys.path.insert(0, sys.argv[1])

from utils.auth import generate_wba_auth_header
from utils.identity import create_identity

# Create test identity
identity = create_identity(
    hostname='awiki.ai',
    path_prefix=['user'],
    proof_purpose='authentication',
    domain='awiki.ai'
)

# Generate auth header
auth_header = generate_wba_auth_header(identity, 'awiki.ai')

# Output for comparison
print(json.dumps({
    'auth_header': auth_header,
    'did': identity.did,
    'timestamp': identity.did_document['proof']['created']
}, indent=2))
EOF

# Run and save output
mkdir -p output
python compare_signatures.py ../../python-client/scripts/ > output/signature_comparison_$(date +%Y-%m-%d).json
```

### 示例 2: 测试 E2EE 兼容性

```bash
cd awiki/MIGRATION-proj/python-work/tests

cat > test_e2ee_compatibility.py << 'EOF'
#!/usr/bin/env python3
"""Test E2EE compatibility between Python and Node.js"""

import sys
sys.path.insert(0, sys.argv[1])

from utils.e2ee import encrypt_message, decrypt_message
import json

# Test vectors
test_cases = [
    {'plaintext': 'Hello, World!', 'aad': b'test'},
    {'plaintext': 'Test message', 'aad': b'e2ee'},
]

results = []
for i, case in enumerate(test_cases):
    # Encrypt
    ciphertext = encrypt_message(case['plaintext'], case['aad'])
    
    # Decrypt
    decrypted = decrypt_message(ciphertext, case['aad'])
    
    # Verify
    match = decrypted == case['plaintext']
    
    results.append({
        'case': i,
        'plaintext': case['plaintext'],
        'ciphertext': ciphertext.hex(),
        'decrypted': decrypted,
        'match': match
    })

print(json.dumps(results, indent=2))
EOF

# Run and save
mkdir -p results
python test_e2ee_compatibility.py ../../python-client/scripts/ > results/e2ee_compatibility_$(date +%Y-%m-%d).json
```

### 示例 3: 创建完整实验

```bash
cd awiki/MIGRATION-proj/python-work/experiments

# Create experiment directory
mkdir exp_003_jwt_auto_refresh
cd exp_003_jwt_auto_refresh

# Copy modules to modify
cp -r ../../../python-client/scripts/utils .
cp -r ../../../python-client/scripts/credential_store.py .

# Modify utils/rpc.py for auto-refresh
cat > utils/rpc.py.patch << 'EOF'
--- rpc.py.original
+++ rpc.py
@@ -100,6 +100,20 @@ async def authenticated_rpc_call(
     resp = await client.post(endpoint, json=payload, headers=auth_headers)
 
     # 401 -> clear expired token -> re-authenticate -> retry
+    if resp.status_code == 401:
+        auth.clear_token(server_url)
+        auth_headers = auth.get_auth_header(server_url, force_new=True)
+        resp = await client.post(endpoint, json=payload, headers=auth_headers)
+        
+        # Cache new token
+        auth_header_value = resp.headers.get("authorization", "")
+        new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
+        if new_token:
+            from credential_store import update_jwt
+            update_jwt(credential_name, new_token)
+
+    # Check for errors
     if resp.status_code >= 400:
         raise Exception(f"HTTP error {resp.status_code}")
EOF

# Apply patch
cd utils
cp rpc.py rpc.py.original
patch < rpc.py.patch

# Test the modification
cat > test_jwt_refresh.py << 'EOF'
import sys
sys.path.insert(0, '.')

from utils.rpc import authenticated_rpc_call
# Test JWT auto-refresh functionality
EOF
python test_jwt_refresh.py

# Document the experiment
cat > README.md << 'EOF'
# Experiment 003: JWT Auto-Refresh

## Objective
Implement automatic JWT refresh on 401 error

## Changes
- Modified `utils/rpc.py` to handle 401 errors
- Added automatic re-authentication
- Added new JWT caching

## Test Result
✓ PASS - JWT automatically refreshes on 401

## Next Steps
- Generate patch file
- Test with Node.js client
EOF
```

---

## 最佳实践

### ✅ 好的做法

1. **保持 python-client 只读**
   ```bash
   # 只读访问
   cat ../../python-client/scripts/utils/auth.py
   # ✓ 正确
   
   # 不修改
   vim ../../python-client/scripts/utils/auth.py
   # ✗ 错误
   ```

2. **在 python-work 下工作**
   ```bash
   cd awiki/MIGRATION-proj/python-work/experiments
   mkdir exp_new_feature
   # ✓ 正确
   ```

3. **记录所有修改**
   ```bash
   cd experiments/exp_001
   cat > README.md  # 记录实验过程
   # ✓ 正确
   ```

4. **使用补丁文件**
   ```bash
   cd awiki/MIGRATION-proj/python-work
   diff -ruN ../../python-client/scripts/utils experiments/exp_001/utils > patches/patch_001.diff
   # ✓ 正确
   ```

5. **定期清理**
   ```bash
   # 清理临时文件
   find . -name "__pycache__" -type d -exec rm -rf {} +
   find . -name "*.pyc" -delete
   # ✓ 正确
   ```

### ❌ 坏的做法

1. **直接修改 python-client**
   ```bash
   cd ../../python-client/scripts
   vim utils/auth.py  # ✗ 错误
   ```

2. **不记录修改**
   ```bash
   cd experiments/exp_001
   # 没有 README.md  # ✗ 错误
   ```

3. **创建临时文件在 python-client**
   ```bash
   cd ../../python-client/scripts
   touch test_temp.py  # ✗ 错误
   ```

4. **不清理临时文件**
   ```bash
   # 留下大量 __pycache__  # ✗ 错误
   ```

---

## 清理和维护

### 每日清理

```bash
cd awiki/MIGRATION-proj/python-work

# 清理 Python 缓存
find . -name "__pycache__" -type d -exec rm -rf {} +
find . -name "*.pyc" -delete

# 清理临时文件
rm -f analysis/output/*.tmp
rm -f tests/results/*.tmp
```

### 每周清理

```bash
# 归档旧实验
cd experiments
for dir in exp_*; do
    if [ -f "$dir/README.md" ] && grep -q "COMPLETED" "$dir/README.md"; then
        mv "$dir" ../archive/$(date +%Y%m)_$(basename "$dir")
    fi
done

# 清理旧输出（保留最近 30 天）
find analysis/output -name "*.md" -mtime +30 -delete
find tests/results -name "*.json" -mtime +30 -delete
```

### 每月清理

```bash
# 整理补丁
cd patches
for patch in patch_*.diff; do
    if grep -q "APPLIED" README.md; then
        mv "$patch" ../archive/applied/
    fi
done

# 更新文档
cat > WORKSPACE_SUMMARY.md << 'EOF'
# Python Workspace Summary

## Active Experiments
$(ls -1 experiments/ | wc -l)

## Pending Patches
$(ls -1 patches/*.diff | wc -l)

## Recent Analysis
$(ls -1 analysis/output/*.md | tail -5)
EOF
```

---

## 联系和支持

- **问题**: 在 MIGRATION-proj/docs/ 创建 issue 文档
- **补丁**: 提交到 patches/ 文件夹
- **实验**: 记录在 experiments/ 文件夹

---

**最后更新**: 2026-03-08  
**维护者**: AI Assistant
