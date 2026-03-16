/**
 * JsonRpcError 类测试
 * 
 * 移植自：python/scripts/utils/rpc.py - JsonRpcError
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { JsonRpcError } from '../src/index.js';

// ============================================
// JsonRpcError 构造函数测试
// ============================================

test('TC001 - JsonRpcError - 基本构造函数', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request', null);
    
    assert.strictEqual(error.code, -32600);
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
    assert.strictEqual(error.data, null);
    assert.strictEqual(error.name, 'JsonRpcError');
});

test('TC002 - JsonRpcError - 带 data 字段', () => {
    const error = new JsonRpcError(-32602, 'Invalid params', { field: 'missing' });
    
    assert.strictEqual(error.code, -32602);
    assert.strictEqual(error.message, 'JSON-RPC error -32602: Invalid params');
    assert.deepStrictEqual(error.data, { field: 'missing' });
});

test('TC003 - JsonRpcError - data 为 undefined', () => {
    const error = new JsonRpcError(-32601, 'Method not found');
    
    assert.strictEqual(error.code, -32601);
    assert.strictEqual(error.message, 'JSON-RPC error -32601: Method not found');
    assert.strictEqual(error.data, undefined);
});

test('TC004 - JsonRpcError - 正错误码', () => {
    const error = new JsonRpcError(1001, 'Custom error', { info: 'details' });
    
    assert.strictEqual(error.code, 1001);
    assert.strictEqual(error.message, 'JSON-RPC error 1001: Custom error');
    assert.deepStrictEqual(error.data, { info: 'details' });
});

test('TC005 - JsonRpcError - 负错误码', () => {
    const error = new JsonRpcError(-32700, 'Parse error');
    
    assert.strictEqual(error.code, -32700);
    assert.strictEqual(error.message, 'JSON-RPC error -32700: Parse error');
});

// ============================================
// JsonRpcError 属性访问测试
// ============================================

test('TC006 - JsonRpcError - 属性只读', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request');
    
    // 尝试修改属性（TypeScript 会在编译时阻止，但运行时仍可修改）
    // 这里验证属性存在且可访问
    assert.strictEqual(error.code, -32600);
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
});

test('TC007 - JsonRpcError - 继承自 Error', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request');
    
    assert.ok(error instanceof Error);
    assert.ok(error instanceof JsonRpcError);
    assert.ok(error.stack); // 应该有堆栈跟踪
});

test('TC008 - JsonRpcError - 错误消息格式', () => {
    const error = new JsonRpcError(-32603, 'Internal error');
    
    // 验证消息格式： "JSON-RPC error {code}: {message}"
    assert.strictEqual(error.message, 'JSON-RPC error -32603: Internal error');
    assert.ok(error.message.includes('JSON-RPC error'));
    assert.ok(error.message.includes('-32603'));
    assert.ok(error.message.includes('Internal error'));
});

// ============================================
// JsonRpcError.toString() 测试
// ============================================

test('TC009 - JsonRpcError - toString 方法', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request');
    
    // Error.toString() 返回 "name: message" 格式
    assert.strictEqual(error.toString(), 'JsonRpcError: JSON-RPC error -32600: Invalid Request');
});

test('TC010 - JsonRpcError - toString 带 data', () => {
    const error = new JsonRpcError(-32602, 'Invalid params', { reason: 'missing field' });
    
    // toString 不包含 data
    assert.strictEqual(error.toString(), 'JsonRpcError: JSON-RPC error -32602: Invalid params');
});

// ============================================
// JsonRpcError.fromErrorObject() 静态方法测试
// ============================================

test('TC011 - JsonRpcError - fromErrorObject 基本用法', () => {
    const errorObj = {
        code: -32601,
        message: 'Method not found',
        data: 'The method does not exist',
    };
    
    const error = JsonRpcError.fromErrorObject(errorObj);
    
    assert.strictEqual(error.code, -32601);
    assert.strictEqual(error.message, 'JSON-RPC error -32601: Method not found');
    assert.strictEqual(error.data, 'The method does not exist');
});

test('TC012 - JsonRpcError - fromErrorObject 无 data', () => {
    const errorObj = {
        code: -32600,
        message: 'Invalid Request',
    };
    
    const error = JsonRpcError.fromErrorObject(errorObj);
    
    assert.strictEqual(error.code, -32600);
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
    assert.strictEqual(error.data, undefined);
});

test('TC013 - JsonRpcError - fromErrorObject data 为 null', () => {
    const errorObj = {
        code: -32603,
        message: 'Internal error',
        data: null,
    };
    
    const error = JsonRpcError.fromErrorObject(errorObj);
    
    assert.strictEqual(error.code, -32603);
    assert.strictEqual(error.message, 'JSON-RPC error -32603: Internal error');
    assert.strictEqual(error.data, null);
});

test('TC014 - JsonRpcError - fromErrorObject 复杂 data', () => {
    const errorObj = {
        code: -32000,
        message: 'Permission denied',
        data: {
            required: 'admin',
            current: 'user',
            details: {
                userId: '123',
                action: 'delete',
            },
        },
    };
    
    const error = JsonRpcError.fromErrorObject(errorObj);
    
    assert.strictEqual(error.code, -32000);
    assert.deepStrictEqual(error.data, {
        required: 'admin',
        current: 'user',
        details: {
            userId: '123',
            action: 'delete',
        },
    });
});

// ============================================
// JsonRpcError 与 Python 版本兼容性测试
// ============================================

test('TC015 - Python 兼容性 - 字段一致 (code, message, data)', () => {
    // Python:
    // class JsonRpcError(Exception):
    //     def __init__(self, code: int, message: str, data: Any = None):
    //         self.code = code
    //         self.message = message
    //         self.data = data
    //         super().__init__(f"JSON-RPC error {code}: {message}")
    
    const error = new JsonRpcError(-32600, 'Invalid Request', { extra: 'info' });
    
    // 验证字段类型与 Python 一致
    assert.strictEqual(typeof error.code, 'number');
    assert.strictEqual(typeof error.message, 'string');
    // data 可以是任何类型（包括 null/undefined）
    
    // 验证消息格式与 Python 一致
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
});

test('TC016 - Python 兼容性 - 异常消息格式', () => {
    // Python: super().__init__(f"JSON-RPC error {code}: {message}")
    
    const testCases = [
        { code: -32700, message: 'Parse error', expected: 'JSON-RPC error -32700: Parse error' },
        { code: -32600, message: 'Invalid Request', expected: 'JSON-RPC error -32600: Invalid Request' },
        { code: -32601, message: 'Method not found', expected: 'JSON-RPC error -32601: Method not found' },
        { code: -32602, message: 'Invalid params', expected: 'JSON-RPC error -32602: Invalid params' },
        { code: -32603, message: 'Internal error', expected: 'JSON-RPC error -32603: Internal error' },
    ];
    
    for (const { code, message, expected } of testCases) {
        const error = new JsonRpcError(code, message);
        assert.strictEqual(error.message, expected, `code=${code}, message=${message}`);
    }
});

test('TC017 - Python 兼容性 - 可捕获为 Exception', () => {
    // Python 中可以捕获为 Exception
    // TypeScript/JavaScript 中可以捕获为 Error
    
    try {
        throw new JsonRpcError(-32600, 'Invalid Request');
    } catch (e) {
        assert.ok(e instanceof Error);
        assert.ok(e instanceof JsonRpcError);
    }
});

console.log('All JsonRpcError tests completed!');
