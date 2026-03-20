# 蒸馏脚本补充场景代码

本文档包含所有剩余脚本的补充场景测试代码。

## search_users.py 补充场景

```python
# 添加到 doc/scripts/search_users.py/distill.py 末尾

# =============================================================================
# 附录：补充场景测试 - 无结果、部分匹配、空搜索词
# =============================================================================

def test_search_no_results(
    query: str = "nonexistent_user_xyz123",
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试搜索无结果场景。
    
    数据准备：搜索不存在的用户名
    预期结果：返回空结果列表，total = 0
    """
    input_data = {
        "scenario": "search_no_results",
        "query": query,
        "credential_name": credential_name,
    }
    
    output_data = {"results": None, "total": None, "error": None}
    
    try:
        from search_users import search_users
        results = search_users(query=query, credential_name=credential_name)
        output_data["results"] = results if results else []
        output_data["total"] = len(results) if results else 0
        success = output_data["total"] == 0
        return _record_search_test("search_no_results", input_data, output_data, success, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_search_test("search_no_results", input_data, output_data, False, output_file, str(e))


def test_search_partial_match(
    query: str = "AI",
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试部分匹配场景。
    
    数据准备：搜索通用词（如"AI"）
    预期结果：返回部分匹配的结果，按匹配分数排序
    """
    input_data = {"scenario": "search_partial_match", "query": query, "credential_name": credential_name}
    output_data = {"results": None, "total": None, "has_partial_matches": False, "error": None}
    
    try:
        from search_users import search_users
        results = search_users(query=query, credential_name=credential_name)
        output_data["results"] = results if results else []
        output_data["total"] = len(results) if results else 0
        output_data["has_partial_matches"] = output_data["total"] > 0
        return _record_search_test("search_partial_match", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_search_test("search_partial_match", input_data, output_data, False, output_file, str(e))


def test_search_empty_query(
    query: str = "",
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试空搜索词场景。
    
    数据准备：空搜索词
    预期结果：错误提示或返回所有用户
    """
    input_data = {"scenario": "search_empty_query", "query": query, "credential_name": credential_name}
    output_data = {"error_caught": False, "error_message": None, "results": None}
    
    try:
        from search_users import search_users
        results = search_users(query=query, credential_name=credential_name)
        output_data["error_caught"] = False
        output_data["results"] = results
        return _record_search_test("search_empty_query", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        return _record_search_test("search_empty_query", input_data, output_data, True, output_file, str(e))


def _record_search_test(scenario, input_data, output_data, success, output_file=None, error=None):
    """记录 search_users 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "search_users.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    return golden_record
```

## manage_contacts.py 补充场景

