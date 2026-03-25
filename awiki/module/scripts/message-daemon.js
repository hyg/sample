/**
 * Local message transport daemon over localhost TCP.
 *
 * Node.js implementation based on Python version:
 * python/scripts/message_daemon.py
 *
 * [INPUT]: Node.js stream server/client, settings.json transport config,
 *          one async message RPC handler callable
 * [OUTPUT]: LocalMessageDaemon server plus helpers for CLI tools to call
 *           or probe the localhost daemon with caller credential context
 * [POS]: Local transport layer for WebSocket receive mode, ensuring all
 *        message CLI traffic goes through one local daemon that owns
 *        the single remote WSS link.
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');

// 常量定义
const DEFAULT_LOCAL_DAEMON_HOST = '127.0.0.1';
const DEFAULT_LOCAL_DAEMON_PORT = 18790;
const _REQUEST_TIMEOUT_SECONDS = 20.0;

/**
 * LocalDaemonSettings 类
 * 解析后的本地守护进程连接设置
 *
 * Python 原型:
 * @dataclass(frozen=True, slots=True)
 * class LocalDaemonSettings:
 *     host: str = DEFAULT_LOCAL_DAEMON_HOST
 *     port: int = DEFAULT_LOCAL_DAEMON_PORT
 *     token: str = ""
 */
class LocalDaemonSettings {
  /**
   * 创建本地守护进程设置实例
   *
   * @param {Object} options - 配置选项
   * @param {string} options.host - 守护进程主机地址
   * @param {number} options.port - 守护进程端口
   * @param {string} options.token - 认证令牌
   */
  constructor({
    host = DEFAULT_LOCAL_DAEMON_HOST,
    port = DEFAULT_LOCAL_DAEMON_PORT,
    token = ''
  } = {}) {
    this.host = host;
    this.port = port;
    this.token = token;

    // 冻结对象，模拟 Python 的 frozen=True
    Object.freeze(this);
  }
}

/**
 * 从 settings.json 加载本地守护进程设置
 *
 * @param {SDKConfig} [config] - SDK 配置，可选
 * @returns {LocalDaemonSettings} 本地守护进程设置
 */
function load_local_daemon_settings(config) {
  const resolved = config || SDKConfig.load();
  const settingsPath = path.join(resolved.data_dir, 'config', 'settings.json');

  let data = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      data = JSON.parse(content);
    } catch (e) {
      // JSON 解析失败或文件读取失败，使用空对象
      data = {};
    }
  }

  const transport = data.message_transport || {};
  let host = transport.local_daemon_host || DEFAULT_LOCAL_DAEMON_HOST;
  const portRaw = transport.local_daemon_port || DEFAULT_LOCAL_DAEMON_PORT;
  const token = transport.local_daemon_token || '';

  // 转换端口为整数
  let port;
  try {
    port = parseInt(portRaw, 10);
    if (isNaN(port)) {
      port = DEFAULT_LOCAL_DAEMON_PORT;
    }
  } catch (e) {
    port = DEFAULT_LOCAL_DAEMON_PORT;
  }

  // 验证主机
  if (typeof host !== 'string' || !host) {
    host = DEFAULT_LOCAL_DAEMON_HOST;
  }

  // 验证令牌
  const validatedToken = typeof token === 'string' ? token : '';

  return new LocalDaemonSettings({ host, port, token: validatedToken });
}

/**
 * 调用本地守护进程的一个 RPC 方法并返回结果
 *
 * @param {string} method - RPC 方法名
 * @param {Object} [params] - RPC 参数
 * @param {Object} options - 选项
 * @param {string} [options.credential_name='default'] - 凭证名称
 * @param {SDKConfig} [options.config] - SDK 配置
 * @param {number} [options.timeout=_REQUEST_TIMEOUT_SECONDS] - 超时时间（秒）
 * @returns {Promise<Object>} RPC 结果
 * @throws {Error} 当守护进程不可用或请求失败时
 */
async function call_local_daemon(
  method,
  params = null,
  { credential_name = 'default', config = null, timeout = _REQUEST_TIMEOUT_SECONDS } = {}
) {
  const settings = load_local_daemon_settings(config);

  if (!settings.token) {
    throw new Error(
      'Local message daemon token is missing; run `node scripts/setup-realtime.js --receive-mode websocket` first'
    );
  }

  /**
   * 执行单次请求
   * @returns {Promise<Object>}
   */
  const roundTrip = async () => {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(
        { host: settings.host, port: settings.port },
        async () => {
          try {
            const payload = {
              token: settings.token,
              method: method,
              params: params || {},
              credential_name: credential_name
            };
            const jsonData = JSON.stringify(payload, null, 0) + '\n';
            client.write(Buffer.from(jsonData, 'utf-8'));

            // 读取响应
            const chunks = [];
            client.on('data', (chunk) => {
              chunks.push(chunk);
            });

            client.on('end', () => {
              try {
                const line = Buffer.concat(chunks).toString('utf-8').trim();
                if (!line) {
                  reject(new Error('Local message daemon closed the connection unexpectedly'));
                  return;
                }
                const response = JSON.parse(line);
                if (!response.ok) {
                  const error = response.error || {};
                  reject(new Error(error.message || 'Local message daemon request failed'));
                  return;
                }
                const result = response.result || {};
                resolve(typeof result === 'object' ? result : { result });
              } catch (e) {
                reject(e);
              }
            });
          } catch (e) {
            reject(e);
          }
        }
      );

      client.on('error', (err) => {
        reject(err);
      });

      // 设置超时
      if (timeout > 0) {
        client.setTimeout(timeout * 1000, () => {
          client.destroy();
          reject(new Error('Request timeout'));
        });
      }
    });
  };

  try {
    // 使用 Promise 实现超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          'Local message daemon request timed out while waiting for a credential WebSocket session'
        ));
      }, timeout * 1000);
    });

    return await Promise.race([roundTrip(), timeoutPromise]);
  } catch (err) {
    if (err.message === 'Request timeout') {
      throw err;
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ENOENT') {
      throw new Error(
        'Local message daemon is unavailable; make sure `ws_listener` is running in websocket mode'
      );
    }
    throw err;
  }
}

