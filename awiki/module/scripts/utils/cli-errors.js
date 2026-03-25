/**
 * utils/cli_errors.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/cli_errors.py
 * 分析报告：doc/scripts/utils/cli_errors.py/py.md
 * 蒸馏数据：doc/scripts/utils/cli_errors.py/py.json
 *
 * CLI 错误处理工具
 */

const rpcModule = require('./rpc.js');

const _MAX_ERROR_LENGTH = 240;

/**
 * 规范化消息：折叠空白并修剪过长的消息
 *
 * @param {string} message - 原始消息
 * @returns {string} 规范化后的消息
 */
function _normalize_message(message) {
  const normalized = message.split(/\s+/).join(' ').trim();
  if (normalized.length <= _MAX_ERROR_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, _MAX_ERROR_LENGTH - 1).trimEnd()}…`;
}

/**
 * 从 payload 中提取人类可读的消息
 *
 * @param {any} payload - 错误 payload
 * @returns {string|null} 提取的消息
 */
function _extract_message(payload) {
  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  // 尝试常见键
  for (const key of ['message', 'detail', 'error', 'reason', 'msg']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    const nested = _extract_message(value);
    if (nested) {
      return nested;
    }
  }

  // 递归查找所有值
  for (const value of Object.values(payload)) {
    const nested = _extract_message(value);
    if (nested) {
      return nested;
    }
  }

  return null;
}

/**
 * 格式化 HTTP 状态错误
 *
 * @param {Error} exc - HTTP 错误
 * @returns {string} 格式化的错误消息
 */
function _format_http_status_error(exc) {
  const response = exc.response;
  if (!response) {
    return _normalize_message(exc.message) || 'HTTP request failed';
  }

  let detail = null;
  try {
    if (typeof response.json === 'function') {
      const jsonData = response.json();
      detail = _extract_message(jsonData);
    }
  } catch (e) {
    // JSON 解析失败
    if (response.text && typeof response.text === 'string') {
      detail = response.text.trim();
    }
  }

  if (detail) {
    return _normalize_message(detail);
  }
  return `HTTP ${response.status_code || response.statusCode || 'unknown'}`;
}

/**
 * 将异常格式化为简短的 CLI 友好错误消息
 *
 * @param {Error} exc - 异常
 * @returns {string} 格式化的错误消息
 */
function format_cli_error(exc) {
  if (exc instanceof rpcModule.JsonRpcError) {
    return _normalize_message(exc.message) || 'Request failed';
  }

  // 检查是否是 HTTP 状态错误
  if (exc.constructor.name === 'HTTPStatusError' || exc._isHttpStatusError) {
    return _format_http_status_error(exc);
  }

  // 检查是否是网络请求错误
  if (exc.constructor.name === 'RequestError' || exc._isRequestError) {
    return _normalize_message(exc.message) || 'Network request failed';
  }

  const message = _normalize_message(exc.message);
  if (message) {
    return message;
  }
  return exc.constructor.name;
}

/**
 * 记录异常并以简洁的终端消息退出
 *
 * @param {Object} options - 选项
 * @param {Error} options.exc - 异常
 * @param {Object} options.logger - 日志记录器
 * @param {string} options.context - 上下文描述
 * @param {number} [options.exit_code=1] - 退出码
 * @param {boolean} [options.log_traceback=true] - 是否记录堆栈跟踪
 * @throws {SystemExit} 抛出退出异常
 */
function exit_with_cli_error({
  exc,
  logger,
  context,
  exit_code = 1,
  log_traceback = true
}) {
  const message = format_cli_error(exc);

  if (log_traceback) {
    if (typeof logger.error === 'function') {
      logger.error(`${context}: ${message}`);
      if (exc.stack) {
        logger.debug(exc.stack);
      }
    }
  } else {
    if (typeof logger.warning === 'function') {
      logger.warning(`${context}: ${message}`);
    }
  }

  console.error(`Error: ${message}`);

  // 抛出错误以退出
  const exitError = new Error(message);
  exitError.code = exit_code;
  exitError._isSystemExit = true;
  throw exitError;
}

module.exports = {
  format_cli_error,
  exit_with_cli_error,
  _normalize_message,
  _extract_message,
  _format_http_status_error
};
