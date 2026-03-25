/**
 * websockets-14.0 库的 Node.js 测试
 * 
 * 对应 Python websockets 库的功能测试：
 * - websockets.connect() - WebSocket 连接
 * - WebSocketClientProtocol - WebSocket 客户端协议
 * - send() / recv() - 发送/接收消息
 * - close() - 关闭连接
 * - ConnectionClosed - 连接关闭异常
 * 
 * Node.js 替代库：ws
 */

const WebSocket = require('ws');
const { WebSocketServer } = require('ws');

// 模拟 Python websockets.exceptions.ConnectionClosed
class ConnectionClosed extends Error {
  constructor(code, reason) {
    super(`Connection closed: code=${code}, reason=${reason}`);
    this.name = 'ConnectionClosed';
    this.code = code;
    this.reason = reason;
  }
}

// 模拟 Python websockets.connect() 的异步上下文管理器
class WebSocketClientProtocol {
  constructor(ws) {
    this.ws = ws;
    this.isOpen = true;
    this.protocol = ws.protocol || null;
    this.messageQueue = [];
    this.messageHandlers = [];
    
    // 设置消息监听器
    this.ws.on('message', (data) => {
      const message = data.toString();
      if (this.messageHandlers.length > 0) {
        const handler = this.messageHandlers.shift();
        handler(message);
      } else {
        this.messageQueue.push(message);
      }
    });
    
    this.ws.on('close', () => {
      this.isOpen = false;
      // 拒绝所有待处理的消息处理器
      while (this.messageHandlers.length > 0) {
        const handler = this.messageHandlers.shift();
        handler(null, new ConnectionClosed(1006, 'Connection closed'));
      }
    });
  }

  // 模拟 send()
  async send(data) {
    if (!this.isOpen) {
      throw new ConnectionClosed(1006, 'Connection is closed');
    }
    return new Promise((resolve, reject) => {
      this.ws.send(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // 模拟 recv()
  async recv() {
    if (!this.isOpen) {
      throw new ConnectionClosed(1006, 'Connection is closed');
    }
    
    // 如果队列中有消息，直接返回
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift();
    }
    
    // 否则等待消息
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 从处理器列表中移除
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
          this.messageHandlers.splice(index, 1);
        }
        reject(new Error('Timeout'));
      }, 5000);
      
      const handler = (data, err) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(data);
      };
      
      this.messageHandlers.push(handler);
    });
  }

  // 模拟 close()
  async close(code = 1000, reason = '') {
    if (!this.isOpen) return;
    this.isOpen = false;
    return new Promise((resolve) => {
      this.ws.close(code, reason);
      resolve();
    });
  }
}

// 模拟 websockets.connect()
async function connect(uri, options = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(uri, options);
    
    ws.on('open', () => {
      resolve(new WebSocketClientProtocol(ws));
    });
    
    ws.on('error', (err) => {
      reject(err);
    });
  });
}

