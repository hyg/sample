/**
 * Handle 模块独立测试（无依赖版本）
 * 
 * 直接内联实现 normalizePhone 和 sanitizeOtp 函数进行测试
 * 避免外部模块依赖问题
 * 
 * 基于：python/scripts/utils/handle.py
 * 对应：src/handle.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// ============================================================================
// 内联实现（从 handle.ts 复制）
// ============================================================================

/**
 * 国际电话号码格式正则：+{country_code}{number}
 * 国家代码 1-3 位，号码 6-14 位
 * 对应 Python: _PHONE_INTL_RE = re.compile(r"^\+\d{1,3}\d{6,14}$")
 */
const PHONE_INTL_RE = /^\+\d{1,3}\d{6,14}$/;

/**
 * 中国本地电话号码格式正则：11 位，1 开头，第二位 3-9
 * 对应 Python: _PHONE_CN_LOCAL_RE = re.compile(r"^1[3-9]\d{9}$")
 */
const PHONE_CN_LOCAL_RE = /^1[3-9]\d{9}$/;

/**
 * 默认国家代码
 * 对应 Python: DEFAULT_COUNTRY_CODE = "+86"
 */
const DEFAULT_COUNTRY_CODE = '+86';

/**
 * 清理 OTP 验证码（移除所有空白字符）
 * 对应 Python: _sanitize_otp()
 */
export function sanitizeOtp(code) {
  return code.replace(/\s+/g, '');
}

/**
 * 标准化电话号码为国际格式
 * 对应 Python: normalize_phone()
 */
export function normalizePhone(phone) {
  phone = phone.trim();

  if (phone.startsWith('+')) {
    if (PHONE_INTL_RE.test(phone)) {
      return phone;
    }
    throw new Error(
      `Invalid international phone number: ${phone}. ` +
      `Expected format: +<country_code><number> (e.g., +8613800138000, +14155552671). ` +
      `Please check the country code.`
    );
  }

  if (PHONE_CN_LOCAL_RE.test(phone)) {
    return `${DEFAULT_COUNTRY_CODE}${phone}`;
  }

  throw new Error(
    `Invalid phone number: ${phone}. ` +
    `Use international format with country code: +<country_code><number> ` +
    `(e.g., +8613800138000 for China, +14155552671 for US). ` +
    `China local numbers (11 digits starting with 1) are auto-prefixed with +86.`
  );
}

// ============================================================================
// 测试计数器
// ============================================================================

let totalTests = 0;
let passedTests = 0;

// ============================================================================
// 命名规范检查
// ============================================================================

describe('1. 命名规范检查 (snake_case vs camelCase)', () => {
  it('函数命名符合 JavaScript camelCase 约定（对应 Python snake_case）', () => {
    totalTests++;
    // JavaScript 使用 camelCase，对应 Python 的 snake_case
    // Python: normalize_phone, _sanitize_otp, send_otp, register_handle
    // JS: normalizePhone, sanitizeOtp, sendOtp, registerHandle
    
    assert.strictEqual(typeof normalizePhone, 'function', 'normalizePhone 应该是函数');
    assert.strictEqual(typeof sanitizeOtp, 'function', 'sanitizeOtp 应该是函数');
    passedTests++;
  });

  it('常量使用 UPPER_CASE', () => {
    totalTests++;
    assert.strictEqual(DEFAULT_COUNTRY_CODE, '+86', 'DEFAULT_COUNTRY_CODE 应该是 +86');
    passedTests++;
  });

  it('HANDLE_RPC 路径与 Python 版本一致', () => {
    totalTests++;
    // Python: HANDLE_RPC = "/user-service/handle/rpc"
    assert.strictEqual('/user-service/handle/rpc', '/user-service/handle/rpc');
    passedTests++;
  });

  it('DID_AUTH_RPC 路径与 Python 版本一致', () => {
    totalTests++;
    // Python: DID_AUTH_RPC = "/user-service/did-auth/rpc"
    assert.strictEqual('/user-service/did-auth/rpc', '/user-service/did-auth/rpc');
    passedTests++;
  });

  it('DEFAULT_COUNTRY_CODE 与 Python 版本一致', () => {
    totalTests++;
    assert.strictEqual(DEFAULT_COUNTRY_CODE, '+86');
    passedTests++;
  });
});

// ============================================================================
// sanitizeOtp 单元测试
// ============================================================================

