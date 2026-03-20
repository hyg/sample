#!/usr/bin/env python3
"""批量执行所有蒸馏脚本，生成 py.json 文件"""

import subprocess
import sys
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent
DOC_DIR = BASE_DIR / 'doc' / 'scripts'

# 需要执行的蒸馏脚本列表（按依赖顺序）
DISTILL_SCRIPTS = [
    # Phase 1: 基础工具
    'utils/config.py',
    'utils/logging_config.py',
    
    # Phase 2: 核心工具
    'utils/rpc.py',
    'utils/client.py',
    'utils/identity.py',
    'utils/auth.py',
    
    # Phase 3: 业务工具
    'utils/handle.py',
    'utils/e2ee.py',
    'utils/resolve.py',
    'utils/ws.py',
    
    # Phase 4: 存储层
    'credential_store.py',
    'local_store.py',
    
    # Phase 5: 核心业务
    'setup_identity.py',
    'register_handle.py',
    'recover_handle.py',
    'resolve_handle.py',
    'send_message.py',
    'check_inbox.py',
    'get_profile.py',
    'update_profile.py',
    
    # Phase 6: 业务功能
    'manage_group.py',
    'manage_relationship.py',
    'manage_content.py',
    'manage_contacts.py',
    'search_users.py',
    'manage_credits.py',
    'check_status.py',
    'query_db.py',
    
    # Phase 7: E2EE
    'e2ee_messaging.py',
    'e2ee_handler.py',
    'e2ee_store.py',
    'e2ee_outbox.py',
    'regenerate_e2ee_keys.py',
    
    # Phase 8: WebSocket
    'ws_listener.py',
    'listener_config.py',
    'service_manager.py',
    
    # Phase 9: 迁移工具
    'database_migration.py',
    'credential_migration.py',
    'migrate_credentials.py',
    'migrate_local_database.py',
]

def run_distill(script_path: Path) -> tuple[bool, str]:
    """执行单个蒸馏脚本"""
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=BASE_DIR
        )
        
        output_file = script_path.parent / 'py.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result.stdout)
        
        if result.returncode == 0:
            return True, f"✅ {script_path.relative_to(BASE_DIR)}"
        else:
            return False, f"❌ {script_path.relative_to(BASE_DIR)}: {result.stderr[:100]}"
            
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
    
    for script_rel_path in DISTILL_SCRIPTS:
        script_path = DOC_DIR / script_rel_path / 'distill.py'
        
        if not script_path.exists():
            print(f"⚠️  跳过：{script_rel_path} (distill.py 不存在)")
            continue
        
        success, message = run_distill(script_path)
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