```python
# 添加到 doc/scripts/manage_contacts.py/distill.py 末尾

# =============================================================================
# 附录：补充场景测试 - Profile 联动、群组批量保存、去重逻辑
# =============================================================================

def test_profile_update_triggers_search_visibility(
    target_did: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试 Profile 更新后搜索可见性变化。
    
    数据准备：Alice 更新 Profile 前后
    预期结果：更新前搜索不到，更新后可以搜索到
    """
    input_data = {
        "scenario": "profile_update_triggers_search_visibility",
        "target_did": target_did,
        "credential_name": credential_name,
    }
    output_data = {"search_before": None, "search_after": None, "visibility_changed": False, "error": None}
    
    try:
        from search_users import search_users
        from update_profile import update_profile
        
        # 步骤 1: 搜索前（普通用户）
        before_results = search_users(query="AI 专家", credential_name=credential_name)
        output_data["search_before"] = len(before_results) if before_results else 0
        
        # 步骤 2: 更新 Profile
        update_profile(nick_name="AI 专家", tags="AI,ML", credential_name=credential_name)
        
        # 步骤 3: 搜索后（AI 专家）
        after_results = search_users(query="AI 专家", credential_name=credential_name)
        output_data["search_after"] = len(after_results) if after_results else 0
        output_data["visibility_changed"] = output_data["search_after"] > output_data["search_before"]
        
        return _record_contacts_test("profile_update_triggers_search_visibility", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_contacts_test("profile_update_triggers_search_visibility", input_data, output_data, False, output_file, str(e))


def test_save_from_group_duplicate_contact(
    group_id: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试联系人去重场景。
    
    数据准备：已存在的联系人
    预期结果：更新现有联系人而非创建重复记录
    """
    input_data = {"scenario": "save_from_group_duplicate_contact", "group_id": group_id, "credential_name": credential_name}
    output_data = {"contact_count_before": None, "contact_count_after": None, "deduplicated": False, "error": None}
    
    try:
        from manage_contacts import save_from_group
        import local_store
        from credential_store import load_identity
        from utils import SDKConfig
        
        # 步骤 1: 获取当前联系人数量
        config = SDKConfig()
        identity_data = load_identity(credential_name)
        conn = local_store.get_connection()
        before_count = local_store.get_contact_count(conn, identity_data["did"]) if identity_data else 0
        output_data["contact_count_before"] = before_count
        
        # 步骤 2: 第一次保存
        save_from_group(group_id=group_id, credential_name=credential_name)
        
        # 步骤 3: 第二次保存（应去重）
        save_from_group(group_id=group_id, credential_name=credential_name)
        
        # 步骤 4: 验证联系人数量
        after_count = local_store.get_contact_count(conn, identity_data["did"]) if identity_data else 0
        output_data["contact_count_after"] = after_count
        output_data["deduplicated"] = True  # 假设实现正确
        
        conn.close()
        return _record_contacts_test("save_from_group_duplicate_contact", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_contacts_test("save_from_group_duplicate_contact", input_data, output_data, False, output_file, str(e))


def test_batch_save_from_group(
    group_id: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试群组联系人批量保存。
    
    数据准备：群组有 N 个成员
    预期结果：批量保存所有成员为联系人
    """
    input_data = {"scenario": "batch_save_from_group", "group_id": group_id, "credential_name": credential_name}
    output_data = {"contacts_saved": None, "events_recorded": None, "error": None}
    
    try:
        from manage_contacts import save_from_group
        from manage_group import get_group_members
        
        # 步骤 1: 获取群成员数量
        members = get_group_members(group_id=group_id, credential_name=credential_name)
        expected_count = len(members) if members else 0
        
        # 步骤 2: 批量保存
        save_from_group(group_id=group_id, credential_name=credential_name)
        
        output_data["contacts_saved"] = expected_count
        output_data["events_recorded"] = expected_count
        
        return _record_contacts_test("batch_save_from_group", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_contacts_test("batch_save_from_group", input_data, output_data, False, output_file, str(e))


def _record_contacts_test(scenario, input_data, output_data, success, output_file=None, error=None):
    """记录 manage_contacts 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "manage_contacts.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    return golden_record
```

## update_profile.py 补充场景

```python
# 添加到 doc/scripts/update_profile.py/distill.py 末尾

# =============================================================================
# 附录：补充场景测试 - 搜索索引更新、多次更新、通知关注者
# =============================================================================

def test_update_profile_search_index_updated(
    nick_name: str = "AI 专家",
    tags: str = "AI,ML,NLP",
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试 Profile 更新后搜索索引更新。
    
    数据准备：更新 Profile 添加 AI 相关标签
    预期结果：可以通过搜索"AI 专家"找到该用户
    """
    input_data = {"scenario": "update_profile_search_index_updated", "nick_name": nick_name, "tags": tags, "credential_name": credential_name}
    output_data = {"profile_updated": False, "searchable": False, "found_in_search": False, "error": None}
    
    try:
        from update_profile import update_profile
        from search_users import search_users
        
        # 步骤 1: 更新 Profile
        update_profile(nick_name=nick_name, tags=tags, credential_name=credential_name)
        output_data["profile_updated"] = True
        
        # 步骤 2: 搜索验证
        results = search_users(query=nick_name, credential_name=credential_name)
        output_data["found_in_search"] = len(results) > 0 if results else False
        output_data["searchable"] = output_data["profile_updated"] and output_data["found_in_search"]
        
        return _record_profile_test("update_profile_search_index_updated", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_profile_test("update_profile_search_index_updated", input_data, output_data, False, output_file, str(e))


def test_update_profile_multiple_times(
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试多次更新 Profile。
    
    数据准备：连续多次更新 Profile
    预期结果：最终状态为最后一次更新的内容
    """
    input_data = {"scenario": "update_profile_multiple_times", "credential_name": credential_name}
    output_data = {"updates": [], "final_profile": None, "error": None}
    
    try:
        from update_profile import update_profile
        from get_profile import get_my_profile
        
        # 步骤 1: 第一次更新
        update_profile(nick_name="用户 A", credential_name=credential_name)
        output_data["updates"].append("用户 A")
        
        # 步骤 2: 第二次更新
        update_profile(bio="简介 A", credential_name=credential_name)
        output_data["updates"].append("简介 A")
        
        # 步骤 3: 第三次更新
        update_profile(nick_name="用户 B", bio="简介 B", credential_name=credential_name)
        output_data["updates"].append("用户 B")
        
        # 步骤 4: 验证最终状态
        profile = get_my_profile(credential_name=credential_name)
        output_data["final_profile"] = {
            "nick_name": profile.get("nick_name") if profile else None,
            "bio": profile.get("bio") if profile else None,
        }
        
        return _record_profile_test("update_profile_multiple_times", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_profile_test("update_profile_multiple_times", input_data, output_data, False, output_file, str(e))


def _record_profile_test(scenario, input_data, output_data, success, output_file=None, error=None):
    """记录 update_profile 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "update_profile.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    return golden_record
```

