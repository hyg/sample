#!/usr/bin/env node

/**
 * CLI 公钥处理测试
 * 测试公钥格式验证和处理逻辑
 */

// 模拟 CLI 中的公钥处理逻辑
function setPartnerPublicKey(publicKeyHex) {
  try {
    let publicKey = Buffer.from(publicKeyHex, 'hex');
    
    // 验证公钥长度
    if (publicKey.length === 33) {
      // 可能是压缩的 P-256 公钥 (0x02 或 0x03 开头)
      const prefix = publicKey[0];
      if (prefix === 0x02 || prefix === 0x03) {
        console.log(`[警告] 检测到 P-256 压缩公钥 (33字节)，自动去掉前缀`);
        publicKey = publicKey.slice(1);
      }
    }
    
    if (publicKey.length !== 32) {
      throw new Error(`公钥长度应为 32 字节 (X25519)，当前长度: ${publicKey.length}`);
    }
    
    console.log(`[连接] 伙伴公钥已设置 (长度: ${publicKey.length} 字节)`);
    return publicKey;
  } catch (err) {
    console.error(`[错误] 无效的公钥格式：${err.message}`);
    return null;
  }
}

// 测试用例
console.log('=== CLI 公钥处理测试 ===\n');

// 测试 1: 正确的 X25519 公钥 (32 字节)
console.log('测试 1: X25519 公钥 (32 字节)');
const testKey1 = '03c8ef419dc877ca4500144f3af9207e03f38dd6f3d5c12d6c7f3c3f3b675d01';
const result1 = setPartnerPublicKey(testKey1);
console.log(`结果: ${result1 ? '✓ 成功' : '✗ 失败'}\n`);

// 测试 2: P-256 压缩公钥 (33 字节)
console.log('测试 2: P-256 压缩公钥 (33 字节)');
const testKey2 = '03c8ef419dc877ca4500144f3af9207e03f38dd6f3d5c12d6c7f3c3f3b675d01ee';
const result2 = setPartnerPublicKey(testKey2);
console.log(`结果: ${result2 ? '✓ 成功' : '✗ 失败'}\n`);

// 测试 3: 错误的长度
console.log('测试 3: 错误的长度 (31 字节)');
const testKey3 = '03c8ef419dc877ca4500144f3af9207e03f38dd6f3d5c12d6c7f3c3f3b675d';
const result3 = setPartnerPublicKey(testKey3);
console.log(`结果: ${result3 ? '✗ 失败' : '✓ 正确拒绝'}\n`);

// 测试 4: 空公钥
console.log('测试 4: 空公钥');
const result4 = setPartnerPublicKey('');
console.log(`结果: ${result4 ? '✗ 失败' : '✓ 正确拒绝'}\n`);

console.log('=== 测试完成 ===');