describe('websockets-14.0', () => {
  let server;
  let serverUrl;

  // 在每个测试前启动 mock 服务器
  beforeEach((done) => {
    server = new WebSocketServer({ port: 0 }, () => {
      const port = server.address().port;
      serverUrl = `ws://localhost:${port}`;
      done();
    });

    // 设置服务器行为
    server.on('connection', (ws) => {
      // 发送欢迎消息
      ws.send(JSON.stringify({ method: 'welcome', params: { status: 'connected' } }));
      
      // 收到消息后立即回显
      ws.on('message', (data) => {
        ws.send(data);
      });
    });
  });

  // 在每个测试后关闭服务器
  afterEach((done) => {
    if (server) {
      server.close(() => {
        server = null;
        done();
      });
    } else {
      done();
    }
  });

  describe('connect', () => {
    test('connect() - 基本连接', async () => {
      const ws = await connect(serverUrl);
      
      expect(ws).toBeInstanceOf(WebSocketClientProtocol);
      expect(ws.isOpen).toBe(true);
      
      await ws.close();
    });

    test('connect() - 连接后接收欢迎消息', async () => {
      const ws = await connect(serverUrl);
      
      const data = await ws.recv();
      const message = JSON.parse(data);
      
      expect(message.method).toBe('welcome');
      expect(message.params.status).toBe('connected');
      
      await ws.close();
    });

    test('connect() - 带额外选项的连接', async () => {
      const ws = await connect(serverUrl, {
        headers: {
          'Authorization': 'Bearer test-token',
          'User-Agent': 'websockets-14.0-test'
        }
      });
      
      expect(ws.isOpen).toBe(true);
      
      await ws.close();
    });
  });

  describe('send/recv', () => {
    test('send() - 发送文本消息', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      await ws.send('Hello, WebSocket!');
      
      const response = await ws.recv();
      
      expect(response).toBe('Hello, WebSocket!');
      
      await ws.close();
    });

    test('send() - 发送 JSON-RPC 消息', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      const message = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
          content: 'Hello from test',
          type: 'text',
          receiver_did: 'did:wba:awiki.ai:user:k1_test',
          client_msg_id: '550e8400-e29b-41d4-a716-446655440000'
        },
        id: 1
      };
      
      await ws.send(JSON.stringify(message));
      
      const response = await ws.recv();
      const parsed = JSON.parse(response);
      
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('send');
      expect(parsed.params.content).toBe('Hello from test');
      expect(parsed.id).toBe(1);
      
      await ws.close();
    });

    test('recv() - 接收推送通知', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      const notification = {
        method: 'new_message',
        params: {
          id: 'msg_123456',
          sender_did: 'did:wba:awiki.ai:user:k1_sender',
          content: 'Hello, this is a push notification',
          type: 'text',
          server_seq: 42,
          sent_at: '2026-03-25T10:00:00Z'
        }
      };
      
      await ws.send(JSON.stringify(notification));
      
      const response = await ws.recv();
      const parsed = JSON.parse(response);
      
      expect(parsed.method).toBe('new_message');
      expect(parsed.params.id).toBe('msg_123456');
      expect(parsed.params.sender_did).toBe('did:wba:awiki.ai:user:k1_sender');
      
      await ws.close();
    });

    test('recv() - 带超时接收', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      // 不发送消息，等待超时
      await expect(ws.recv()).rejects.toThrow('Timeout');
      
      await ws.close();
    });
  });

  describe('close', () => {
    test('close() - 正常关闭连接', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      await ws.close(1000, 'Normal closure');
      
      expect(ws.isOpen).toBe(false);
    });

    test('close() - 关闭后不能再发送', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      await ws.close(1000, 'Test complete');
      
      await expect(ws.send('test')).rejects.toThrow('Connection is closed');
    });

    test('close() - 关闭后不能再接收', async () => {
      const ws = await connect(serverUrl);
      
      // 先消费欢迎消息
      await ws.recv();
      
      await ws.close(1000, 'Test complete');
      
      await expect(ws.recv()).rejects.toThrow('Connection is closed');
    });

    test('close() - 常见关闭状态码', async () => {
      const statusCodes = [
        { code: 1000, reason: 'CLOSE_NORMAL' },
        { code: 1001, reason: 'CLOSE_GOING_AWAY' }
      ];
      
      for (const { code, reason } of statusCodes) {
        const ws = await connect(serverUrl);
        await ws.recv();
        await ws.close(code, reason);
        expect(ws.isOpen).toBe(false);
      }
    });
  });

  describe('ConnectionClosed', () => {
    test('ConnectionClosed - 关闭后 send 抛出异常', async () => {
      const ws = await connect(serverUrl);
      await ws.recv();
      
      await ws.close(1000, 'Test complete');
      
      try {
        await ws.send('test after close');
      } catch (err) {
        expect(err.name).toBe('ConnectionClosed');
        expect(err.code).toBe(1006);
      }
    });

    test('ConnectionClosed - 异常处理完整示例', async () => {
      const ws = await connect(serverUrl);
      await ws.recv();
      
      let caughtException = null;
      
      try {
        await ws.close(1000, 'Normal closure');
        await ws.send('test');
      } catch (err) {
        caughtException = err;
      }
      
      expect(caughtException).toBeInstanceOf(ConnectionClosed);
      expect(caughtException.code).toBe(1006);
    });
  });

  describe('完整使用示例', () => {
    test('WsClient 封装类 - 完整流程', async () => {
      class WsClient {
        constructor(uri, token) {
          this.uri = `${uri}?token=${token}`;
          this.token = token;
          this.websocket = null;
        }

        async connect() {
          this.websocket = await connect(this.uri);
        }

        async close() {
          if (this.websocket) {
            await this.websocket.close();
          }
        }

        async sendRpc(method, params) {
          const message = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: Date.now()
          };
          await this.websocket.send(JSON.stringify(message));
          const response = await this.websocket.recv();
          return JSON.parse(response);
        }

        async receive(timeout = 10000) {
          try {
            const data = await Promise.race([
              this.websocket.recv(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
              )
            ]);
            return JSON.parse(data);
          } catch (err) {
            if (err.message === 'Timeout') {
              return null;
            }
            throw err;
          }
        }

        async receiveNotification(timeout = 10000) {
          while (true) {
            const msg = await this.receive(timeout);
            if (msg === null) {
              return null;
            }
            if ('id' in msg) {
              continue;
            }
            return msg;
          }
        }
      }

      const client = new WsClient(serverUrl, 'test-token');
      
      try {
        await client.connect();
        
        // 消费欢迎消息
        await client.receive(1000);
        
        const result = await client.sendRpc('send', {
          content: 'Hello',
          type: 'text',
          receiver_did: 'did:wba:awiki.ai:user:k1_test',
          client_msg_id: 'uuid4-string'
        });
        
        expect(result.jsonrpc).toBe('2.0');
        expect(result.method).toBe('send');
        
        await client.close();
        
      } catch (err) {
        await client.close();
        throw err;
      }
    });
  });
});
