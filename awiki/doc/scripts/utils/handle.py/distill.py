"""Handle 模块蒸馏脚本 - 记录公共函数的输入输出作为黄金标准

源文件：python/scripts/utils/handle.py
分析报告：doc/scripts/utils/handle.py/py.md

公共函数:
- normalize_phone() - 规范化手机号
- _sanitize_otp() - 清理 OTP 代码 (私有但被测试)
- send_otp() - 发送 OTP (异步，需要 HTTP 客户端)
- register_handle() - 注册 Handle (异步)
- recover_handle() - 恢复 Handle (异步)
- resolve_handle() - 解析 Handle (异步)
- lookup_handle() - 通过 DID 查找 Handle (异步)
"""

import sys
import asyncio
from typing import Any

# 添加 python/scripts 目录到路径以便导入
sys.path.insert(0, r"D:\huangyg\git\sample\awiki\python\scripts")

from utils.handle import (
    normalize_phone,
    _sanitize_otp,
    send_otp,
    register_handle,
    recover_handle,
    resolve_handle,
    lookup_handle,
    HANDLE_RPC,
    DID_AUTH_RPC,
    DEFAULT_COUNTRY_CODE,
)


def record_result(func_name: str, inputs: dict[str, Any], outputs: Any, error: str | None = None) -> None:
    """记录函数调用结果"""
    print(f"\n{'='*60}")
    print(f"函数：{func_name}")
    print(f"{'='*60}")
    print(f"输入：{inputs}")
    if error:
        print(f"错误：{error}")
    else:
        print(f"输出：{outputs}")


def test_normalize_phone() -> None:
    """测试 normalize_phone 函数"""
    print("\n### 测试 normalize_phone ###")
    
    test_cases = [
        ("+8613800138000", "国际格式 - 中国"),
        ("+14155552671", "国际格式 - 美国"),
        ("13800138000", "中国本地格式"),
        ("18912345678", "中国本地格式 - 移动"),
        ("  +8613800138000  ", "带空格的国际格式"),
        ("  13800138000  ", "带空格的中国本地格式"),
    ]
    
    for phone, desc in test_cases:
        try:
            result = normalize_phone(phone)
            record_result("normalize_phone", {"phone": phone, "desc": desc}, result)
        except ValueError as e:
            record_result("normalize_phone", {"phone": phone, "desc": desc}, None, str(e))
    
    # 测试错误情况
    error_cases = [
        ("12345", "太短"),
        ("abc123", "非数字"),
        ("+86123", "国际格式太短"),
        ("23800138000", "非 1 开头的中国号码"),
    ]
    
    for phone, desc in error_cases:
        try:
            result = normalize_phone(phone)
            record_result("normalize_phone", {"phone": phone, "desc": desc}, result)
        except ValueError as e:
            record_result("normalize_phone", {"phone": phone, "desc": desc}, None, f"ValueError: {e}")


def test_sanitize_otp() -> None:
    """测试 _sanitize_otp 函数"""
    print("\n### 测试 _sanitize_otp ###")
    
    test_cases = [
        ("123456", "标准 OTP"),
        ("123 456", "带空格"),
        ("12\n34\t56", "带换行和制表符"),
        ("  123456  ", "带前后空格"),
        ("1 2 3 4 5 6", "每个数字间有空格"),
    ]
    
    for code, desc in test_cases:
        result = _sanitize_otp(code)
        record_result("_sanitize_otp", {"code": code, "desc": desc}, result)


async def test_async_functions_stub() -> None:
    """测试异步函数的存根（记录签名和预期行为）"""
    print("\n### 异步函数签名记录 ###")
    
    # 这些函数需要真实的 HTTP 客户端和服务器连接
    # 这里只记录它们的签名和预期行为
    
    print("\n" + "="*60)
    print("函数：send_otp")
    print("="*60)
    print("签名：async def send_otp(client: httpx.AsyncClient, phone: str) -> dict[str, Any]")
    print("输入：client (HTTP 客户端), phone (手机号)")
    print("输出：RPC 结果 dict")
    print("行为：规范化手机号后发送 OTP 验证码")
    
    print("\n" + "="*60)
    print("函数：register_handle")
    print("="*60)
    print("签名：async def register_handle(client, config, phone, otp_code, handle, ...) -> DIDIdentity")
    print("输入：client, config, phone, otp_code, handle, invite_code?, name?, is_public?, services?")
    print("输出：DIDIdentity (包含 user_id 和 jwt_token)")
    print("行为：一站式 Handle 注册流程")
    
    print("\n" + "="*60)
    print("函数：recover_handle")
    print("="*60)
    print("签名：async def recover_handle(client, config, phone, otp_code, handle, *, services?) -> tuple[DIDIdentity, dict]")
    print("输入：client, config, phone, otp_code, handle, services?")
    print("输出：(DIDIdentity, 恢复结果 dict)")
    print("行为：通过重新绑定到新 DID 来恢复 Handle")
    
    print("\n" + "="*60)
    print("函数：resolve_handle")
    print("="*60)
    print("签名：async def resolve_handle(client: httpx.AsyncClient, handle: str) -> dict[str, Any]")
    print("输入：client, handle")
    print("输出：查找结果 dict (包含 handle, did, status)")
    print("行为：解析 Handle 到 DID 映射")
    
    print("\n" + "="*60)
    print("函数：lookup_handle")
    print("="*60)
    print("签名：async def lookup_handle(client: httpx.AsyncClient, did: str) -> dict[str, Any]")
    print("输入：client, did")
    print("输出：查找结果 dict")
    print("行为：通过 DID 查找 Handle")


def test_constants() -> None:
    """测试常量"""
    print("\n### 常量记录 ###")
    
    record_result("常量", {"name": "HANDLE_RPC"}, HANDLE_RPC)
    record_result("常量", {"name": "DID_AUTH_RPC"}, DID_AUTH_RPC)
    record_result("常量", {"name": "DEFAULT_COUNTRY_CODE"}, DEFAULT_COUNTRY_CODE)


def main() -> None:
    """主函数 - 执行所有蒸馏测试"""
    print("="*60)
    print("Handle 模块蒸馏脚本")
    print("源文件：python/scripts/utils/handle.py")
    print("="*60)
    
    # 测试同步函数
    test_constants()
    test_normalize_phone()
    test_sanitize_otp()
    
    # 测试异步函数（记录签名）
    asyncio.run(test_async_functions_stub())
    
    print("\n" + "="*60)
    print("蒸馏完成")
    print("="*60)


if __name__ == "__main__":
    main()
