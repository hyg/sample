'use strict'

/**
 * 协议常量。所有对端、DHT、STUN 共用的魔术字与长度定义集中于此。
 */
module.exports = {
  VERSION: 1,

  // UDP 报文分类魔术字
  MAGIC: Buffer.from('P2PN'), // 打洞探测包（16 字节固定）
  HS_MAGIC: Buffer.from('P2PH'), // 握手包（192 字节固定）

  HS_LEN: 192,
  PUNCH_LEN: 16,

  // 加密帧分桶长度：所有密文帧长度只能是这几个值之一，隐藏真实长度
  BUCKETS: [64, 256, 1024, 4096],

  // 12 字节明文头（tag4 + counter8）+ 16 字节 GCM tag
  FRAME_OVERHEAD: 28,

  // 内层明文头：type(1) appType(1) chunkIndex(2) chunkCount(2) payloadLen(2) msgId(4)
  INNER_HDR: 12,

  // 单分片最大负载，保证 INNER_HDR + MAX_CHUNK + FRAME_OVERHEAD <= 1024
  MAX_CHUNK: 960,

  // 单条应用消息最大长度
  MAX_MESSAGE: 4 * 1024 * 1024,

  T: {
    DATA: 0x10,
    ACK: 0x11,
    CHAFF: 0x12
  },

  APP: {
    CHAT: 0x01,
    PING: 0x02,
    PONG: 0x03,
    BYE: 0x04
  },

  // DHT 主题（rendezvous point）前缀，最终 infoHash = sha1(prefix + network + epoch)
  TOPIC_PREFIX: 'p2pnet/v1/topic/'
}