/**
 * 检查本地守护进程 TCP 端口是否可达
 *
 * Python 原型:
 * def is_local_daemon_available(config: SDKConfig | None = None) -> bool:
 *
 * @param {SDKConfig} [config] - SDK 配置
 * @returns {Promise<boolean>} 如果可达返回 true
 */
async function is_local_daemon_available(config) {
  const settings = load_local_daemon_settings(config);

  return new Promise((resolve) => {
    const socket = net.createConnection(
      { host: settings.host, port: settings.port, timeout: 200 },
      () => {
        socket.destroy();
        resolve(true);
      }
    );

    socket.on('error', () => {
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * LocalMessageDaemon 类
 * 本地 TCP 守护进程，将消息 RPC 调用代理到一个异步处理器
 *
 * Python 原型:
 * class LocalMessageDaemon:
 *     """Local TCP daemon that proxies message RPC calls to one async handler."""
 */
class LocalMessageDaemon {
  /**
   * 创建本地消息守护进程实例
   *
   * @param {LocalDaemonSettings} settings - 守护进程设置
   * @param {Function} handler - 异步处理器，签名：(method, params, credential_name) => Promise<Object>
   */
  constructor(settings, handler) {
    this._settings = settings;
    this._handler = handler;
    this._server = null;
  }

  /**
   * 启动本地守护进程服务器
   * @returns {Promise<void>}
   */
  async start() {
    this._server = await new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        this._handleClient(socket);
      });

      server.on('error', (err) => {
        reject(err);
      });

      server.listen({
        host: this._settings.host,
        port: this._settings.port,
        reuseAddress: true
      }, () => {
        resolve(server);
      });
    });
  }

  /**
   * 停止本地守护进程服务器
   * @returns {Promise<void>}
   */
  async close() {
    if (!this._server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this._server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        this._server = null;
        resolve();
      });
    });
  }

  /**
   * 处理单个客户端连接
   *
   * @param {net.Socket} socket - 客户端 socket
   * @private
   */
  async _handleClient(socket) {
    const timeoutMs = _REQUEST_TIMEOUT_SECONDS * 1000;
    let dataReceived = '';

    // 设置超时
    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('data', async (chunk) => {
      dataReceived += chunk.toString('utf-8');

      // 查找换行符表示消息结束
      const newlineIndex = dataReceived.indexOf('\n');
      if (newlineIndex === -1) {
        return; // 等待更多数据
      }

      const line = dataReceived.substring(0, newlineIndex);
      socket.setTimeout(0); // 取消超时

      try {
        const request = JSON.parse(line);
      } catch (e) {
        await this._writeResponse(socket, {
          ok: false,
          error: { message: 'Invalid local daemon JSON request' }
        });
        socket.end();
        return;
      }

      const request = JSON.parse(line);

      if (request.token !== this._settings.token) {
        await this._writeResponse(socket, {
          ok: false,
          error: { message: 'Unauthorized local daemon request' }
        });
        socket.end();
        return;
      }

      const method = request.method;
      const params = request.params || {};
      let credential_name = request.credential_name;

      // 验证 method
      if (typeof method !== 'string' || !method) {
        await this._writeResponse(socket, {
          ok: false,
          error: { message: 'Local daemon request missing method' }
        });
        socket.end();
        return;
      }

      // 验证 params
      if (typeof params !== 'object' || params === null || Array.isArray(params)) {
        await this._writeResponse(socket, {
          ok: false,
          error: { message: 'Local daemon params must be an object' }
        });
        socket.end();
        return;
      }

      // 验证 credential_name
      if (typeof credential_name !== 'string' || !credential_name) {
        credential_name = 'default';
      }

      try {
        const result = await this._handler(method, params, credential_name);
        await this._writeResponse(socket, {
          ok: true,
          result: result || {}
        });
      } catch (err) {
        await this._writeResponse(socket, {
          ok: false,
          error: { message: err.message || String(err) }
        });
      } finally {
        socket.end();
      }
    });

    socket.on('error', () => {
      socket.destroy();
    });
  }

  /**
   * 写入响应到客户端
   *
   * @param {net.Socket} socket - 客户端 socket
   * @param {Object} response - 响应对象
   * @param {boolean} response.ok - 是否成功
   * @param {Object} [response.result] - 成功时的结果
   * @param {Object} [response.error] - 失败时的错误
   * @returns {Promise<void>}
   * @private
   */
  async _writeResponse(socket, { ok, result = null, error = null }) {
    const payload = { ok };
    if (ok) {
      payload.result = result || {};
    } else {
      payload.error = error || { message: 'Unknown local daemon error' };
    }

    const jsonData = JSON.stringify(payload, null, 0) + '\n';

    return new Promise((resolve, reject) => {
      socket.write(Buffer.from(jsonData, 'utf-8'), (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

module.exports = {
  DEFAULT_LOCAL_DAEMON_HOST,
  DEFAULT_LOCAL_DAEMON_PORT,
  LocalDaemonSettings,
  LocalMessageDaemon,
  call_local_daemon,
  is_local_daemon_available,
  load_local_daemon_settings
};