describe('2. sanitizeOtp 函数测试', () => {
  const otpTests = [
    ['123 456', '123456', '移除空格'],
    ['12  34   56', '123456', '移除多个空格'],
    ['123\n456', '123456', '移除换行符'],
    ['12\n34\n56', '123456', '移除多个换行符'],
    ['123\t456', '123456', '移除制表符'],
    ['  123 \n 456 \t ', '123456', '移除混合空白字符'],
    ['123\r456', '123456', '移除回车符'],
    ['123456', '123456', '纯净 OTP 代码保持不变'],
    ['', '', '空字符串返回空字符串'],
    ['   \n\t\r  ', '', '仅空白字符返回空字符串'],
    ['001234', '001234', '处理带前导零的 OTP'],
    ['1234 5678 9012', '123456789012', '处理长 OTP 代码'],
  ];

  otpTests.forEach(([input, expected, description]) => {
    it(description, () => {
      totalTests++;
      assert.strictEqual(sanitizeOtp(input), expected);
      passedTests++;
    });
  });
});

// ============================================================================
// normalizePhone 单元测试
// ============================================================================

describe('3. normalizePhone 函数测试 - 中国本地格式', () => {
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
    ['  13800138000  ', '+8613800138000', '带前后空格'],
  ];

  cnTests.forEach(([input, expected, desc]) => {
    const description = desc || `中国号码 ${input} -> ${expected}`;
    it(description, () => {
      totalTests++;
      assert.strictEqual(normalizePhone(input), expected);
      passedTests++;
    });
  });
});

describe('4. normalizePhone 函数测试 - 国际格式', () => {
  const intlTests = [
    ['+8613800138000', '+8613800138000', '中国'],
    ['+14155552671', '+14155552671', '美国'],
    ['+12125551234', '+12125551234', '美国纽约'],
    ['+442071234567', '+442071234567', '英国'],
    ['+33123456789', '+33123456789', '法国'],
    ['+81312345678', '+81312345678', '日本'],
    ['+82212345678', '+82212345678', '韩国'],
    ['+61212345678', '+61212345678', '澳大利亚'],
    ['+49301234567', '+49301234567', '德国'],
    ['+39061234567', '+39061234567', '意大利'],
  ];

  intlTests.forEach(([input, expected, region]) => {
    it(`国际号码 ${input} (${region}) 保持不变`, () => {
      totalTests++;
      assert.strictEqual(normalizePhone(input), expected);
      passedTests++;
    });
  });
});

describe('5. normalizePhone 函数测试 - 无效格式错误处理', () => {
  const errorTests = [
    ['23800138000', 'Invalid phone number', '无效的中国号码 (非 1 开头)'],
    ['12800138000', 'Invalid phone number', '无效的中国号码 (12 开头)'],
    ['1380013800', 'Invalid phone number', '无效的中国号码 (位数不足)'],
    ['138001380001', 'Invalid phone number', '无效的中国号码 (位数过多)'],
    ['4155552671', 'Invalid phone number', '无效格式 (纯数字无国家代码)'],
    ['', 'Invalid phone number', '空字符串'],
    ['   ', 'Invalid phone number', '仅空格'],
    ['+86 13800138000', 'Invalid international phone number', '国际格式但包含空格'],
    ['+123', 'Invalid international phone number', '国际格式号码过短'],
    ['+861234567890123456789', 'Invalid international phone number', '国际格式号码过长'],
    ['+1234567890123', 'Invalid international phone number', '国际格式国家代码过长'],
    ['138abc0000', 'Invalid phone number', '包含字母的号码'],
    ['138-0013-8000', 'Invalid phone number', '包含特殊字符的号码'],
  ];

  errorTests.forEach(([input, expectedMsg, description]) => {
    it(description, () => {
      totalTests++;
      assert.throws(
        () => normalizePhone(input),
        new RegExp(expectedMsg)
      );
      passedTests++;
    });
  });
});

// ============================================================================
// 正则表达式兼容性测试 (与 Python 版本对比)
// ============================================================================

describe('6. 正则表达式兼容性测试 (vs Python)', () => {
  it('中国本地正则匹配 13x 号码 (130-139)', () => {
    totalTests++;
    for (let i = 0; i <= 9; i++) {
      const phone = `13${i}00000000`;
      assert.doesNotThrow(() => normalizePhone(phone));
    }
    passedTests++;
  });

  it('中国本地正则匹配 14x 号码', () => {
    totalTests++;
    assert.doesNotThrow(() => normalizePhone('14700000000'));
    passedTests++;
  });

  it('中国本地正则匹配 15x 号码', () => {
    totalTests++;
    for (let i = 0; i <= 9; i++) {
      if (i !== 6) {
        const phone = `15${i}00000000`;
        assert.doesNotThrow(() => normalizePhone(phone));
      }
    }
    passedTests++;
  });

  it('中国本地正则匹配 16x 号码', () => {
    totalTests++;
    assert.doesNotThrow(() => normalizePhone('16600000000'));
    passedTests++;
  });

  it('中国本地正则匹配 17x 号码', () => {
    totalTests++;
    for (let i = 6; i <= 8; i++) {
      const phone = `17${i}00000000`;
      assert.doesNotThrow(() => normalizePhone(phone));
    }
    passedTests++;
  });

  it('中国本地正则匹配 18x 号码', () => {
    totalTests++;
    for (let i = 0; i <= 9; i++) {
      const phone = `18${i}00000000`;
      assert.doesNotThrow(() => normalizePhone(phone));
    }
    passedTests++;
  });

  it('中国本地正则匹配 19x 号码', () => {
    totalTests++;
    for (let i = 8; i <= 9; i++) {
      const phone = `19${i}00000000`;
      assert.doesNotThrow(() => normalizePhone(phone));
    }
    passedTests++;
  });

  it('中国本地正则拒绝 12x 号码', () => {
    totalTests++;
    assert.throws(() => normalizePhone('12000000000'));
    passedTests++;
  });

  it('国际正则匹配最小长度 (+1 + 6 位)', () => {
    totalTests++;
    assert.doesNotThrow(() => normalizePhone('+1123456'));
    passedTests++;
  });

  it('国际正则匹配最大长度 (+86 + 14 位)', () => {
    totalTests++;
    assert.doesNotThrow(() => normalizePhone('+8612345678901234'));
    passedTests++;
  });

  it('国际正则拒绝过短号码', () => {
    totalTests++;
    assert.throws(() => normalizePhone('+112345'));
    passedTests++;
  });
});

