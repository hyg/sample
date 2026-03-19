#!/usr/bin/env python
"""蒸馏脚本：验证 utils 包入口并记录输入输出作为"黄金标准"

[INPUT]: python/scripts/utils/__init__.py 及其依赖模块
[OUTPUT]: 导入验证结果、导出列表、模块信息
[POS]: 验证包入口文件的完整性和可导入性
"""

import sys
import os
from datetime import datetime

# 添加项目路径
# distill.py 位于 doc/scripts/utils/__init__.py/distill.py
# 需要添加到 python/scripts
# 路径：doc/scripts/utils/__init__.py -> doc/scripts/utils -> doc/scripts -> doc -> awiki -> python/scripts
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'python', 'scripts'))
sys.path.insert(0, PROJECT_ROOT)

def main():
    print("=" * 60)
    print("utils 包入口蒸馏报告")
    print("=" * 60)
    print(f"执行时间：{datetime.now().isoformat()}")
    print(f"项目路径：{PROJECT_ROOT}")
    print()

    # 记录输入
    print("-" * 60)
    print("【INPUT】输入模块")
    print("-" * 60)
    input_modules = [
        "utils.config",
        "utils.identity",
        "utils.auth",
        "utils.client",
        "utils.e2ee",
        "utils.rpc",
        "utils.handle",
        "utils.logging_config",
        "utils.ws",
        "utils.resolve",
    ]
    for mod in input_modules:
        print(f"  - {mod}")
    print()

    # 尝试导入并记录输出
    print("-" * 60)
    print("【OUTPUT】导入验证")
    print("-" * 60)
    
    try:
        import utils
        print(f"✓ utils 包导入成功")
        print(f"  包路径：{getattr(utils, '__path__', 'N/A')}")
        print(f"  包文件：{getattr(utils, '__file__', 'N/A')}")
        print()
        
        # 验证 __all__ 导出
        print("-" * 60)
        print("【OUTPUT】__all__ 导出列表")
        print("-" * 60)
        all_exports = getattr(utils, '__all__', [])
        print(f"导出数量：{len(all_exports)}")
        for item in all_exports:
            print(f"  - {item}")
        print()
        
        # 验证实际可访问的导出
        print("-" * 60)
        print("【OUTPUT】实际可访问性验证")
        print("-" * 60)
        accessible = []
        not_accessible = []
        
        for name in all_exports:
            try:
                obj = getattr(utils, name)
                obj_type = type(obj).__name__
                if hasattr(obj, '__module__'):
                    obj_module = obj.__module__
                else:
                    obj_module = 'N/A'
                accessible.append((name, obj_type, obj_module))
                print(f"  ✓ {name}: {obj_type} (来自 {obj_module})")
            except AttributeError as e:
                not_accessible.append((name, str(e)))
                print(f"  ✗ {name}: {str(e)}")
        
        print()
        
        # 汇总
        print("-" * 60)
        print("【SUMMARY】汇总")
        print("-" * 60)
        print(f"总导出数：{len(all_exports)}")
        print(f"可访问：{len(accessible)}")
        print(f"不可访问：{len(not_accessible)}")
        
        if not_accessible:
            print()
            print("警告：以下导出项不可访问:")
            for name, error in not_accessible:
                print(f"  - {name}: {error}")
            return 1
        
        print()
        print("✓ 所有导出项验证通过")
        return 0
        
    except ImportError as e:
        print(f"✗ 导入失败：{e}")
        return 1
    except Exception as e:
        print(f"✗ 执行错误：{e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
