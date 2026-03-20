"""蒸馏脚本：执行 test_recover_handle_cli.py 并记录黄金标准输入输出。"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 添加脚本目录到路径
# distill.py 位于 doc/tests/test_recover_handle_cli.py/
# scripts 位于 python/scripts/
# 需要上溯 4 级到达项目根目录
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

import recover_handle as recover_cli  # noqa: E402
from utils.identity import DIDIdentity  # noqa: E402


class _AsyncClientContext:
    """用于 CLI 测试的最小异步客户端上下文管理器。"""

    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        del exc_type, exc, tb
        return False


def _make_identity(did: str, *, user_id: str = "user-1") -> DIDIdentity:
    """为 CLI 测试创建最小 DID 身份。"""
    return DIDIdentity(
        did=did,
        did_document={"id": did, "proof": {"challenge": "nonce"}},
        private_key_pem=b"private-key",
        public_key_pem=b"public-key",
        user_id=user_id,
        jwt_token="jwt-token",
        e2ee_signing_private_pem=b"e2ee-signing-key",
        e2ee_agreement_private_pem=b"e2ee-agreement-key",
    )


def _run_test(name: str, test_func) -> dict:
    """运行单个测试并返回结果。"""
    result = {
        "name": name,
        "status": "pending",
        "input": {},
        "output": {},
        "error": None,
    }
    return result


def test_resolve_recovery_target_auto_selects_non_destructive_alias() -> dict:
    """测试：自动恢复别名应跳过已占用的凭证名称。"""
    result = _run_test("test_resolve_recovery_target_auto_selects_non_destructive_alias", None)
    
    # 输入：模拟已存在的凭证
    existing_credentials = {
        "alice": {"did": "did:wba:awiki.ai:alice:k1_old"},
        "alice_recovered": {"did": "did:wba:awiki.ai:alice:k1_other"},
    }
    result["input"] = {
        "existing_credentials": existing_credentials,
        "handle": "alice",
        "requested_credential_name": None,
        "replace_existing": False,
    }
    
    # 模拟 load_identity
    original_load = recover_cli.load_identity
    recover_cli.load_identity = lambda name: existing_credentials.get(name)
    
    try:
        credential_name, existing_credential = recover_cli._resolve_recovery_target(
            handle="alice",
            requested_credential_name=None,
            replace_existing=False,
        )
        
        result["output"] = {
            "credential_name": credential_name,
            "existing_credential": existing_credential,
        }
        result["status"] = "passed"
        
        # 验证
        assert credential_name == "alice_recovered_2", f"期望 'alice_recovered_2', 实际 '{credential_name}'"
        assert existing_credential is None, f"期望 None, 实际 {existing_credential}"
        
    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
    finally:
        recover_cli.load_identity = original_load
    
    return result


def test_resolve_recovery_target_rejects_implicit_overwrite() -> dict:
    """测试：显式凭证目标不应默认覆盖现有数据。"""
    result = _run_test("test_resolve_recovery_target_rejects_implicit_overwrite", None)
    
    # 输入
    result["input"] = {
        "default_credential": {"did": "did:wba:awiki.ai:user:k1_existing"},
        "handle": "alice",
        "requested_credential_name": "default",
        "replace_existing": False,
    }
    
    # 模拟 load_identity
    original_load = recover_cli.load_identity
    recover_cli.load_identity = lambda name: {"did": "did:wba:awiki.ai:user:k1_existing"} if name == "default" else None
    
    try:
        error_raised = False
        error_message = ""
        try:
            recover_cli._resolve_recovery_target(
                handle="alice",
                requested_credential_name="default",
                replace_existing=False,
            )
        except ValueError as e:
            error_raised = True
            error_message = str(e)
        
        result["output"] = {
            "error_raised": error_raised,
            "error_message": error_message,
        }
        
        # 验证
        assert error_raised, "期望抛出 ValueError"
        assert "already exists for DID" in error_message, f"错误消息应包含 'already exists for DID', 实际 '{error_message}'"
        result["status"] = "passed"
        
    except AssertionError as e:
        result["status"] = "failed"
        result["error"] = str(e)
    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
    finally:
        recover_cli.load_identity = original_load
    
    return result


def test_do_recover_preserves_existing_default_when_no_credential_is_requested() -> dict:
    """测试：不带 --credential 的恢复应保存到新别名并保持 default 完整。"""
    result = _run_test("test_do_recover_preserves_existing_default_when_no_credential_is_requested", None)
    
    saved_payload: dict = {}
    existing_credentials = {
        "default": {
            "did": "did:wba:awiki.ai:user:k1_default",
            "unique_id": "k1_default",
            "name": "Default User",
        }
    }
    
    result["input"] = {
        "existing_credentials": existing_credentials,
        "handle": "alice",
        "phone": "+8613800138000",
        "otp_code": "123456",
        "requested_credential_name": None,
        "replace_existing": False,
    }
    
    # 保存原始函数
    original_load = recover_cli.load_identity
    original_create_client = recover_cli.create_user_service_client
    original_recover = recover_cli.recover_handle
    original_save = recover_cli.save_identity
    original_backup = recover_cli.backup_identity
    original_migrate = recover_cli._migrate_local_cache
    original_prune = recover_cli.prune_unreferenced_credential_dir
    
    try:
        recover_cli.load_identity = lambda name: existing_credentials.get(name)
        recover_cli.create_user_service_client = lambda config: _AsyncClientContext()
        
        async def fake_recover_handle(client, config, *, phone, otp_code, handle):
            del client, config, phone, otp_code, handle
            return _make_identity("did:wba:awiki.ai:alice:k1_new"), {
                "handle": "alice",
                "full_handle": "alice.awiki.ai",
                "message": "recovered",
            }
        
        recover_cli.recover_handle = fake_recover_handle
        recover_cli.save_identity = lambda **kwargs: saved_payload.update(kwargs)
        
        backup_called = False
        migrate_called = False
        prune_called = False
        
        def fake_backup(name):
            nonlocal backup_called
            backup_called = True
            return Path(f"/tmp/{name}-backup")
        
        def fake_migrate(**kwargs):
            nonlocal migrate_called
            migrate_called = True
            return {
                "messages_rebound": 3,
                "contacts_rebound": 1,
                "e2ee_outbox_cleared": 0,
                "e2ee_state_deleted": True,
            }
        
        def fake_prune(dir_name):
            nonlocal prune_called
            prune_called = True
            return True
        
        recover_cli.backup_identity = fake_backup
        recover_cli._migrate_local_cache = fake_migrate
        recover_cli.prune_unreferenced_credential_dir = fake_prune
        
        asyncio.run(
            recover_cli.do_recover(
                handle="alice",
                phone="+8613800138000",
                otp_code="123456",
                requested_credential_name=None,
                replace_existing=False,
            )
        )
        
        result["output"] = {
            "saved_payload": saved_payload,
            "backup_called": backup_called,
            "migrate_called": migrate_called,
            "prune_called": prune_called,
        }
        
        # 验证
        assert saved_payload["name"] == "alice", f"期望 name='alice', 实际 '{saved_payload.get('name')}'"
        assert saved_payload["replace_existing"] is False, f"期望 replace_existing=False, 实际 {saved_payload.get('replace_existing')}"
        assert saved_payload["did"] == "did:wba:awiki.ai:alice:k1_new", f"期望正确的 DID"
        assert backup_called is False, "backup_identity 不应被调用"
        assert migrate_called is False, "_migrate_local_cache 不应被调用"
        assert prune_called is False, "prune_unreferenced_credential_dir 不应被调用"
        result["status"] = "passed"
        
    except AssertionError as e:
        result["status"] = "failed"
        result["error"] = str(e)
    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
    finally:
        recover_cli.load_identity = original_load
        recover_cli.create_user_service_client = original_create_client
        recover_cli.recover_handle = original_recover
        recover_cli.save_identity = original_save
        recover_cli.backup_identity = original_backup
        recover_cli._migrate_local_cache = original_migrate
        recover_cli.prune_unreferenced_credential_dir = original_prune
    
    return result


def test_do_recover_replaces_existing_credential_only_when_requested() -> dict:
    """测试：有意替换应备份并迁移选定的凭证。"""
    result = _run_test("test_do_recover_replaces_existing_credential_only_when_requested", None)
    
    events: dict = {}
    existing_credential = {
        "did": "did:wba:awiki.ai:alice:k1_old",
        "unique_id": "k1_old",
        "name": "Recovered User",
    }
    
    result["input"] = {
        "existing_credential": existing_credential,
        "handle": "alice",
        "phone": "+8613800138000",
        "otp_code": "123456",
        "requested_credential_name": "default",
        "replace_existing": True,
    }
    
    # 保存原始函数
    original_load = recover_cli.load_identity
    original_create_client = recover_cli.create_user_service_client
    original_recover = recover_cli.recover_handle
    original_save = recover_cli.save_identity
    original_backup = recover_cli.backup_identity
    original_migrate = recover_cli._migrate_local_cache
    original_prune = recover_cli.prune_unreferenced_credential_dir
    
    try:
        recover_cli.load_identity = lambda name: existing_credential if name == "default" else None
        recover_cli.create_user_service_client = lambda config: _AsyncClientContext()
        
        async def fake_recover_handle(client, config, *, phone, otp_code, handle):
            del client, config, phone, otp_code, handle
            return _make_identity("did:wba:awiki.ai:alice:k1_new"), {
                "handle": "alice",
                "full_handle": "alice.awiki.ai",
                "message": "recovered",
            }
        
        recover_cli.recover_handle = fake_recover_handle
        recover_cli.backup_identity = lambda name: Path(f"/tmp/{name}-backup")
        recover_cli.save_identity = lambda **kwargs: events.setdefault("save_identity", kwargs)
        recover_cli._migrate_local_cache = lambda **kwargs: events.setdefault("cache_migration", kwargs) or {
            "messages_rebound": 3,
            "contacts_rebound": 1,
            "e2ee_outbox_cleared": 0,
            "e2ee_state_deleted": True,
        }
        recover_cli.prune_unreferenced_credential_dir = lambda dir_name: events.setdefault("pruned_unique_id", dir_name) or True
        
        asyncio.run(
            recover_cli.do_recover(
                handle="alice",
                phone="+8613800138000",
                otp_code="123456",
                requested_credential_name="default",
                replace_existing=True,
            )
        )
        
        save_call = events.get("save_identity", {})
        migration_call = events.get("cache_migration", {})
        
        result["output"] = {
            "events": events,
            "save_call": save_call,
            "migration_call": migration_call,
        }
        
        # 验证
        assert isinstance(save_call, dict), "save_identity 调用应为字典"
        assert save_call.get("name") == "default", f"期望 name='default', 实际 '{save_call.get('name')}'"
        assert save_call.get("replace_existing") is True, f"期望 replace_existing=True"
        assert save_call.get("did") == "did:wba:awiki.ai:alice:k1_new", f"期望正确的 DID"
        
        assert isinstance(migration_call, dict), "cache_migration 调用应为字典"
        assert migration_call.get("credential_name") == "default"
        assert migration_call.get("old_did") == "did:wba:awiki.ai:alice:k1_old"
        assert migration_call.get("new_did") == "did:wba:awiki.ai:alice:k1_new"
        assert events.get("pruned_unique_id") == "k1_old"
        
        result["status"] = "passed"
        
    except AssertionError as e:
        result["status"] = "failed"
        result["error"] = str(e)
    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
    finally:
        recover_cli.load_identity = original_load
        recover_cli.create_user_service_client = original_create_client
        recover_cli.recover_handle = original_recover
        recover_cli.save_identity = original_save
        recover_cli.backup_identity = original_backup
        recover_cli._migrate_local_cache = original_migrate
        recover_cli.prune_unreferenced_credential_dir = original_prune
    
    return result


def main():
    """执行所有测试并输出黄金标准报告。"""
    print("=" * 70)
    print("test_recover_handle_cli.py 蒸馏报告")
    print("=" * 70)
    print()
    
    tests = [
        ("test_resolve_recovery_target_auto_selects_non_destructive_alias", 
         test_resolve_recovery_target_auto_selects_non_destructive_alias),
        ("test_resolve_recovery_target_rejects_implicit_overwrite", 
         test_resolve_recovery_target_rejects_implicit_overwrite),
        ("test_do_recover_preserves_existing_default_when_no_credential_is_requested", 
         test_do_recover_preserves_existing_default_when_no_credential_is_requested),
        ("test_do_recover_replaces_existing_credential_only_when_requested", 
         test_do_recover_replaces_existing_credential_only_when_requested),
    ]
    
    results = []
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        print(f"运行测试：{name}")
        result = test_func()
        results.append(result)
        
        if result["status"] == "passed":
            print(f"  ✓ 通过")
            passed += 1
        else:
            print(f"  ✗ 失败：{result['error']}")
            failed += 1
        
        print()
    
    # 输出汇总报告
    print("=" * 70)
    print("黄金标准汇总")
    print("=" * 70)
    print(f"总计：{len(results)} | 通过：{passed} | 失败：{failed}")
    print()
    
    for result in results:
        print(f"测试：{result['name']}")
        print(f"  状态：{result['status']}")
        print(f"  输入：{result['input']}")
        print(f"  输出：{result['output']}")
        if result["error"]:
            print(f"  错误：{result['error']}")
        print()
    
    print("=" * 70)
    if failed == 0:
        print("所有测试通过 ✓")
    else:
        print(f"{failed} 个测试失败 ✗")
    print("=" * 70)
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
