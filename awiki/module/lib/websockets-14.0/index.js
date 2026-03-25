/**
 * websockets-14.0 库的 Node.js 适配器
 *
 * 对应 Python websockets 库的功能：
 * - websockets.connect() - WebSocket 连接（异步上下文管理器）
 * - WebSocketClientProtocol - WebSocket 客户端协议
 * - send() / recv() - 发送/接收消息
 * - close() - 关闭连接
 * - ConnectionClosed - 连接关闭异常
 *
 * Node.js 替代库：ws
 */

const WebSocket = require('ws');

/**
 * WebSocket 连接关闭异常
 * 
 * 对应 Python: websockets.exceptions.ConnectionClosed
 */
class ConnectionClosed extends Error {
  /**
   * @param {number} code - 关闭状态码
   * @param {string} reason - 关闭原因
   */
  constructor(code, reason) {
    super(`Connection closed: code=${code}, reason=${reason}`);
    this.name = 'ConnectionClosed';
    this.code = code;
    this.reason = reason;
  }
}

/**
 * WebSocket 客户端协议类
 * 
 * 对应 Python: websockets.asyncio.client.ClientConnection
 * 
 * 实现异步上下文管理器协议，支持：
 * - async with connect(...) as websocket:
 * - await websocket.send(data)
 * - data = await websocket.recv()
 * - await websocket.close()
 */
class WebSocketClientProtocol {
  /**
   * @param {WebSocket} ws - ws 库的 WebSocket 实例
   */
  constructor(ws) {
    this.ws = ws;
    this.isOpen = true;
    this.protocol = ws.protocol || null;
    this.messageQueue = [];
    this.messageHandlers = [];
    this.closeCode = 1000;
    this.closeReason = '';
    this._messageHandler = null;
    this._closeHandler = null;
    this._errorHandler = null;

    // 设置消息监听器
    this._messageHandler = (data) => {
      const message = data.toString();
      if (this.messageHandlers.length > 0) {
        const handler = this.messageHandlers.shift();
        handler(message, null);
      } else {
        this.messageQueue.push(message);
      }
    };

    this._closeHandler = (code, reason) => {
      this.isOpen = false;
      this.closeCode = code;
      this.closeReason = reason.toString();
      // 拒绝所有待处理的消息处理器
      while (this.messageHandlers.length > 0) {
        const handler = this.messageHandlers.shift();
        handler(null, new ConnectionClosed(code, reason.toString()));
      }
    };

    this._errorHandler = (err) => {
      // 错误时拒绝所有待处理的消息处理器
      while (this.messageHandlers.length > 0) {
        const handler = this.messageHandlers.shift();
        handler(null, err);
      }
    };

    this.ws.on('message', this._messageHandler);
    this.ws.on('close', this._closeHandler);
    this.ws.on('error', this._errorHandler);
  }

  /**
   * 发送消息
   * 
   * 对应 Python: await websocket.send(data)
   * 
   * @param {string|Buffer} data - 要发送的数据（str 或 bytes）
   * @returns {Promise<void>}
   * @throws {ConnectionClosed} 连接关闭时抛出
   */
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

  /**
   * 接收消息
   * 
   * 对应 Python: data = await websocket.recv()
   * 
   * @returns {Promise<string>} 返回接收到的消息（str）
   * @throws {ConnectionClosed} 连接关闭时抛出
   * @throws {Error} 超时时抛出（timeout=5000ms）
   */
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
      let handler = null;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // 从处理器列表中移除
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
          this.messageHandlers.splice(index, 1);
        }
      };

      handler = (data, err) => {
        cleanup();
        if (err) reject(err);
        else resolve(data);
      };

      // 设置超时
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout'));
      }, 5000);

      this.messageHandlers.push(handler);
    });
  }

  /**
   * 关闭连接
   * 
   * 对应 Python: await websocket.close(code=1000, reason='')
   * 
   * @param {number} code - 关闭状态码（默认 1000 表示正常关闭）
   * @param {string} reason - 关闭原因（可选字符串）
   * @returns {Promise<void>}
   */
  async close(code = 1000, reason = '') {
    if (!this.isOpen) return;
    this.isOpen = false;
    return new Promise((resolve) => {
      // 移除监听器
      if (this._messageHandler) {
        this.ws.removeListener('message', this._messageHandler);
      }
      if (this._closeHandler) {
        this.ws.removeListener('close', this._closeHandler);
      }
      if (this._errorHandler) {
        this.ws.removeListener('error', this._errorHandler);
      }
      this.ws.close(code, reason);
      // 等待连接完全关闭
      this.ws.on('close', () => {
        resolve();
      });
      // 如果已经关闭，立即 resolve
      setTimeout(() => resolve(), 10);
    });
  }

  /**
   * 异步上下文管理器入口
   * 
   * 对应 Python: async with websockets.connect(...) as websocket:
   * 
   * @returns {Promise<WebSocketClientProtocol>}
   */
  async [Symbol.asyncIterator]() {
    return this;
  }

  /**
   * 异步上下文管理器进入
   */
  async [Symbol.for('asyncIterator.enter')]() {
    return this;
  }

  /**
   * 异步上下文管理器退出
   * 
   * @param {Error|null} error - 如果有错误则传入
   * @returns {Promise<void>}
   */
  async [Symbol.for('asyncIterator.exit')](error) {
    await this.close();
  }
}

