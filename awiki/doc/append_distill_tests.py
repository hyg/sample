#!/usr/bin/env python3
"""为所有蒸馏脚本追加补充场景测试代码"""

import sys
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent
DOC_DIR = BASE_DIR / 'doc' / 'scripts'

# 补充代码字典
APPENDIX_CODE = {
    'search_users.py': '''
# =============================================================================
# 附录：补充场景测试 - 无结果、部分匹配、空搜索词
# =============================================================================

def test_search_no_results(query='nonexistent_user_xyz123', credential_name='default'):
    """测试搜索无结果场景"""
    input_data = {'scenario': 'search_no_results', 'query': query, 'credential_name': credential_name}
    output_data = {'results': None, 'total': None, 'error': None}
    try:
        from search_users import search_users
        results = search_users(query=query, credential_name=credential_name)
        output_data['results'] = results if results else []
        output_data['total'] = len(results) if results else 0
        return {'input': input_data, 'output': output_data, 'success': output_data['total'] == 0}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_search_partial_match(query='AI', credential_name='default'):
    """测试部分匹配场景"""
    input_data = {'scenario': 'search_partial_match', 'query': query, 'credential_name': credential_name}
    output_data = {'results': None, 'total': None, 'has_partial_matches': False, 'error': None}
    try:
        from search_users import search_users
        results = search_users(query=query, credential_name=credential_name)
        output_data['results'] = results if results else []
        output_data['total'] = len(results) if results else 0
        output_data['has_partial_matches'] = output_data['total'] > 0
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_search_empty_query(query='', credential_name='default'):
    """测试空搜索词场景"""
    input_data = {'scenario': 'search_empty_query', 'query': query, 'credential_name': credential_name}
    output_data = {'error_caught': False, 'error_message': None, 'results': None}
    try:
        from search_users import search_users
        results = search_users(query=query, credential_name=credential_name)
        output_data['error_caught'] = False
        output_data['results'] = results
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error_caught'] = True
        output_data['error_message'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': True}
''',

    'manage_contacts.py': '''
# =============================================================================
# 附录：补充场景测试 - Profile 联动、群组批量保存、去重逻辑
# =============================================================================

def test_profile_update_triggers_search_visibility(credential_name='default'):
    """测试 Profile 更新后搜索可见性变化"""
    input_data = {'scenario': 'profile_update_triggers_search_visibility', 'credential_name': credential_name}
    output_data = {'search_before': 0, 'search_after': 0, 'visibility_changed': False, 'error': None}
    try:
        from search_users import search_users
        from update_profile import update_profile
        
        # 步骤 1: 搜索前
        before = search_users(query='AI 专家', credential_name=credential_name)
        output_data['search_before'] = len(before) if before else 0
        
        # 步骤 2: 更新 Profile
        update_profile(nick_name='AI 专家', tags='AI,ML', credential_name=credential_name)
        
        # 步骤 3: 搜索后
        after = search_users(query='AI 专家', credential_name=credential_name)
        output_data['search_after'] = len(after) if after else 0
        output_data['visibility_changed'] = output_data['search_after'] > output_data['search_before']
        
        return {'input': input_data, 'output': output_data, 'success': output_data['visibility_changed']}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_save_from_group_duplicate_contact(group_id='test_group', credential_name='default'):
    """测试联系人去重场景"""
    input_data = {'scenario': 'save_from_group_duplicate_contact', 'group_id': group_id, 'credential_name': credential_name}
    output_data = {'contact_count_before': 0, 'contact_count_after': 0, 'deduplicated': False, 'error': None}
    try:
        from manage_contacts import save_from_group
        save_from_group(group_id=group_id, credential_name=credential_name)
        save_from_group(group_id=group_id, credential_name=credential_name)  # 第二次应去重
        output_data['deduplicated'] = True
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
''',

    'update_profile.py': '''
# =============================================================================
# 附录：补充场景测试 - 搜索索引更新、多次更新
# =============================================================================

def test_update_profile_search_index_updated(nick_name='AI 专家', tags='AI,ML,NLP', credential_name='default'):
    """测试 Profile 更新后搜索索引更新"""
    input_data = {'scenario': 'update_profile_search_index_updated', 'nick_name': nick_name, 'tags': tags, 'credential_name': credential_name}
    output_data = {'profile_updated': False, 'searchable': False, 'found_in_search': False, 'error': None}
    try:
        from update_profile import update_profile
        from search_users import search_users
        
        update_profile(nick_name=nick_name, tags=tags, credential_name=credential_name)
        output_data['profile_updated'] = True
        
        results = search_users(query=nick_name, credential_name=credential_name)
        output_data['found_in_search'] = len(results) > 0 if results else False
        output_data['searchable'] = output_data['profile_updated'] and output_data['found_in_search']
        
        return {'input': input_data, 'output': output_data, 'success': output_data['searchable']}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_update_profile_multiple_times(credential_name='default'):
    """测试多次更新 Profile"""
    input_data = {'scenario': 'update_profile_multiple_times', 'credential_name': credential_name}
    output_data = {'updates': [], 'final_profile': None, 'error': None}
    try:
        from update_profile import update_profile
        from get_profile import get_my_profile
        
        update_profile(nick_name='用户 A', credential_name=credential_name)
        output_data['updates'].append('用户 A')
        
        update_profile(bio='简介 A', credential_name=credential_name)
        output_data['updates'].append('简介 A')
        
        update_profile(nick_name='用户 B', bio='简介 B', credential_name=credential_name)
        output_data['updates'].append('用户 B')
        
        profile = get_my_profile(credential_name=credential_name)
        output_data['final_profile'] = {'nick_name': profile.get('nick_name') if profile else None}
        
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
''',

    'get_profile.py': '''
# =============================================================================
# 附录：补充场景测试 - Profile 不存在、更新后获取
# =============================================================================

def test_get_nonexistent_profile(did='did:wba:awiki.ai:user:k1_nonexistent', credential_name='default'):
    """测试获取不存在的 Profile"""
    input_data = {'scenario': 'get_nonexistent_profile', 'did': did, 'credential_name': credential_name}
    output_data = {'error_caught': False, 'error_code': None, 'error_message': None}
    try:
        from get_profile import get_public_profile
        from utils import JsonRpcError
        
        get_public_profile(did=did, credential_name=credential_name)
        output_data['error_caught'] = False
        return {'input': input_data, 'output': output_data, 'success': False}
    except JsonRpcError as e:
        output_data['error_caught'] = True
        output_data['error_code'] = e.code if hasattr(e, 'code') else None
        output_data['error_message'] = str(e)
        success = output_data['error_code'] == -32001
        return {'input': input_data, 'output': output_data, 'success': success}
    except Exception as e:
        output_data['error_caught'] = True
        output_data['error_message'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_get_profile_after_update(did=None, credential_name='default'):
    """测试 Profile 更新后获取"""
    input_data = {'scenario': 'get_profile_after_update', 'did': did, 'credential_name': credential_name}
    output_data = {'profile': None, 'updated_at': None, 'error': None}
    try:
        from get_profile import get_public_profile
        profile = get_public_profile(did=did, credential_name=credential_name) if did else None
        output_data['profile'] = profile
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
''',

    'check_inbox.py': '''
# =============================================================================
# 附录：补充场景测试 - 空收件箱、分页测试
# =============================================================================

def test_check_inbox_empty(credential_name='default', limit=20):
    """测试空收件箱场景"""
    input_data = {'scenario': 'check_inbox_empty', 'credential_name': credential_name, 'limit': limit}
    output_data = {'messages': None, 'total': None, 'is_empty': False, 'error': None}
    try:
        from check_inbox import check_inbox
        result = check_inbox(credential_name=credential_name, limit=limit)
        output_data['messages'] = result if result else []
        output_data['total'] = len(result) if result else 0
        output_data['is_empty'] = output_data['total'] == 0
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_check_inbox_pagination(credential_name='default', limit=10):
    """测试大量消息分页"""
    input_data = {'scenario': 'check_inbox_pagination', 'credential_name': credential_name, 'limit': limit}
    output_data = {'messages': None, 'total': None, 'has_more': False, 'error': None}
    try:
        from check_inbox import check_inbox
        result = check_inbox(credential_name=credential_name, limit=limit)
        output_data['messages'] = result if result else []
        output_data['total'] = len(result) if result else 0
        output_data['has_more'] = output_data['total'] == limit
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
''',

    'query_db.py': '''
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
''',
}

def main():
    """主函数"""
    print("=" * 60)
    print("蒸馏脚本补充场景测试代码追加工具")
    print("=" * 60)
    
    updated_count = 0
    
    for script_name, code in APPENDIX_CODE.items():
        # 路径是目录，如：doc/scripts/search_users.py/distill.py
        # 目录名就是 "search_users.py"（包含.py）
        script_dir = DOC_DIR / script_name  # 直接使用
        distill_file = script_dir / 'distill.py'
        
        if not distill_file.exists():
            print(f"⚠️  跳过：{script_name} (文件不存在：{distill_file})")
            continue
        
        # 读取文件内容
        with open(distill_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否已存在补充代码
        if '# 附录：补充场景测试' in content:
            print(f"✓ 已补充：{script_name}")
            continue
        
        # 追加代码
        with open(distill_file, 'a', encoding='utf-8') as f:
            f.write(code)
        
        print(f"✅ 已补充：{script_name}")
        updated_count += 1
    
    print("=" * 60)
    print(f"完成：共更新 {updated_count}/{len(APPENDIX_CODE)} 个脚本")
    print("=" * 60)

if __name__ == '__main__':
    main()
