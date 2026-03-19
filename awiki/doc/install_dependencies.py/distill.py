#!/usr/bin/env python3
"""Distill script for install_dependencies.py.

执行原始脚本并记录输入输出作为"黄金标准"。
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def main() -> int:
    """主函数：执行原始脚本并记录结果。"""
    # 获取路径
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    original_script = project_root / "python" / "install_dependencies.py"
    output_file = script_dir / "distill_output.json"
    
    print("=" * 60)
    print("Distill: install_dependencies.py")
    print("=" * 60)
    print(f"原始脚本：{original_script}")
    print(f"输出文件：{output_file}")
    print()
    
    # 检查原始脚本是否存在
    if not original_script.exists():
        print(f"错误：原始脚本不存在：{original_script}")
        return 1
    
    # 记录输入信息
    input_info = {
        "script": str(original_script),
        "timestamp": datetime.now().isoformat(),
        "working_directory": str(Path.cwd()),
        "arguments": sys.argv[1:]
    }
    
    print("执行原始脚本...")
    print("-" * 60)
    
    # 执行原始脚本
    try:
        result = subprocess.run(
            [sys.executable, str(original_script)],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(project_root)
        )
        
        output_info = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "duration": "N/A"
        }
        
        # 打印输出
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        
        print("-" * 60)
        print(f"返回码：{result.returncode}")
        
    except subprocess.TimeoutExpired:
        print("错误：脚本执行超时（30 秒）")
        output_info = {
            "stdout": "",
            "stderr": "Timeout after 30 seconds",
            "returncode": -1,
            "duration": "30s (timeout)"
        }
    except Exception as e:
        print(f"错误：{e}")
        output_info = {
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
            "duration": "N/A"
        }
    
    # 保存蒸馏结果
    distill_result = {
        "input": input_info,
        "output": output_info,
        "metadata": {
            "source_script": "python/install_dependencies.py",
            "distill_script": "doc/install_dependencies.py/distill.py",
            "purpose": "记录输入输出作为黄金标准"
        }
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(distill_result, f, indent=2, ensure_ascii=False)
    
    print()
    print(f"蒸馏结果已保存到：{output_file}")
    
    return output_info["returncode"]


if __name__ == "__main__":
    sys.exit(main())