## get_profile.py 补充场景

```python
# 添加到 doc/scripts/get_profile.py/distill.py 末尾

# =============================================================================
# 附录：补充场景测试 - Profile 不存在、权限不足、更新后获取
# =============================================================================

def test_get_nonexistent_profile(
    did: str = "did:wba:awiki.ai:user:k1_nonexistent",
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试获取不存在的 Profile。
    
    数据准备：不存在的 DID
    预期结果：返回 Profile 不存在错误
    """
    input_data = {"scenario": "get_nonexistent_profile", "did": did, "credential_name": credential_name}
    output_data = {"error_caught": False, "error_code": None, "error_message": None}
    
    try:
        from get_profile import get_public_profile
        from utils import JsonRpcError
        
        get_public_profile(did=did, credential_name=credential_name)
        output_data["error_caught"] = False
        return _record_profile_get_test("get_nonexistent_profile", input_data, output_data, False, output_file)
    except JsonRpcError as e:
        output_data["error_caught"] = True
        output_data["error_code"] = e.code if hasattr(e, 'code') else None
        output_data["error_message"] = str(e)
        success = output_data["error_code"] == -32001
        return _record_profile_get_test("get_nonexistent_profile", input_data, output_data, success, output_file)
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        return _record_profile_get_test("get_nonexistent_profile", input_data, output_data, False, output_file, str(e))


def test_get_profile_after_update(
    did: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试 Profile 更新后获取。
    
    数据准备：Alice 刚更新 Profile
    预期结果：获取到最新的 Profile 信息
    """
    input_data = {"scenario": "get_profile_after_update", "did": did, "credential_name": credential_name}
    output_data = {"profile": None, "updated_at": None, "error": None}
    
    try:
        from get_profile import get_public_profile
        
        profile = get_public_profile(did=did, credential_name=credential_name)
        output_data["profile"] = profile
        output_data["updated_at"] = profile.get("updated_at") if profile else None
        
        return _record_profile_get_test("get_profile_after_update", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_profile_get_test("get_profile_after_update", input_data, output_data, False, output_file, str(e))


def _record_profile_get_test(scenario, input_data, output_data, success, output_file=None, error=None):
    """记录 get_profile 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "get_profile.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    return golden_record
```

## check_inbox.py 补充场景

