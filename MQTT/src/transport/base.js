/**
 * 统一传输层抽象基类
 * 
 * 设计原则:
 * 1. roomId - 房间/主题名称 (MQTT: topic, PeerJS: 无, GUN: path)
 * 2. peerId - 节点唯一标识 (DID 或公钥哈希)
 * 3. serverUrl - 服务器地址 (MQTT: broker, PeerJS: 信令服务器, GUN: peers)
 * 
 * 各传输层只需实现这三个参数的映射，CLI 统一调用
 */

import { EventEmitter } from 'events';

export class Transport extends EventEmitter {
  constructor(config = {}) {
    super();
    this.roomId = config.roomId || 'psmd/e2ee/chat';
    this.peerId = config.peerId || null;  // 使用 DID 或公钥作为标识
    this.serverUrl = config.serverUrl || null;
    this.isConnected = false;
    this.sentMessageIds = new Set();
    this.receivedMessageCache = new Map();
  }

  /**
   * 连接到服务器并加入房间
   * @returns {Promise<string>} 返回节点 ID
   */
  async connect() {
    throw new Error('Transport.connect() must be implemented');
  }

  /**
   * 加入房间
   * @param {string} roomId 房间 ID
   */
  async joinRoom(roomId) {
    throw new Error('Transport.joinRoom() must be implemented');
  }

  /**
   * 发送消息给指定 peer
   * @param {string} recipientDid 接收者 DID
   * @param {object} message 消息内容
   */
  async sendTo(recipientDid, message) {
    throw new Error('Transport.sendTo() must be implemented');
  }

  /**
   * 广播消息到当前房间
   * @param {object} message 消息内容
   */
  async broadcast(message) {
    throw new Error('Transport.broadcast() must be implemented');
  }

  /**
   * 断开连接
   */
  close() {
    throw new Error('Transport.close() must be implemented');
  }

  /**
   * 处理收到的消息 (内部方法)
   */
  _handleIncomingMessage(data, senderPeerId) {
    const messageId = data.id;
    if (messageId && this.receivedMessageCache.has(messageId)) return;
    if (messageId && this.sentMessageIds.has(messageId)) return;
    if (messageId) this.receivedMessageCache.set(messageId, Date.now());

    // 解析消息格式
    let type, content, sender_did, recipient_did;

    if (data.method === 'send' && data.params) {
      // JSON-RPC 格式
      type = data.params.type;
      content = data.params.content;
      sender_did = content?.sender_did;
      recipient_did = data.params.recipient_did;
    } else if (data.type) {
      // 直接格式
      type = data.type;
      content = data.content;
      sender_did = content?.sender_did;
      recipient_did = data.recipient_did;
    } else {
      // 未知格式
      this.emit('message', data);
      return;
    }

    // 过滤自己的消息
    if (sender_did && sender_did === this.peerId) return;

    // 发出消息事件
    this.emit('message', { type, content, sender_did, recipient_did });
  }

  /**
   * 生成消息 ID
   */
  _generateMessageId() {
    return Math.random().toString(16).substring(2, 10);
  }

  /**
   * 构建标准消息格式
   */
  _buildMessage(type, content, recipientDid = null) {
    const message = {
      type,
      content,
      recipient_did: recipientDid
    };

    const request = {
      jsonrpc: '2.0',
      method: 'send',
      params: message,
      id: this._generateMessageId()
    };

    if (request.id) {
      this.sentMessageIds.add(request.id);
    }

    return request;
  }
}

export default Transport;
