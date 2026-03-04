import { Transport, HTTPTransport, WebSocketTransport } from './transports/http.js';
import { MoltxTransport } from './transports/moltx.js';
import { MQTTTransport } from './transports/mqtt.js';

export { Transport, HTTPTransport, WebSocketTransport, MoltxTransport, MQTTTransport };

export class MessageService {
  constructor(config = {}) {
    this.transports = new Map();
    this.defaultTransport = config.defaultTransport || 'http';
    this.config = config;

    this.registerTransport('http', new HTTPTransport(config));
    this.registerTransport('ws', new WebSocketTransport(config));
    this.registerTransport('moltx', new MoltxTransport(config));
    this.registerTransport('mqtt', new MQTTTransport(config));
  }

  registerTransport(name, transport) {
    this.transports.set(name, transport);
  }

  getTransport(name = this.defaultTransport) {
    const transport = this.transports.get(name);
    if (!transport) {
      throw new Error(`Unknown transport: ${name}. Available: ${[...this.transports.keys()].join(', ')}`);
    }
    return transport;
  }

  async send(to, content, options = {}) {
    const transport = this.getTransport(options.transport || this.defaultTransport);
    return transport.send(to, content, options);
  }

  async receive(options = {}) {
    const transport = this.getTransport(options.transport || this.defaultTransport);
    return transport.receive(options);
  }

  async connect(options = {}) {
    const transport = this.getTransport(options.transport || this.defaultTransport);
    return transport.connect();
  }

  async disconnect(options = {}) {
    const transport = this.getTransport(options.transport || this.defaultTransport);
    return transport.disconnect();
  }

  setAuth(jwt, transportName = null) {
    const name = transportName || this.defaultTransport;
    const transport = this.getTransport(name);
    if (transport.setAuth) {
      transport.setAuth(jwt);
    }
  }

  on(event, callback, transportName = null) {
    const name = transportName || this.defaultTransport;
    const transport = this.getTransport(name);
    if (transport.on) {
      transport.on(event, callback);
    }
  }
}

export class AWikiMessaging extends MessageService {
  constructor(config = {}) {
    super({
      ...config,
      defaultTransport: 'http',
      baseUrl: config.userServiceUrl || 'https://awiki.ai',
      endpoint: '/message/rpc' // Python uses /message/rpc
    });
    this.identityManager = null; // Needs to be injected or passed for refresh
  }

  setIdentityManager(im) {
    this.identityManager = im;
  }

  async sendMessage(to, content, type = 'text', options = {}) {
    // Wrap in JSON-RPC if using HTTP transport (default)
    const transportName = options.transport || this.defaultTransport;
    if (transportName === 'http') {
      return this.authenticatedRpcCall('send', {
        receiver_did: to,
        content,
        type,
        client_msg_id: crypto.randomUUID()
      });
    } else {
      // Other transports (MQTT, MoltX) might use different payload structure
      // But we should try to keep it consistent if possible?
      // For now, use the base send method for non-HTTP.
      return this.send(to, content, { type, ...options });
    }
  }

  async checkInbox(options = {}) {
    const transportName = options.transport || this.defaultTransport;
    if (transportName === 'http') {
      return this.authenticatedRpcCall('get_inbox', {
        limit: options.limit || 50,
        ...options
      });
    } else {
      return this.receive(options);
    }
  }

  async markAsRead(messageIds, options = {}) {
    const transportName = options.transport || this.defaultTransport;
    if (transportName === 'http') {
      return this.authenticatedRpcCall('mark_read', {
        message_ids: messageIds
      });
    } else {
      // Not supported on other transports usually
      console.warn('Mark as read only supported on HTTP/RPC');
      return { success: false };
    }
  }

  async authenticatedRpcCall(method, params) {
    const transport = this.getTransport('http');
    try {
      return await transport.rpcCall(method, params);
    } catch (error) {
      // Handle 401
      if (error.response?.status === 401 && this.identityManager) {
        console.log('Token expired, refreshing...');
        try {
          const cred = await this.identityManager.refreshJwt();
          this.setAuth(cred.jwt, 'http');
          // Retry
          return await transport.rpcCall(method, params);
        } catch (refreshError) {
          throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
      }
      throw error;
    }
  }
}

import crypto from 'crypto'; // For randomUUID
export default { MessageService, AWikiMessaging, Transport, HTTPTransport, WebSocketTransport, MoltxTransport };