/**
 * 异步上下文管理器包装器
 * 
 * 用于支持 Python 风格的 async with 语法
 */
class ConnectContextManager {
  /**
   * @param {string} uri - WebSocket URI
   * @param {object} options - 连接选项
   */
  constructor(uri, options = {}) {
    this.uri = uri;
    this.options = options;
    this.websocket = null;
  }

  /**
   * 进入上下文（建立连接）
   * 
   * @returns {Promise<WebSocketClientProtocol>}
   */
  async [Symbol.asyncIterator]() {
    return this.connect();
  }

  /**
   * 连接
   * 
   * @returns {Promise<WebSocketClientProtocol>}
   */
  async connect() {
    if (!this.websocket) {
      this.websocket = await connect(this.uri, this.options);
    }
    return this.websocket;
  }

  /**
   * 异步迭代器协议 - 进入
   */
  async [Symbol.for('asyncIterator.enter')]() {
    return this.connect();
  }

  /**
   * 异步迭代器协议 - 退出
   * 
   * @param {Error|null} error - 如果有错误则传入
   * @returns {Promise<void>}
   */
  async [Symbol.for('asyncIterator.exit')](error) {
    if (this.websocket) {
      await this.websocket.close();
    }
  }
}

/**
 * 创建 WebSocket 连接
 * 
 * 对应 Python: async with websockets.connect(uri, **kwargs) as websocket:
 * 
 * @param {string} uri - WebSocket 服务器地址 (ws:// 或 wss://)
 * @param {object} options - 连接选项
 * @param {boolean} options.ssl - SSL 上下文（可选，用于 wss 连接）
 * @param {object} options.headers - 额外的 HTTP 请求头（可选）
 * @param {number} options.timeout - 连接超时时间（秒）
 * @param {number} options.ping_interval - 心跳间隔（秒）
 * @param {number} options.ping_timeout - 心跳超时时间（秒）
 * @returns {ConnectContextManager} 异步上下文管理器
 * 
 * @example
 * // 使用 async with（推荐）
 * const ctx = connect(uri, options);
 * const ws = await ctx[Symbol.for('asyncIterator.enter')]();
 * try {
 *   await ws.send('Hello');
 *   const data = await ws.recv();
 * } finally {
 *   await ctx[Symbol.for('asyncIterator.exit')]();
 * }
 * 
 * @example
 * // 直接连接（不使用上下文管理器）
 * const ws = await connect(uri, options);
 * await ws.send('Hello');
 * const data = await ws.recv();
 * await ws.close();
 */
async function connect(uri, options = {}) {
  return new Promise((resolve, reject) => {
    // 转换选项
    const wsOptions = {};

    // 处理 headers
    if (options.headers) {
      wsOptions.headers = options.headers;
    }

    // 处理 SSL
    if (options.ssl === true || uri.startsWith('wss://')) {
      wsOptions.rejectUnauthorized = options.ssl !== false;
    }

    // 处理超时
    if (options.timeout) {
      wsOptions.handshakeTimeout = options.timeout * 1000;
    }

    // 创建 WebSocket 连接
    const ws = new WebSocket(uri, wsOptions);

    ws.on('open', () => {
      resolve(new WebSocketClientProtocol(ws));
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

// 导出
module.exports = {
  connect,
  ConnectionClosed,
  WebSocketClientProtocol
};
