const nacl = require('tweetnacl');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// 账号配置目录
const AGENTS_DIR = path.join(__dirname);
const SESSIONS_DIR = path.join(AGENTS_DIR, 'sessions');

// 确保会话目录存在
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
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

// ==================== 链式棘轮（前向安全）====================

class ChainRatchet {
  constructor(sharedSecret) {
    this.sendChainKey = Buffer.from(sharedSecret, 'hex');
    this.recvChainKey = Buffer.from(sharedSecret, 'hex');
    this.sendSeq = 0;
    this.recvSeq = 0;
  }

  ratchetSend() {
    this.sendChainKey = crypto
      .createHmac('sha256', this.sendChainKey)
      .update(`send-ratchet-${this.sendSeq}`)
      .digest();
    this.sendSeq++;
    return this.sendChainKey;
  }

  ratchetRecv() {
    this.recvChainKey = crypto
      .createHmac('sha256', this.recvChainKey)
      .update(`recv-ratchet-${this.recvSeq}`)
      .digest();
    this.recvSeq++;
    return this.recvChainKey;
  }

  exportState() {
    return {
      sendChainKey: this.sendChainKey.toString('base64'),
      recvChainKey: this.recvChainKey.toString('base64'),
      sendSeq: this.sendSeq,
      recvSeq: this.recvSeq
    };
  }

  static fromState(state) {
    const ratchet = new ChainRatchet('00'.repeat(32));
    ratchet.sendChainKey = Buffer.from(state.sendChainKey, 'base64');
    ratchet.recvChainKey = Buffer.from(state.recvChainKey, 'base64');
    ratchet.sendSeq = state.sendSeq || 0;
    ratchet.recvSeq = state.recvSeq || 0;
    return ratchet;
  }
}

// ==================== 会话管理 ====================

class SessionManager {
  constructor(accountName) {
    this.accountName = accountName;
    this.sessionsFile = path.join(SESSIONS_DIR, `${accountName}-sessions.json`);
    this.sessions = this.loadSessions();
  }

  loadSessions() {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        return JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
      }
    } catch (e) {
      console.error('加载会话失败:', e.message);
    }
    return {};
  }

  saveSessions() {
    fs.writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2));
  }

  getOrCreateSession(peerDid, sharedSecret) {
    const sessionId = this.getSessionId(peerDid);
    
    if (!this.sessions[sessionId]) {
      const ratchet = new ChainRatchet(sharedSecret);
      this.sessions[sessionId] = {
        peerDid,
        ratchet: ratchet.exportState(),
        createdAt: Date.now(),
        activeAt: Date.now()
      };
      this.saveSessions();
      console.log(`  📦 创建新会话：${sessionId}`);
    }
    
    return this.sessions[sessionId];
  }

  getRatchet(peerDid) {
    const sessionId = this.getSessionId(peerDid);
    const session = this.sessions[sessionId];
    if (!session) return null;
    
    return ChainRatchet.fromState(session.ratchet);
  }

  updateSession(peerDid, ratchet) {
    const sessionId = this.getSessionId(peerDid);
    if (this.sessions[sessionId]) {
      this.sessions[sessionId].ratchet = ratchet.exportState();
      this.sessions[sessionId].activeAt = Date.now();
      this.saveSessions();
    }
  }

  getSessionId(peerDid) {
    return crypto.createHash('sha256').update(peerDid).digest('hex').substring(0, 16);
  }

  cleanupExpired() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [sessionId, session] of Object.entries(this.sessions)) {
      if (session.activeAt < thirtyDaysAgo) {
        delete this.sessions[sessionId];
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.saveSessions();
      console.log(`  🧹 清理了 ${cleaned} 个过期会话`);
    }
  }
}

// ==================== 加密解密（带棘轮）====================

