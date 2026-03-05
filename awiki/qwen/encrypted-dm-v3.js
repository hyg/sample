const nacl = require('tweetnacl');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch').default;

// 账号配置目录
const AGENTS_DIR = path.join(__dirname);
const SESSIONS_DIR = path.join(AGENTS_DIR, 'sessions');

// 确保会话目录存在
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ==================== 双棘轮算法（Double Ratchet）====================

/**
 * KDF 链式派生
 */
class KdfChain {
  constructor(chainKey) {
    this.chainKey = chainKey; // Buffer
  }

  /**
   * 派生下一个密钥
   * @returns {[Buffer, Buffer]} [messageKey, newChainKey]
   */
  next() {
    // HMAC-SHA256(chainKey, 0x01)
    const hmac = crypto.createHmac('sha256', this.chainKey);
    hmac.update(Buffer.from([0x01]));
    const output = hmac.digest();
    
    const messageKey = output;
    const newChainKey = crypto
      .createHmac('sha256', output)
      .update(Buffer.from([0x02]))
      .digest();
    
    this.chainKey = newChainKey;
    return [messageKey, newChainKey];
  }

  exportState() {
    return this.chainKey.toString('base64');
  }

  static fromState(state) {
    return new KdfChain(Buffer.from(state, 'base64'));
  }
}

/**
 * 双棘轮会话
 */
class DoubleRatchetSession {
  /**
   * 初始化双棘轮会话
   * @param {Buffer} sharedSecret - DH 共享密钥
   * @param {string} localPublicKey - 本地 DH 公钥 (hex)
   * @param {string} localPrivateKey - 本地 DH 私钥 (hex)
   * @param {boolean} isInitiator - 是否是发起方
   */
  constructor(sharedSecret, localPublicKey, localPrivateKey, isInitiator) {
    this.localDhPublic = localPublicKey;
    this.localDhPrivate = localPrivateKey;
    this.remoteDhPublic = null;
    this.rootKey = sharedSecret;
    this.isInitiator = isInitiator;
    
    // 初始化发送链和接收链
    if (isInitiator) {
      this.sendChain = null; // 第一次 DH 后创建
      this.recvChain = null;
    } else {
      this.sendChain = null;
      this.recvChain = null;
    }
    
    this.dhPublicKeys = []; // 历史 DH 公钥
    this.sendCounter = 0;
    this.recvCounter = 0;
  }

  /**
   * DH 交换
   */
  dh(privateKey, publicKey) {
    const priv = Buffer.from(privateKey, 'hex');
    const pub = Buffer.from(publicKey, 'hex');
    return nacl.box.before(pub, priv);
  }