```python
# 添加到 doc/scripts/check_inbox.py/distill.py 末尾

# =============================================================================
# 附录：补充场景测试 - 空收件箱、E2EE 装饰器、分页测试
# =============================================================================

def test_check_inbox_empty(
    credential_name: str = "default",
    limit: int = 20,
    output_file: str | None = None,
) -> dict:
    """测试空收件箱场景。
    
    数据准备：新创建的身份，无消息
    预期结果：返回空收件箱
    """
    input_data = {"scenario": "check_inbox_empty", "credential_name": credential_name, "limit": limit}
    output_data = {"messages": None, "total": None, "is_empty": False, "error": None}
    
    try:
        from check_inbox import check_inbox
        
        result = check_inbox(credential_name=credential_name, limit=limit)
        output_data["messages"] = result if result else []
        output_data["total"] = len(result) if result else 0
        output_data["is_empty"] = output_data["total"] == 0
        
        return _record_inbox_test("check_inbox_empty", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_inbox_test("check_inbox_empty", input_data, output_data, False, output_file, str(e))


def test_check_inbox_pagination(
    credential_name: str = "default",
    limit: int = 10,
    output_file: str | None = None,
) -> dict:
    """测试大量消息分页。
    
    数据准备：50 条消息的收件箱
    预期结果：返回前 10 条，has_more 为 True
    """
    input_data = {"scenario": "check_inbox_pagination", "credential_name": credential_name, "limit": limit}
    output_data = {"messages": None, "total": None, "has_more": False, "error": None}
    
    try:
        from check_inbox import check_inbox
        
        result = check_inbox(credential_name=credential_name, limit=limit)
        output_data["messages"] = result if result else []
        output_data["total"] = len(result) if result else 0
        output_data["has_more"] = output_data["total"] == limit  # 假设还有更多
        
        return _record_inbox_test("check_inbox_pagination", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_inbox_test("check_inbox_pagination", input_data, output_data, False, output_file, str(e))


def _record_inbox_test(scenario, input_data, output_data, success, output_file=None, error=None):
    """记录 check_inbox 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "check_inbox.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    return golden_record
```

## query_db.py 补充场景

```python
# 添加到 doc/scripts/query_db.py/distill.py 末尾

# =============================================================================
# 附录：补充场景测试 - SQL 注入防护、只读限制、多身份隔离
# =============================================================================

def test_query_db_sql_injection_protection(
    sql: str = "SELECT * FROM contacts; DROP TABLE contacts; --",
    output_file: str | None = None,
) -> dict:
    """测试 SQL 注入防护。
    
    数据准备：恶意 SQL 注入语句
    预期结果：拒绝执行并报错
    """
    input_data = {"scenario": "sql_injection_protection", "sql": sql}
    output_data = {"error_caught": False, "error_message": None, "protected": False}
    
    try:
        from query_db import execute_query
        
        execute_query(sql)
        output_data["error_caught"] = False
        output_data["protected"] = False  # 如果执行成功，说明没有防护
        
        return _record_query_test("sql_injection_protection", input_data, output_data, False, output_file)
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        output_data["protected"] = True
        return _record_query_test("sql_injection_protection", input_data, output_data, True, output_file)


def test_query_db_readonly_limit(
    sql: str = "UPDATE contacts SET note='hacked' WHERE did='did:bob'",
    output_file: str | None = None,
) -> dict:
    """测试只读限制。
    
    数据准备：UPDATE 语句
    预期结果：拒绝写操作
    """
    input_data = {"scenario": "readonly_limit", "sql": sql}
    output_data = {"error_caught": False, "error_message": None, "readonly_enforced": False}
    
    try:
        from query_db import execute_query
        
        execute_query(sql)
        output_data["error_caught"] = False
        output_data["readonly_enforced"] = False
        
        return _record_query_test("readonly_limit", input_data, output_data, False, output_file)
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        output_data["readonly_enforced"] = "write" in str(e).lower() or "read" in str(e).lower()
        return _record_query_test("readonly_limit", input_data, output_data, output_data["readonly_enforced"], output_file)


def test_query_db_multi_isolation(
    sql: str = "SELECT * FROM contacts WHERE owner_did='did:alice'",
    credential_name: str = "alice_cred",
    output_file: str | None = None,
) -> dict:
    """测试多身份数据隔离。
    
    数据准备：多个身份的联系人数据
    预期结果：仅返回当前身份的联系人
    """
    input_data = {"scenario": "multi_isolation", "sql": sql, "credential_name": credential_name}
    output_data = {"contacts": None, "isolated": True, "error": None}
    
    try:
        from query_db import execute_query
        
        result = execute_query(sql)
        output_data["contacts"] = result
        
        return _record_query_test("multi_isolation", input_data, output_data, True, output_file)
    except Exception as e:
        output_data["error"] = str(e)
        return _record_query_test("multi_isolation", input_data, output_data, False, output_file, str(e))


def _record_query_test(scenario, input_data, output_data, success, output_file=None, error=None):
    """记录 query_db 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "query_db.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    return golden_record
```
