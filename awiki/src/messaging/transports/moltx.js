import axios from 'axios';
import { Transport } from './http.js';

export class MoltxTransport extends Transport {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.baseUrl || 'https://moltx.io';
    this.agentName = config.agentName || null;
    this.endpoint = '/v1/dm';
  }

  setCredentials(apiKey, agentName) {
    this.apiKey = apiKey;
    this.agentName = agentName;
  }

  getHeaders() {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async startDm(agentName) {
    const response = await axios.post(
      `${this.baseUrl}${this.endpoint}/${agentName}`,
      {},
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async send(to, content, options = {}) {
    if (!this.agentName) {
      throw new Error('Agent name not set');
    }

    const targetName = typeof to === 'string' ? to : to.name;

    try {
      await this.startDm(targetName);
    } catch (error) {
      if (error.response?.status !== 409) {
        throw error;
      }
    }

    const response = await axios.post(
      `${this.baseUrl}${this.endpoint}/${targetName}/messages`,
      { content, ...options },
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async receive(agentName, options = {}) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const response = await axios.get(
      `${this.baseUrl}${this.endpoint}/${agentName}/messages`,
      {
        params: { limit, offset },
        headers: this.getHeaders()
      }
    );

    return response.data;
  }

  async listConversations(options = {}) {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const response = await axios.get(
      `${this.baseUrl}${this.endpoint}`,
      {
        params: { limit, offset },
        headers: this.getHeaders()
      }
    );

    return response.data;
  }

  async connect() {}
  async disconnect() {}
}

export default { MoltxTransport };
