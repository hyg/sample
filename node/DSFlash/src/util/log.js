'use strict'

const LEVELS = { silent: -1, error: 0, warn: 1, info: 2, debug: 3 }

/**
 * 日志统一走 stderr，stdout 留给交互与最终报告。
 * 默认 info 级别只输出元信息（不含消息正文），避免本地落盘泄露内容。
 */
function createLogger (level = 'info') {
  const cur = LEVELS[level] === undefined ? LEVELS.info : LEVELS[level]
  const ts = () => new Date().toISOString().slice(11, 19)
  const mk = (name, lv) => (...args) => {
    if (lv > cur) return
    process.stderr.write(`[${ts()}] ${name} ${args.join(' ')}\n`)
  }
  return {
    level,
    error: mk('ERROR', LEVELS.error),
    warn: mk('WARN ', LEVELS.warn),
    info: mk('INFO ', LEVELS.info),
    debug: mk('DEBUG', LEVELS.debug)
  }
}

module.exports = { createLogger, LEVELS }
