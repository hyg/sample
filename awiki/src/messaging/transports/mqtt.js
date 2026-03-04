import mqtt from 'mqtt';
import { Transport } from './http.js';

export class MQTTTransport extends Transport {
  constructor(config = {}) {
    super();
    this.brokerUrl = config.brokerUrl || 'mqtt://broker.emqx.io:1883';
    this.username = config.username || null;
    this.password = config.password || null;
    this.clientId = config.clientId || `agent-${Date.now()}`;
    this.topicPrefix = config.topicPrefix || 'agent/msg';
    this.client = null;
    this.listeners = new Map();
    this.connected = false;
    this.messageHandlers = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const options = {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 4000,
      };

      if (this.username) {
        options.username = this.username;
      }
      if (this.password) {
        options.password = this.password;
      }

      this.client = mqtt.connect(this.brokerUrl, options);

      this.client.on('connect', () => {
        this.connected = true;
        this.subscribe(`${this.topicPrefix}/${this.clientId}/#`);
        resolve();
      });

      this.client.on('error', (error) => {
        reject(error);
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          const event = payload.type || 'message';
          
          const callbacks = this.listeners.get(event) || [];
          callbacks.forEach(cb => cb(payload, topic));
        } catch (e) {
          console.error('Failed to parse MQTT message:', e);
        }
      });
    });
  }

  subscribe(topic) {
    if (this.client && this.connected) {
      this.client.subscribe(topic, { qos: 1 });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  async send(to, content, options = {}) {
    if (!this.client || !this.connected) {
      throw new Error('MQTT not connected');
    }

    const topic = `${this.topicPrefix}/${to}/message`;
    const payload = {
      type: 'message',
      from: this.clientId,
      to,
      content,
      timestamp: new Date().toISOString(),
      ...options
    };

    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(payload);
        }
      });
    });
  }

  async receive(options = {}) {
    return new Promise((resolve) => {
      const handler = (payload, topic) => {
        this.messageHandlers.push(payload);
        if (options.callback) {
          options.callback(payload);
        }
      };
      
      this.on('message', handler);
      
      setTimeout(() => {
        this.off('message', handler);
        resolve(this.messageHandlers);
      }, options.timeout || 1000);
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
    }
  }
}

export default { MQTTTransport };
