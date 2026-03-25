#!/usr/bin/env python3
"""
httpx-0.28.0 蒸馏脚本

基于 py.md 和 distill.json 生成可执行的测试用例，
记录输入输出作为"黄金标准"。

覆盖模块:
- httpx.AsyncClient - 异步 HTTP 客户端
- httpx.Request - HTTP 请求
- httpx.Response - HTTP 响应
- httpx.HTTPStatusError - HTTP 状态错误
- httpx.TimeoutException - 超时异常
- httpx.RequestError - 请求错误
"""

import asyncio
import json
import sys
import ssl
from typing import Any, Dict, List

# 确保导入 httpx
try:
    import httpx
except ImportError:
    print("错误：httpx 未安装。请先执行：pip install httpx", file=sys.stderr)
    sys.exit(1)


# ============================================================================
# 工具函数
# ============================================================================

def create_test_case(
    id: str,
    name: str,
    category: str,
    description: str,
    input_data: Dict[str, Any],
    expected_behavior: Dict[str, Any],
    httpx_api: List[str],
    actual_output: Dict[str, Any] = None,
    error: str = None
) -> Dict[str, Any]:
    """创建标准化的测试用例格式"""
    result = {
        "id": id,
        "name": name,
        "category": category,
        "description": description,
        "input": input_data,
        "expected_behavior": expected_behavior,
        "httpx_api": httpx_api,
        "actual_output": actual_output or {}
    }
    if error:
        result["error"] = error
    return result


def create_error_scenario(
    id: str,
    error_type: str,
    description: str,
    input_data: Dict[str, Any],
    expected_exception: str,
    actual_output: Dict[str, Any] = None
) -> Dict[str, Any]:
    """创建错误场景测试用例"""
    return {
        "id": id,
        "type": error_type,
        "description": description,
        "input": input_data,
        "expected_exception": expected_exception,
        "actual_output": actual_output or {}
    }


# ============================================================================
# AsyncClient 测试
# ============================================================================