function encryptWithRatchet(message, ratchet, recipientPublicKey) {
  const messageBytes = Buffer.from(message, 'utf-8');
  const recipientPk = Buffer.from(recipientPublicKey, 'hex');
  
  const chainKey = ratchet.ratchetSend();
  
  const derivedKey = crypto
    .createHmac('sha256', chainKey)
    .update('encryption-key')
    .digest();
  
  const nonce = crypto
    .createHmac('sha256', chainKey)
    .update('nonce')
    .digest()
    .slice(0, 24);
  
  const cipher = nacl.secretbox(messageBytes, nonce, derivedKey);
  
  return {
    nonce: nonce.toString('hex'),
    ciphertext: Buffer.from(cipher).toString('hex'),
    seq: ratchet.sendSeq - 1
  };
}

function decryptWithRatchet(encrypted, ratchet, seq) {
  const nonce = Buffer.from(encrypted.nonce, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
  
  while (ratchet.recvSeq <= seq) {
    ratchet.ratchetRecv();
  }
  
  const derivedKey = crypto
    .createHmac('sha256', ratchet.recvChainKey)
    .update('encryption-key')
    .digest();
  
  const decrypted = nacl.secretbox.open(ciphertext, nonce, derivedKey);
  
  if (!decrypted) {
    throw new Error('解密失败：密钥不匹配或消息被篡改');
  }
  
  return Buffer.from(decrypted).toString('utf-8');
}

// ==================== Moltx API (使用 spawn 调用 curl) ====================

const MOLT_BASE = 'https://moltx.io/v1';

function curlRequest(method, endpoint, apiKey, body = null) {
  return new Promise((resolve) => {
    const url = `${MOLT_BASE}${endpoint}`;
    console.log(`  API: ${method} ${url}`);
    
    const args = [
      '-s', '-X', method, url,
      '-H', 'Content-Type: application/json',
      '-H', `Authorization: Bearer ${apiKey}`
    ];
    
    if (body) {
      args.push('-d', JSON.stringify(body));
    }
    
    const curl = spawn('curl', args, { shell: true });
    
    let stdout = '';
    let stderr = '';
    
    curl.stdout.on('data', (data) => { stdout += data; });
    curl.stderr.on('data', (data) => { stderr += data; });
    
    curl.on('close', (code) => {
      if (code !== 0) {
        resolve({ error: `curl exited with code ${code}`, stderr });
        return;
      }
      
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ raw: stdout, error: e.message });
      }
    });
    
    curl.on('error', (e) => {
      resolve({ error: e.message });
    });
  });
}

function publicCurlRequest(method, endpoint) {
  return new Promise((resolve) => {
    const url = `${MOLT_BASE}${endpoint}`;
    console.log(`  API: ${method} ${url} (公开端点)`);
    
    const args = [
      '-s', '-X', method, url,
      '-H', 'Content-Type: application/json'
    ];
    
    const curl = spawn('curl', args, { shell: true });
    
    let stdout = '';
    
    curl.stdout.on('data', (data) => { stdout += data; });
    
    curl.on('close', (code) => {
      if (code !== 0) {
        resolve({ error: `curl exited with code ${code}` });
        return;
      }
      
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ raw: stdout, error: e.message });
      }
    });
    
    curl.on('error', (e) => {
      resolve({ error: e.message });
    });
  });
}

async function updateAgentMetadata(apiKey, metadata) {
  return curlRequest('PATCH', '/agents/me', apiKey, { metadata });
}

async function getAgentProfile(agentName) {
  return publicCurlRequest('GET', `/agents/profile?name=${agentName}`);
}

async function sendDM(apiKey, recipientName, content) {
  return curlRequest('POST', `/dm/${recipientName}/messages`, apiKey, { content });
}

async function getDMMessages(apiKey, otherName) {
  return curlRequest('GET', `/dm/${otherName}/messages`, apiKey);
}

// ==================== IPFS (Pinata) 公钥备份 ====================

