const { Stage, Graph, Pipeline, Protocol, ProtocolRegistry } = require('./index')

const registry = new ProtocolRegistry()

async function zhangDevelopsProtocol() {
  const newProtocol = new Protocol('entity-mask', '1.0', {
    mask: (data) => {
      const persons = ['张三', '李四', '王五']
      const locations = ['北京', '上海', '深圳']
      const orgs = ['阿里巴巴', '腾讯', '华为']
      const brands = ['华为', '小米', '苹果']
      
      let result = data
      for (const p of persons) result = result.replaceAll(p, '<PERSON>')
      for (const l of locations) result = result.replaceAll(l, '<LOCATION>')
      for (const o of orgs) result = result.replaceAll(o, '<ORG>')
      for (const b of brands) result = result.replaceAll(b, '<BRAND>')
      
      result = result.replaceAll(/\d{4}-\d{2}-\d{2}/g, 'DATE基准+偏移')
      result = result.replaceAll(/¥\d+/g, '金额基准*倍数')
      result = result.replaceAll(/\d+个?/g, '数量基准+偏移')
      
      return { masked: result, replacementTable: { persons, locations, orgs, brands } }
    },
    unmask: (data, table) => {
      let result = data.masked
      result = result.replaceAll('<PERSON>', table.persons[0])
      result = result.replaceAll('<LOCATION>', table.locations[0])
      result = result.replaceAll('<ORG>', table.orgs[0])
      result = result.replaceAll('<BRAND>', table.brands[0])
      return result
    },
    validate: (data) => typeof data === 'string'
  }, ['mask', 'unmask', 'validate'])

  await registry.load('entity-mask', async () => newProtocol)
  
  console.log('=== 张三开发了新子协议 ===')
  console.log('名称:', newProtocol.name)
  console.log('版本:', newProtocol.version)
  console.log('接口:', newProtocol.interfaceDef)
  
  return {
    name: 'entity-mask',
    version: '1.0',
    desc: '自动识别人名、地名、企业名、品牌商标；日期金额用基准替换',
    author: '张三',
    replacementTableMembers: ['李四', '王五', '财务组'],
    schema: { mask: 'data→{masked, replacementTable}', unmask: '(data, table)→original' }
  }
}

async function distributeToLiSi(protocolInfo) {
  console.log('\n=== 分发给李四 ===')
  console.log('协议信息:', JSON.stringify(protocolInfo, null, 2))
  
  const liSiStage = new Stage('mask', ['mask', 'unmask', 'validate'])
  
  const protocol = registry.get(protocolInfo.name)
  liSiStage.use('entity-mask', protocol).default('entity-mask')
  
  console.log('\n李四加载协议成功，可使用方法:')
  console.log('- mask(data): 脱敏')
  console.log('- unmask(data, table): 还原')
}

async function testProtocol() {
  const protocolInfo = await zhangDevelopsProtocol()
  await distributeToLiSi(protocolInfo)
  
  console.log('\n=== 李四测试协议 ===')
  const stage = new Stage('mask', ['mask', 'unmask', 'validate'])
  const protocol = registry.get('entity-mask')
  stage.use('entity-mask', protocol)
  
  const testData = '张三在北京的阿里巴巴购买了5个华为手机，总价¥8000，时间是2024-01-15'
  const masked = await protocol.invoke('mask', testData)
  console.log('原始:', testData)
  console.log('脱敏:', masked.masked)
  console.log('替换表:', masked.replacementTable)
  
  const restored = await protocol.invoke('unmask', masked, masked.replacementTable)
  console.log('还原:', restored)
}

testProtocol().catch(console.error)
