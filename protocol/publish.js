const crypto = require('crypto')

class EmailExchange {
  constructor() {
    this.inbox = new Map()
  }

  async send(to, subject, body) {
    console.log(`[Email] 发送给 ${to}: ${subject}`)
    if (!this.inbox.has(to)) this.inbox.set(to, [])
    this.inbox.get(to).push({ subject, body, time: new Date() })
    return { status: 'sent', to, subject }
  }

  async receive(user) {
    return this.inbox.get(user) || []
  }
}

class ProtocolPublisher {
  constructor(email) {
    this.email = email
    this.published = new Map()
  }

  async publish(name, version, code) {
    const normalizedCode = code.replace(/\s+/g, ' ').trim()
    const hash = crypto.createHash('sha256').update(normalizedCode).digest('hex')
    const signature = crypto.createSign('RSA-SHA256')
    
    const meta = {
      name,
      version,
      hash,
      hashAlgo: 'sha256',
      publishedAt: new Date().toISOString(),
      codeSize: code.length,
      checksum: hash.substring(0, 16)
    }

    this.published.set(name, meta)
    console.log(`[发布] ${name}@${version}, 哈希: ${meta.checksum}...`)
    return meta
  }

  async notify(meta, recipients) {
    const body = JSON.stringify(meta, null, 2)
    for (const recipient of recipients) {
      await this.email.send(recipient, `协议元数据: ${meta.name}@${meta.version}`, body)
    }
    return { notified: recipients.length }
  }
}

class ProtocolInstaller {
  constructor(email, httpBaseUrl) {
    this.email = email
    this.httpBaseUrl = httpBaseUrl
    this.downloaded = new Map()
  }

  async checkInbox(user) {
    const messages = await this.email.receive(user)
    return messages.filter(m => m.subject.startsWith('协议元数据:'))
  }

  async fetchAndVerify(meta) {
    const url = `${this.httpBaseUrl}/${meta.name}.js`
    console.log(`[下载] 从 ${url} 下载...`)
    
    const code = `module.exports = { 
    mask: (data) => ({ masked: data.replace(/\\d+/g, 'NUM'), table: {} }),
    unmask: (data, table) => data.masked
  }`
    
    const normalizedCode = code.replace(/\s+/g, ' ').trim()
    const actualHash = crypto.createHash('sha256').update(normalizedCode).digest('hex')
    
    if (actualHash !== meta.hash) {
      throw new Error(`哈希校验失败! 期望: ${meta.hash}, 实际: ${actualHash}`)
    }
    
    console.log(`[验证] 哈希校验通过: ${meta.checksum}...`)
    this.downloaded.set(meta.name, { meta, code })
    return { code, verified: true }
  }

  getDownloaded() {
    return Array.from(this.downloaded.keys())
  }
}

async function demo() {
  const email = new EmailExchange()
  const publisher = new ProtocolPublisher(email)
  const installer = new ProtocolInstaller(email, 'http://zhang-server:8080/protocols')

  const code = `module.exports = { 
    mask: (data) => ({ masked: data.replace(/\\d+/g, 'NUM'), table: {} }),
    unmask: (data, table) => data.masked
  }`

  console.log('=== 张三发布协议 ===')
  const meta = await publisher.publish('entity-mask', '1.0.1', code)
  await publisher.notify(meta, ['李四', '王五'])

  console.log('\n=== 李四收信获取元数据 ===')
  const messages = await installer.checkInbox('李四')
  console.log(`收到 ${messages.length} 封元数据邮件`)
  const receivedMeta = JSON.parse(messages[0].body)
  console.log('元数据:', receivedMeta)

  console.log('\n=== 李四下载并验证 ===')
  const result = await installer.fetchAndVerify(receivedMeta)
  console.log('下载成功, 已验证:', result.verified)
}

demo().catch(console.error)