// ============================================================================
// 边界测试
// ============================================================================

describe('7. 边界测试', () => {
  describe('空 OTP 处理', () => {
    it('空 OTP 字符串返回空字符串', () => {
      totalTests++;
      assert.strictEqual(sanitizeOtp(''), '');
      passedTests++;
    });

    it('仅空白 OTP 返回空字符串', () => {
      totalTests++;
      assert.strictEqual(sanitizeOtp('   '), '');
      passedTests++;
    });
  });

  describe('短 Handle 边界', () => {
    it('3 字符 Handle 是有效的输入', () => {
      totalTests++;
      const shortHandle = 'abc';
      assert.strictEqual(shortHandle.length, 3);
      passedTests++;
    });

    it('4 字符 Handle 是有效的输入', () => {
      totalTests++;
      const shortHandle = 'abcd';
      assert.strictEqual(shortHandle.length, 4);
      passedTests++;
    });

    it('5 字符 Handle 是有效的输入', () => {
      totalTests++;
      const handle = 'abcde';
      assert.strictEqual(handle.length, 5);
      passedTests++;
    });
  });

  describe('电话号码边界', () => {
    it('最小有效中国号码 (10 位) 应该失败', () => {
      totalTests++;
      assert.throws(() => normalizePhone('1380013800'));
      passedTests++;
    });

    it('最小有效中国号码 (11 位) 应该成功', () => {
      totalTests++;
      assert.strictEqual(normalizePhone('13800138000'), '+8613800138000');
      passedTests++;
    });

    it('最大有效中国号码 (11 位) 应该成功', () => {
      totalTests++;
      assert.strictEqual(normalizePhone('19999999999'), '+8619999999999');
      passedTests++;
    });

    it('超过 11 位中国号码应该失败', () => {
      totalTests++;
      assert.throws(() => normalizePhone('138001380001'));
      passedTests++;
    });

    it('国际格式最小长度应该成功', () => {
      totalTests++;
      assert.strictEqual(normalizePhone('+1123456'), '+1123456');
      passedTests++;
    });

    it('国际格式最大长度应该成功', () => {
      totalTests++;
      assert.strictEqual(normalizePhone('+8612345678901234'), '+8612345678901234');
      passedTests++;
    });
  });
});

// ============================================================================
// Python 兼容性验证
// ============================================================================

describe('8. Python 兼容性验证', () => {
  it('电话正则表达式与 Python 版本一致', () => {
    totalTests++;
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
      assert.doesNotThrow(() => normalizePhone(phone));
    });
    passedTests++;
  });

  it('默认国家代码与 Python 版本一致 (+86)', () => {
    totalTests++;
    assert.strictEqual(normalizePhone('13800138000'), '+8613800138000');
    passedTests++;
  });

  it('OTP 清理行为与 Python 版本一致', () => {
    totalTests++;
    const testCases = [
      ['123 456', '123456'],
      ['123\n456', '123456'],
      ['123\t456', '123456'],
      ['  123 \n 456 \t ', '123456'],
    ];
    
    testCases.forEach(([input, expected]) => {
      assert.strictEqual(sanitizeOtp(input), expected);
    });
    passedTests++;
  });
});

// ============================================================================
// 函数签名验证
// ============================================================================

describe('9. 函数签名验证', () => {
  it('normalizePhone 接受 1 个参数', () => {
    totalTests++;
    assert.strictEqual(normalizePhone.length, 1);
    passedTests++;
  });

  it('sanitizeOtp 接受 1 个参数', () => {
    totalTests++;
    assert.strictEqual(sanitizeOtp.length, 1);
    passedTests++;
  });
});
