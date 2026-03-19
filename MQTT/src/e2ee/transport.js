/**
 * Transport 接口 - 抽象传输层
 * 
 * 不同协议实现：
 * - MQTTTransport: MQTT topics
 * - PeerTransport: WebRTC DataChannel
 * - GunTransport: Gun DAG
 */

export class Transport extends EventTarget {
  constructor() {
    super();
    this.topics = new Set();
    this._handlers = new Map();
  }

  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, []);
    }
    this._handlers.get(event).push(handler);
    this.addEventListener(event, handler);
    return this;
  }

  off(event, handler) {
    if (handler) {
      this.removeEventListener(event, handler);
      const handlers = this._handlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    } else {
      this._handlers.delete(event);
      this.removeEventListeners(event);
    }
    return this;
  }

  emit(event, data) {
    const handlers = this._handlers.get(event) || [];
    handlers.forEach(h => {
      try {
        h(data);
      } catch (e) {
        console.error(`[Transport] Handler error:`, e);
      }
    });
  }

  async send(message) {
    throw new Error('Transport.send() must be implemented');
  }

  async broadcast(message) {
    throw new Error('Transport.broadcast() must be implemented');
  }

  subscribe(topic) {
    throw new Error('Transport.subscribe() must be implemented');
  }

  unsubscribe(topic) {
    throw new Error('Transport.unsubscribe() must be implemented');
  }

  close() {
    throw new Error('Transport.close() must be implemented');
  }

  getTopics() {
    return Array.from(this.topics);
  }
}

export default Transport;
