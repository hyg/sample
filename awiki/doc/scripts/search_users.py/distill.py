"""Distiller for search_users.py - 记录输入输出作为黄金标准."""

import argparse
import asyncio
import json
import logging
import sys
from io import StringIO
from contextlib import redirect_stdout

from utils import SDKConfig, create_user_service_client, authenticated_rpc_call
from utils.logging_config import configure_logging
from credential_store import create_authenticator

SEARCH_RPC = "/search/rpc"
logger = logging.getLogger(__name__)


async def search_users(query: str, credential_name: str = "default") -> dict:
    """Search users by semantic matching."""
    logger.info("Searching users query=%r credential=%s", query, credential_name)
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        return {"error": f"Credential '{credential_name}' unavailable; please create an identity first"}

    auth, _ = auth_result
    async with create_user_service_client(config) as client:
        result = await authenticated_rpc_call(
            client, SEARCH_RPC, "search.users",
            params={"type": "keyword", "q": query},
            auth=auth, credential_name=credential_name,
        )
        return result


def distill(query: str, credential_name: str = "default") -> dict:
    """执行 search_users 并记录输入输出作为黄金标准."""
    # 捕获标准输出
    stdout_capture = StringIO()
    
    # 准备输入记录
    input_record = {
        "query": query,
        "credential_name": credential_name
    }
    
    # 执行并捕获输出
    try:
        result = asyncio.run(search_users(query, credential_name))
        output_record = {
            "result": result,
            "status": "success"
        }
    except Exception as e:
        output_record = {
            "error": str(e),
            "status": "error"
        }
    
    # 返回黄金标准记录
    return {
        "input": input_record,
        "output": output_record
    }


def main() -> None:
    configure_logging(console_level=None, mirror_stdio=True)
    
    parser = argparse.ArgumentParser(description="Distiller for search_users.py")
    parser.add_argument("query", type=str, help="Search query")
    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")
    
    args = parser.parse_args()
    logger.info("distill CLI started credential=%s query=%r", args.credential, args.query)
    
    # 执行蒸馏
    golden_record = distill(args.query, args.credential)
    
    # 输出黄金标准（JSON 格式）
    print(json.dumps(golden_record, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

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