  /**
   * 生成新的 DH 密钥对
   */
  generateDhKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
      privateKey: Buffer.from(keyPair.secretKey).toString('hex')
    };
  }

  /**
   * 棘轮发送（发送消息前调用）
   * @returns {Buffer} messageKey
   */
  ratchetSend() {
    if (!this.sendChain) {
      // 第一次发送，需要先 DH
      throw new Error('需要先执行 DH 握手');
    }
    
    const [messageKey] = this.sendChain.next();
    this.sendCounter++;
    return messageKey;
  }

  /**
   * 棘轮接收（接收消息前调用）
   * @param {string} newRemoteDhPublic - 对方的新 DH 公钥
   * @returns {Buffer} messageKey
   */
  ratchetRecv(newRemoteDhPublic) {
    // DH 棘轮
    if (newRemoteDhPublic !== this.remoteDhPublic) {
      this.remoteDhPublic = newRemoteDhPublic;
      
      // DH 输出
      const dhOutput = this.dh(this.localDhPrivate, newRemoteDhPublic);
      
      // KDF 更新根密钥
      const [newRootKey, sendChainKey] = this.kdf(this.rootKey, dhOutput);
      this.rootKey = newRootKey;
      this.sendChain = new KdfChain(sendChainKey);
      
      // 生成新的 DH 密钥对
      const newDh = this.generateDhKeyPair();
      this.localDhPublic = newDh.publicKey;
      this.localDhPrivate = newDh.privateKey;
      
      // 再次 DH
      const dhOutput2 = this.dh(this.localDhPrivate, newRemoteDhPublic);
      const [finalRootKey, recvChainKey] = this.kdf(this.rootKey, dhOutput2);
      this.rootKey = finalRootKey;
      this.recvChain = new KdfChain(recvChainKey);
    }
    
    if (!this.recvChain) {
      throw new Error('接收链未初始化');
    }
    
    const [messageKey] = this.recvChain.next();
    this.recvCounter++;
    return messageKey;
  }

  /**
   * KDF 函数
   */
  kdf(rootKey, dhOutput) {
    const hmac = crypto.createHmac('sha256', rootKey);
    hmac.update(dhOutput);
    const output = hmac.digest();
    
    const newRootKey = output;
    const chainKey = crypto
      .createHmac('sha256', output)
      .update(Buffer.from([0x01]))
      .digest();
    
    return [newRootKey, chainKey];
  }

  /**
   * 加密消息
   */
  encrypt(plaintext, recipientNaclPublicKey) {
    const messageKey = this.ratchetSend();
    
    // 使用 messageKey 派生加密密钥和 nonce
    const encryptionKey = crypto
      .createHmac('sha256', messageKey)
      .update('encryption')
      .digest();
    
    const nonce = crypto
      .createHmac('sha256', messageKey)
      .update('nonce')
      .digest()
      .slice(0, 24);
    
    // XSalsa20-Poly1305 加密
    const ciphertext = nacl.secretbox(
      Buffer.from(plaintext, 'utf-8'),
      nonce,
      encryptionKey
    );
    
    return {
      ciphertext: Buffer.from(ciphertext).toString('hex'),
      nonce: nonce.toString('hex'),
      dhPublic: this.localDhPublic,
      counter: this.sendCounter
    };
  }

  /**
   * 解密消息
   */
  decrypt(encrypted, senderNaclPublicKey) {
    // 棘轮接收
    const messageKey = this.ratchetRecv(encrypted.dhPublic);
    
    // 派生解密密钥
    const encryptionKey = crypto
      .createHmac('sha256', messageKey)
      .update('encryption')
      .digest();
    
    const nonce = Buffer.from(encrypted.nonce, 'hex');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
    
    const decrypted = nacl.secretbox.open(ciphertext, nonce, encryptionKey);
    
    if (!decrypted) {
      throw new Error('解密失败');
    }
    
    return Buffer.from(decrypted).toString('utf-8');
  }

  exportState() {
    return {
      localDhPublic: this.localDhPublic,
      localDhPrivate: this.localDhPrivate,
      remoteDhPublic: this.remoteDhPublic,
      rootKey: this.rootKey.toString('base64'),
      sendChain: this.sendChain ? this.sendChain.exportState() : null,
      recvChain: this.recvChain ? this.recvChain.exportState() : null,
      isInitiator: this.isInitiator,
      sendCounter: this.sendCounter,
      recvCounter: this.recvCounter
    };
  }

  static fromState(state) {
    const session = new DoubleRatchetSession(
      Buffer.from(state.rootKey, 'base64'),
      state.localDhPublic,
      state.localDhPrivate,
      state.isInitiator
    );
    session.remoteDhPublic = state.remoteDhPublic;
    session.sendChain = state.sendChain ? KdfChain.fromState(state.sendChain) : null;
    session.recvChain = state.recvChain ? KdfChain.fromState(state.recvChain) : null;
    session.sendCounter = state.sendCounter || 0;
    session.recvCounter = state.recvCounter || 0;
    return session;
  }
}

