import axios from 'axios';

export class Transport {
  async send(to, content, options = {}) {
    throw new Error('Not implemented');
  }

  async receive(options = {}) {
    throw new Error('Not implemented');
  }

  async connect() {
    throw new Error('Not implemented');
  }

  async disconnect() {
    throw new Error('Not implemented');
  }
}

export class HTTPTransport extends Transport {
  constructor(config = {}) {
    super();
    this.baseUrl = config.userServiceUrl || 'https://awiki.ai';
    this.jwt = config.jwt || null;
    this.endpoint = '/message/rpc'; // Default to RPC endpoint
  }

  setAuth(jwt) {
    this.jwt = jwt;
  }

  async send(to, content, options = {}) {
    return this.rpcCall('send', {
      receiver_did: to,
      content,
      type: options.type || 'text',
      client_msg_id: options.client_msg_id || crypto.randomUUID()
    });
  }

  async receive(options = {}) {
    return this.rpcCall('get_inbox', {
      limit: options.limit || 50,
      user_did: options.user_did // If needed
    });
  }

  async rpcCall(method, params) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.jwt) {
      headers.Authorization = `Bearer ${this.jwt}`;
    }

    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: 1
    };

    const response = await axios.post(`${this.baseUrl}${this.endpoint}`, payload, { headers });
    
    if (response.data.error) {
      throw new Error(`JSON-RPC Error: ${response.data.error.message}`);
    }
    
    return response.data.result;
  }

  async connect() {}
  async disconnect() {}
}

export class WebSocketTransport extends Transport {
  constructor(config = {}) {
    super();
    this.url = config.wsUrl || 'wss://awiki.ai/ws'; // Correct WS URL
    this.jwt = config.jwt || null;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectInterval = config.reconnectInterval || 5000;
  }

  setAuth(jwt) {
    this.jwt = jwt;
  }

  async connect() {
    const WS = (await import('ws')).default;

    return new Promise((resolve, reject) => {
      this.ws = new WS(this.url, {
        headers: this.jwt ? { Authorization: `Bearer ${this.jwt}` } : {}
      });

      this.ws.on('open', () => {
        this.setupListeners();
        resolve();
      });

      this.ws.on('error', (error) => {
        reject(error);
      });
    });
  }

  setupListeners() {
    if (!this.ws) return;

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const event = message.type || 'message';

        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(message));
      } catch (e) {
        console.error('WS message parse error', e);
      }
    });
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
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'message',
      to,
      content,
      ...options
    };

    this.ws.send(JSON.stringify(message));
    return message;
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default { Transport, HTTPTransport, WebSocketTransport };
