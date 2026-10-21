export const BOOTSTRAP_NODES = [
  { host: '34.197.35.250', port: 6880 },
  { host: '72.46.58.63', port: 51413 },
  { host: '46.53.251.68', port: 16970 },
  { host: '191.95.16.229', port: 55998 },
  { host: '79.173.94.111', port: 1438 },
  { host: '45.233.86.50', port: 61995 },
  { host: '178.162.174.28', port: 28013 },
  { host: '178.162.174.240', port: 28006 },
  { host: '72.21.17.101', port: 22643 },
  { host: '31.181.42.46', port: 22566 },
  { host: '67.213.106.46', port: 61956 },
  { host: '201.131.172.249', port: 53567 },
  { host: '185.203.152.184', port: 2003 },
  { host: '68.146.23.207', port: 42107 },
  { host: '51.195.222.183', port: 8653 },
  { host: '85.17.170.48', port: 28005 },
  { host: '87.98.162.88', port: 6881 },
  { host: '185.145.245.121', port: 8656 },
  { host: '52.201.45.189', port: 6880 }
]

export const STUN_SERVERS = [
  { urls: 'stun:fwa.lifesizecloud.com:3478' },
  { urls: 'stun:stun.isp.net.au:3478' },
  { urls: 'stun:stun.freeswitch.org:3478' },
  { urls: 'stun:stun.voip.blackberry.com:3478' }
]

export const RECORD_PLAIN_SIZE = 900
export const RECORD_TTL = 180000
export const ROSTER_MAX_PEERS = 10

export const STUN_TIMEOUT = 2500
export const STUN_REFRESH_MIN = 60000
export const STUN_REFRESH_JITTER = 15000

export const ANNOUNCE_MIN = 45000
export const ANNOUNCE_JITTER = 15000
export const DHT_OPS_TIMEOUT = 10000

export const PUNCH_FAST_INTERVAL = 1200
export const PUNCH_FAST_TRIES = 8
export const PUNCH_SLOW_INTERVAL = 5000
export const PUNCH_MAX_LIFETIME = 180000

export const KEEPALIVE_INTERVAL = 20000
export const SESSION_TIMEOUT = 70000
export const TIMEOUT_CHECK_INTERVAL = 10000

export const MAX_MESSAGE_CHUNK = 900