// ==================== 会话管理器 ====================

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

  getSessionId(peerDid) {
    return crypto.createHash('sha256').update(peerDid).digest('hex').substring(0, 16);
  }

  /**
   * 初始化双棘轮会话（发起方）
   */
  initSession(peerDid, localNaclPrivate, remoteNaclPublic) {
    const sessionId = this.getSessionId(peerDid);
    
    // 生成 DH 密钥对
    const dhKeyPair = nacl.box.keyPair();
    const localDhPublic = Buffer.from(dhKeyPair.publicKey).toString('hex');
    const localDhPrivate = Buffer.from(dhKeyPair.secretKey).toString('hex');
    
    // DH 共享密钥
    const sharedSecret = nacl.box.before(
      Buffer.from(remoteNaclPublic, 'hex'),
      Buffer.from(localNaclPrivate, 'hex')
    );
    
    // 创建双棘轮会话
    const session = new DoubleRatchetSession(
      sharedSecret,
      localDhPublic,
      localDhPrivate,
      true // isInitiator
    );
    
    // 初始化发送链（第一次 DH）
    const dhOutput = nacl.box.before(
      Buffer.from(remoteNaclPublic, 'hex'),
      Buffer.from(localDhPrivate, 'hex')
    );
    const [newRootKey, chainKey] = session.kdf(sharedSecret, dhOutput);
    session.rootKey = newRootKey;
    session.sendChain = new KdfChain(chainKey);
    
    this.sessions[sessionId] = {
      peerDid,
      type: 'double-ratchet',
      state: session.exportState(),
      createdAt: Date.now(),
      activeAt: Date.now()
    };
    this.saveSessions();
    
    console.log(`  📦 创建双棘轮会话：${sessionId}`);
    return session;
  }

  /**
   * 获取或创建会话
   */
  getOrCreateSession(peerDid, localNaclPrivate, remoteNaclPublic, isInitiator) {
    const sessionId = this.getSessionId(peerDid);
    
    if (!this.sessions[sessionId]) {
      if (isInitiator) {
        return this.initSession(peerDid, localNaclPrivate, remoteNaclPublic);
      } else {
        // 接收方，等待对方发起
        console.log(`  ⏳ 等待对方发起会话...`);
        return null;
      }
    }
    
    const sessionData = this.sessions[sessionId];
    if (!sessionData.state || !sessionData.state.rootKey) {
      console.log(`  ⚠️ 会话状态无效，重新初始化`);
      return this.initSession(peerDid, localNaclPrivate, remoteNaclPublic);
    }
    
    return DoubleRatchetSession.fromState(sessionData.state);
  }

  updateSession(peerDid, session) {
    const sessionId = this.getSessionId(peerDid);
    if (this.sessions[sessionId]) {
      this.sessions[sessionId].state = session.exportState();
      this.sessions[sessionId].activeAt = Date.now();
      this.saveSessions();
    }
  }

  getRatchet(peerDid, localNaclPrivate, remoteNaclPublic) {
    const sessionId = this.getSessionId(peerDid);
    const sessionData = this.sessions[sessionId];
    if (!sessionData) return null;
    
    return DoubleRatchetSession.fromState(sessionData.state);
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

// ==================== Moltx API (使用 node-fetch) ====================

const MOLT_BASE = 'https://moltx.io/v1';

async function apiRequest(method, endpoint, apiKey, body = null) {
  const url = `${MOLT_BASE}${endpoint}`;
  console.log(`  API: ${method} ${url}`);
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  
  const options = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    console.log(`  Status: ${response.status}`);
    
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text, status: response.status };
    }
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    return { error: e.message };
  }
}

async function publicApiRequest(method, endpoint) {
  const url = `${MOLT_BASE}${endpoint}`;
  console.log(`  API: ${method} ${url} (公开端点)`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    console.log(`  Status: ${response.status}`);
    
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text, status: response.status };
    }
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    return { error: e.message };
  }
}

async function updateAgentMetadata(apiKey, metadata) {
  return apiRequest('PATCH', '/agents/me', apiKey, { metadata });
}

async function getAgentProfile(agentName) {
  return publicApiRequest('GET', `/agents/profile?name=${agentName}`);
}

async function sendDM(apiKey, recipientName, content) {
  return apiRequest('POST', `/dm/${recipientName}/messages`, apiKey, { content });
}

async function getDMMessages(apiKey, otherName) {
  return apiRequest('GET', `/dm/${otherName}/messages`, apiKey);
}

// ==================== 辅助函数 ====================

