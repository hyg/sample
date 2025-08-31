#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const yaml = require('js-yaml');

// 获取目标路径（脚本所在目录）
//const targetPath = __dirname;
const targetPath = "d:\\huangyg\\git\\ego\\data\\voucher\\2025\\";

// 查找最新的AVR ID
function getLatestAvrId() {
  const files = fs.readdirSync(targetPath);
  let maxId = 0;
  
  files.forEach(file => {
    const match = file.match(/^AVR\.(\d+)\.yaml$/);
    if (match) {
      const id = parseInt(match[1]);
      if (id > maxId) {
        maxId = id;
      }
    }
  });
  
  return maxId;
}

// 查找最新的AER ID
function getLatestAerId() {
  const files = fs.readdirSync(targetPath);
  let maxId = 0;
  
  files.forEach(file => {
    const match = file.match(/^AER\.(\d+)\.yaml$/);
    if (match) {
      const id = parseInt(match[1]);
      if (id > maxId) {
        maxId = id;
      }
    }
  });
  
  return maxId;
}

// 解析输入文本
function parseVoucherText(text) {
  // 分割文本为行
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  const result = {};
  
  // 查找"---"分隔符的位置
  const separatorIndex = lines.indexOf('---');
  
  // 如果找到了分隔符，提取额外的amount和summary信息
  if (separatorIndex !== -1 && separatorIndex + 2 < lines.length) {
    // 提取amount和summary（分隔符后的两行）
    result.userAmount = lines[separatorIndex + 1];
    result.userSummary = lines[separatorIndex + 2];
    
    // 只处理分隔符之前的内容作为凭证文本
    const voucherLines = lines.slice(0, separatorIndex);
    
    // 处理凭证内容
    for (let i = 0; i < voucherLines.length; i++) {
      const line = voucherLines[i];
      
      // 处理301凭证格式（支付宝支付）
      if (line === '支付时间' && i + 1 < voucherLines.length) {
        result.payTime = voucherLines[i + 1];
      } else if (line === '订单号' && i + 1 < voucherLines.length) {
        result.transactionId = voucherLines[i + 1];
        result.voucherType = 'alipay'; // 标记为支付宝支付
      } else if (line === '商家订单号' && i + 1 < voucherLines.length) {
        result.merchantId = voucherLines[i + 1];
      } else if (line === '商品说明' && i + 1 < voucherLines.length) {
        result.product = voucherLines[i + 1];
      } else if (line === '收款方全称' && i + 1 < voucherLines.length) {
        result.merchantName = voucherLines[i + 1];
      } else if (line.startsWith('-') && !isNaN(parseFloat(line))) {
        // 金额行，以负号开头的数字
        result.amount = Math.abs(parseFloat(line)).toFixed(2);
      } else if (line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // 支付时间格式：2025-08-24 19:38:20
        result.payTime = line;
      } else if (line.match(/^\d{28,}$/) && !result.transactionId) {
        // 订单号格式：28位以上的数字（仅当尚未设置transactionId时）
        result.transactionId = line;
        if (!result.voucherType) {
          result.voucherType = 'alipay'; // 默认标记为支付宝支付
        }
      } else if (line.match(/^[A-Z0-9]+$/) && !result.merchantId) {
        // 商家订单号格式：大写字母和数字组合（仅当尚未设置merchantId时）
        result.merchantId = line;
      }
      
      // 处理299、300凭证格式（微信支付）
      if (line === '交易单号' && i + 1 < voucherLines.length) {
        result.transactionId = voucherLines[i + 1];
        result.voucherType = 'wechat'; // 标记为微信支付
      } else if (line === '商户单号' && i + 1 < voucherLines.length) {
        result.merchantId = voucherLines[i + 1];
      } else if (line === '商品' && i + 1 < voucherLines.length) {
        result.product = voucherLines[i + 1];
      } else if (line === '商户全称' && i + 1 < voucherLines.length) {
        result.merchantName = voucherLines[i + 1];
      }
    }
  } else {
    // 没有找到分隔符，按原来的方式处理所有行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 处理301凭证格式（支付宝支付）
      if (line === '支付时间' && i + 1 < lines.length) {
        result.payTime = lines[i + 1];
      } else if (line === '订单号' && i + 1 < lines.length) {
        result.transactionId = lines[i + 1];
        result.voucherType = 'alipay'; // 标记为支付宝支付
      } else if (line === '商家订单号' && i + 1 < lines.length) {
        result.merchantId = lines[i + 1];
      } else if (line === '商品说明' && i + 1 < lines.length) {
        result.product = lines[i + 1];
      } else if (line === '收款方全称' && i + 1 < lines.length) {
        result.merchantName = lines[i + 1];
      } else if (line.startsWith('-') && !isNaN(parseFloat(line))) {
        // 金额行，以负号开头的数字
        result.amount = Math.abs(parseFloat(line)).toFixed(2);
      } else if (line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // 支付时间格式：2025-08-24 19:38:20
        result.payTime = line;
      } else if (line.match(/^\d{28,}$/) && !result.transactionId) {
        // 订单号格式：28位以上的数字（仅当尚未设置transactionId时）
        result.transactionId = line;
        if (!result.voucherType) {
          result.voucherType = 'alipay'; // 默认标记为支付宝支付
        }
      } else if (line.match(/^[A-Z0-9]+$/) && !result.merchantId) {
        // 商家订单号格式：大写字母和数字组合（仅当尚未设置merchantId时）
        result.merchantId = line;
      }
      
      // 处理299、300凭证格式（微信支付）
      if (line === '交易单号' && i + 1 < lines.length) {
        result.transactionId = lines[i + 1];
        result.voucherType = 'wechat'; // 标记为微信支付
      } else if (line === '商户单号' && i + 1 < lines.length) {
        result.merchantId = lines[i + 1];
      } else if (line === '商品' && i + 1 < lines.length) {
        result.product = lines[i + 1];
      } else if (line === '商户全称' && i + 1 < lines.length) {
        result.merchantName = lines[i + 1];
      }
    }
  }
  
  return result;
}

