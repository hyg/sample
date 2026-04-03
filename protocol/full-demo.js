const { Semver, KeyPair, CodeSigner, ConfigLoader, HotReloader, Pipeline, Graph, Stage, Protocol } = require('./index')

async function demo() {
  console.log('=== 1. 版本兼容性 ===')
  console.log('compare 1.2.3 vs 1.2.4:', Semver.compare('1.2.3', '1.2.4'))
  console.log('compatible 2.0.0 vs 2.1.0:', Semver.compatible('2.0.0', '2.1.0'))
  console.log('satisfies 1.5.0 range 1.0.0-2.0.0:', Semver.satisfies('1.5.0', '1.0.0-2.0.0'))

  console.log('\n=== 2. 代码签名 ===')
  const { publicKey, privateKey } = KeyPair.generate()
  const code = 'module.exports = { mask: d => d }'
  const signer = new CodeSigner(privateKey)
  const { hash, signature } = signer.sign(code)
  console.log('哈希:', hash.substring(0, 32) + '...')
  console.log('签名验证:', CodeSigner.verify(code, signature, publicKey))

  console.log('\n=== 3. 配置即代码 ===')
  const config = {
    stages: [
      { name: 'crypto', interfaceDef: ['encrypt', 'decrypt'], protocols: { rsa: new Protocol('rsa', '1.0', { encrypt: d => 'enc:' + d }) }, default: 'rsa' },
      { name: 'mask', interfaceDef: ['mask'], protocols: { sensitive: new Protocol('sensitive', '1.0', { mask: d => 'mask:' + d }) }, default: 'sensitive' }
    ],
    edges: [
      { from: 'crypto', to: 'mask' }
    ]
  }
  
  const loadedGraph = ConfigLoader.loadConfig(JSON.stringify(config))
  console.log('从JSON加载图成功, stages:', Array.from(loadedGraph.stages.keys()))
  console.log('拓扑顺序:', loadedGraph.topologicalSort())
  console.log('导出为JSON:', ConfigLoader.toJSON(loadedGraph).substring(0, 100) + '...')

  console.log('\n=== 4. 热更新 ===')
  const graph = new Graph()
  const cryptoStage = new Stage('crypto', ['encrypt']).use('aes', new Protocol('aes', '1.0', { encrypt: d => 'v1:' + d }))
  graph.addStage(cryptoStage)
  
  const pipeline = new Pipeline(graph)
  const reloader = new HotReloader(pipeline)
  
  await pipeline.execute('test', 'crypto')
  console.log('更新前结果: v1:test')
  
  reloader.reload('crypto', new Protocol('aes', '2.0', { encrypt: d => 'v2:' + d }))
  await pipeline.execute('test', 'crypto')
  console.log('更新后结果: v2:test')
  
  console.log('版本历史:', JSON.stringify(reloader.getVersionHistory()))

  console.log('\n=== 5. 沙箱隔离 ===')
  const Sandbox = require('./index').Sandbox
  const sandbox = new Sandbox(100)
  const evilCode = 'module.exports = { mask: (d) => { while(true){} } }'
  try {
    sandbox.run(evilCode)
  } catch (e) {
    console.log('恶意代码被超时拦截:', e.message)
  }
  console.log('沙箱演示完成 (需 npm install vm2 生效)')
}

demo().catch(console.error)
