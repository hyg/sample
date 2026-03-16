/**
 * Handle 模块测试
 *
 * 测试用例基于：doc/util/handle/distill.json
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizePhone, sanitizeOtp } from '../dist/index.js';

describe('normalizePhone', () => {
  it('中国本地格式号码自动添加 +86 前缀 (138)', () => {
    assert.strictEqual(normalizePhone('13800138000'), '+8613800138000');
  });

  it('中国本地格式号码自动添加 +86 前缀 (139)', () => {
    assert.strictEqual(normalizePhone('13912345678'), '+8613912345678');
  });

  it('中国本地格式号码自动添加 +86 前缀 (188)', () => {
    assert.strictEqual(normalizePhone('18888888888'), '+8618888888888');
  });

  it('国际格式号码 (中国) 保持不变', () => {
    assert.strictEqual(normalizePhone('+8613800138000'), '+8613800138000');
  });

  it('国际格式号码 (美国) 保持不变', () => {
    assert.strictEqual(normalizePhone('+14155552671'), '+14155552671');
  });

  it('带前后空格的号码', () => {
    assert.strictEqual(normalizePhone('  13800138000  '), '+8613800138000');
  });

  it('中国号码 130 开头', () => {
    assert.strictEqual(normalizePhone('13000000000'), '+8613000000000');
  });

  it('中国号码 199 开头', () => {
    assert.strictEqual(normalizePhone('19900000000'), '+8619900000000');
  });

  it('国际格式但包含空格应抛出异常', () => {
    assert.throws(
      () => normalizePhone('+86 13800138000'),
      /Invalid international phone number/
    );
  });

  it('无效的中国号码 (非 1 开头) 应抛出异常', () => {
    assert.throws(
      () => normalizePhone('23800138000'),
      /Invalid phone number/
    );
  });

  it('无效的中国号码 (位数不足) 应抛出异常', () => {
    assert.throws(
      () => normalizePhone('1380013800'),
      /Invalid phone number/
    );
  });

  it('无效的中国号码 (12 开头) 应抛出异常', () => {
    assert.throws(
      () => normalizePhone('12800138000'),
      /Invalid phone number/
    );
  });

  it('无效格式 (纯数字无国家代码) 应抛出异常', () => {
    assert.throws(
      () => normalizePhone('4155552671'),
      /Invalid phone number/
    );
  });

  it('空字符串应抛出异常', () => {
    assert.throws(
      () => normalizePhone(''),
      /Invalid phone number/
    );
  });

  it('国际格式号码过短应抛出异常', () => {
    assert.throws(
      () => normalizePhone('+123'),
      /Invalid international phone number/
    );
  });

  it('国际格式号码过长应抛出异常', () => {
    assert.throws(
      () => normalizePhone('+861234567890123456789'),
      /Invalid international phone number/
    );
  });
});

describe('sanitizeOtp', () => {
  it('清理带空格的 OTP 代码', () => {
    assert.strictEqual(sanitizeOtp('123 456'), '123456');
  });

  it('清理带换行的 OTP 代码', () => {
    assert.strictEqual(sanitizeOtp('123\n456'), '123456');
  });

  it('清理带制表符的 OTP 代码', () => {
    assert.strictEqual(sanitizeOtp('123\t456'), '123456');
  });

  it('纯净 OTP 代码保持不变', () => {
    assert.strictEqual(sanitizeOtp('123456'), '123456');
  });

  it('清理混合空白字符的 OTP 代码', () => {
    assert.strictEqual(sanitizeOtp('  123 \n 456 \t '), '123456');
  });

  it('空 OTP 代码返回空字符串', () => {
    assert.strictEqual(sanitizeOtp(''), '');
  });

  it('仅空白字符的 OTP 代码返回空字符串', () => {
    assert.strictEqual(sanitizeOtp('   \n\t  '), '');
  });
});