function loadAccount(name) {
  const filePath = path.join(AGENTS_DIR, `${name}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
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

// ==================== 主流程 ====================

async function main() {
  console.log('='.repeat(70));
  console.log('Moltx 双棘轮加密消息系统演示');
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

  // 步骤 2: 更新 Moltx metadata
  console.log('\n【步骤 2】更新 Moltx metadata');
  console.log('-'.repeat(70));

  const hygMetadata = {
    category: 'encrypted-messenger-v3',
    nacl_public_key: hygAccount.nacl.publicKey,
    nacl_signature: hygAccount.nacl.signature,
    nacl_wallet_address: hygAccount.wallet.address,
    double_ratchet_enabled: true
  };

  const blogMetadata = {
    category: 'encrypted-messenger-v3',
    nacl_public_key: blogAccount.nacl.publicKey,
    nacl_signature: blogAccount.nacl.signature,
    nacl_wallet_address: blogAccount.wallet.address,
    double_ratchet_enabled: true
  };

  console.log('\n更新 hyg metadata:');
  const hygUpdateResult = await updateAgentMetadata(hygAccount.api_key, hygMetadata);
  console.log(`  结果：${hygUpdateResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (!hygUpdateResult.success) {
    console.log(`  错误：${hygUpdateResult.error || hygUpdateResult.raw?.substring(0, 100)}`);
  }

  console.log('\n更新 blog metadata:');
  const blogUpdateResult = await updateAgentMetadata(blogAccount.api_key, blogMetadata);
  console.log(`  结果：${blogUpdateResult.success ? '✅ 成功' : '❌ 失败'}`);
  if (!blogUpdateResult.success) {
    console.log(`  错误：${blogUpdateResult.error || blogUpdateResult.raw?.substring(0, 100)}`);
  }

  // 步骤 3: 获取公钥
  console.log('\n【步骤 3】hyg 从 Moltx 索取 blog 的公钥');
  console.log('-'.repeat(70));

  const blogProfileResponse = await getAgentProfile('blog');
  let blogMetadataFromProfile = blogProfileResponse.data?.agent?.metadata;
  if (typeof blogMetadataFromProfile === 'string') {
    blogMetadataFromProfile = JSON.parse(blogMetadataFromProfile);
  }

  const blogPublicKey = blogMetadataFromProfile?.nacl_public_key;
  const blogSignature = blogMetadataFromProfile?.nacl_signature;
  const blogWalletAddress = blogMetadataFromProfile?.nacl_wallet_address;

  if (!blogPublicKey) {
    console.log('❌ 无法获取 blog 公钥');
    console.log('完整响应:', JSON.stringify(blogProfileResponse, null, 2).substring(0, 500));
    return;
  }

  console.log(`\n从 Moltx 获取到:`);
  console.log(`  nacl_public_key: ${blogPublicKey}`);

  const blogKeyVerification = await verifyPublicKeySignature(blogPublicKey, blogSignature, blogWalletAddress);
  console.log(`\n【公钥验证】${blogKeyVerification.valid ? '✅ 通过' : '❌ 失败'}`);

  if (!blogKeyVerification.valid) {
    console.log('公钥验证失败，终止流程');
    return;
  }

  // 步骤 4: 初始化双棘轮会话
  console.log('\n【步骤 4】初始化双棘轮会话');
  console.log('-'.repeat(70));

  const hygSession = hygSessionMgr.getOrCreateSession(
    'blog',
    hygAccount.nacl.privateKey,
    blogPublicKey,
    true
  );
  
  console.log(`  🔑 DH 公钥：${hygSession.localDhPublic.substring(0, 32)}...`);

  // 步骤 5: 加密发送
  console.log('\n【步骤 5】hyg 使用双棘轮加密消息');
  console.log('-'.repeat(70));

  const hygOriginalMessage = '你好 blog！这是使用双棘轮加密的消息。🔐';
  console.log(`\n📝 hyg 原始消息：${hygOriginalMessage}`);

  const encrypted = hygSession.encrypt(hygOriginalMessage, blogPublicKey);
  
  console.log(`\n🔐 加密后:`);
  console.log(`   ciphertext: ${encrypted.ciphertext.substring(0, 64)}...`);
  console.log(`   nonce: ${encrypted.nonce}`);
  console.log(`   dhPublic: ${encrypted.dhPublic.substring(0, 32)}...`);
  console.log(`   counter: ${encrypted.counter}`);

  hygSessionMgr.updateSession('blog', hygSession);

  const encryptedMessageContent = JSON.stringify({
    type: 'encrypted-double-ratchet',
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

  // 步骤 6: blog 接收并解密
  console.log('\n【步骤 6】blog 接收并使用双棘轮解密');
  console.log('-'.repeat(70));

  const dmMessages = await getDMMessages(blogAccount.api_key, 'hyg');
  const encryptedMessages = dmMessages.data?.messages?.filter(m => {
    try {
      const parsed = JSON.parse(m.content);
      return parsed.type === 'encrypted-double-ratchet';
    } catch {
      return false;
    }
  });

  if (!encryptedMessages || encryptedMessages.length === 0) {
    console.log('⚠️ 未找到双棘轮加密消息');
    console.log('  提示：消息可能已发送但尚未同步，请稍后重试');
    return;
  }

  encryptedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const lastMessage = encryptedMessages[0];
  console.log(`找到加密消息：${lastMessage.id}`);

  const parsedMessage = JSON.parse(lastMessage.content);

  // blog 创建会话并解密
  const blogSession = blogSessionMgr.getOrCreateSession(
    'hyg',
    blogAccount.nacl.privateKey,
    hygAccount.nacl.publicKey,
    false
  );
  
  // 接收方需要先设置对方的 DH 公钥
  if (!blogSession) {
    // 手动创建接收方会话
    const dhKeyPair = nacl.box.keyPair();
    const localDhPublic = Buffer.from(dhKeyPair.publicKey).toString('hex');
    const localDhPrivate = Buffer.from(dhKeyPair.secretKey).toString('hex');
    
    // DH 共享密钥
    const sharedSecret = nacl.box.before(
      Buffer.from(hygAccount.nacl.publicKey, 'hex'),
      Buffer.from(blogAccount.nacl.privateKey, 'hex')
    );
    
    const session = new DoubleRatchetSession(
      sharedSecret,
      localDhPublic,
      localDhPrivate,
      false
    );
    
    // 接收方需要先处理对方的 DH
    const dhOutput = nacl.box.before(
      Buffer.from(parsedMessage.dhPublic, 'hex'),
      Buffer.from(blogAccount.nacl.privateKey, 'hex')
    );
    const [newRootKey, chainKey] = session.kdf(sharedSecret, dhOutput);
    session.rootKey = newRootKey;
    session.recvChain = new KdfChain(chainKey);
    session.remoteDhPublic = parsedMessage.dhPublic;
    
    blogSessionMgr.updateSession('hyg', session);
    
    console.log(`  📦 创建接收方会话`);
    
    // 解密
    console.log('\n【解密消息】');
    const decryptedMessage = session.decrypt(parsedMessage, hygAccount.nacl.publicKey);
    console.log(`🔓 解密后的消息：${decryptedMessage}`);
    
    blogSessionMgr.updateSession('hyg', session);
  }

  // 步骤 7: blog 加密回复
  console.log('\n【步骤 7】blog 使用双棘轮加密回复');
  console.log('-'.repeat(70));

  const blogReplyMessage = '收到！双棘轮加密工作正常！✅';
  console.log(`\n📝 blog 原始回复：${blogReplyMessage}`);

  // 获取 blog 会话
  const blogSessionForSend = blogSessionMgr.getRatchet('hyg', blogAccount.nacl.privateKey, hygAccount.nacl.publicKey);
  
  if (blogSessionForSend) {
    const blogEncrypted = blogSessionForSend.encrypt(blogReplyMessage, hygAccount.nacl.publicKey);
    blogSessionMgr.updateSession('hyg', blogSessionForSend);

    const blogEncryptedContent = JSON.stringify({
      type: 'encrypted-double-ratchet',
      sender: 'blog',
      senderPublicKey: blogAccount.nacl.publicKey,
      ...blogEncrypted
    });

    console.log(`\n📤 发送加密回复...`);
    const blogSendResult = await sendDM(blogAccount.api_key, 'hyg', blogEncryptedContent);
    console.log(`  结果：${blogSendResult.success ? '✅ 成功' : '❌ 失败'}`);
  } else {
    console.log('⚠️ 无法获取发送会话');
  }

  // 步骤 8: hyg 接收并解密回复
  console.log('\n【步骤 8】hyg 接收并解密回复');
  console.log('-'.repeat(70));

  const hygDmMessages = await getDMMessages(hygAccount.api_key, 'blog');
  const hygEncryptedMessages = hygDmMessages.data?.messages?.filter(m => {
    try {
      const parsed = JSON.parse(m.content);
      return parsed.type === 'encrypted-double-ratchet';
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

  const hygRatchet = hygSessionMgr.getRatchet('blog', hygAccount.nacl.privateKey, blogAccount.nacl.publicKey);
  
  if (hygRatchet) {
    const decryptedReply = hygRatchet.decrypt(parsedReply, blogAccount.nacl.publicKey);
    console.log(`🔓 hyg 解密后的回复：${decryptedReply}`);
    hygSessionMgr.updateSession('blog', hygRatchet);
  } else {
    console.log('⚠️ 无法获取会话');
  }

  // 完成
  console.log('\n' + '='.repeat(70));
  console.log('✅ 演示完成！');
  console.log('='.repeat(70));

  console.log('\n📊 双棘轮特性:');
  console.log('  🔐 前向安全：每条消息使用不同的密钥');
  console.log('  🔄 后向安全：收到新消息后更新 DH 密钥');
  console.log('  💾 会话持久化：会话状态保存到本地文件');
  console.log(`\n📁 会话文件位置：${SESSIONS_DIR}/`);
}

main().catch(console.error);
