#!/usr/bin/env python3
"""批量执行所有蒸馏脚本，生成 py.json 文件"""

import subprocess
import sys
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent
DOC_DIR = BASE_DIR / 'doc' / 'scripts'

# 需要执行的蒸馏脚本列表（按依赖顺序）
# 格式：(相对路径，CLI 参数列表或 None)
DISTILL_SCRIPTS = [
    # Phase 1: 基础工具
    ('utils/config.py', None),
    ('utils/logging_config.py', None),
    
    # Phase 2: 核心工具
    ('utils/rpc.py', None),
    ('utils/client.py', None),
    ('utils/identity.py', None),
    ('utils/auth.py', None),
    
    # Phase 3: 业务工具
    ('utils/handle.py', None),
    ('utils/e2ee.py', None),
    ('utils/resolve.py', None),
    ('utils/ws.py', None),
    
    # Phase 4: 存储层
    ('credential_store.py', None),
    ('local_store.py', None),
    
    # Phase 5: 核心业务
    ('setup_identity.py', ['--list']),
    ('register_handle.py', None),  # 需要 OTP，跳过实际执行
    ('recover_handle.py', None),
    ('resolve_handle.py', ['--handle', 'test']),
    ('send_message.py', ['--scenario', 'credential_missing', '--to', '@test', '--content', 'test']),
    ('check_inbox.py', ['--limit', '1']),
    ('get_profile.py', None),
    ('update_profile.py', None),
    
    # Phase 6: 业务功能
    ('manage_group.py', ['--list']),
    ('manage_relationship.py', ['--following']),
    ('manage_content.py', ['--list']),
    ('manage_contacts.py', ['--test']),
    ('search_users.py', ['AI']),
    ('manage_credits.py', ['--balance']),
    ('check_status.py', None),
    ('query_db.py', ['SELECT 1']),
    
    # Phase 7: E2EE
    ('e2ee_messaging.py', ['--test']),
    ('e2ee_handler.py', None),
    ('e2ee_store.py', None),
    ('e2ee_outbox.py', None),
    ('regenerate_e2ee_keys.py', None),
    
    # Phase 8: WebSocket
    ('ws_listener.py', None),
    ('listener_config.py', None),
    ('service_manager.py', None),
    
    # Phase 9: 迁移工具
    ('database_migration.py', None),
    ('credential_migration.py', None),
    ('migrate_credentials.py', None),
    ('migrate_local_database.py', None),
]

def run_distill(script_path: Path, args: list[str] = None) -> tuple[bool, str]:
    """执行单个蒸馏脚本"""
    try:
        cmd = [sys.executable, str(script_path)]
        if args:
            cmd.extend(args)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 增加到 120 秒
            cwd=BASE_DIR
        )
        
        output_file = script_path.parent / 'py.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result.stdout)
        
        if result.returncode == 0:
            return True, f"✅ {script_path.relative_to(BASE_DIR)}"
        else:
            # 截取错误信息前 200 字符
            error_msg = result.stderr[:200] if result.stderr else result.stdout[:200]
            return False, f"❌ {script_path.relative_to(BASE_DIR)}: {error_msg}"
            
    except subprocess.TimeoutExpired:
        return False, f"⏱️ {script_path.relative_to(BASE_DIR)}: 超时"
    except Exception as e:
        return False, f"❌ {script_path.relative_to(BASE_DIR)}: {str(e)[:100]}"

def main():
    """主函数"""
    print("=" * 70)
    print("批量执行蒸馏脚本")
    print("=" * 70)
    
    success_count = 0
    fail_count = 0
    results = []
    
    for script_rel_path, args in DISTILL_SCRIPTS:
        script_path = DOC_DIR / script_rel_path / 'distill.py'
        
        if not script_path.exists():
            print(f"⚠️  跳过：{script_rel_path} (distill.py 不存在)")
            continue
        
        success, message = run_distill(script_path, args)
        results.append((success, message))
        
        if success:
            success_count += 1
        else:
            fail_count += 1
        
        print(message)
    
    print("=" * 70)
    print(f"完成：成功 {success_count}/{success_count + fail_count} 个脚本")
    print("=" * 70)
    
    # 输出失败列表
    if fail_count > 0:
        print("\n失败的脚本:")
        for success, message in results:
            if not success:
                print(f"  {message}")
    
    return 0 if fail_count == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