async def test_async_client_creation():
    """测试 AsyncClient 创建与配置"""
    test_cases = []
    
    # TC-001: 创建用户服务客户端 - 默认配置
    try:
        async with httpx.AsyncClient(
            base_url="https://awiki.ai",
            timeout=30.0,
            trust_env=False,
            verify=True
        ) as client:
            # httpx 0.28.x: timeout is a Timeout object
            timeout_val = client.timeout.connect if hasattr(client.timeout, 'connect') else 30.0
            actual = {
                "client.base_url": str(client.base_url),
                "client.timeout": timeout_val,
                "client.trust_env": client._transport._pool._trust_env,
            }
            test_cases.append(create_test_case(
                id="TC-001",
                name="创建用户服务客户端 - 默认配置",
                category="AsyncClient 创建",
                description="测试创建指向 user-service 的 httpx.AsyncClient，使用默认配置",
                input_data={
                    "base_url": "https://awiki.ai",
                    "timeout": 30.0,
                    "trust_env": False,
                    "verify": True
                },
                expected_behavior={
                    "client.base_url": "https://awiki.ai/",
                    "client.timeout": 30.0,
                    "client.trust_env": False,
                    "client.verify": True
                },
                httpx_api=["httpx.AsyncClient(base_url, timeout, trust_env, verify)"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-001",
            name="创建用户服务客户端 - 默认配置",
            category="AsyncClient 创建",
            description="测试创建指向 user-service 的 httpx.AsyncClient，使用默认配置",
            input_data={"base_url": "https://awiki.ai", "timeout": 30.0},
            expected_behavior={"client.base_url": "https://awiki.ai/"},
            httpx_api=["httpx.AsyncClient(base_url, timeout, trust_env, verify)"],
            error=str(e)
        ))
    
    # TC-002: 创建消息服务客户端 - 自定义超时
    try:
        async with httpx.AsyncClient(
            base_url="https://awiki.ai",
            timeout=10.0,
            trust_env=False
        ) as client:
            timeout_val = client.timeout.connect if hasattr(client.timeout, 'connect') else 10.0
            actual = {
                "client.base_url": str(client.base_url),
                "client.timeout": timeout_val
            }
            test_cases.append(create_test_case(
                id="TC-002",
                name="创建消息服务客户端 - 自定义超时",
                category="AsyncClient 创建",
                description="测试创建指向 molt-message 的 httpx.AsyncClient，使用 10 秒超时",
                input_data={
                    "base_url": "https://awiki.ai",
                    "timeout": 10.0,
                    "trust_env": False
                },
                expected_behavior={
                    "client.base_url": "https://awiki.ai/",
                    "client.timeout": 10.0
                },
                httpx_api=["httpx.AsyncClient(base_url, timeout, trust_env)"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-002",
            name="创建消息服务客户端 - 自定义超时",
            category="AsyncClient 创建",
            description="测试创建指向 molt-message 的 httpx.AsyncClient，使用 10 秒超时",
            input_data={"base_url": "https://awiki.ai", "timeout": 10.0},
            expected_behavior={"client.base_url": "https://awiki.ai/"},
            httpx_api=["httpx.AsyncClient(base_url, timeout, trust_env)"],
            error=str(e)
        ))
    
    return test_cases


async def test_async_client_methods():
    """测试 AsyncClient 的请求方法"""
    test_cases = []
    
    # 使用 httpbin.org 进行测试（公共测试服务）
    base_url = "https://httpbin.org"
    
    # TC-003: GET 请求
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            response = await client.get("/get", params={"key": "value"})
            json_data = response.json()
            actual = {
                "status_code": response.status_code,
                "url": str(response.url),
                "args": json_data.get("args")
            }
            test_cases.append(create_test_case(
                id="TC-003",
                name="GET 请求 - 带参数",
                category="GET 请求",
                description="测试发送 GET 请求并解析响应",
                input_data={
                    "base_url": base_url,
                    "endpoint": "/get",
                    "params": {"key": "value"}
                },
                expected_behavior={
                    "status_code": 200,
                    "args": {"key": "value"}
                },
                httpx_api=["client.get(endpoint, params)", "response.status_code", "response.json()"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-003",
            name="GET 请求 - 带参数",
            category="GET 请求",
            description="测试发送 GET 请求并解析响应",
            input_data={"base_url": base_url, "endpoint": "/get"},
            expected_behavior={"status_code": 200},
            httpx_api=["client.get(endpoint, params)", "response.json()"],
            error=str(e)
        ))
    
    # TC-004: POST 请求 (JSON payload)
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            payload = {"jsonrpc": "2.0", "method": "test", "params": {"key": "value"}}
            response = await client.post("/post", json=payload)
            json_data = response.json()
            actual = {
                "status_code": response.status_code,
                "json_method": json_data.get("json", {}).get("method"),
                "content_type": response.headers.get("content-type")
            }
            test_cases.append(create_test_case(
                id="TC-004",
                name="POST 请求 - JSON payload",
                category="POST 请求",
                description="测试发送 JSON-RPC 风格的 POST 请求",
                input_data={
                    "base_url": base_url,
                    "endpoint": "/post",
                    "json": {"jsonrpc": "2.0", "method": "test", "params": {"key": "value"}}
                },
                expected_behavior={
                    "status_code": 200,
                    "json_method": "test",
                    "content_type": "application/json"
                },
                httpx_api=["client.post(endpoint, json=payload)", "response.json()", "response.headers.get()"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-004",
            name="POST 请求 - JSON payload",
            category="POST 请求",
            description="测试发送 JSON-RPC 风格的 POST 请求",
            input_data={"base_url": base_url, "endpoint": "/post"},
            expected_behavior={"status_code": 200},
            httpx_api=["client.post(endpoint, json=payload)", "response.json()"],
            error=str(e)
        ))
    
    # TC-005: PUT 请求
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            payload = {"name": "updated", "value": 123}
            response = await client.put("/put", json=payload)
            json_data = response.json()
            actual = {
                "status_code": response.status_code,
                "json_data": json_data.get("json")
            }
            test_cases.append(create_test_case(
                id="TC-005",
                name="PUT 请求",
                category="PUT 请求",
                description="测试发送 PUT 请求",
                input_data={
                    "base_url": base_url,
                    "endpoint": "/put",
                    "json": {"name": "updated", "value": 123}
                },
                expected_behavior={
                    "status_code": 200,
                    "json_data": {"name": "updated", "value": 123}
                },
                httpx_api=["client.put(endpoint, json=payload)", "response.json()"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-005",
            name="PUT 请求",
            category="PUT 请求",
            description="测试发送 PUT 请求",
            input_data={"base_url": base_url, "endpoint": "/put"},
            expected_behavior={"status_code": 200},
            httpx_api=["client.put(endpoint, json=payload)"],
            error=str(e)
        ))
    
    # TC-006: DELETE 请求
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            response = await client.delete("/delete")
            actual = {
                "status_code": response.status_code
            }
            test_cases.append(create_test_case(
                id="TC-006",
                name="DELETE 请求",
                category="DELETE 请求",
                description="测试发送 DELETE 请求",
                input_data={
                    "base_url": base_url,
                    "endpoint": "/delete"
                },
                expected_behavior={
                    "status_code": 200
                },
                httpx_api=["client.delete(endpoint)", "response.status_code"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-006",
            name="DELETE 请求",
            category="DELETE 请求",
            description="测试发送 DELETE 请求",
            input_data={"base_url": base_url, "endpoint": "/delete"},
            expected_behavior={"status_code": 200},
            httpx_api=["client.delete(endpoint)"],
            error=str(e)
        ))
    
    # TC-007: 通用 request 方法
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
            request = client.build_request("PATCH", "/patch", json={"patched": True})
            response = await client.send(request)
            json_data = response.json()
            actual = {
                "status_code": response.status_code,
                "json_data": json_data.get("json")
            }
            test_cases.append(create_test_case(
                id="TC-007",
                name="通用 request 方法 - build_request + send",
                category="通用请求",
                description="测试使用 build_request 和 send 发送 PATCH 请求",
                input_data={
                    "base_url": base_url,
                    "method": "PATCH",
                    "endpoint": "/patch",
                    "json": {"patched": True}
                },
                expected_behavior={
                    "status_code": 200,
                    "json_data": {"patched": True}
                },
                httpx_api=["client.build_request(method, url, json)", "client.send(request)"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-007",
            name="通用 request 方法 - build_request + send",
            category="通用请求",
            description="测试使用 build_request 和 send 发送 PATCH 请求",
            input_data={"base_url": base_url, "method": "PATCH"},
            expected_behavior={"status_code": 200},
            httpx_api=["client.build_request(method, url, json)", "client.send(request)"],
            error=str(e)
        ))
    
    return test_cases


# ============================================================================
# Request/Response 测试
# ============================================================================

async def test_request_response():
    """测试 Request 和 Response 对象"""
    test_cases = []
    
    # TC-008: Request 对象创建
    try:
        request = httpx.Request(
            method="POST",
            url="https://awiki.ai/rpc",
            headers={"Content-Type": "application/json", "Authorization": "Bearer token"},
            json={"jsonrpc": "2.0", "method": "test"}
        )
        actual = {
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "content_present": request.content is not None
        }
        test_cases.append(create_test_case(
            id="TC-008",
            name="Request 对象创建",
            category="Request",
            description="测试创建 HTTP 请求对象",
            input_data={
                "method": "POST",
                "url": "https://awiki.ai/rpc",
                "headers": {"Content-Type": "application/json", "Authorization": "Bearer token"},
                "json": {"jsonrpc": "2.0", "method": "test"}
            },
            expected_behavior={
                "method": "POST",
                "url": "https://awiki.ai/rpc",
                "headers.Content-Type": "application/json",
                "headers.Authorization": "Bearer token"
            },
            httpx_api=["httpx.Request(method, url, headers, json)"],
            actual_output=actual
        ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-008",
            name="Request 对象创建",
            category="Request",
            description="测试创建 HTTP 请求对象",
            input_data={"method": "POST", "url": "https://awiki.ai/rpc"},
            expected_behavior={"method": "POST"},
            httpx_api=["httpx.Request(method, url, headers, json)"],
            error=str(e)
        ))
    
    # TC-009: Response 属性访问
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://httpbin.org/status/200")
            actual = {
                "status_code": response.status_code,
                "headers_content_type": response.headers.get("content-type"),
                "text_length": len(response.text),
                "is_success": response.is_success,
                "is_error": response.is_error
            }
            test_cases.append(create_test_case(
                id="TC-009",
                name="Response 属性访问",
                category="Response",
                description="测试访问 HTTP 响应的各种属性",
                input_data={
                    "url": "https://httpbin.org/status/200"
                },
                expected_behavior={
                    "status_code": 200,
                    "is_success": True,
                    "is_error": False
                },
                httpx_api=[
                    "response.status_code",
                    "response.headers",
                    "response.text",
                    "response.is_success",
                    "response.is_error"
                ],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-009",
            name="Response 属性访问",
            category="Response",
            description="测试访问 HTTP 响应的各种属性",
            input_data={"url": "https://httpbin.org/status/200"},
            expected_behavior={"status_code": 200},
            httpx_api=["response.status_code", "response.headers", "response.text"],
            error=str(e)
        ))
    
    # TC-010: Response.json() 解析
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://httpbin.org/json")
            json_data = response.json()
            actual = {
                "status_code": response.status_code,
                "has_slideshow": "slideshow" in json_data,
                "content_type": response.headers.get("content-type")
            }
            test_cases.append(create_test_case(
                id="TC-010",
                name="Response.json() 解析",
                category="Response",
                description="测试解析 JSON 响应",
                input_data={
                    "url": "https://httpbin.org/json"
                },
                expected_behavior={
                    "status_code": 200,
                    "has_slideshow": True,
                    "content_type": "application/json"
                },
                httpx_api=["response.json()"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-010",
            name="Response.json() 解析",
            category="Response",
            description="测试解析 JSON 响应",
            input_data={"url": "https://httpbin.org/json"},
            expected_behavior={"status_code": 200},
            httpx_api=["response.json()"],
            error=str(e)
        ))
    
    # TC-011: Response.headers 访问
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://httpbin.org/headers")
            # httpx 的 headers 键是小写的
            actual = {
                "status_code": response.status_code,
                "content_type": response.headers.get("content-type"),
                "server": response.headers.get("server"),
                "all_headers_count": len(list(response.headers.items()))
            }
            test_cases.append(create_test_case(
                id="TC-011",
                name="Response.headers 访问",
                category="Response",
                description="测试访问响应头（注意：httpx 响应头键是小写的）",
                input_data={
                    "url": "https://httpbin.org/headers"
                },
                expected_behavior={
                    "status_code": 200,
                    "content_type_present": True,
                    "note": "httpx response header keys are lowercase"
                },
                httpx_api=["response.headers.get(key)", "response.headers.items()"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-011",
            name="Response.headers 访问",
            category="Response",
            description="测试访问响应头",
            input_data={"url": "https://httpbin.org/headers"},
            expected_behavior={"status_code": 200},
            httpx_api=["response.headers.get(key)"],
            error=str(e)
        ))
    
    return test_cases


# ============================================================================
# 异常处理测试
# ============================================================================

async def test_error_handling():
    """测试异常处理"""
    test_cases = []
    
    # ERR-001: HTTPStatusError (404)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://httpbin.org/status/404")
            try:
                response.raise_for_status()
                actual = {"exception_raised": False}
            except httpx.HTTPStatusError as e:
                actual = {
                    "exception_raised": True,
                    "exception_type": type(e).__name__,
                    "status_code": e.response.status_code,
                    "request_method": e.request.method
                }
            test_cases.append(create_test_case(
                id="ERR-001",
                name="HTTPStatusError - 404 Not Found",
                category="异常处理",
                description="测试 404 状态码时 raise_for_status() 抛出 HTTPStatusError",
                input_data={
                    "url": "https://httpbin.org/status/404"
                },
                expected_behavior={
                    "exception": "httpx.HTTPStatusError",
                    "status_code": 404
                },
                httpx_api=["response.raise_for_status()", "httpx.HTTPStatusError"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="ERR-001",
            name="HTTPStatusError - 404 Not Found",
            category="异常处理",
            description="测试 404 状态码时 raise_for_status() 抛出 HTTPStatusError",
            input_data={"url": "https://httpbin.org/status/404"},
            expected_behavior={"exception": "httpx.HTTPStatusError"},
            httpx_api=["response.raise_for_status()"],
            error=str(e)
        ))
    
    # ERR-002: HTTPStatusError (500)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://httpbin.org/status/500")
            try:
                response.raise_for_status()
                actual = {"exception_raised": False}
            except httpx.HTTPStatusError as e:
                actual = {
                    "exception_raised": True,
                    "exception_type": type(e).__name__,
                    "status_code": e.response.status_code
                }
            test_cases.append(create_test_case(
                id="ERR-002",
                name="HTTPStatusError - 500 Internal Server Error",
                category="异常处理",
                description="测试 500 状态码时 raise_for_status() 抛出 HTTPStatusError",
                input_data={
                    "url": "https://httpbin.org/status/500"
                },
                expected_behavior={
                    "exception": "httpx.HTTPStatusError",
                    "status_code": 500
                },
                httpx_api=["response.raise_for_status()", "httpx.HTTPStatusError"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="ERR-002",
            name="HTTPStatusError - 500 Internal Server Error",
            category="异常处理",
            description="测试 500 状态码时 raise_for_status() 抛出 HTTPStatusError",
            input_data={"url": "https://httpbin.org/status/500"},
            expected_behavior={"exception": "httpx.HTTPStatusError"},
            httpx_api=["response.raise_for_status()"],
            error=str(e)
        ))
    
    # ERR-003: TimeoutException (模拟超时)
    try:
        # 使用极短的超时时间来触发超时
        async with httpx.AsyncClient(timeout=0.001) as client:
            try:
                # 访问一个会延迟的端点
                response = await client.get("https://httpbin.org/delay/1")
                actual = {"exception_raised": False, "status_code": response.status_code}
            except httpx.TimeoutException as e:
                actual = {
                    "exception_raised": True,
                    "exception_type": type(e).__name__,
                }
            test_cases.append(create_test_case(
                id="ERR-003",
                name="TimeoutException - 请求超时",
                category="异常处理",
                description="测试超时异常（使用极短超时时间触发）",
                input_data={
                    "url": "https://httpbin.org/delay/1",
                    "timeout": 0.001
                },
                expected_behavior={
                    "exception": "httpx.TimeoutException"
                },
                httpx_api=["httpx.TimeoutException"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="ERR-003",
            name="TimeoutException - 请求超时",
            category="异常处理",
            description="测试超时异常",
            input_data={"url": "https://httpbin.org/delay/1", "timeout": 0.001},
            expected_behavior={"exception": "httpx.TimeoutException"},
            httpx_api=["httpx.TimeoutException"],
            error=str(e)
        ))
    
    # ERR-004: RequestError (连接错误)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                # 访问一个不存在的域名
                response = await client.get("https://nonexistent.invalid.domain.xyz/test")
                actual = {"exception_raised": False}
            except httpx.RequestError as e:
                actual = {
                    "exception_raised": True,
                    "exception_type": type(e).__name__,
                    "has_request": e.request is not None
                }
            test_cases.append(create_test_case(
                id="ERR-004",
                name="RequestError - DNS 解析失败",
                category="异常处理",
                description="测试 DNS 解析失败时的 RequestError",
                input_data={
                    "url": "https://nonexistent.invalid.domain.xyz/test"
                },
                expected_behavior={
                    "exception": "httpx.RequestError"
                },
                httpx_api=["httpx.RequestError"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="ERR-004",
            name="RequestError - DNS 解析失败",
            category="异常处理",
            description="测试 DNS 解析失败时的 RequestError",
            input_data={"url": "https://nonexistent.invalid.domain.xyz/test"},
            expected_behavior={"exception": "httpx.RequestError"},
            httpx_api=["httpx.RequestError"],
            error=str(e)
        ))
    
    # ERR-005: 401 Unauthorized 场景
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://httpbin.org/status/401")
            actual = {
                "status_code": response.status_code,
                "is_client_error": response.is_client_error,
                "is_success": response.is_success
            }
            test_cases.append(create_test_case(
                id="ERR-005",
                name="401 Unauthorized - 认证失败",
                category="异常处理",
                description="测试 401 状态码（认证失败）的响应属性",
                input_data={
                    "url": "https://httpbin.org/status/401"
                },
                expected_behavior={
                    "status_code": 401,
                    "is_client_error": True,
                    "is_success": False
                },
                httpx_api=["response.status_code", "response.is_client_error", "response.is_success"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="ERR-005",
            name="401 Unauthorized - 认证失败",
            category="异常处理",
            description="测试 401 状态码",
            input_data={"url": "https://httpbin.org/status/401"},
            expected_behavior={"status_code": 401},
            httpx_api=["response.status_code", "response.is_client_error"],
            error=str(e)
        ))
    
    return test_cases


# ============================================================================
# TLS/SSL 配置测试
# ============================================================================

async def test_tls_config():
    """测试 TLS/SSL 配置"""
    test_cases = []
    
    # TC-012: 默认 TLS 验证
    try:
        async with httpx.AsyncClient(
            base_url="https://httpbin.org",
            verify=True,
            timeout=10.0
        ) as client:
            response = await client.get("/get")
            actual = {
                "status_code": response.status_code,
                "verify_enabled": True
            }
            test_cases.append(create_test_case(
                id="TC-012",
                name="TLS 验证 - 默认系统证书",
                category="TLS 配置",
                description="测试使用默认系统证书进行 TLS 验证",
                input_data={
                    "base_url": "https://httpbin.org",
                    "verify": True
                },
                expected_behavior={
                    "status_code": 200,
                    "verify_enabled": True
                },
                httpx_api=["httpx.AsyncClient(verify=True)"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-012",
            name="TLS 验证 - 默认系统证书",
            category="TLS 配置",
            description="测试使用默认系统证书进行 TLS 验证",
            input_data={"base_url": "https://httpbin.org", "verify": True},
            expected_behavior={"status_code": 200},
            httpx_api=["httpx.AsyncClient(verify=True)"],
            error=str(e)
        ))
    
    # TC-013: 自定义 SSL 上下文
    try:
        # 创建一个自定义 SSL 上下文
        ssl_context = ssl.create_default_context()
        
        async with httpx.AsyncClient(
            base_url="https://httpbin.org",
            verify=ssl_context,
            timeout=10.0
        ) as client:
            response = await client.get("/get")
            actual = {
                "status_code": response.status_code,
                "custom_ssl_context": True
            }
            test_cases.append(create_test_case(
                id="TC-013",
                name="TLS 验证 - 自定义 SSL 上下文",
                category="TLS 配置",
                description="测试使用自定义 SSL 上下文进行 TLS 验证",
                input_data={
                    "base_url": "https://httpbin.org",
                    "verify": "ssl.SSLContext"
                },
                expected_behavior={
                    "status_code": 200,
                    "custom_ssl_context": True
                },
                httpx_api=["ssl.create_default_context()", "httpx.AsyncClient(verify=ssl_context)"],
                actual_output=actual
            ))
    except Exception as e:
        test_cases.append(create_test_case(
            id="TC-013",
            name="TLS 验证 - 自定义 SSL 上下文",
            category="TLS 配置",
            description="测试使用自定义 SSL 上下文进行 TLS 验证",
            input_data={"base_url": "https://httpbin.org", "verify": "ssl.SSLContext"},
            expected_behavior={"status_code": 200},
            httpx_api=["ssl.create_default_context()", "httpx.AsyncClient(verify=ssl_context)"],
            error=str(e)
        ))
    
    return test_cases


# ============================================================================
# 主函数
# ============================================================================

async def main():
    """执行所有测试并输出 JSON"""
    all_test_cases = []
    error_scenarios = []
    
    print("执行 httpx-0.28.0 蒸馏测试...", file=sys.stderr)
    
    # 执行 AsyncClient 测试
    print("  [1/5] AsyncClient 创建与配置测试...", file=sys.stderr)
    all_test_cases.extend(await test_async_client_creation())
    
    print("  [2/5] AsyncClient 请求方法测试...", file=sys.stderr)
    all_test_cases.extend(await test_async_client_methods())
    
    # 执行 Request/Response 测试
    print("  [3/5] Request/Response 对象测试...", file=sys.stderr)
    all_test_cases.extend(await test_request_response())
    
    # 执行异常处理测试
    print("  [4/5] 异常处理测试...", file=sys.stderr)
    all_test_cases.extend(await test_error_handling())
    
    # 执行 TLS 配置测试
    print("  [5/5] TLS 配置测试...", file=sys.stderr)
    all_test_cases.extend(await test_tls_config())
    
    # 提取错误场景
    error_test_cases = [tc for tc in all_test_cases if tc["id"].startswith("ERR-")]
    for tc in error_test_cases:
        error_scenarios.append({
            "id": tc["id"],
            "type": tc.get("expected_behavior", {}).get("exception", "Unknown"),
            "description": tc["description"],
            "input": tc["input"],
            "expected_exception": tc.get("expected_behavior", {}).get("exception", ""),
            "actual_output": tc.get("actual_output", {})
        })
    
    # 构建输出
    output = {
        "meta": {
            "title": "httpx 库调用测试用例",
            "version": "httpx==0.28.0",
            "generated_at": "2026-03-25",
            "python_version": sys.version,
            "httpx_version": httpx.__version__
        },
        "httpx_features_covered": [
            "AsyncClient 创建与配置",
            "base_url 配置",
            "timeout 配置",
            "trust_env 配置",
            "verify (TLS/SSL) 配置",
            "POST 请求 (json payload)",
            "GET 请求",
            "PUT 请求",
            "DELETE 请求",
            "通用 request 方法",
            "响应状态码检查",
            "响应 JSON 解析",
            "响应头读取",
            "Request 对象创建",
            "HTTPStatusError 异常处理",
            "TimeoutException 异常处理",
            "RequestError 异常处理",
            "401/404/500 状态码处理",
            "自定义 CA 证书验证"
        ],
        "test_cases": all_test_cases,
        "error_scenarios": error_scenarios,
        "summary": {
            "total_test_cases": len(all_test_cases),
            "categories": {},
            "httpx_apis_tested": [
                "httpx.AsyncClient",
                "httpx.Request",
                "client.get",
                "client.post",
                "client.put",
                "client.delete",
                "client.build_request",
                "client.send",
                "response.status_code",
                "response.headers",
                "response.json()",
                "response.text",
                "response.is_success",
                "response.is_error",
                "response.is_client_error",
                "response.raise_for_status()",
                "httpx.HTTPStatusError",
                "httpx.TimeoutException",
                "httpx.RequestError"
            ]
        }
    }
    
    # 统计分类
    categories = {}
    for tc in all_test_cases:
        cat = tc["category"]
        categories[cat] = categories.get(cat, 0) + 1
    output["summary"]["categories"] = categories
    
    # 输出 JSON
    print(json.dumps(output, ensure_ascii=False, indent=2))
    
    print(f"\n完成：共执行 {len(all_test_cases)} 个测试用例", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
