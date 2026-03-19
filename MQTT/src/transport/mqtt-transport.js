/**
 * MQTT Transport 实现
 * 
 * 统一接口映射:
 * - roomId → MQTT topic
 * - peerId → clientId (用于过滤自己的消息)
 * - serverUrl → broker URL
 */

import mqtt from 'mqtt';
import { Transport } from './base.js';

export class MQTTTransport extends Transport {
  constructor(config = {}) {
    super(config);
    this.serverUrl = config.serverUrl || config.brokerUrl || 'mqtt://broker.emqx.io:1883';
    this.mqttClient = null;
    this.topics = new Set();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const clientId = this.peerId 
        ? this.peerId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) + '_' + Date.now().toString(36)
        : 'mqtt_' + Math.random().toString(36).substring(2, 8);

      this.mqttClient = mqtt.connect(this.serverUrl, {
        clientId,
        clean: true,
        reconnectPeriod: 5000
      });

      this.mqttClient.on('connect', () => {
        console.log(`[MQTT] 已连接到 ${this.serverUrl}`);
        this.isConnected = true;
        
        // 自动加入房间
        if (this.roomId) {
          this.joinRoom(this.roomId);
        }
        
        resolve(clientId);
      });

      this.mqttClient.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          this._handleIncomingMessage(data, topic);
        } catch (err) {
          console.error('[MQTT] 消息解析错误:', err);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.error('[MQTT] 错误:', err.message);
        if (!this.isConnected) reject(err);
      });

      this.mqttClient.on('close', () => {
        console.log('[MQTT] 连接已关闭');
        this.isConnected = false;
      });
    });
  }

  async joinRoom(roomId) {
    if (!this.topics.has(roomId)) {
      this.topics.add(roomId);
      if (this.mqttClient) {
        this.mqttClient.subscribe(roomId, (err) => {
          if (err) {
            console.error(`[MQTT] 订阅失败 (${roomId}):`, err.message);
          } else {
            console.log(`[MQTT] 已加入房间: ${roomId}`);
          }
        });
      }
    }
  }

  async leaveRoom(roomId) {
    if (this.topics.has(roomId)) {
      this.topics.delete(roomId);
      if (this.mqttClient) {
        this.mqttClient.unsubscribe(roomId);
      }
    }
  }

  async send(message) {
    if (!this.isConnected) throw new Error('未连接');
    
    const request = this._buildMessage(
      message.type || 'text',
      message.content || message,
      message.recipient_did
    );

    const payload = JSON.stringify(request);
    this.mqttClient.publish(this.roomId, payload);
    return { request };
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

  close() {
    if (this.mqttClient) {
      this.mqttClient.end(false, () => {
        console.log('[MQTT] 已断开连接');
      });
    }
    this.isConnected = false;
  }
}

export default MQTTTransport;
