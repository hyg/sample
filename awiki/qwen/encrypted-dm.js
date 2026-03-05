const nacl = require('tweetnacl');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;

// 账号配置目录
const AGENTS_DIR = path.join(__dirname);

// 加载账号配置
function loadAccount(name) {
  const filePath = path.join(AGENTS_DIR, `${name}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// ==================== 密钥管理 ====================

function generateNaClKeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
    privateKey: Buffer.from(keyPair.secretKey).toString('hex')
  };
}

async function signPublicKeyWithEVM(naclPublicKeyHex, evmPrivateKey) {
  const wallet = new ethers.Wallet(evmPrivateKey);
  const message = `I own this NaCl public key: ${naclPublicKeyHex}`;
  const signature = await wallet.signMessage(message);
  return {
    publicKey: naclPublicKeyHex,
    signature: signature,
    walletAddress: wallet.address
  };
}

// ==================== 加密解密 ====================

function encryptMessage(message, senderPrivateKey, recipientPublicKey) {
  const messageBytes = Buffer.from(message, 'utf-8');
  const senderSecretKey = Buffer.from(senderPrivateKey, 'hex');
  const recipientPk = Buffer.from(recipientPublicKey, 'hex');
  
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(
    messageBytes,
    nonce,
    recipientPk,
    senderSecretKey
  );
  
  return {
    nonce: Buffer.from(nonce).toString('hex'),
    ciphertext: Buffer.from(ciphertext).toString('hex')
  };
}

function decryptMessage(encrypted, recipientPrivateKey, senderPublicKey) {
  const nonce = Buffer.from(encrypted.nonce, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
  const recipientSecretKey = Buffer.from(recipientPrivateKey, 'hex');
  const senderPk = Buffer.from(senderPublicKey, 'hex');
  
  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPk,
    recipientSecretKey
  );
  
  if (!decrypted) {
    throw new Error('解密失败：密文可能被篡改或密钥不匹配');
  }
  
  return Buffer.from(decrypted).toString('utf-8');
}

async function verifyPublicKeySignature(publicKey, signature, expectedAddress) {
  const message = `I own this NaCl public key: ${publicKey}`;
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return {
      valid: recoveredAddress.toLowerCase() === expectedAddress.toLowerCase(),
      recoveredAddress
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// ==================== Moltx API ====================

const MOLT_BASE = 'https://moltx.io/v1';

async function apiRequest(method, endpoint, apiKey, body = null) {
  const url = `${MOLT_BASE}${endpoint}`;
  console.log(`  API: ${method} ${url}`);
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Moltx-Client/1.0'
    },
    body: body ? JSON.stringify(body) : undefined
  };
  
  const response = await fetch(url, options);
  const text = await response.text();
  console.log(`  Status: ${response.status}`);
  
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: response.status };
  }
}

async function publicApiRequest(method, endpoint) {
  const url = `${MOLT_BASE}${endpoint}`;
  console.log(`  API: ${method} ${url} (公开端点)`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Moltx-Client/1.0'
    }
  };
  
  const response = await fetch(url, options);
  const text = await response.text();
  console.log(`  Status: ${response.status}`);
  
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: response.status };
  }
}

async function updateAgentMetadata(apiKey, metadata) {
  return apiRequest('PATCH', '/agents/me', apiKey, { metadata });
}

/**
 * 获取其他账号的公开资料（包括 metadata）
 */
async function getAgentProfile(agentName) {
  return publicApiRequest('GET', `/agents/profile?name=${agentName}`);
}

async function sendDM(apiKey, recipientName, content) {
  return apiRequest('POST', `/dm/${recipientName}/messages`, apiKey, { content });
}

async function getDMMessages(apiKey, otherName) {
  return apiRequest('GET', `/dm/${otherName}/messages`, apiKey);
}

// ==================== 主流程 ====================

async function main() {
  console.log('='.repeat(70));
  console.log('Moltx 混合加密消息系统演示');
  console.log('='.repeat(70));

  // --- 步骤 1: 从配置文件加载账号 ---
  console.log('\n【步骤 1】从配置文件加载账号');
  console.log('-'.repeat(70));

  const hygAccount = loadAccount('hyg');
  const blogAccount = loadAccount('blog');

  console.log(`\nhyg 账号:`);
  console.log(`  name: ${hygAccount.name}`);
  console.log(`  display_name: ${hygAccount.display_name}`);
  console.log(`  EVM 地址：${hygAccount.wallet.address}`);
  console.log(`  NaCl 公钥：${hygAccount.nacl.publicKey}`);
  console.log(`  NaCl 私钥：${hygAccount.nacl.privateKey} (保密)`);

  console.log(`\nblog 账号:`);
  console.log(`  name: ${blogAccount.name}`);
  console.log(`  display_name: ${blogAccount.display_name}`);
  console.log(`  EVM 地址：${blogAccount.wallet.address}`);
  console.log(`  NaCl 公钥：${blogAccount.nacl.publicKey}`);
  console.log(`  NaCl 私钥：${blogAccount.nacl.privateKey} (保密)`);

  // --- 步骤 2: 将公钥发布到 Moltx metadata ---
  console.log('\n【步骤 2】将公钥发布到 Moltx metadata');
  console.log('-'.repeat(70));

  const hygMetadata = {
    category: 'encrypted-messenger',
    nacl_public_key: hygAccount.nacl.publicKey,
    nacl_signature: hygAccount.nacl.signature,
    nacl_wallet_address: hygAccount.wallet.address
  };

  const blogMetadata = {
    category: 'encrypted-messenger',
    nacl_public_key: blogAccount.nacl.publicKey,
    nacl_signature: blogAccount.nacl.signature,
    nacl_wallet_address: blogAccount.wallet.address
  };

  console.log('\n更新 hyg metadata:');
  const hygUpdateResult = await updateAgentMetadata(hygAccount.api_key, hygMetadata);
  console.log(`  结果：${hygUpdateResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (!hygUpdateResult.success) {
    console.log(`  错误：${hygUpdateResult.error || '未知错误'}`);
    console.log(`  提示：metadata 可能已存在，继续执行...`);
  } else if (hygUpdateResult.data?.agent?.metadata) {
    console.log(`  metadata: ${JSON.stringify(hygUpdateResult.data.agent.metadata)}`);
  }

  console.log('\n更新 blog metadata:');
  const blogUpdateResult = await updateAgentMetadata(blogAccount.api_key, blogMetadata);
  console.log(`  结果：${blogUpdateResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (!blogUpdateResult.success) {
    console.log(`  错误：${blogUpdateResult.error || '未知错误'}`);
    console.log(`  提示：metadata 可能已存在，继续执行...`);
  } else if (blogUpdateResult.data?.agent?.metadata) {
    console.log(`  metadata: ${JSON.stringify(blogUpdateResult.data.agent.metadata)}`);
  }

  // --- 步骤 3: hyg 从 Moltx 索取 blog 的公钥 ---
  console.log('\n【步骤 3】hyg 从 Moltx 索取 blog 的公钥');
  console.log('-'.repeat(70));

  console.log('\n调用 API: GET /v1/agents/profile?name=blog');
  const blogProfileResponse = await getAgentProfile('blog');
  
  console.log('\n【Moltx API 返回的完整响应】');
  console.log(JSON.stringify(blogProfileResponse, null, 2));

  // 解析 blog 的 metadata
  const blogAgentData = blogProfileResponse.data?.agent;
  
  // metadata 是 JSON 字符串，需要解析
  let blogMetadataFromProfile = blogAgentData?.metadata;
  if (typeof blogMetadataFromProfile === 'string') {
    try {
      blogMetadataFromProfile = JSON.parse(blogMetadataFromProfile);
    } catch (e) {
      console.error('解析 metadata 失败:', e.message);
      blogMetadataFromProfile = {};
    }
  }

  console.log('\n【解析 blog 账号信息】');
  console.log(`  name: ${blogAgentData?.name}`);
  console.log(`  display_name: ${blogAgentData?.display_name}`);
  console.log(`  description: ${blogAgentData?.description}`);
  console.log(`  avatar_emoji: ${blogAgentData?.avatar_emoji}`);
  console.log(`  metadata (解析后): ${JSON.stringify(blogMetadataFromProfile)}`);

  // 提取公钥信息
  const blogPublicKey = blogMetadataFromProfile?.nacl_public_key;
  const blogSignature = blogMetadataFromProfile?.nacl_signature;
  const blogWalletAddress = blogMetadataFromProfile?.nacl_wallet_address;

  console.log('\n【提取的加密相关字段】');
  console.log(`  nacl_public_key: ${blogPublicKey}`);
  console.log(`  nacl_signature: ${blogSignature?.substring(0, 66)}...`);
  console.log(`  nacl_wallet_address: ${blogWalletAddress}`);

  // 验证公钥签名
  console.log('\n【验证 blog 公钥签名】');
  const blogKeyVerification = await verifyPublicKeySignature(blogPublicKey, blogSignature, blogWalletAddress);
  console.log(`验证结果：${blogKeyVerification.valid ? '✅ 通过' : '❌ 失败'}`);
  if (blogKeyVerification.valid) {
    console.log(`恢复的钱包地址：${blogKeyVerification.recoveredAddress}`);
    console.log(`预期钱包地址：${blogWalletAddress}`);
  } else {
    console.log(`错误：${blogKeyVerification.error}`);
  }

  // --- 步骤 4: hyg 加密并发送消息给 blog ---
  console.log('\n【步骤 4】hyg 加密消息并发送给 blog');
  console.log('-'.repeat(70));

  const hygOriginalMessage = '你好 blog！这是一条加密消息。今晚 8 点开会，讨论新项目。';
  console.log(`\n📝 hyg 原始消息：${hygOriginalMessage}`);

  const encryptedByHyg = encryptMessage(hygOriginalMessage, hygAccount.nacl.privateKey, blogPublicKey);
  console.log(`\n🔐 加密后:`);
  console.log(`   nonce: ${encryptedByHyg.nonce}`);
  console.log(`   ciphertext: ${encryptedByHyg.ciphertext}`);

  const encryptedMessageContent = JSON.stringify({
    type: 'encrypted',
    sender: 'hyg',
    senderPublicKey: hygAccount.nacl.publicKey,
    ...encryptedByHyg
  });

  console.log(`\n📤 发送加密消息内容:`);
  console.log(`   ${encryptedMessageContent}`);
  
  const sendResult = await sendDM(hygAccount.api_key, 'blog', encryptedMessageContent);
  console.log(`\n发送结果：${sendResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (!sendResult.success) {
    console.log(`  错误：${sendResult.error || '未知错误'}`);
    console.log(`  完整响应：${JSON.stringify(sendResult)}`);
    return;
  }
  if (sendResult.data?.message?.id) {
    console.log(`消息 ID: ${sendResult.data.message.id}`);
  }

  // --- 步骤 5: blog 接收并解密消息 ---
  console.log('\n【步骤 5】blog 接收并解密消息');
  console.log('-'.repeat(70));

  console.log('\n从 Moltx 获取 DM 消息...');
  const dmMessages = await getDMMessages(blogAccount.api_key, 'hyg');
  
  // 查找加密消息
  const encryptedMessages = dmMessages.data?.messages?.filter(m => {
    try {
      const parsed = JSON.parse(m.content);
      return parsed.type === 'encrypted';
    } catch {
      return false;
    }
  });

  if (!encryptedMessages || encryptedMessages.length === 0) {
    console.log('⚠️ 未找到加密消息');
    return;
  }

  // 按 created_at 排序，获取最新的一条
  encryptedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastEncryptedMessage = encryptedMessages[0];
  console.log(`找到 ${encryptedMessages.length} 条加密消息，处理最新的一条:`);
  console.log(`消息 ID: ${lastEncryptedMessage.id}`);
  console.log(`创建时间：${lastEncryptedMessage.created_at}`);
  console.log(`原始内容：${lastEncryptedMessage.content}`);

  const parsedMessage = JSON.parse(lastEncryptedMessage.content);
  
  // 从 Moltx 获取 hyg 的公钥并验证
  console.log('\n【从 Moltx 获取 hyg 的公钥】');
  console.log('调用 API: GET /v1/agents/profile?name=hyg');
  const hygProfileResponse = await getAgentProfile('hyg');
  
  console.log('\n【Moltx API 返回的 hyg 完整响应】');
  console.log(JSON.stringify(hygProfileResponse, null, 2));

  let hygMetadataFromProfile = hygProfileResponse.data?.agent?.metadata;
  if (typeof hygMetadataFromProfile === 'string') {
    hygMetadataFromProfile = JSON.parse(hygMetadataFromProfile);
  }
  const hygPublicKeyFromMoltx = hygMetadataFromProfile?.nacl_public_key;
  const hygSignatureFromMoltx = hygMetadataFromProfile?.nacl_signature;
  const hygWalletAddressFromMoltx = hygMetadataFromProfile?.nacl_wallet_address;

  console.log('\n【提取的 hyg 加密相关字段】');
  console.log(`  nacl_public_key: ${hygPublicKeyFromMoltx}`);
  console.log(`  nacl_signature: ${hygSignatureFromMoltx?.substring(0, 66)}...`);
  console.log(`  nacl_wallet_address: ${hygWalletAddressFromMoltx}`);

  // 验证 hyg 公钥
  console.log('\n【验证 hyg 公钥签名】');
  const hygKeyVerification = await verifyPublicKeySignature(
    hygPublicKeyFromMoltx,
    hygSignatureFromMoltx,
    hygWalletAddressFromMoltx
  );
  console.log(`验证结果：${hygKeyVerification.valid ? '✅ 通过' : '❌ 失败'}`);
  
  // 验证消息中的发送方公钥与 Moltx 获取的一致
  const senderKeyMatch = parsedMessage.senderPublicKey === hygPublicKeyFromMoltx;
  console.log(`发送方公钥匹配：${senderKeyMatch ? '✅ 一致' : '❌ 不一致'}`);

  // 解密消息
  console.log('\n【解密消息】');
  const decryptedMessage = decryptMessage(
    { nonce: parsedMessage.nonce, ciphertext: parsedMessage.ciphertext },
    blogAccount.nacl.privateKey,
    parsedMessage.senderPublicKey
  );
  console.log(`🔓 解密后的消息：${decryptedMessage}`);

  // --- 步骤 6: blog 加密回复 ---
  console.log('\n【步骤 6】blog 加密回复 hyg');
  console.log('-'.repeat(70));

  const blogReplyMessage = '收到！我会准时参加。已准备好项目资料。';
  console.log(`\n📝 blog 原始回复：${blogReplyMessage}`);

  const encryptedByBlog = encryptMessage(blogReplyMessage, blogAccount.nacl.privateKey, hygPublicKeyFromMoltx);
  console.log(`\n🔐 加密后:`);
  console.log(`   nonce: ${encryptedByBlog.nonce}`);
  console.log(`   ciphertext: ${encryptedByBlog.ciphertext}`);

  const blogEncryptedContent = JSON.stringify({
    type: 'encrypted',
    sender: 'blog',
    senderPublicKey: blogAccount.nacl.publicKey,
    ...encryptedByBlog
  });

  console.log(`\n📤 发送加密回复:`);
  console.log(`   ${blogEncryptedContent}`);

  const blogSendResult = await sendDM(blogAccount.api_key, 'hyg', blogEncryptedContent);
  console.log(`\n发送结果：${blogSendResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (blogSendResult.data?.message?.id) {
    console.log(`消息 ID: ${blogSendResult.data.message.id}`);
  }

  // --- 步骤 7: hyg 接收并解密回复 ---
  console.log('\n【步骤 7】hyg 接收并解密 blog 的回复');
  console.log('-'.repeat(70));

  const hygDmMessages = await getDMMessages(hygAccount.api_key, 'blog');
  
  const hygEncryptedMessages = hygDmMessages.data?.messages?.filter(m => {
    try {
      const parsed = JSON.parse(m.content);
      return parsed.type === 'encrypted';
    } catch {
      return false;
    }
  });

  if (!hygEncryptedMessages || hygEncryptedMessages.length === 0) {
    console.log('⚠️ 未找到加密消息');
    return;
  }

  // 按 created_at 排序，获取最新的一条
  hygEncryptedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastHygMessage = hygEncryptedMessages[0];
  console.log(`找到 ${hygEncryptedMessages.length} 条加密消息，处理最新的一条:`);
  console.log(`消息 ID: ${lastHygMessage.id}`);
  console.log(`创建时间：${lastHygMessage.created_at}`);
  console.log(`原始内容：${lastHygMessage.content}`);

  const parsedReply = JSON.parse(lastHygMessage.content);
  
  // 从 Moltx 获取 blog 公钥验证
  console.log('\n【从 Moltx 获取 blog 的公钥验证】');
  const blogProfileForVerify = await getAgentProfile('blog');
  let blogMetadataForVerify = blogProfileForVerify.data?.agent?.metadata;
  if (typeof blogMetadataForVerify === 'string') {
    blogMetadataForVerify = JSON.parse(blogMetadataForVerify);
  }
  const blogPkFromMoltx = blogMetadataForVerify?.nacl_public_key;
  
  const senderKeyMatchBlog = parsedReply.senderPublicKey === blogPkFromMoltx;
  console.log(`发送方公钥匹配：${senderKeyMatchBlog ? '✅ 一致' : '❌ 不一致'}`);

  const decryptedReply = decryptMessage(
    { nonce: parsedReply.nonce, ciphertext: parsedReply.ciphertext },
    hygAccount.nacl.privateKey,
    parsedReply.senderPublicKey
  );
  console.log(`\n🔓 hyg 解密后的回复：${decryptedReply}`);

  // --- 完成 ---
  console.log('\n' + '='.repeat(70));
  console.log('✅ 演示完成！');
  console.log('='.repeat(70));
  console.log('\nNaCl 密钥已存储在账号配置文件中:');
  console.log(`  - ${hygAccount.name}.json (hyg.nacl)`);
  console.log(`  - ${blogAccount.name}.json (blog.nacl)`);
}

main().catch(console.error);
