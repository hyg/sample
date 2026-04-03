const { Stage, Graph, Pipeline, Protocol, ProtocolRegistry } = require('./index')

const cryptoStage = new Stage('crypto', ['encrypt', 'decrypt', 'validate'])
  .use('rsa', new Protocol('rsa', '1.0', {
    encrypt: (data, pubKey) => `encrypted:${Buffer.from(data).toString('base64')}`,
    decrypt: (data, privKey) => Buffer.from(data.replace('encrypted:', ''), 'base64').toString(),
    validate: (data) => typeof data === 'string'
  }, ['encrypt', 'decrypt', 'validate']))
  .use('aes', new Protocol('aes', '1.0', {
    encrypt: (data, key) => `aes:${data}`,
    decrypt: (data, key) => data.replace('aes:', ''),
    validate: (data) => typeof data === 'string'
  }, ['encrypt', 'decrypt', 'validate']))
  .default('rsa')

const maskStage = new Stage('mask', ['mask', 'unmask', 'listSensitiveWords'])
  .use('sensitive', new Protocol('sensitive', '1.0', {
    mask: (data) => ({ masked: data.replace(/\d{11}/g, '138****0000'), sensitiveWords: ['手机号'] }),
    unmask: (data, sensitiveWords) => data.masked,
    listSensitiveWords: () => ['手机号', '身份证', '银行卡']
  }, ['mask', 'unmask', 'listSensitiveWords']))

const commStage = new Stage('comm', ['send', 'receive', 'listMessages'])
  .use('mqtt', new Protocol('mqtt', '1.0', {
    send: (data, topic) => ({ channel: 'mqtt', topic, payload: data }),
    receive: (channel, topic) => ({ channel: 'mqtt', topic, payload: 'received' }),
    listMessages: () => [{ channel: 'mqtt', topic: 'alerts', time: '2026-04-03' }]
  }, ['send', 'receive', 'listMessages']))
  .use('molix', new Protocol('molix', '1.0', {
    send: (data, userId) => ({ channel: 'molix', to: userId, content: data }),
    receive: (userId) => ({ channel: 'molix', from: 'user123', content: 'hello' }),
    listMessages: () => [{ channel: 'molix', from: 'user123', time: '2026-04-03' }]
  }, ['send', 'receive', 'listMessages']))
  .use('email', new Protocol('email', '1.0', {
    send: (data, address) => ({ channel: 'email', to: address, subject: '通知', body: data }),
    receive: (address) => ({ channel: 'email', from: 'system@example.com', subject: '通知', body: 'content' }),
    listMessages: () => [{ channel: 'email', from: 'system@example.com', subject: '通知', time: '2026-04-03' }]
  }, ['send', 'receive', 'listMessages']))
  .default('molix')

const graph = new Graph()
  .addStage(cryptoStage)
  .addStage(maskStage)
  .addStage(commStage)
  .connect('crypto', 'mask')
  .connect('mask', 'comm')

const pipeline = new Pipeline(graph)

pipeline.subscribe('stage:enter', ({ stage, data }) => {
  console.log(`[进入环节] ${stage}:`, typeof data === 'object' ? JSON.stringify(data).slice(0, 50) : data)
})

pipeline.subscribe('stage:exit', ({ stage, data, protocol }) => {
  console.log(`[离开环节] ${stage} (protocol: ${protocol}):`, typeof data === 'object' ? JSON.stringify(data).slice(0, 50) : data)
})

pipeline.subscribe('error', ({ stage, error, suggestion }) => {
  console.log(`[错误] ${stage}: ${error}`)
  console.log(`[修复选项]`, suggestion.options)
})

async function test() {
  console.log('=== 测试加密+脱敏+通信管道 ===\n')

  const result = await pipeline.execute('用户手机号13812345678', 'crypto', 'rsa')
  console.log('\n最终结果:', result)

  console.log('\n=== 列出敏感词 ===')
  const sensitiveProto = maskStage.protocols.get('sensitive')
  console.log(await sensitiveProto.invoke('listSensitiveWords'))

  console.log('\n=== 通信子协议列表 ===')
  console.log(commStage.listProtocols())

  console.log('\n=== 图拓扑顺序 ===')
  console.log(graph.topologicalSort())

  console.log('\n=== 搜索模块 ===')
  const registry = new ProtocolRegistry()
  await registry.load('mqtt', async () => ({ desc: 'MQTT messaging', version: '1.0' }))
  await registry.load('email', async () => ({ desc: 'Email notification', version: '1.0' }))
  await registry.load('crypto-rsa', async () => ({ desc: 'RSA encryption', version: '1.0' }))
  console.log('search "MQTT":', registry.search('MQTT'))
  console.log('search "email":', registry.search('email'))
}

test().catch(console.error)