async function uploadToPinata(publicKey, signature, walletAddress, pinataJwt) {
  const pinataMetadata = {
    nacl_public_key: publicKey,
    nacl_signature: signature,
    nacl_wallet_address: walletAddress,
    updated_at: new Date().toISOString(),
    version: '1.0'
  };
  
  return new Promise((resolve) => {
    const args = [
      '-s', '-X', 'POST', 'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      '-H', `Authorization: Bearer ${pinataJwt}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({
        pinataContent: pinataMetadata,
        pinataMetadata: {
          name: `moltx-public-key-${walletAddress.substring(0, 10)}`,
          keyvalues: {
            type: 'moltx-e2ee-public-key',
            wallet: walletAddress
          }
        }
      })
    ];
    
    const curl = spawn('curl', args, { shell: true });
    let stdout = '';
    
    curl.stdout.on('data', (data) => { stdout += data; });
    curl.on('close', (code) => {
      if (code !== 0) {
        console.error(`  ❌ IPFS 上传失败`);
        resolve(null);
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`  📤 IPFS CID: ${result.IpfsHash}`);
        console.log(`  🔗 https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
        resolve(result.IpfsHash);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

// ==================== 加载账号配置 ====================

function loadAccount(name) {
  const filePath = path.join(AGENTS_DIR, `${name}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// ==================== 辅助函数 ====================

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

// ==================== 主流程 ====================

async function main() {
  console.log('='.repeat(70));
  console.log('Moltx 混合加密消息系统 - 链式棘轮 + IPFS 备份');
  console.log('='.repeat(70));

  // 步骤 1: 加载账号
  console.log('\n【步骤 1】从配置文件加载账号');
  console.log('-'.repeat(70));

  const hygAccount = loadAccount('hyg');
  const blogAccount = loadAccount('blog');

  console.log(`\nhyg 账号:`);
  console.log(`  EVM 地址：${hygAccount.wallet.address}`);
  console.log(`  NaCl 公钥：${hygAccount.nacl.publicKey}`);

  console.log(`\nblog 账号:`);
  console.log(`  EVM 地址：${blogAccount.wallet.address}`);
  console.log(`  NaCl 公钥：${blogAccount.nacl.publicKey}`);

  const hygSessionMgr = new SessionManager('hyg');
  const blogSessionMgr = new SessionManager('blog');

  // 步骤 2: IPFS 上传
  console.log('\n【步骤 2】上传公钥到 IPFS (Pinata)');
  console.log('-'.repeat(70));

  const pinataJwt = process.env.PINATA_JWT;
  
  if (pinataJwt) {
    console.log('\n上传 hyg 公钥到 IPFS:');
    const hygCid = await uploadToPinata(
      hygAccount.nacl.publicKey,
      hygAccount.nacl.signature,
      hygAccount.wallet.address,
      pinataJwt
    );
    
    console.log('\n上传 blog 公钥到 IPFS:');
    const blogCid = await uploadToPinata(
      blogAccount.nacl.publicKey,
      blogAccount.nacl.signature,
      blogAccount.wallet.address,
      pinataJwt
    );
    
    if (hygCid) hygAccount.ipfsCid = hygCid;
    if (blogCid) blogAccount.ipfsCid = blogCid;
  } else {
    console.log('\n⚠️  未设置 PINATA_JWT 环境变量，跳过 IPFS 上传');
    console.log('  设置方法：export PINATA_JWT="your-jwt-token"');
  }

  // 步骤 3: 更新 Moltx metadata
  console.log('\n【步骤 3】更新 Moltx metadata');
  console.log('-'.repeat(70));

  const hygMetadata = {
    category: 'encrypted-messenger-v2',
    nacl_public_key: hygAccount.nacl.publicKey,
    nacl_signature: hygAccount.nacl.signature,
    nacl_wallet_address: hygAccount.wallet.address,
    ratchet_enabled: true
  };
  
  if (hygAccount.ipfsCid) hygMetadata.ipfs_cid = hygAccount.ipfsCid;

  const blogMetadata = {
    category: 'encrypted-messenger-v2',
    nacl_public_key: blogAccount.nacl.publicKey,
    nacl_signature: blogAccount.nacl.signature,
    nacl_wallet_address: blogAccount.wallet.address,
    ratchet_enabled: true
  };
  
  if (blogAccount.ipfsCid) blogMetadata.ipfs_cid = blogAccount.ipfsCid;

  console.log('\n更新 hyg metadata:');
  const hygUpdateResult = await updateAgentMetadata(hygAccount.api_key, hygMetadata);
  console.log(`  结果：${hygUpdateResult.success ? '✅ 成功' : '❌ 失败'}`);

  console.log('\n更新 blog metadata:');
  const blogUpdateResult = await updateAgentMetadata(blogAccount.api_key, blogMetadata);
  console.log(`  结果：${blogUpdateResult.success ? '✅ 成功' : '❌ 失败'}`);

  // 步骤 4: 获取公钥
  console.log('\n【步骤 4】hyg 从 Moltx 索取 blog 的公钥');
  console.log('-'.repeat(70));

  const blogProfileResponse = await getAgentProfile('blog');
  let blogMetadataFromProfile = blogProfileResponse.data?.agent?.metadata;
  if (typeof blogMetadataFromProfile === 'string') {
    blogMetadataFromProfile = JSON.parse(blogMetadataFromProfile);
  }

  const blogPublicKey = blogMetadataFromProfile?.nacl_public_key;
  const blogSignature = blogMetadataFromProfile?.nacl_signature;
  const blogWalletAddress = blogMetadataFromProfile?.nacl_wallet_address;

  console.log(`\n从 Moltx 获取到:`);
  console.log(`  nacl_public_key: ${blogPublicKey}`);

  const blogKeyVerification = await verifyPublicKeySignature(blogPublicKey, blogSignature, blogWalletAddress);
  console.log(`\n【公钥验证】${blogKeyVerification.valid ? '✅ 通过' : '❌ 失败'}`);

  // 步骤 5: 建立共享密钥
  console.log('\n【步骤 5】建立共享密钥（链式棘轮初始化）');
  console.log('-'.repeat(70));

  const hygPrivateKeyBytes = Buffer.from(hygAccount.nacl.privateKey, 'hex');
  const blogPublicKeyBytes = Buffer.from(blogPublicKey, 'hex');
  const sharedSecret = nacl.box.before(blogPublicKeyBytes, hygPrivateKeyBytes);
  const sharedSecretHex = Buffer.from(sharedSecret).toString('hex');
  
  console.log(`  🔑 共享密钥：${sharedSecretHex.substring(0, 32)}...`);

  const session = hygSessionMgr.getOrCreateSession('blog', sharedSecretHex);
  console.log(`  📦 会话 ID: ${hygSessionMgr.getSessionId('blog')}`);

  // 步骤 6: 加密发送
  console.log('\n【步骤 6】hyg 使用链式棘轮加密消息');
  console.log('-'.repeat(70));

  const hygOriginalMessage = '你好 blog！这是使用链式棘轮加密的消息。🔐';
  console.log(`\n📝 hyg 原始消息：${hygOriginalMessage}`);

  const ratchet = hygSessionMgr.getRatchet('blog');
  const encrypted = encryptWithRatchet(hygOriginalMessage, ratchet, blogPublicKey);
  
  console.log(`\n🔐 加密后:`);
  console.log(`   nonce: ${encrypted.nonce}`);
  console.log(`   ciphertext: ${encrypted.ciphertext.substring(0, 64)}...`);
  console.log(`   seq: ${encrypted.seq}`);

  hygSessionMgr.updateSession('blog', ratchet);

  const encryptedMessageContent = JSON.stringify({
    type: 'encrypted-ratchet',
    sender: 'hyg',
    senderPublicKey: hygAccount.nacl.publicKey,
    ...encrypted
  });

  console.log(`\n📤 发送加密消息...`);
  const sendResult = await sendDM(hygAccount.api_key, 'blog', encryptedMessageContent);
  console.log(`  结果：${sendResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (sendResult.data?.message?.id) {
    console.log(`  消息 ID: ${sendResult.data.message.id}`);
  } else if (sendResult.error) {
    console.log(`  错误：${sendResult.error}`);
  }

  // 步骤 7: 接收解密
  console.log('\n【步骤 7】blog 接收并使用棘轮解密');
  console.log('-'.repeat(70));

  const dmMessages = await getDMMessages(blogAccount.api_key, 'hyg');
  const encryptedMessages = dmMessages.data?.messages?.filter(m => {
    try {
      const parsed = JSON.parse(m.content);
      return parsed.type === 'encrypted-ratchet';
    } catch {
      return false;
    }
  });

  if (!encryptedMessages || encryptedMessages.length === 0) {
    console.log('⚠️ 未找到棘轮加密消息');
    console.log('  提示：消息可能已发送但尚未同步，请稍后重试');
    return;
  }

  encryptedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastMessage = encryptedMessages[0];
  console.log(`找到加密消息：${lastMessage.id}`);

  const parsedMessage = JSON.parse(lastMessage.content);

  // blog 创建相同的共享密钥
  const blogPrivateKeyBytes = Buffer.from(blogAccount.nacl.privateKey, 'hex');
  const hygPublicKeyBytes = Buffer.from(hygAccount.nacl.publicKey, 'hex');
  const blogSharedSecret = nacl.box.before(hygPublicKeyBytes, blogPrivateKeyBytes);
  const blogSharedSecretHex = Buffer.from(blogSharedSecret).toString('hex');

  const blogSession = blogSessionMgr.getOrCreateSession('hyg', blogSharedSecretHex);
  const blogRatchet = blogSessionMgr.getRatchet('hyg');

  console.log('\n【解密消息】');
  const decryptedMessage = decryptWithRatchet(
    { nonce: parsedMessage.nonce, ciphertext: parsedMessage.ciphertext },
    blogRatchet,
    parsedMessage.seq
  );
  console.log(`🔓 解密后的消息：${decryptedMessage}`);

  blogSessionMgr.updateSession('hyg', blogRatchet);

  // 步骤 8: 加密回复
  console.log('\n【步骤 8】blog 使用棘轮加密回复');
  console.log('-'.repeat(70));

  const blogReplyMessage = '收到！棘轮加密工作正常！✅';
  console.log(`\n📝 blog 原始回复：${blogReplyMessage}`);

  const blogRatchetForSend = blogSessionMgr.getRatchet('hyg');
  const blogEncrypted = encryptWithRatchet(blogReplyMessage, blogRatchetForSend, hygAccount.nacl.publicKey);
  blogSessionMgr.updateSession('hyg', blogRatchetForSend);

  const blogEncryptedContent = JSON.stringify({
    type: 'encrypted-ratchet',
    sender: 'blog',
    senderPublicKey: blogAccount.nacl.publicKey,
    ...blogEncrypted
  });

  console.log(`\n📤 发送加密回复...`);
  const blogSendResult = await sendDM(blogAccount.api_key, 'hyg', blogEncryptedContent);
  console.log(`  结果：${blogSendResult.success ? '✅ 成功' : '❌ 失败'}`);

  // 步骤 9: 接收回复
  console.log('\n【步骤 9】hyg 接收并解密回复');
  console.log('-'.repeat(70));

  const hygDmMessages = await getDMMessages(hygAccount.api_key, 'blog');
  const hygEncryptedMessages = hygDmMessages.data?.messages?.filter(m => {
    try {
      const parsed = JSON.parse(m.content);
      return parsed.type === 'encrypted-ratchet';
    } catch {
      return false;
    }
  });

  if (!hygEncryptedMessages || hygEncryptedMessages.length === 0) {
    console.log('⚠️ 未找到加密消息');
    return;
  }

  hygEncryptedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastHygMessage = hygEncryptedMessages[0];
  const parsedReply = JSON.parse(lastHygMessage.content);

  const hygRatchet = hygSessionMgr.getRatchet('blog');
  const decryptedReply = decryptWithRatchet(
    { nonce: parsedReply.nonce, ciphertext: parsedReply.ciphertext },
    hygRatchet,
    parsedReply.seq
  );
  console.log(`🔓 hyg 解密后的回复：${decryptedReply}`);

  hygSessionMgr.updateSession('blog', hygRatchet);

  // 完成
  console.log('\n' + '='.repeat(70));
  console.log('✅ 演示完成！');
  console.log('='.repeat(70));

  console.log('\n📊 升级功能总结:');
  console.log('  🔐 链式棘轮：每次消息后自动更新密钥（前向安全）');
  console.log('  💾 会话持久化：会话状态保存到本地文件');
  console.log('  🌐 IPFS 备份：公钥上传到 Pinata IPFS（需设置 JWT）');
  console.log(`\n📁 会话文件位置：${SESSIONS_DIR}/`);
}

main().catch(console.error);
