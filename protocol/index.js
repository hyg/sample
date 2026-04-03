const crypto = require('crypto')

class Semver {
  static compare(a, b) {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1
      if (pa[i] < pb[i]) return -1
    }
    return 0
  }

  static compatible(current, required) {
    const [cMajor] = current.split('.')
    const [rMajor] = required.split('.')
    return cMajor === rMajor
  }

  static satisfies(version, range) {
    const [min, max] = range.split('-')
    if (min && this.compare(version, min) < 0) return false
    if (max && this.compare(version, max) > 0) return false
    return true
  }
}

class KeyPair {
  static generate() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    return {
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
    }
  }
}

class CodeSigner {
  constructor(privateKey) {
    this.privateKey = privateKey
  }

  sign(code) {
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(hash)
    return { hash, signature: sign.sign(this.privateKey) }
  }

  static verify(code, signature, publicKey) {
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(hash)
    return verify.verify(publicKey, signature)
  }
}

class Sandbox {
  constructor(timeout = 1000) {
    this.timeout = timeout
  }

  run(code, exports) {
    try {
      const vm = new (require('vm').Script)(code)
      return vm.runInNewContext({ exports: {} })
    } catch (e) {
      if (e.message.includes('Script execution')) throw new Error('超时')
      throw e
    }
  }

  isolate(protocol) {
    const handler = {
      get(obj, prop) {
        if (prop === 'impl') return new Proxy(obj.impl, handler)
        return obj[prop]
      }
    }
    return new Proxy(protocol, handler)
  }
}

class ConfigLoader {
  static loadConfig(json) {
    const config = typeof json === 'string' ? JSON.parse(json) : json
    
    const graph = new Graph()
    
    for (const stage of config.stages || []) {
      const s = new Stage(stage.name, stage.interfaceDef)
      for (const [name, proto] of Object.entries(stage.protocols || {})) {
        s.use(name, proto)
      }
      if (stage.default) s.default(stage.default)
      graph.addStage(s)
    }

    for (const edge of config.edges || []) {
      graph.connect(edge.from, edge.to)
    }

    return graph
  }

  static toJSON(graph) {
    const stages = []
    for (const [name, stage] of graph.stages) {
      const protocols = {}
      for (const [pname, proto] of stage.protocols) {
        protocols[pname] = proto
      }
      stages.push({
        name,
        interfaceDef: stage.interfaceDef,
        protocols,
        default: stage.defaultProtocol
      })
    }

    const edges = []
    for (const [from, tos] of graph.edges) {
      for (const to of tos) {
        edges.push({ from, to })
      }
    }

    return JSON.stringify({ stages, edges }, null, 2)
  }
}

class HotReloader {
  constructor(pipeline) {
    this.pipeline = pipeline
    this.versions = new Map()
  }

  reload(stageName, newProtocol) {
    const stage = this.pipeline.graph.stages.get(stageName)
    if (!stage) throw new Error(`Stage ${stageName} not found`)
    
    const old = stage.protocols.get(newProtocol.name)
    stage.protocols.set(newProtocol.name, newProtocol)
    
    this.versions.set(`${stageName}:${newProtocol.name}`, {
      old: old?.version,
      new: newProtocol.version,
      time: new Date()
    })
    
    this.pipeline.emit('reloaded', { stage: stageName, protocol: newProtocol.name })
    return { oldVersion: old?.version, newVersion: newProtocol.version }
  }

  getVersionHistory() {
    return Array.from(this.versions.entries()).map(([key, v]) => ({ key, ...v }))
  }
}

class Protocol {
  constructor(name, version, impl, interfaceDef) {
    this.name = name
    this.version = version
    this.impl = impl
    this.interfaceDef = interfaceDef
  }

  async invoke(method, ...args) {
    if (!this.impl[method]) throw new Error(`method '${method}' not implemented`)
    return await this.impl[method](...args)
  }

  static fromModule(mod) {
    return new Protocol(mod.name, mod.version, mod, mod.interfaceDef || [])
  }
}

class Stage {
  constructor(name, interfaceDef) {
    this.name = name
    this.interfaceDef = interfaceDef
    this.protocols = new Map()
    this.defaultProtocol = null
  }

  use(name, protocol) {
    this.protocols.set(name, protocol)
    return this
  }

  default(name) {
    this.defaultProtocol = name
    return this
  }

  async process(input, protocolName) {
    const name = protocolName || this.defaultProtocol
    const protocol = this.protocols.get(name)
    if (!protocol) throw new Error(`[${this.name}] protocol '${name}' not found`)
    return protocol
  }

  getInterface() {
    return this.interfaceDef
  }

  listProtocols() {
    return Array.from(this.protocols.keys())
  }
}

class Edge {
  constructor(from, to) {
    this.from = from
    this.to = to
  }
}

class Graph {
  constructor() {
    this.stages = new Map()
    this.edges = new Map()
  }

  addStage(stage) {
    this.stages.set(stage.name, stage)
    return this
  }

  connect(from, to) {
    if (!this.edges.has(from)) this.edges.set(from, [])
    this.edges.get(from).push(to)
    return this
  }

  getNext(from) {
    return this.edges.get(from) || []
  }

  topologicalSort() {
    const visited = new Set()
    const order = []
    const visiting = new Set()

    const dfs = (name) => {
      if (visited.has(name)) return
      if (visiting.has(name)) throw new Error(`Circular: ${name}`)
      visiting.add(name)
      for (const next of this.getNext(name)) dfs(next)
      visiting.delete(name)
      visited.add(name)
      order.unshift(name)
    }

    for (const name of this.stages.keys()) dfs(name)
    return order
  }
}

class EventBus {
  constructor() {
    this.handlers = new Map()
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event).push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx >= 0) handlers.splice(idx, 1)
    }
  }

  async emit(event, data) {
    const handlers = this.handlers.get(event) || []
    for (const handler of handlers) {
      await handler(data)
    }
  }
}

class Pipeline extends EventBus {
  constructor(graph) {
    super()
    this.graph = graph
  }

  async execute(startData, startStage) {
    const order = this.graph.topologicalSort()
    const startIdx = order.indexOf(startStage)
    const execOrder = startIdx >= 0 ? order.slice(startIdx) : order

    await this.emit('start', { data: startData, stage: startStage })

    let data = startData
    for (const stageName of execOrder) {
      const stage = this.graph.stages.get(stageName)
      const protocol = await stage.process(data, stage.defaultProtocol || stage.listProtocols()[0])
      const method = stage.interfaceDef[0]
      data = await protocol.invoke(method, data)
      await this.emit('stage:exit', { stage: stageName, data })
    }

    await this.emit('complete', { data })
    return data
  }
}

class ProtocolRegistry {
  constructor() {
    this.modules = new Map()
    this.onUpdate = new EventBus()
  }

  async load(name, loader) {
    const mod = await loader()
    this.modules.set(name, mod)
    this.onUpdate.emit('loaded', { name, mod })
    return mod
  }

  get(name) {
    return this.modules.get(name)
  }

  search(query) {
    return Array.from(this.modules.entries())
      .filter(([k, v]) => k.includes(query) || v.desc?.includes(query))
      .map(([k, v]) => ({ name: k, ...v }))
  }

  on(event, handler) {
    return this.onUpdate.on(event, handler)
  }
}

module.exports = {
  Semver, KeyPair, CodeSigner, Sandbox, ConfigLoader, HotReloader,
  Protocol, Stage, Edge, Graph, EventBus, Pipeline, ProtocolRegistry
}
