#!/usr/bin/env python3
"""验证步骤 1 完成情况 - Python 代码分析

检查所有 Python 文件是否都有对应的 py.md 分析报告
"""

import os
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # 向上 3 层到项目根目录
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'
DOC_SCRIPTS = PROJECT_ROOT / 'doc' / 'scripts'
DOC_TESTS = PROJECT_ROOT / 'doc' / 'tests'

def count_py_files(root_dir):
    """统计 Python 文件数量"""
    py_files = list(root_dir.rglob('*.py'))
    return len(py_files), py_files

def count_py_md_files(root_dir):
    """统计 py.md 文件数量"""
    py_md_files = []
    for py_md in root_dir.rglob('py.md'):
        py_md_files.append(py_md)
    return len(py_md_files), py_md_files

def check_step1_completion():
    """检查步骤 1 完成情况"""
    print("=" * 60)
    print("步骤 1: Python 代码分析 - 完成情况检查")
    print("=" * 60)
    
    # 统计 Python 文件
    py_count, py_files = count_py_files(PYTHON_SCRIPTS)
    print(f"\nPython 文件数量：{py_count}")
    
    # 统计 py.md 文件
    md_count, md_files = count_py_md_files(DOC_SCRIPTS)
    print(f"py.md 文件数量：{md_count}")
    
    # 检查覆盖率
    coverage = (md_count / py_count * 100) if py_count > 0 else 0
    print(f"覆盖率：{coverage:.1f}%")
    
    # 列出缺失的文件
    print("\n缺失的 py.md 文件:")
    missing = []
    for py_file in py_files:
        rel_path = py_file.relative_to(PYTHON_SCRIPTS)
        # 构建对应的 py.md 路径
        if len(rel_path.parts) > 1:
            # 有子目录，如 utils/config.py
            md_path = DOC_SCRIPTS / rel_path.parent / rel_path.name.replace('.py', '') / 'py.md'
        else:
            # 根目录文件，如 send_message.py
            md_path = DOC_SCRIPTS / rel_path.name.replace('.py', '') / 'py.md'
        
        if not md_path.exists():
            missing.append(str(rel_path))
            print(f"  ❌ {rel_path}")
    
    if not missing:
        print("  ✅ 所有文件都有 py.md")
    
    # 检查关键文件
    print("\n关键文件检查:")
    key_files = [
        'utils/config.py',
        'utils/logging_config.py',
        'utils/auth.py',
        'utils/identity.py',
        'send_message.py',
        'check_inbox.py',
        'manage_group.py',
    ]
    
    for key_file in key_files:
        py_path = PYTHON_SCRIPTS / key_file
        # 构建对应的 py.md 路径
        key_path = Path(key_file)
        if len(key_path.parts) > 1:
            # 有子目录，如 utils/config.py
            md_path = DOC_SCRIPTS / key_path.parent / key_path.name.replace('.py', '') / 'py.md'
        else:
            # 根目录文件，如 send_message.py
            md_path = DOC_SCRIPTS / key_path.name.replace('.py', '') / 'py.md'
        
        if py_path.exists() and md_path.exists():
            print(f"  ✅ {key_file}")
        elif py_path.exists():
            print(f"  ❌ {key_file} (缺少 py.md)")
        else:
            print(f"  ⚠️  {key_file} (Python 文件不存在)")
    
    # 检查 doc 根目录文件
    print("\ndoc 根目录文件检查:")
    root_files = ['cli.md', 'web.md', 'skill.py.md', 'skill.js.md', 'WORKFLOW.md']
    for root_file in root_files:
        file_path = PROJECT_ROOT / 'doc' / root_file
        if file_path.exists():
            print(f"  ✅ {root_file}")
        else:
            print(f"  ❌ {root_file} (缺失)")
    
    print("\n" + "=" * 60)
    if md_count >= py_count:
        print("✅ 步骤 1 完成！可以进入步骤 2")
    else:
        print(f"❌ 步骤 1 未完成，还需创建 {len(missing)} 个 py.md 文件")
    print("=" * 60)
    
    return len(missing) == 0

if __name__ == "__main__":
    success = check_step1_completion()
    sys.exit(0 if success else 1)
