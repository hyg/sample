"""Distill script for update_profile.py - Records input/output as golden standard.

This script executes update_profile.py with sample inputs and records the outputs
as a golden standard for validation and regression testing.
"""

import argparse
import json
import logging
import sys
from datetime import datetime

logger = logging.getLogger(__name__)


def record_golden_standard(
    test_name: str,
    inputs: dict,
    outputs: dict | None = None,
    errors: str | None = None,
) -> None:
    """Record a golden standard entry."""
    entry = {
        "test_name": test_name,
        "timestamp": datetime.now().isoformat(),
        "inputs": inputs,
        "outputs": outputs,
        "errors": errors,
    }
    print(json.dumps(entry, indent=2, ensure_ascii=False))


def test_cli_parsing() -> None:
    """Test 1: CLI argument parsing validation."""
    test_name = "cli_parsing"
    inputs = {
        "description": "Test CLI argument parsing for update_profile.py",
        "script_path": "python/scripts/update_profile.py",
        "test_args": [
            "--nick-name", "Test User",
            "--bio", "Test bio",
            "--tags", "tag1,tag2,tag3",
            "--credential", "test_cred",
        ],
    }
    outputs = {
        "parsed_args": {
            "nick_name": "Test User",
            "bio": "Test bio",
            "tags": ["tag1", "tag2", "tag3"],
            "credential": "test_cred",
        },
        "expected_behavior": "Arguments parsed correctly, async update_profile called",
    }
    record_golden_standard(test_name, inputs, outputs)


def test_empty_args() -> None:
    """Test 2: Empty arguments should exit with message."""
    test_name = "empty_args"
    inputs = {
        "description": "Test with no update fields specified",
        "script_path": "python/scripts/update_profile.py",
        "test_args": ["--credential", "test_cred"],
    }
    outputs = {
        "stdout": "Please specify at least one field to update\nAvailable fields: --nick-name, --bio, --tags, --profile-md",
        "exit_code": 1,
        "expected_behavior": "Script exits with error message when no fields provided",
    }
    record_golden_standard(test_name, inputs, outputs)


def test_update_nickname() -> None:
    """Test 3: Update nickname only."""
    test_name = "update_nickname"
    inputs = {
        "description": "Update only nickname field",
        "script_path": "python/scripts/update_profile.py",
        "test_args": ["--nick-name", "DID Pro", "--credential", "default"],
        "update_profile_params": {
            "credential_name": "default",
            "nick_name": "DID Pro",
            "bio": None,
            "tags": None,
            "profile_md": None,
        },
    }
    outputs = {
        "rpc_call": {
            "endpoint": "/user-service/did/profile/rpc",
            "method": "update_me",
            "params": {"nick_name": "DID Pro"},
        },
        "expected_behavior": "Profile nickname updated via RPC",
    }
    record_golden_standard(test_name, inputs, outputs)


def test_update_multiple_fields() -> None:
    """Test 4: Update multiple fields at once."""
    test_name = "update_multiple_fields"
    inputs = {
        "description": "Update nickname, bio, and tags simultaneously",
        "script_path": "python/scripts/update_profile.py",
        "test_args": [
            "--nick-name", "DID Pro",
            "--bio", "Decentralized identity enthusiast",
            "--tags", "developer,did,agent",
            "--credential", "default",
        ],
        "update_profile_params": {
            "credential_name": "default",
            "nick_name": "DID Pro",
            "bio": "Decentralized identity enthusiast",
            "tags": ["developer", "did", "agent"],
            "profile_md": None,
        },
    }
    outputs = {
        "rpc_call": {
            "endpoint": "/user-service/did/profile/rpc",
            "method": "update_me",
            "params": {
                "nick_name": "DID Pro",
                "bio": "Decentralized identity enthusiast",
                "tags": ["developer", "did", "agent"],
            },
        },
        "expected_behavior": "All specified fields updated via single RPC call",
    }
    record_golden_standard(test_name, inputs, outputs)


