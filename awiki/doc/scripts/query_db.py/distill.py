"""Distiller script for python/scripts/query_db.py

Records input/output as golden standard for query_db.py CLI.
"""

import json
import os
import subprocess
import sys
from datetime import datetime

# 项目根目录
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCRIPT_PATH = os.path.join(PROJECT_ROOT, "python", "scripts", "query_db.py")

# 测试用例
TEST_CASES = [
    {
        "name": "查询线程列表",
        "args": ["SELECT * FROM threads LIMIT 10"],
    },
    {
        "name": "查询消息",
        "args": ["SELECT * FROM messages WHERE credential_name='alice' LIMIT 10"],
    },
    {
        "name": "查询群组",
        "args": ["SELECT * FROM groups ORDER BY last_message_at DESC LIMIT 10"],
    },
    {
        "name": "查询群组成员",
        "args": ["SELECT * FROM group_members WHERE group_id='grp_xxx' LIMIT 20"],
    },
    {
        "name": "查询关系事件",
        "args": ["SELECT * FROM relationship_events WHERE status='pending' ORDER BY created_at DESC LIMIT 20"],
    },
]


def run_query(sql: str) -> dict:
    """执行查询并捕获输入输出。"""
    cmd = [sys.executable, SCRIPT_PATH, sql]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=PROJECT_ROOT,
        )
        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Timeout after 30 seconds",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


def main() -> None:
    """运行所有测试用例并记录黄金标准。"""
    print(f"Distiller for query_db.py")
    print(f"Script path: {SCRIPT_PATH}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    results = []
    
    for i, case in enumerate(TEST_CASES, 1):
        print(f"\n[{i}/{len(TEST_CASES)}] {case['name']}")
        print(f"Input: {case['args'][0]}")
        
        output = run_query(case["args"][0])
        
        result_entry = {
            "name": case["name"],
            "input": case["args"][0],
            "output": output,
        }
        results.append(result_entry)
        
        if output["success"]:
            print(f"Status: OK (returncode={output['returncode']})")
            if output["stdout"]:
                # 截断长输出
                stdout_preview = output["stdout"][:500]
                if len(output["stdout"]) > 500:
                    stdout_preview += "\n... (truncated)"
                print(f"Stdout preview:\n{stdout_preview}")
        else:
            print(f"Status: FAILED - {output.get('error', 'Unknown error')}")
    
    # 保存结果
    output_file = os.path.join(os.path.dirname(__file__), "distill_output.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "script": "python/scripts/query_db.py",
            "timestamp": datetime.now().isoformat(),
            "results": results,
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'=' * 60}")
    print(f"Results saved to: {output_file}")
    
    # 返回失败计数
    failed_count = sum(1 for r in results if not r["output"]["success"])
    if failed_count > 0:
        print(f"Warning: {failed_count} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()

# =============================================================================
# 附录：补充场景测试 - SQL 注入防护、只读限制、多身份隔离
# =============================================================================

def test_query_db_sql_injection_protection(sql="SELECT * FROM contacts; DROP TABLE contacts; --"):
    """测试 SQL 注入防护"""
    input_data = {'scenario': 'sql_injection_protection', 'sql': sql}
    output_data = {'error_caught': False, 'error_message': None, 'protected': False}
    try:
        from query_db import execute_query
        execute_query(sql)
        output_data['error_caught'] = False
        output_data['protected'] = False
        return {'input': input_data, 'output': output_data, 'success': False}
    except Exception as e:
        output_data['error_caught'] = True
        output_data['error_message'] = str(e)
        output_data['protected'] = True
        return {'input': input_data, 'output': output_data, 'success': True}

def test_query_db_readonly_limit(sql="UPDATE contacts SET note='hacked' WHERE did='did:bob'"):
    """测试只读限制"""
    input_data = {'scenario': 'readonly_limit', 'sql': sql}
    output_data = {'error_caught': False, 'error_message': None, 'readonly_enforced': False}
    try:
        from query_db import execute_query
        execute_query(sql)
        output_data['error_caught'] = False
        output_data['readonly_enforced'] = False
        return {'input': input_data, 'output': output_data, 'success': False}
    except Exception as e:
        output_data['error_caught'] = True
        output_data['error_message'] = str(e)
        output_data['readonly_enforced'] = 'write' in str(e).lower() or 'read' in str(e).lower()
        return {'input': input_data, 'output': output_data, 'success': output_data['readonly_enforced']}
