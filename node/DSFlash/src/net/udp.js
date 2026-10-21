'use strict'

const dgram = require('dgram')
const { EventEmitter } = require('events')
const { MAGIC, HS_MAGIC } = require('../protocol')
const bencode = require('../util/bencode')

/**
 * 单一 UDP 端口承载全部流量：
 *   - DHT（KRPC，bencode 字典，首字节 'd'）
 *   - STUN（响应带 magic cookie 0x2112A442）
 *   - 打洞探测（'P2PN'，16 字节）
 *   - 握手（'P2PH'，192 字节）
 *   - 加密数据帧（其余）
 *
 * 为什么必须共用一个 socket：NAT 映射是绑定到 (内部 ip:port) 的。
 * 公布出去的端口必须是真正收发数据的那个端口，否则打洞必失败。
 */
class UDPSocket extends EventEmitter {
  constructor (opts = {}) {
    super()
    this.sock = dgram.createSocket({
      type: 'udp4',
      recvBufferSize: 1 << 20,
      sendBufferSize: 1 << 20
    })
    this.port = 0
    this.sock.on('message', (buf, rinfo) => this._dispatch(buf, rinfo))
    this.sock.on('error', (err) => this.emit('error', err))
  }

  bind (port = 0, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      const onErr = (err) => { this.sock.removeListener('listening', onOk); reject(err) }
      const onOk = () => {
        this.sock.removeListener('error', onErr)
        this.port = this.sock.address().port
        resolve(this.port)
      }
      this.sock.once('error', onErr)
      this.sock.once('listening', onOk)
      this.sock.bind(port, host)
    })
  }

  send (buf, host, port) {
    try {
      this.sock.send(buf, 0, buf.length, port, host, () => {})
    } catch (e) { /* 目标不可达时静默丢弃，UDP 语义如此 */ }
  }

  close () {
    try { this.sock.close() } catch (e) { /* ignore */ }
  }

  _dispatch (buf, rinfo) {
    // 1) STUN
    if (buf.length >= 20 && buf.readUInt32BE(4) === 0x2112a442) {
      return this.emit('stun', buf, rinfo)
    }
    // 2) 打洞
    if (buf.length === 16 && buf.subarray(0, 4).equals(MAGIC)) {
      return this.emit('punch', buf, rinfo)
    }
    // 3) 握手
    if (buf.length === 192 && buf.subarray(0, 4).equals(HS_MAGIC)) {
      return this.emit('handshake', buf, rinfo)
    }
    // 4) KRPC
    if (buf.length >= 3 && buf[0] === 0x64) {
      let msg = null
      try { msg = bencode.decode(buf) } catch (e) { msg = null }
      if (msg && typeof msg === 'object' && !Buffer.isBuffer(msg) && Array.isArray(msg) === false &&
          msg.y && msg.t) {
        return this.emit('krpc', msg, rinfo)
      }
    }
    // 5) 加密帧
    this.emit('frame', buf, rinfo)
  }
}

module.exports = { UDPSocket }