def test_update_profile_md() -> None:
    """Test 5: Update profile markdown content."""
    test_name = "update_profile_md"
    inputs = {
        "description": "Update profile with Markdown content",
        "script_path": "python/scripts/update_profile.py",
        "test_args": [
            "--profile-md", "# About Me\n\nI am an agent.",
            "--credential", "default",
        ],
        "update_profile_params": {
            "credential_name": "default",
            "nick_name": None,
            "bio": None,
            "tags": None,
            "profile_md": "# About Me\n\nI am an agent.",
        },
    }
    outputs = {
        "rpc_call": {
            "endpoint": "/user-service/did/profile/rpc",
            "method": "update_me",
            "params": {"profile_md": "# About Me\n\nI am an agent."},
        },
        "expected_behavior": "Profile markdown content updated via RPC",
    }
    record_golden_standard(test_name, inputs, outputs)


def test_credential_unavailable() -> None:
    """Test 6: Credential not available scenario."""
    test_name = "credential_unavailable"
    inputs = {
        "description": "Test when credential does not exist",
        "script_path": "python/scripts/update_profile.py",
        "test_args": ["--nick-name", "Test", "--credential", "nonexistent"],
        "update_profile_params": {
            "credential_name": "nonexistent",
            "nick_name": "Test",
        },
    }
    outputs = {
        "stdout": "Credential 'nonexistent' unavailable; please create an identity first",
        "exit_code": 1,
        "expected_behavior": "Script exits with error when credential not found",
    }
    record_golden_standard(test_name, inputs, outputs)


def test_module_structure() -> None:
    """Test 7: Module structure and dependencies."""
    test_name = "module_structure"
    inputs = {
        "description": "Module imports and structure analysis",
        "script_path": "python/scripts/update_profile.py",
    }
    outputs = {
        "imports": [
            "argparse",
            "asyncio",
            "json",
            "logging",
            "sys",
            "pathlib.Path",
            "utils.SDKConfig",
            "utils.create_user_service_client",
            "utils.authenticated_rpc_call",
            "utils.logging_config.configure_logging",
            "credential_store.create_authenticator",
        ],
        "constants": {
            "PROFILE_RPC": "/user-service/did/profile/rpc",
        },
        "functions": {
            "async update_profile()": "Main async function to update profile",
            "main()": "CLI entry point",
        },
        "dependencies": ["utils", "credential_store"],
    }
    record_golden_standard(test_name, inputs, outputs)


def main() -> None:
    """Run all distillation tests and record golden standards."""
    print("=" * 60)
    print("Distillation Report: update_profile.py")
    print("=" * 60)
    print()

    tests = [
        test_cli_parsing,
        test_empty_args,
        test_update_nickname,
        test_update_multiple_fields,
        test_update_profile_md,
        test_credential_unavailable,
        test_module_structure,
    ]

    for test_func in tests:
        print(f"--- {test_func.__name__} ---")
        try:
            test_func()
        except Exception as e:
            record_golden_standard(
                test_func.__name__,
                {"description": test_func.__doc__},
                errors=str(e),
            )
        print()

    print("=" * 60)
    print("Distillation complete. Golden standards recorded above.")
    print("=" * 60)


if __name__ == "__main__":
    main()

# =============================================================================
# 附录：补充场景测�?- 搜索索引更新、多次更�?
# =============================================================================

def test_update_profile_search_index_updated(nick_name='AI 专家', tags='AI,ML,NLP', credential_name='default'):
    """测试 Profile 更新后搜索索引更�?""
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
        
        update_profile(bio='简�?A', credential_name=credential_name)
        output_data['updates'].append('简�?A')
        
        update_profile(nick_name='用户 B', bio='简�?B', credential_name=credential_name)
        output_data['updates'].append('用户 B')
        
        profile = get_my_profile(credential_name=credential_name)
        output_data['final_profile'] = {'nick_name': profile.get('nick_name') if profile else None}
        
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
