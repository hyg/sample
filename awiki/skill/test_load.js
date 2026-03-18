// 测试 credential_layout.js
const filePath = 'D:/huangyg/git/sample/awiki/skill/src/credential_layout.js';

console.log('开始加载...');

try {
    const m = require(filePath);
    console.log('加载完成');
    console.log('module.exports 类型:', typeof m);
    console.log('module.exports 内容:', m);
    console.log('Keys:', Object.keys(m));
    console.log('AUTH_FILE_NAME:', m.AUTH_FILE_NAME);
    console.log('loadIndex:', typeof m.loadIndex);
} catch (e) {
    console.log('错误:', e.message);
    console.log('堆栈:', e.stack);
}
