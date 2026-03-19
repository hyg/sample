/**
 * PeerJS Transport - CommonJS 版本
 * 
 * 使用 PeerJS + WebRTC 进行 P2P 消息传输
 * 信令服务器: 0.peerjs.com (PeerJS Cloud)
 * 
 * 用法:
 *   const { PeerTransport } = require('./peer-transport.cjs');
 *   const transport = new PeerTransport({ peerId: 'my-id', connectTarget: 'target-id' });
 *   await transport.connect();
 */

// 在导入 peerjs 之前设置 WebRTC polyfill
try {
  const wrtc = require('@roamhq/wrtc');
  global.RTCPeerConnection = wrtc.RTCPeerConnection;
  global.RTCSessionDescription = wrtc.RTCSessionDescription;
  global.RTCIceCandidate = wrtc.RTCIceCandidate;
  global.RTCDataChannel = wrtc.RTCDataChannel;
  console.log('[PeerJS] WebRTC polyfill loaded');
} catch (e) {
  console.warn('[PeerJS] WebRTC polyfill not available:', e.message);
}

const { Peer } = require('peerjs');
const EventEmitter = require('events');

class PeerTransport extends EventEmitter {
  constructor(config = {}) {
    super();
    this.peerId = config.peerId || null;
    this.connectTarget = config.connectTarget || null;
    this.peer = null;
    this.connections = new Map();
    this.isConnected = false;
    this.sentMessageIds = new Set();
    this.receivedMessageCache = new Map();
    this.myDid = null;
  }

  setIdentity(did) {
    this.myDid = did;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.peer = this.peerId ? new Peer(this.peerId) : new Peer();

      this.peer.on('open', (id) => {
        console.log(`[PeerJS] Connected to PeerJS Cloud, ID: ${id}`);
        this.peerId = id;
        this.isConnected = true;

        if (this.connectTarget) {
          this.connectToPeer(this.connectTarget);
        }

        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err.message);
        if (err.type === 'unavailable-id') {
          console.log('[PeerJS] ID taken, using random ID...');
          this.peer = new Peer();
          this.setupPeer(resolve, reject);
        } else if (!this.isConnected) {
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        console.log('[PeerJS] Disconnected, reconnecting...');
        this.peer.reconnect();
      });
    });
  }

  setupPeer(resolve, reject) {
    this.peer.on('open', (id) => {
      console.log(`[PeerJS] Connected with ID: ${id}`);
      this.peerId = id;
      this.isConnected = true;
      if (this.connectTarget) {
        this.connectToPeer(this.connectTarget);
      }
      resolve(id);
    });
    this.peer.on('connection', (conn) => this.handleConnection(conn));
    this.peer.on('error', (err) => {
      if (!this.isConnected) reject(err);
    });
  }

  handleConnection(conn) {
    console.log(`[PeerJS] 处理连接: ${conn.peer} (open=${conn.open})`);
    this.connections.set(conn.peer, conn);

    conn.on('open', () => {
      console.log(`[PeerJS] 连接已打开: ${conn.peer}`);
      console.log(`[PeerJS] 当前连接数: ${this.connections.size}`);
      this.emit('peer-connected', { peerId: conn.peer });
    });

    conn.on('data', (data) => {
      console.log(`[PeerJS] 收到数据 from ${conn.peer}: ${data.method || data.type || 'unknown'}`);
      this.handleMessage(data, conn.peer);
    });

    conn.on('close', () => {
      console.log(`[PeerJS] 连接关闭: ${conn.peer}`);
      this.connections.delete(conn.peer);
      this.emit('peer-disconnected', { peerId: conn.peer });
    });

    conn.on('error', (err) => {
      console.error(`[PeerJS] 连接错误 (${conn.peer}):`, err.message);
    });
  }

  handleMessage(data, senderPeerId) {
    try {
      console.log(`[PeerJS] 处理消息 from ${senderPeerId}:`, JSON.stringify(data).substring(0, 100));
      
      const messageId = data.id;
      if (messageId && this.receivedMessageCache.has(messageId)) {
        console.log(`[PeerJS] 忽略重复消息: ${messageId}`);
        return;
      }
      if (messageId && this.sentMessageIds.has(messageId)) {
        console.log(`[PeerJS] 过滤自己发送的消息: ${messageId}`);
        return;
      }
      if (messageId) this.receivedMessageCache.set(messageId, Date.now());

      if (data.method === 'send' && data.params) {
        const { type, content, recipient_did } = data.params;
        console.log(`[PeerJS] 收到 ${type} 消息`);
        const sender_did = content?.sender_did;
        if (sender_did === this.myDid) {
          console.log(`[PeerJS] 过滤自己的消息: ${sender_did}`);
          return;
        }

        if (type === 'text') {
          this.emit('message', { type: 'text', content, sender_did, recipient_did });
        } else {
          this.emit('message', { type, content, sender_did, recipient_did });
        }
      } else if (data.type === 'text') {
        const sender_did = data.content?.sender_did;
        if (sender_did === this.myDid) return;
        this.emit('message', { type: 'text', content: data.content, sender_did });
      } else {
        this.emit('message', data);
      }
    } catch (err) {
      console.error('[PeerJS] 消息处理错误:', err);
    }
  }

  async connectToPeer(peerId) {
    if (!this.isConnected) {
      throw new Error('Not connected to PeerJS Cloud');
    }

    if (this.connections.has(peerId)) {
      const existingConn = this.connections.get(peerId);
      if (existingConn.open) {
        console.log(`[PeerJS] 已连接到 ${peerId}`);
        return existingConn;
      }
    }

    console.log(`[PeerJS] 正在连接到: ${peerId}`);
    const conn = this.peer.connect(peerId);
    this.handleConnection(conn);
    
    // 等待连接打开
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接超时'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log(`[PeerJS] 连接成功: ${peerId}`);
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async send(message) {
    if (!this.isConnected) throw new Error('Not connected');

    const request = {
      jsonrpc: '2.0',
      method: 'send',
      params: message,
      id: message.id || Math.random().toString(16).substring(2, 10)
    };

    if (request.id) this.sentMessageIds.add(request.id);

    let sent = false;
    for (const [peerId, conn] of this.connections) {
      if (conn.open) {
        try { 
          conn.send(request); 
          sent = true;
          console.log(`[PeerJS] 消息已发送到 ${peerId} (${message.type || 'unknown'})`);
        } catch (e) {
          console.error(`[PeerJS] 发送失败到 ${peerId}:`, e.message);
        }
      } else {
        console.log(`[PeerJS] 连接未就绪: ${peerId} (open=${conn.open})`);
      }
    }

    if (!sent && this.connections.size === 0) {
      console.log('[PeerJS] 警告: 没有 peer 连接，消息未发送。使用 /peer <id> 连接到其他 peer');
    }

    return { request };
  }

  async broadcast(message) {
    return this.send({ ...message, recipient_did: null });
  }

  async sendToPeer(peerId, message) {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) throw new Error(`Not connected to peer: ${peerId}`);

    const request = {
      jsonrpc: '2.0',
      method: 'send',
      params: message,
      id: message.id || Math.random().toString(16).substring(2, 10)
    };

    if (request.id) this.sentMessageIds.add(request.id);
    conn.send(request);
    return { request };
  }

  getConnectedPeers() {
    return Array.from(this.connections.keys()).filter(
      id => this.connections.get(id).open
    );
  }

  close() {
    for (const [, conn] of this.connections) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();
    if (this.peer) this.peer.destroy();
    this.isConnected = false;
    console.log('[PeerJS] Disconnected');
  }
}

module.exports = { PeerTransport };
