/**
 * GUN Transport 实现
 * 
 * 统一接口映射:
 * - roomId → gun.get('e2ee').get(roomId)
 * - peerId → 消息中的 sender_did 字段
 * - serverUrl → GUN peers URL
 * 
 * GUN 特性:
 * - 去中心化网状网络
 * - 实时数据同步 (gun.on)
 * - 离线优先，自动同步
 */

import { Transport } from './base.js';

export class GunTransport extends Transport {
  constructor(config = {}) {
    super(config);
    this.serverUrl = config.serverUrl || config.peers || 'https://gun-manhattan.herokuapp.com/gun';
    this.gun = null;
    this.room = null;
    this.messageCounter = 0;
    this.cleanupInterval = null;
  }

  async connect() {
    let Gun;
    try {
      const gunModule = await import('gun');
      Gun = gunModule.Gun || gunModule.default;
    } catch (e) {
      throw new Error('GUN 库未安装，请运行: npm install gun');
    }

    const peers = Array.isArray(this.serverUrl) ? this.serverUrl : [this.serverUrl];
    
    this.gun = Gun({
      peers,
      localStorage: false,
      radisk: false
    });

    // 创建房间节点
    this.room = this.gun.get('e2ee').get(this.roomId);

    // 监听房间消息
    this.room.map().on((data, key) => {
      if (data && data.message) {
        try {
          const message = JSON.parse(data.message);
          this._handleIncomingMessage(message, key);
        } catch (e) {
          // 忽略解析错误
        }
      }
    });

    this.isConnected = true;
    console.log(`[GUN] 已连接到房间: ${this.roomId}`);

    // 定期清理旧消息
    this.cleanupInterval = setInterval(() => {
      this._cleanupOldMessages();
    }, 60000);

    return `gun-${Date.now().toString(36)}`;
  }

  async joinRoom(roomId) {
    if (this.room) {
      // 取消监听旧房间
      this.room.off();
    }
    
    this.roomId = roomId;
    this.room = this.gun.get('e2ee').get(roomId);
    
    this.room.map().on((data, key) => {
      if (data && data.message) {
        try {
          const message = JSON.parse(data.message);
          this._handleIncomingMessage(message, key);
        } catch (e) {}
      }
    });

    console.log(`[GUN] 已加入房间: ${roomId}`);
  }

  async send(message) {
    if (!this.isConnected) throw new Error('未连接');

    const request = this._buildMessage(
      message.type || 'text',
      message.content || message,
      message.recipient_did
    );

    const key = `${this.peerId || 'anon'}_${Date.now()}_${this.messageCounter++}`;
    
    this.room.get(key).put({
      message: JSON.stringify(request),
      timestamp: Date.now()
    });

    return { request, key };
  }

  async sendTo(recipientDid, message) {
    return this.send({
      ...message,
      recipient_did: recipientDid
    });
  }

  async broadcast(message) {
    return this.send({
      ...message,
      recipient_did: null
    });
  }

  _cleanupOldMessages() {
    const maxAge = 5 * 60 * 1000; // 5 分钟
    const now = Date.now();
    
    for (const [id, timestamp] of this.receivedMessageCache) {
      if (now - timestamp > maxAge) {
        this.receivedMessageCache.delete(id);
      }
    }
  }

  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.room) {
      this.room.off();
    }

    this.isConnected = false;
    console.log('[GUN] 已断开连接');
  }
}

export default GunTransport;