// 转换日期格式
function convertDate(dateStr) {
  // 将 "2025年8月22日 20:21:28" 转换为 "2025-08-22 20:21:28"
  const match = dateStr.match(/^(\d+)年(\d+)月(\d+)日\s+(.+)$/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const time = match[4];
    return `${year}-${month}-${day} ${time}`;
  }
  return dateStr;
}

// 生成YAML内容
function generateYamlContent(data) {
  const date = convertDate(data.payTime);
  const transactionId = data.transactionId || '';
  const merchantId = data.merchantId || '';
  
  // 使用用户提供的amount，如果没有则使用解析的amount，否则默认为'0.00'
  const amount = data.userAmount || data.amount || '0.00';
  
  // 根据凭证内容特征判断凭证类型
  // 微信支付凭证包含"交易单号"，支付宝支付凭证包含"订单号"
  let title = '支付宝账单';
  let voucherType = '订单号';
  const isWeChatPay = data.voucherType === 'wechat';
  
  if (isWeChatPay) {
    title = '微信支付账单';
    voucherType = '交易单号';
  }
  
  // 提取商品信息中的订单号
  let orderNumber = '';
  if (data.product) {
    // 处理多种格式：
    // 1. 美团订单-25082211100300001304615814784876
    // 2. 商户单号XP2125082220200492539796002493
    // 3. 充值:阿里云服务购买,业务交易号:CFP202508241937299046
    const orderMatch = data.product.match(/(?:.*-)?([A-Z0-9]+)$/);
    if (orderMatch) {
      orderNumber = orderMatch[1];
    }
  }
  
  // 使用用户提供的summary，如果没有则使用自动生成的摘要
  let summary = '';
  if (data.userSummary) {
    summary = data.userSummary;
  } else if (data.product) {
    if (data.product.includes('阿里云')) {
      summary = '阿里云充值';
    } else if (data.product.includes('美团')) {
      summary = '商品购买';
    } else {
      // 默认摘要
      summary = data.product.split(':')[0].replace('充值', '').trim() || '商品购买';
    }
  }
  
  let yaml = `date: ${date}\n`;
  yaml += `title: ${title}\n`;
  yaml += `VoucherID: ${transactionId}\n`;
  yaml += `VoucherType: ${voucherType}\n`;
  yaml += `amount: ${amount}\n`;
  yaml += `summary: ${summary}\n`;
  yaml += `comment:\n`;
  
  if (merchantId) {
    const merchantLabel = isWeChatPay ? '商户单号' : '商户订单号';
    yaml += `  - name: ${merchantLabel}\n`;
    yaml += `    value: ${merchantId}\n`;
  }
  
  if (orderNumber) {
    if (data.product && data.product.includes('美团')) {
      yaml += `  - name: 美团订单\n`;
      yaml += `    value: ${orderNumber}\n`;
    } else if (data.product && data.product.includes('业务交易号')) {
      yaml += `  - name: 业务交易号\n`;  // 业务交易号
      yaml += `    value: ${orderNumber}\n`;
    }
  }
  
  return yaml;
}

