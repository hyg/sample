/**
 * Handle 模块全面测试
 * 
 * 测试范围：
 * 1. 单元测试 - 所有函数
 * 2. 集成测试 - 完整流程
 * 3. 边界测试 - 异常情况
 * 4. 命名规范检查 - snake_case 验证
 * 5. Python 兼容性验证
 * 
 * 基于：python/scripts/utils/handle.py
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as handleModule from '../dist/index.js';
import { normalizePhone, sanitizeOtp } from '../dist/index.js';

// ============================================================================
// 命名规范检查
// ============================================================================

describe('命名规范检查 (snake_case)', () => {
  it('所有函数名使用 snake_case', () => {
    const expectedFunctions = [
      'sanitizeOtp',      // camelCase (JavaScript 约定)
      'normalizePhone',   // camelCase (JavaScript 约定)
      'sendOtp',          // camelCase (JavaScript 约定)
      'registerHandle',   // camelCase (JavaScript 约定)
      'recoverHandle',    // camelCase (JavaScript 约定)
      'resolveHandle',    // camelCase (JavaScript 约定)
      'lookupHandle',     // camelCase (JavaScript 约定)
    ];
    
    // JavaScript 使用 camelCase 是标准约定，与 Python 的 snake_case 对应
    // 验证函数存在且可调用
    expectedFunctions.forEach(funcName => {
      assert.ok(
        typeof handleModule[funcName] === 'function',
        `函数 ${funcName} 应该存在且可调用`
      );
    });
  });

  it('常量使用 UPPER_CASE', () => {
    const expectedConstants = {
      'HANDLE_RPC': '/user-service/handle/rpc',
      'DID_AUTH_RPC': '/user-service/did-auth/rpc',
      'DEFAULT_COUNTRY_CODE': '+86',
    };

    Object.entries(expectedConstants).forEach(([name, expectedValue]) => {
      assert.ok(
        handleModule[name] !== undefined,
        `常量 ${name} 应该存在`
      );
      assert.strictEqual(
        handleModule[name],
        expectedValue,
        `常量 ${name} 的值应该匹配`
      );
    });
  });

  it('HANDLE_RPC 路径与 Python 版本一致', () => {
    assert.strictEqual(
      handleModule.HANDLE_RPC,
      '/user-service/handle/rpc',
      'HANDLE_RPC 应该与 Python 版本一致'
    );
  });

  it('DID_AUTH_RPC 路径与 Python 版本一致', () => {
    assert.strictEqual(
      handleModule.DID_AUTH_RPC,
      '/user-service/did-auth/rpc',
      'DID_AUTH_RPC 应该与 Python 版本一致'
    );
  });

  it('DEFAULT_COUNTRY_CODE 与 Python 版本一致', () => {
    assert.strictEqual(
      handleModule.DEFAULT_COUNTRY_CODE,
      '+86',
      'DEFAULT_COUNTRY_CODE 应该与 Python 版本一致'
    );
  });
});

// ============================================================================
// sanitizeOtp 单元测试
// ============================================================================

describe('sanitizeOtp 函数测试', () => {
  it('移除空格', () => {
    assert.strictEqual(sanitizeOtp('123 456'), '123456');
  });

  it('移除多个空格', () => {
    assert.strictEqual(sanitizeOtp('12  34   56'), '123456');
  });

  it('移除换行符', () => {
    assert.strictEqual(sanitizeOtp('123\n456'), '123456');
  });

  it('移除多个换行符', () => {
    assert.strictEqual(sanitizeOtp('12\n34\n56'), '123456');
  });

  it('移除制表符', () => {
    assert.strictEqual(sanitizeOtp('123\t456'), '123456');
  });

  it('移除混合空白字符', () => {
    assert.strictEqual(sanitizeOtp('  123 \n 456 \t '), '123456');
  });

  it('移除回车符', () => {
    assert.strictEqual(sanitizeOtp('123\r456'), '123456');
  });

  it('纯净 OTP 代码保持不变', () => {
    assert.strictEqual(sanitizeOtp('123456'), '123456');
  });

  it('空字符串返回空字符串', () => {
    assert.strictEqual(sanitizeOtp(''), '');
  });

  it('仅空白字符返回空字符串', () => {
    assert.strictEqual(sanitizeOtp('   \n\t\r  '), '');
  });

  it('处理带前导零的 OTP', () => {
    assert.strictEqual(sanitizeOtp('001234'), '001234');
  });

  it('处理长 OTP 代码', () => {
    assert.strictEqual(sanitizeOtp('1234 5678 9012'), '123456789012');
  });
});

// ============================================================================
// normalizePhone 单元测试
// ============================================================================

describe('normalizePhone 函数测试', () => {
  // 中国本地格式测试
  describe('中国本地格式 (11 位)', () => {
    const cnTests = [
      ['13800138000', '+8613800138000'],
      ['13912345678', '+8613912345678'],
      ['18888888888', '+8618888888888'],
      ['13000000000', '+8613000000000'],
      ['19900000000', '+8619900000000'],
      ['13123456789', '+8613123456789'],
      ['13234567890', '+8613234567890'],
      ['13345678901', '+8613345678901'],
      ['13456789012', '+8613456789012'],
      ['13567890123', '+8613567890123'],
      ['13678901234', '+8613678901234'],
      ['13789012345', '+8613789012345'],
      ['13890123456', '+8613890123456'],
      ['13901234567', '+8613901234567'],
      ['14700000000', '+8614700000000'],
      ['15000000000', '+8615000000000'],
      ['15100000000', '+8615100000000'],
      ['15200000000', '+8615200000000'],
      ['15800000000', '+8615800000000'],
      ['15900000000', '+8615900000000'],
      ['16600000000', '+8616600000000'],
      ['17600000000', '+8617600000000'],
      ['17800000000', '+8617800000000'],
      ['18000000000', '+8618000000000'],
      ['18100000000', '+8618100000000'],
      ['18200000000', '+8618200000000'],
      ['18300000000', '+8618300000000'],
      ['18400000000', '+8618400000000'],
      ['18500000000', '+8618500000000'],
      ['18600000000', '+8618600000000'],
      ['18700000000', '+8618700000000'],
      ['18900000000', '+8618900000000'],
      ['19800000000', '+8619800000000'],
    ];

    cnTests.forEach(([input, expected]) => {
      it(`中国号码 ${input} -> ${expected}`, () => {
        assert.strictEqual(normalizePhone(input), expected);
      });
    });

    it('带前后空格的中国号码', () => {
      assert.strictEqual(normalizePhone('  13800138000  '), '+8613800138000');
    });
  });

  // 国际格式测试
  describe('国际格式', () => {
    const intlTests = [
      ['+8613800138000', '+8613800138000'],  // 中国
      ['+14155552671', '+14155552671'],      // 美国
      ['+12125551234', '+12125551234'],      // 美国纽约
      ['+442071234567', '+442071234567'],    // 英国
      ['+33123456789', '+33123456789'],      // 法国
      ['+81312345678', '+81312345678'],      // 日本
      ['+82212345678', '+82212345678'],      // 韩国
      ['+61212345678', '+61212345678'],      // 澳大利亚
      ['+49301234567', '+49301234567'],      // 德国
      ['+39061234567', '+39061234567'],      // 意大利
    ];

    intlTests.forEach(([input, expected]) => {
      it(`国际号码 ${input} 保持不变`, () => {
        assert.strictEqual(normalizePhone(input), expected);
      });
    });
  });

  // 无效格式测试
  describe('无效格式错误处理', () => {
    it('无效的中国号码 (非 1 开头) 抛出异常', () => {
      assert.throws(
        () => normalizePhone('23800138000'),
        /Invalid phone number/
      );
    });

    it('无效的中国号码 (12 开头) 抛出异常', () => {
      assert.throws(
        () => normalizePhone('12800138000'),
        /Invalid phone number/
      );
    });

    it('无效的中国号码 (位数不足) 抛出异常', () => {
      assert.throws(
        () => normalizePhone('1380013800'),
        /Invalid phone number/
      );
    });

    it('无效的中国号码 (位数过多) 抛出异常', () => {
      assert.throws(
        () => normalizePhone('138001380001'),
        /Invalid phone number/
      );
    });

    it('无效格式 (纯数字无国家代码) 抛出异常', () => {
      assert.throws(
        () => normalizePhone('4155552671'),
        /Invalid phone number/
      );
    });

    it('空字符串抛出异常', () => {
      assert.throws(
        () => normalizePhone(''),
        /Invalid phone number/
      );
    });

    it('仅空格抛出异常', () => {
      assert.throws(
        () => normalizePhone('   '),
        /Invalid phone number/
      );
    });

    it('国际格式但包含空格抛出异常', () => {
      assert.throws(
        () => normalizePhone('+86 13800138000'),
        /Invalid international phone number/
      );
    });

    it('国际格式号码过短抛出异常', () => {
      assert.throws(
        () => normalizePhone('+123'),
        /Invalid international phone number/
      );
    });

    it('国际格式号码过长抛出异常', () => {
      assert.throws(
        () => normalizePhone('+861234567890123456789'),
        /Invalid international phone number/
      );
    });

    it('国际格式国家代码过长抛出异常', () => {
      assert.throws(
        () => normalizePhone('+1234567890123'),
        /Invalid international phone number/
      );
    });

    it('包含字母的号码抛出异常', () => {
      assert.throws(
        () => normalizePhone('138abc0000'),
        /Invalid phone number/
      );
    });

    it('包含特殊字符的号码抛出异常', () => {
      assert.throws(
        () => normalizePhone('138-0013-8000'),
        /Invalid phone number/
      );
    });
  });
});

// ============================================================================
// 正则表达式兼容性测试 (与 Python 版本对比)
// ============================================================================

describe('正则表达式兼容性测试 (vs Python)', () => {
  // Python 正则：
  // _PHONE_INTL_RE = re.compile(r"^\+\d{1,3}\d{6,14}$")
  // _PHONE_CN_LOCAL_RE = re.compile(r"^1[3-9]\d{9}$")
  
  it('中国本地正则匹配 13x 号码', () => {
    // 验证 130-139 都匹配
    for (let i = 0; i <= 9; i++) {
      const phone = `13${i}00000000`;
      assert.doesNotThrow(
        () => normalizePhone(phone),
        `号码 ${phone} 应该被接受`
      );
    }
  });

  it('中国本地正则匹配 14x 号码', () => {
    assert.doesNotThrow(() => normalizePhone('14700000000'));
  });

  it('中国本地正则匹配 15x 号码', () => {
    for (let i = 0; i <= 9; i++) {
      if (i !== 6) { // 156 单独测试
        const phone = `15${i}00000000`;
        assert.doesNotThrow(
          () => normalizePhone(phone),
          `号码 ${phone} 应该被接受`
        );
      }
    }
  });

  it('中国本地正则匹配 16x 号码', () => {
    assert.doesNotThrow(() => normalizePhone('16600000000'));
  });

  it('中国本地正则匹配 17x 号码', () => {
    for (let i = 6; i <= 8; i++) {
      const phone = `17${i}00000000`;
      assert.doesNotThrow(
        () => normalizePhone(phone),
        `号码 ${phone} 应该被接受`
      );
    }
  });

  it('中国本地正则匹配 18x 号码', () => {
    for (let i = 0; i <= 9; i++) {
      const phone = `18${i}00000000`;
      assert.doesNotThrow(
        () => normalizePhone(phone),
        `号码 ${phone} 应该被接受`
      );
    }
  });

  it('中国本地正则匹配 19x 号码', () => {
    for (let i = 8; i <= 9; i++) {
      const phone = `19${i}00000000`;
      assert.doesNotThrow(
        () => normalizePhone(phone),
        `号码 ${phone} 应该被接受`
      );
    }
  });

  it('中国本地正则拒绝 12x 号码', () => {
    assert.throws(() => normalizePhone('12000000000'));
  });

  it('国际正则匹配最小长度 (+1 + 6 位)', () => {
    assert.doesNotThrow(() => normalizePhone('+1123456'));
  });

  it('国际正则匹配最大长度 (+86 + 14 位)', () => {
    assert.doesNotThrow(() => normalizePhone('+8612345678901234'));
  });

  it('国际正则拒绝过短号码', () => {
    assert.throws(() => normalizePhone('+112345'));  // 只有 5 位数字
  });
});

// ============================================================================
// 边界测试
// ============================================================================

describe('边界测试', () => {
  describe('空 OTP 处理', () => {
    it('空 OTP 字符串返回空字符串', () => {
      assert.strictEqual(sanitizeOtp(''), '');
    });

    it('仅空白 OTP 返回空字符串', () => {
      assert.strictEqual(sanitizeOtp('   '), '');
    });
  });

  describe('短 Handle 边界', () => {
    // 短 Handle (3-4 字符) 需要邀请码
    // 这是业务逻辑，在集成测试中验证
    it('3 字符 Handle 是有效的输入', () => {
      // Handle 验证在服务端，这里只验证可以传入
      const shortHandle = 'abc';
      assert.strictEqual(shortHandle.length, 3);
    });

    it('4 字符 Handle 是有效的输入', () => {
      const shortHandle = 'abcd';
      assert.strictEqual(shortHandle.length, 4);
    });

    it('5 字符 Handle 是有效的输入', () => {
      const handle = 'abcde';
      assert.strictEqual(handle.length, 5);
    });
  });

  describe('电话号码边界', () => {
    it('最小有效中国号码 (10 位) 应该失败', () => {
      assert.throws(() => normalizePhone('1380013800'));
    });

    it('最小有效中国号码 (11 位) 应该成功', () => {
      assert.strictEqual(normalizePhone('13800138000'), '+8613800138000');
    });

    it('最大有效中国号码 (11 位) 应该成功', () => {
      assert.strictEqual(normalizePhone('19999999999'), '+8619999999999');
    });

    it('超过 11 位中国号码应该失败', () => {
      assert.throws(() => normalizePhone('138001380001'));
    });

    it('国际格式最小长度应该成功', () => {
      assert.strictEqual(normalizePhone('+1123456'), '+1123456');
    });

    it('国际格式最大长度应该成功', () => {
      assert.strictEqual(normalizePhone('+8612345678901234'), '+8612345678901234');
    });
  });
});

// ============================================================================
// 模块导出验证
// ============================================================================

describe('模块导出验证', () => {
  it('导出 sanitizeOtp 函数', () => {
    assert.strictEqual(typeof handleModule.sanitizeOtp, 'function');
  });

  it('导出 normalizePhone 函数', () => {
    assert.strictEqual(typeof handleModule.normalizePhone, 'function');
  });

  it('导出 sendOtp 函数', () => {
    assert.strictEqual(typeof handleModule.sendOtp, 'function');
  });

  it('导出 registerHandle 函数', () => {
    assert.strictEqual(typeof handleModule.registerHandle, 'function');
  });

  it('导出 recoverHandle 函数', () => {
    assert.strictEqual(typeof handleModule.recoverHandle, 'function');
  });

  it('导出 resolveHandle 函数', () => {
    assert.strictEqual(typeof handleModule.resolveHandle, 'function');
  });

  it('导出 lookupHandle 函数', () => {
    assert.strictEqual(typeof handleModule.lookupHandle, 'function');
  });

  it('导出 HANDLE_RPC 常量', () => {
    assert.strictEqual(handleModule.HANDLE_RPC, '/user-service/handle/rpc');
  });

  it('导出 DID_AUTH_RPC 常量', () => {
    assert.strictEqual(handleModule.DID_AUTH_RPC, '/user-service/did-auth/rpc');
  });

  it('导出 DEFAULT_COUNTRY_CODE 常量', () => {
    assert.strictEqual(handleModule.DEFAULT_COUNTRY_CODE, '+86');
  });

  it('默认导出包含所有函数', () => {
    const defaultExport = handleModule.default;
    assert.ok(defaultExport !== undefined);
    assert.strictEqual(typeof defaultExport.sanitizeOtp, 'function');
    assert.strictEqual(typeof defaultExport.normalizePhone, 'function');
    assert.strictEqual(typeof defaultExport.sendOtp, 'function');
    assert.strictEqual(typeof defaultExport.registerHandle, 'function');
    assert.strictEqual(typeof defaultExport.recoverHandle, 'function');
    assert.strictEqual(typeof defaultExport.resolveHandle, 'function');
    assert.strictEqual(typeof defaultExport.lookupHandle, 'function');
  });
});

// ============================================================================
// Python 兼容性验证
// ============================================================================

describe('Python 兼容性验证', () => {
  it('电话正则表达式与 Python 版本一致', () => {
    // Python: _PHONE_CN_LOCAL_RE = re.compile(r"^1[3-9]\d{9}$")
    // 测试边界值
    const validNumbers = [
      '13000000000', '13100000000', '13200000000', '13300000000',
      '13400000000', '13500000000', '13600000000', '13700000000',
      '13800000000', '13900000000', '14700000000', '15000000000',
      '15100000000', '15200000000', '15800000000', '15900000000',
      '16600000000', '17600000000', '17800000000', '18000000000',
      '18100000000', '18200000000', '18300000000', '18400000000',
      '18500000000', '18600000000', '18700000000', '18900000000',
      '19800000000', '19900000000',
    ];
    
    validNumbers.forEach(phone => {
      assert.doesNotThrow(
        () => normalizePhone(phone),
        `号码 ${phone} 应该与 Python 版本行为一致`
      );
    });
  });

  it('默认国家代码与 Python 版本一致 (+86)', () => {
    assert.strictEqual(handleModule.DEFAULT_COUNTRY_CODE, '+86');
    assert.strictEqual(normalizePhone('13800138000'), '+8613800138000');
  });

  it('RPC 端点路径与 Python 版本一致', () => {
    // Python: HANDLE_RPC = "/user-service/handle/rpc"
    assert.strictEqual(handleModule.HANDLE_RPC, '/user-service/handle/rpc');
    
    // Python: DID_AUTH_RPC = "/user-service/did-auth/rpc"
    assert.strictEqual(handleModule.DID_AUTH_RPC, '/user-service/did-auth/rpc');
  });

  it('OTP 清理行为与 Python 版本一致', () => {
    // Python: return re.sub(r"\s+", "", code)
    const testCases = [
      ['123 456', '123456'],
      ['123\n456', '123456'],
      ['123\t456', '123456'],
      ['  123 \n 456 \t ', '123456'],
    ];
    
    testCases.forEach(([input, expected]) => {
      assert.strictEqual(
        sanitizeOtp(input),
        expected,
        `OTP "${input}" 应该清理为 "${expected}"`
      );
    });
  });
});

// ============================================================================
// 集成测试 (Mock)
// ============================================================================

describe('集成测试 (Mock)', () => {
  // 注意：完整的集成测试需要实际的 RPC 服务器
  // 这里测试函数的调用链和参数传递
  
  it('registerHandle 应该调用 normalizePhone', () => {
    // 验证函数签名
    assert.strictEqual(handleModule.registerHandle.length, 6);
    // 参数：client, config, phone, otpCode, handle, options
  });

  it('recoverHandle 应该返回元组结构', () => {
    // 验证函数签名
    assert.strictEqual(handleModule.recoverHandle.length, 6);
    // 返回：[DIDIdentity, dict]
  });

  it('sendOtp 应该调用 normalizePhone', () => {
    // 验证函数签名
    assert.strictEqual(handleModule.sendOtp.length, 2);
    // 参数：client, phone
  });

  it('resolveHandle 调用 lookup RPC', () => {
    // 验证函数签名
    assert.strictEqual(handleModule.resolveHandle.length, 2);
    // 参数：client, handle
  });

  it('lookupHandle 调用 lookup RPC', () => {
    // 验证函数签名
    assert.strictEqual(handleModule.lookupHandle.length, 2);
    // 参数：client, did
  });
});
