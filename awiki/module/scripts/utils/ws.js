/**
 * scripts/utils/ws.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/ws.py
 * 分析报告：doc/scripts/utils/ws.py/py.md
 * 蒸馏数据：doc/scripts/utils/ws.py/py.json
 *
 * WsClient - WebSocket 客户端封装 (连接 molt-message)
 */

const crypto = require('crypto');
const { WebSocket } = require('ws');

/**
 * WsClient 类 - molt-message WebSocket 客户端
 *
 * 使用 JWT Bearer 认证 (通过查询参数)
 * 支持 JSON-RPC 请求发送和推送通知接收
 */
class WsClient {
  /**
   * 初始化 WebSocket 客户端
   *
   * @param {object} config - SDK 配置 (SDKConfig 实例)
   * @param {object} identity - DID 身份 (需要 jwt_token)
   */
  constructor(config, identity) {
    this._config = config;
    this._identity = identity;
    this._conn = null;
    this._request_id = 0;
    this._reader_task = null;
    this._pending_responses = new Map();
    this._notifications = [];
    this._send_lock = false;
    this._reader_error = null;
    this._resolve_notification = null;
  }

  /**
   * 建立 WebSocket 连接
   *
   * URL 格式：wss://{host}/message/ws?token={jwt_token}
   */
  async connect() {
    if (!this._identity.jwt_token) {
      throw new Error('identity missing jwt_token, call get_jwt_via_wba first');
    }

    // 构建 WebSocket URL
    const base_url = this._config.molt_message_ws_url || this._config.molt_message_url;
    let ws_url;
    if (base_url.startsWith('ws://') || base_url.startsWith('wss://')) {
      ws_url = base_url.replace(/\/$/, '');
    } else {
      ws_url = base_url.replace('http://', 'ws://').replace('https://', 'wss://');
    }
    const url = `${ws_url}/message/ws?token=${this._identity.jwt_token}`;

    // TLS 配置 (简化处理，Node.js ws 库自动处理)
    const ssl_context = url.startsWith('wss://');

    // 创建 WebSocket 连接
    this._conn = new WebSocket(url, {
      rejectUnauthorized: ssl_context === true
    });

    // 等待连接建立
    await new Promise((resolve, reject) => {
      this._conn.on('open', () => {
        resolve();
      });
      this._conn.on('error', (err) => {
        reject(err);
      });
    });

    this._reader_error = null;
    this._reader_task = this._reader_loop();
    console.log(`[WsClient] Connected to ${url.split('?')[0]}`);
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this._reader_task) {
      this._reader_task.cancelled = true;
      try {
        await this._reader_task;
      } catch (e) {
        if (e.name !== 'CancelledError') {
          throw e;
        }
      }
      this._reader_task = null;
    }
    if (this._conn) {
      this._conn.close();
      this._conn = null;
    }
    this._fail_pending(new Error('WebSocket closed'));
  }

  /**
   * 异步上下文管理器入口
   */
  async [Symbol.asyncIterator]() {
    await this.connect();
    return this;
  }

  /**
   * 异步上下文管理器入口 (for await...of)
   */
  async return() {
    await this.close();
  }

  /**
   * 生成下一个请求 ID
   * @private
   */
  _next_id() {
    this._request_id += 1;
    return this._request_id;
  }

  /**
   * 读取循环 - 从连接读取所有消息并解复用
   * @private
   */
  async _reader_loop() {
    if (!this._conn) return;

    try {
      while (!this._reader_task?.cancelled) {
        const raw = await new Promise((resolve, reject) => {
          this._conn.once('message', (data) => {
            resolve(data.toString());
          });
          this._conn.once('error', reject);
        });

        const data = JSON.parse(raw);

        if ('id' in data) {
          const req_id = data.id;
          if (typeof req_id === 'number') {
            const future = this._pending_responses.get(req_id);
            if (future && !future.done) {
              future.resolve(data);
              future.done = true;
              continue;
            }
          }
          console.debug(`Ignoring unmatched WebSocket response id=${data.id}`);
          continue;
        }

        // 通知消息
        this._notifications.push(data);
        if (this._resolve_notification) {
          this._resolve_notification(data);
          this._resolve_notification = null;
        }
      }
    } catch (err) {
      this._reader_error = err;
      console.debug('WebSocket reader stopped', err);
      this._fail_pending(new Error(`WebSocket reader stopped: ${err.message}`));
    }
  }

  /**
   * 失败所有待处理的 JSON-RPC 等待器
   * @private
   */
  _fail_pending(error) {
    for (const future of this._pending_responses.values()) {
      if (!future.done) {
        future.reject(error);
        future.done = true;
      }
    }
    this._pending_responses.clear();
  }

  /**
   * 确保连接可用
   * @private
   */
  _ensure_available() {
    if (!this._conn) {
      throw new Error('WebSocket not connected');
    }
    if (this._reader_error !== null) {
      throw new Error(`WebSocket reader failed: ${this._reader_error.message}`);
    }
    return this._conn;
  }

  /**
   * 发送 JSON-RPC 请求并等待响应
   *
   * @param {string} method - RPC 方法名
   * @param {object|null} [params=null] - 方法参数
   * @returns {Promise<object>} JSON-RPC result 字段内容
   * @throws {Error} 未连接或收到错误响应
   */
  async send_rpc(method, params = null) {
    const conn = this._ensure_available();

    const req_id = this._next_id();
    const request = {
      jsonrpc: '2.0',
      method: method,
      id: req_id,
    };
    if (params) {
      request.params = params;
    }

    // 创建 future
    const future = {
      done: false,
      resolve: null,
      reject: null,
      promise: null
    };
    future.promise = new Promise((resolve, reject) => {
      future.resolve = resolve;
      future.reject = reject;
    });

    this._pending_responses.set(req_id, future);

    try {
      // 发送锁
      while (this._send_lock) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      this._send_lock = true;
      conn.send(JSON.stringify(request));
      this._send_lock = false;

      const data = await future.promise;

      if ('error' in data && data.error) {
        const error = data.error;
        throw new Error(`JSON-RPC error ${error.code}: ${error.message}`);
      }
      return data.result || {};
    } finally {
      this._pending_responses.delete(req_id);
    }
  }

  /**
   * 发送消息的便捷方法
   *
   * sender_did 由服务器自动注入
   * client_msg_id 自动生成 (uuid4) 用于幂等投递
   *
   * @param {string} content - 消息内容
   * @param {string|null} [receiver_did=null] - 接收者 DID
   * @param {string|null} [receiver_id=null] - 接收者 ID
   * @param {string|null} [group_did=null] - 群组 DID
   * @param {string|null} [group_id=null] - 群组 ID
   * @param {string} [msg_type='text'] - 消息类型
   * @param {string|null} [client_msg_id=null] - 客户端消息 ID (自动生成 uuid4)
   * @param {string|null} [title=null] - 消息标题
   * @returns {Promise<object>} 消息响应 dict
   */
  async send_message(
    content,
    {
      receiver_did = null,
      receiver_id = null,
      group_did = null,
      group_id = null,
      msg_type = 'text',
      client_msg_id = null,
      title = null
    } = {}
  ) {
    if (client_msg_id === null) {
      client_msg_id = crypto.randomUUID();
    }

    const params = {
      content: content,
      type: msg_type,
      client_msg_id: client_msg_id,
    };
    if (receiver_did) params.receiver_did = receiver_did;
    if (receiver_id) params.receiver_id = receiver_id;
    if (group_did) params.group_did = group_did;
    if (group_id) params.group_id = group_id;
    if (title !== null) params.title = title;

    return this.send_rpc('send', params);
  }

  /**
   * 发送应用层心跳并等待 pong
   *
   * @returns {Promise<boolean>} 是否收到 pong
   */
  async ping() {
    this._ensure_available();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this._conn.removeListener('pong', onPong);
        resolve(false);
      }, 10000);

      const onPong = () => {
        clearTimeout(timeout);
        resolve(true);
      };

      this._conn.once('pong', onPong);
      this._conn.ping();
    });
  }

  /**
   * 发送应用层 pong 响应
   */
  async send_pong() {
    const conn = this._ensure_available();
    while (this._send_lock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this._send_lock = true;
    conn.send(JSON.stringify({ jsonrpc: '2.0', method: 'pong' }));
    this._send_lock = false;
  }

  /**
   * 接收单个消息 (请求响应或推送通知)
   *
   * @param {number} [timeout=10.0] - 超时时间 (秒)
   * @returns {Promise<object|null>} JSON 消息 dict，超时时返回 null
   */
  async receive(timeout = 10.0) {
    this._ensure_available();

    // 检查是否已有通知
    if (this._notifications.length > 0) {
      return this._notifications.shift();
    }

    // 等待新通知
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._resolve_notification = null;
        resolve(null);
      }, timeout * 1000);

      this._resolve_notification = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
    });
  }

  /**
   * 接收单个推送通知 (跳过请求响应)
   *
   * 通知特征：无 id 字段
   *
   * @param {number} [timeout=10.0] - 超时时间 (秒)
   * @returns {Promise<object|null>} JSON-RPC Notification dict，超时时返回 null
   */
  async receive_notification(timeout = 10.0) {
    return this.receive(timeout);
  }
}

/**
 * 创建 WebSocket 客户端工厂函数
 *
 * @param {object} config - SDK 配置
 * @param {object} identity - DID 身份
 * @returns {WsClient} WebSocket 客户端实例
 */
function createWebSocketClient(config, identity) {
  return new WsClient(config, identity);
}

/**
 * 连接到 WebSocket 服务器 (便捷函数)
 *
 * @param {object} config - SDK 配置
 * @param {object} identity - DID 身份
 * @returns {Promise<WsClient>} WebSocket 客户端实例
 */
async function connectToWs(config, identity) {
  const client = new WsClient(config, identity);
  await client.connect();
  return client;
}

module.exports = {
  WsClient,
  createWebSocketClient,
  connectToWs
};