// 保存YAML文件
function saveYamlFile(content, id) {
  const filename = `AVR.${id}.yaml`;
  const filepath = path.join(targetPath, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  return filename;
}

// 解析AVR文件
function parseAvrFile(filepath) {
  try {
    let content = fs.readFileSync(filepath, 'utf8');
    
    // 在解析前处理内容，确保长数字被作为字符串处理
    // 使用正则表达式匹配VoucherID后的长数字，并给它们加上引号
    content = content.replace(/VoucherID:\s*(\d{16,})/g, 'VoucherID: "$1"');
    
    return yaml.load(content);
  } catch (error) {
    console.error(`解析文件 ${filepath} 时出错:`, error.message);
    return null;
  }
}

// 根据摘要确定借方科目
function getAccountTitle(summary) {
  if (!summary || typeof summary !== 'string') return 'unknown';
  
  if (summary.includes('阿里云')) return 'xuemen';
  if (summary.includes('蔬菜') || summary.includes('葡萄') || summary.includes('食品')) return 'raw.food';
  if (summary.includes('牙线') || summary.includes('医疗')) return 'raw.med';
  if (summary.includes('外卖') || summary.includes('餐')) return 'raw.food';
  
  // 默认科目
  return 'unknown';
}

// 根据支付方式确定贷方科目
function getCreditAccountTitle(title) {
  if (!title || typeof title !== 'string') return 'unknown';
  
  if (title.includes('微信')) return '微信零钱';
  if (title.includes('支付宝')) return '支付宝余额';
  if (title.includes('银行')) return '银行存款';
  
  // 默认科目
  return 'unknown';
}

// 根据摘要确定单位
function getUnitBySummary(summary) {
  if (!summary || typeof summary !== 'string') return 'unknown';
  
  if (summary.includes('牙线')) return '根';
  if (summary.includes('充值')) return 'rmb';
  if (summary.includes('外卖') || summary.includes('餐') || summary.includes('食品')) return '份';
  
  return 'unknown';
}

// 生成注释部分
function generateComments(avrData) {
  const comments = [];
  
  // 如果有摘要，添加摘要作为注释
  if (avrData.summary && typeof avrData.summary === 'string') {
    comments.push({
      name: avrData.summary,
      amount: avrData.amount || 0,
      unit: getUnitBySummary(avrData.summary),
      asset: parseFloat(avrData.amount || 0).toFixed(2)
    });
  }
  
  // 添加AVR文件中的注释项
  if (avrData.comment && Array.isArray(avrData.comment)) {
    avrData.comment.forEach(item => {
      // 跳过商户单号等非业务注释
      if (item.name && typeof item.name === 'string' && !item.name.includes('商户') && !item.name.includes('订单')) {
        comments.push({
          name: item.name,
          value: item.value
        });
      }
    });
  }
  
  return comments;
}

// 生成AER内容
function generateAerContent(avrData, avrFilename) {
  // 从AVR文件名提取ID
  const avrIdMatch = avrFilename.match(/^AVR\.(\d+)\.yaml$/);
  const avrId = avrIdMatch ? avrIdMatch[1] : 'unknown';
  
  // 从日期中提取日期部分（YYYY-MM-DD）
  let datePart = '';
  if (avrData.date instanceof Date) {
    // 如果是Date对象，格式化为YYYY-MM-DD
    datePart = avrData.date.toISOString().split('T')[0];
  } else if (typeof avrData.date === 'string') {
    // 如果是字符串，提取日期部分
    datePart = avrData.date.split(' ')[0];
  } else {
    // 如果日期不是字符串也不是Date对象，使用当前日期
    const now = new Date();
    datePart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }
  
  // 确保VoucherID作为字符串处理，避免科学计数法
  let voucherId = avrData.VoucherID || '';
  // 如果是纯数字字符串且长度超过15位，强制作为字符串处理
  if (typeof voucherId === 'string' && /^\d+$/.test(voucherId) && voucherId.length > 15) {
    // 在YAML中使用引号确保它被作为字符串处理
  } else if (typeof voucherId === 'number') {
    voucherId = String(voucherId);
  }
  
  // 生成AER内容
  const aerData = {
    date: datePart,
    VoucherID: voucherId,
    AccountingSoftwareID: '',
    AccountingEntry: {
      debit: [
        {
          AccountTitle: getAccountTitle(avrData.summary),
          asset: 'rmb',
          amount: parseFloat(avrData.amount || 0).toFixed(2)
        }
      ],
      credit: [
        {
          AccountTitle: getCreditAccountTitle(avrData.title),
          asset: 'rmb',
          amount: parseFloat(avrData.amount || 0).toFixed(2)
        }
      ]
    },
    comment: generateComments(avrData)
  };
  
  // 转换为YAML格式
  let yamlStr = yaml.dump(aerData, { 
    lineWidth: -1,
    noRefs: true,
    skipInvalid: true
  });
  
  // 移除所有引号
  yamlStr = yamlStr.replace(/"/g, '').replace(/'/g, '');
  
  return yamlStr;
}

// 保存AER文件
function saveAerFile(content, id) {
  const filename = `AER.${id}.yaml`;
  const filepath = path.join(targetPath, filename);
  fs.writeFileSync(filepath, content, 'utf8');
  return filename;
}

// 生成AER文件
function generateAerFile(avrFilename) {
  const avrFilepath = path.join(targetPath, avrFilename);
  
  // 检查文件是否存在
  if (!fs.existsSync(avrFilepath)) {
    console.error(`文件 ${avrFilename} 不存在`);
    return null;
  }
  
  // 解析AVR文件
  const avrData = parseAvrFile(avrFilepath);
  if (!avrData) {
    console.error(`无法解析文件 ${avrFilename}`);
    return null;
  }
  
  // 获取新ID
  const latestId = getLatestAerId();
  const newId = latestId + 1;
  
  // 生成AER内容
  const aerContent = generateAerContent(avrData, avrFilename);
  
  // 保存文件
  const filename = saveAerFile(aerContent, newId);
  
  // 输出文件名和内容
  console.log(`\n生成AER文件: ${filename}`);
  console.log('文件内容:');
  console.log(aerContent);
  
  return filename;
}

// 处理用户输入
function processUserInput(inputText) {
  // 解析输入文本
  const parsedData = parseVoucherText(inputText);
  
  // 获取新ID
  const latestId = getLatestAvrId();
  const newId = latestId + 1;
  
  // 生成YAML内容
  const yamlContent = generateYamlContent(parsedData);
  
  // 保存AVR文件
  const avrFilename = saveYamlFile(yamlContent, newId);
  
  // 输出AVR文件名和内容
  console.log(`\n生成AVR文件: ${avrFilename}`);
  console.log('文件内容:');
  console.log(yamlContent);
  
  // 生成对应的AER文件
  const aerFilename = generateAerFile(avrFilename);
  
  return { avrFilename, aerFilename };
}

// 创建交互式界面
function createInteractiveInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function promptUser() {
    console.log('\n请输入电子凭证（输入完成后输入"END"结束）:');
    let inputLines = [];
    
    rl.on('line', (line) => {
      if (line.trim() === 'END') {
        // 处理输入
        if (inputLines.length > 0) {
          const inputText = inputLines.join('\n');
          try {
            processUserInput(inputText);
          } catch (error) {
            console.error('处理输入时出错:', error.message);
          }
        }
        
        // 移除事件监听器并重新开始
        rl.removeAllListeners('line');
        promptUser();
      } else {
        inputLines.push(line);
      }
    });
  }
  
  promptUser();
}

// 主函数
function main() {
  if (process.stdin.isTTY) {
    // 交互式模式
    console.log('电子凭证自动整理工具');
    createInteractiveInterface();
  } else {
    // 管道模式
    let inputText = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      inputText += chunk;
    });
    
    process.stdin.on('end', () => {
      if (inputText.trim() !== '') {
        try {
          processUserInput(inputText);
        } catch (error) {
          console.error('处理输入时出错:', error.message);
        }
      }
    });
  }
}

// 如果是直接运行此脚本，则执行主函数
if (require.main === module) {
  main();
}