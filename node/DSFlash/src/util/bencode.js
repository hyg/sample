'use strict'

/**
 * 最小 bencode 实现（BEP-3）。
 * 解码时所有字符串返回 Buffer（DHT 协议里 info_hash / token / id 都是二进制）。
 */

function encode (value) {
  const out = []
  enc(value, out)
  return Buffer.concat(out)
}

function enc (v, out) {
  if (Buffer.isBuffer(v)) {
    out.push(Buffer.from(v.length + ':'))
    out.push(v)
    return
  }
  if (typeof v === 'string') {
    const b = Buffer.from(v, 'utf8')
    out.push(Buffer.from(b.length + ':'))
    out.push(b)
    return
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) throw new Error('bencode: only integer numbers supported')
    out.push(Buffer.from('i' + v + 'e'))
    return
  }
  if (typeof v === 'boolean') {
    out.push(Buffer.from('i' + (v ? 1 : 0) + 'e'))
    return
  }
  if (Array.isArray(v)) {
    out.push(Buffer.from('l'))
    for (const x of v) enc(x, out)
    out.push(Buffer.from('e'))
    return
  }
  if (v && typeof v === 'object') {
    out.push(Buffer.from('d'))
    const keys = Object.keys(v)
      .filter(k => v[k] !== undefined && v[k] !== null)
      .map(k => [Buffer.from(k, 'utf8'), v[k]])
      .sort((a, b) => Buffer.compare(a[0], b[0]))
    for (const [k, val] of keys) {
      out.push(Buffer.from(k.length + ':'))
      out.push(k)
      enc(val, out)
    }
    out.push(Buffer.from('e'))
    return
  }
  throw new Error('bencode: unsupported type ' + typeof v)
}

function decode (buf) {
  const s = { buf, i: 0 }
  const v = dec(s)
  if (s.i !== buf.length) throw new Error('bencode: trailing data')
  return v
}

function dec (s) {
  if (s.i >= s.buf.length) throw new Error('bencode: unexpected end')
  const c = s.buf[s.i]

  if (c === 0x69) { // 'i'
    const end = s.buf.indexOf(0x65, s.i)
    if (end < 0) throw new Error('bencode: bad int')
    const n = Number(s.buf.toString('ascii', s.i + 1, end))
    if (!Number.isFinite(n)) throw new Error('bencode: bad int')
    s.i = end + 1
    return n
  }

  if (c === 0x6c) { // 'l'
    s.i++
    const arr = []
    while (s.i < s.buf.length && s.buf[s.i] !== 0x65) arr.push(dec(s))
    if (s.i >= s.buf.length) throw new Error('bencode: unterminated list')
    s.i++
    return arr
  }

  if (c === 0x64) { // 'd'
    s.i++
    const obj = {}
    while (s.i < s.buf.length && s.buf[s.i] !== 0x65) {
      const k = dec(s)
      if (!Buffer.isBuffer(k)) throw new Error('bencode: key must be string')
      obj[k.toString('utf8')] = dec(s)
    }
    if (s.i >= s.buf.length) throw new Error('bencode: unterminated dict')
    s.i++
    return obj
  }

  if (c >= 0x30 && c <= 0x39) { // 字符串
    const colon = s.buf.indexOf(0x3a, s.i)
    if (colon < 0) throw new Error('bencode: bad string length')
    const len = Number(s.buf.toString('ascii', s.i, colon))
    if (!Number.isFinite(len) || len < 0) throw new Error('bencode: bad string length')
    const start = colon + 1
    if (start + len > s.buf.length) throw new Error('bencode: string overflow')
    const out = s.buf.subarray(start, start + len)
    s.i = start + len
    return out
  }

  throw new Error('bencode: unexpected byte 0x' + c.toString(16))
}

module.exports = { encode, decode }
