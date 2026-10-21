import dgram from 'node:dgram'
import { EventEmitter } from 'node:events'
import DHT from 'bittorrent-dht'
import krpcSocket from 'k-rpc-socket'
import { ANNOUNCE_JITTER, ANNOUNCE_MIN, DHT_OPS_TIMEOUT, RECORD_TTL, ROSTER_MAX_PEERS } from './defaults.js'
import { dhtTarget } from './keys.js'
import { decodeRecord, encodeRecord, mergeRoster } from './record.js'

export class DhtService extends EventEmitter {
  constructor ({ roomKeys, nodeId, bootstrap, dhtPort = 0, idLength = 20 }) {
    super()
    this.roomKeys = roomKeys
    this.nodeId = nodeId
    this.bootstrap = bootstrap
    this.dhtPort = dhtPort
    this.idLength = idLength
    this.target = dhtTarget(roomKeys.publicKey)
    this.selfIdHex = nodeId.toString('hex')
    this.seq = -1
    this.roster = {}
    this.selfEntry = null
    this.running = false
    this.cycleBusy = false
    this.cycleCount = 0
    this.cycleTimer = null
    this.debugCycle = process.env.DHT_DEBUG === '1'
  }

  async start () {
    this.socket = dgram.createSocket('udp4')
    this.rpcSocket = krpcSocket({ socket: this.socket, timeout: 2500 })
    this.dht = new DHT({
      bootstrap: this.bootstrap,
      krpcSocket: this.rpcSocket,
      verify: this.roomKeys.verifyEd,
      id: this.nodeId
    })
    this.dht.on('warning', (err) => this.emit('warning', err))
    this.dht.on('error', (err) => this.emit('error', err))
    this.dht.on('ready', () => {
      this.emit('ready', { nodes: this.dht.nodes.toArray().length, address: this.address() })
      this.scheduleCycle(0)
    })
    this.dht.listen(this.dhtPort)
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        this.dht.removeListener('listening', onListening)
        this.dht.removeListener('error', onError)
      }
      const onListening = () => {
        cleanup()
        resolve()
      }
      const onError = (err) => {
        cleanup()
        reject(new Error(`DHT端口 ${this.dhtPort || '随机'} 监听失败: ${err.code || err.message}`))
      }
      this.dht.once('listening', onListening)
      this.dht.once('error', onError)
    })
    this.running = true
    this.scheduleCycle(0)
  }

  address () {
    try {
      return this.dht.address()
    } catch {
      return null
    }
  }

  nodeCount () {
    try {
      return this.dht.nodes.toArray().length
    } catch {
      return 0
    }
  }

  setSelfEntry ({ ip, port, lport, lan = [], nat = 'unknown', ts = Date.now() }) {
    const prev = this.selfEntry
    this.selfEntry = { ip, port, lport: lport || port, lan, nat, ts }
    const changed = !prev || prev.ip !== ip || prev.port !== port || prev.nat !== nat
    if (changed && this.running) this.scheduleCycle(0)
    return changed
  }

  touchSelf () {
    if (!this.selfEntry) return
    this.selfEntry.ts = Date.now()
  }

  scheduleCycle (delay) {
    if (!this.running) return
    clearTimeout(this.cycleTimer)
    if (delay === undefined) {
      delay = this.cycleCount < 6
        ? 12000 + Math.floor(Math.random() * 6000)
        : ANNOUNCE_MIN + Math.floor(Math.random() * ANNOUNCE_JITTER)
    }
    this.cycleTimer = setTimeout(() => this.cycle(), delay)
  }

  async cycle () {
    if (!this.running || this.cycleBusy) return
    if (!this.dht.ready) {
      if (this.debugCycle) console.log('[cycle] not ready, retry 5s')
      this.scheduleCycle(5000)
      return
    }
    this.cycleBusy = true
    this.cycleCount++
    if (this.debugCycle) console.log(`[cycle] begin count=${this.cycleCount}`)
    try {
      const got = await this.dhtGet()
      let remote = {}
      if (got && got.v) {
        try {
          remote = decodeRecord(this.roomKeys.aesKey, got.v)
        } catch {
          remote = {}
        }
        if (Number.isFinite(got.seq)) this.seq = Math.max(this.seq, got.seq)
      }
      if (this.selfEntry) {
        this.selfEntry.ts = Date.now()
        this.roster = mergeRoster(remote, this.selfIdHex, this.selfEntry, {
          ttl: RECORD_TTL,
          max: ROSTER_MAX_PEERS
        })
        this.emit('roster', this.roster)
        const v = encodeRecord(this.roomKeys.aesKey, this.roster)
        this.seq = Math.max(this.seq + 1, Date.now())
        const hits = await this.dhtPut(v, this.seq)
        this.emit('announced', { seq: this.seq, hits, size: v.length, peers: Object.keys(this.roster).length - 1 })
      } else {
        this.roster = remote
        this.emit('roster', this.roster)
      }
    } catch (err) {
      this.emit('cycle-error', err)
    } finally {
      if (this.debugCycle) console.log(`[cycle] end count=${this.cycleCount}`)
      this.cycleBusy = false
      this.scheduleCycle()
    }
  }

  dhtGet () {
    return new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      }, DHT_OPS_TIMEOUT)
      try {
        this.dht.get(this.target, (err, res) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(err ? null : res)
        })
      } catch {
        clearTimeout(timer)
        resolve(null)
      }
    })
  }

  dhtPut (v, seq) {
    return new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(0)
        }
      }, DHT_OPS_TIMEOUT)
      try {
        this.dht.put({ k: this.roomKeys.publicKey, seq, v, sign: this.roomKeys.sign }, (err, hash, hits) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(err ? 0 : (hits || 0))
        })
      } catch {
        clearTimeout(timer)
        resolve(0)
      }
    })
  }

  async stop () {
    this.running = false
    clearTimeout(this.cycleTimer)
    await new Promise((resolve) => {
      if (!this.dht) return resolve()
      try {
        this.dht.removeBucketCheckInterval?.()
        this.dht.destroy(() => resolve())
        setTimeout(resolve, 2000).unref?.()
      } catch {
        resolve()
      }
    })
  }
}
