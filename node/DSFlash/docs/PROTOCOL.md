# 协议说明（p2pnet/v1）

本文档描述 p2pnode 的线格式与状态机。所有多字节整数均为**网络字节序（大端）**。

---

## 0. 端口复用与报文分类

一个 UDP socket 承载全部流量。收包时按固定顺序判定：

| 顺序 | 判定条件 | 归属 |
|---|---|---|
| 1 | `len >= 20` 且 `buf[4..7] == 0x2112A442` | STUN 响应 |
| 2 | `len == 16` 且 `buf[0..3] == 'P2PN'` | 打洞探测 |
| 3 | `len == 192` 且 `buf[0..3] == 'P2PH'` | 握手 |
| 4 | `buf[0] == 0x64`（`'d'`）且可解析为 bencode 字典且含 `y`/`t` | KRPC（DHT） |
| 5 | 其余 | 加密数据帧 |

加密帧首字节是密文，理论上可能恰好等于 `0x64`；此时第 4 步会因 bencode 解析失败或缺少 `y`/`t` 而落到第 5 步。

---

## 1. DHT 层（BEP-5 兼容）

### 1.1 节点 ID 与路由表

- 节点 ID：160 bit，首次运行随机生成并持久化（`data/node-id`）。
- 路由表：160 个 k-bucket，`k = 8`；同桶已满时，若最久未响应的节点活跃时间超过 15 分钟则替换，否则拒绝新节点（保稳定性）。

### 1.2 支持的 KRPC 方法

| 方法 | 参数 | 返回 |
|---|---|---|
| `ping` | `{id}` | `{id}` |
| `find_node` | `{id, target}` | `{id, nodes}`（紧凑节点 26B × n） |
| `get_peers` | `{id, info_hash}` | `{id, token, values?}` 或 `{id, token, nodes?}` |
| `announce_peer` | `{id, info_hash, port, token, implied_port}` | `{id}` |

错误响应：`{y:'e', e:[code, msg]}`，`code = 203` 参数非法 / `204` 方法未知。

### 1.3 token

```
token = HMAC-SHA1(secret_i, peer_ip)
```

`secret_i` 为 8 字节随机密钥，每 10 分钟轮换，保留最近 3 个。`announce_peer` 必须携带针对**来源 IP** 有效的 token，否则 203。

### 1.4 主题（rendezvous point）

```
topic = SHA1("p2pnet/v1/topic/" + network + "|" + epoch)
epoch = epochMs > 0 ? floor(Date.now() / epochMs) : 0
```

同一 `network` 的节点必然算出同一 topic。查询时同时查 `epoch` 与 `epoch-1`，兼容刚跨过轮换边界的对端。

### 1.5 迭代查询（关键）

为保证 **A 的公告能被 B 查到**，双方必须收敛到同一批「离 topic 最近的节点」：

```
候选集 C ← routing.closest(topic, 32)
loop:
  S ← C 按到 topic 的 XOR 距离排序
  batch ← S[0..k) 中尚未查询的节点，取前 α 个（k=8, α=3）
  if batch 为空 → break
  并行查询 batch（get_peers / find_node）
  把响应中的 nodes 合并进 C
  （get_peers 时同时收集 values 与 token）
until 超时
```

公告目标 = 收敛后**最近且确实应答**的节点（最多 16 个）的 token 集合。

> 曾经踩过的坑：早期实现按路由表顺序分批查询、并在"若干轮无新节点"时提前退出，导致公告集与查询集是两个不同子集，两个节点互相发现不了。必须收敛到 K 个最近节点。

### 1.6 本地 peer store 的合并

`get_peers` 结果会与本地 peer store 合并。原因：小规模网络里「离 topic 最近的 K 个节点」可能就是对端本身，此时远端只会把**查询者自己的记录**返回给它，若不合并本地已存的对端公告，双方永远发现不了对方。

peer store 记录 TTL 30 分钟。

---

## 2. STUN（RFC 5389 Binding）

请求：20 字节头 `type=0x0001, len=0, magic=0x2112A442, txid(12 随机)`。
解析 `XOR-MAPPED-ADDRESS(0x0020)`，回退 `MAPPED-ADDRESS(0x0001)`。

**必须使用与数据面相同的 socket**，否则拿到的端口不是可用端口。

---

## 3. NAT 判定与候选端口

用同一 socket 向多个 STUN 服务器探测：

- 全部返回同一 `ip:port` → `endpoint-independent`（锥形，成功率高）
- 端口随目标变化 → `address-dependent`（对称型）

候选端口列表（最多 5 个，公告前 3 个）：

1. 各次观测到的映射端口（去重，升序）
2. 若观察到 ≥2 个不同端口，按中位步长线性预测 3 个
3. 本地监听端口（端口保持型 NAT 场景）

---

## 4. 打洞

探测包（16 字节，定长）：

```
'P2PN'(4) | ver(1) | flags(1) | 随机(10)
```

- 每个候选地址每 400ms 发一个，持续 30 秒高频、之后每 3.2 秒一次，单目标最长保留 120 秒，目标数上限 96。
- 收到探测包：若来源地址已在目标表中 → 立即建会话发握手；否则加入目标表，**累计收到第 2 次**才建会话（防扫描触发 192 字节回包）。
- 握手完成后从目标表移除该地址。

---

## 5. 握手（固定 192 字节）

```
偏移  长度  字段
0     4     'P2PH'
4     1     版本 = 1
5     1     flags（保留 0）
6     2     保留
8     32    临时 X25519 公钥
40    32    长期 Ed25519 公钥
72    16    随机 nonce
88    64    Ed25519 签名
152   32    HMAC-SHA256
184   8     随机填充
```

其中：

```
body  = "p2pnet/v1" || 版本(1B) || ephPub || staticPub || nonce      // 85 字节
sig   = Ed25519-Sign(身份私钥, body)
tag   = HMAC-SHA256(netKey, body || sig)
```

`netKey = scrypt(network + "\0" + secret, "p2pnet/v1/psk", 32)`。

校验顺序：`tag` 用常量时间比较 → 用 `staticPub` 验签 → 计算 `peerId = base32(SHA256(staticPub))[0..12]`。

> 双重校验的意义：HMAC 证明「知道网络口令」（挡外部扫描者）；签名证明「我是这个身份」（挡中间人替换临时公钥，因为 HMAC 谁都能算，签名只有私钥持有者能算）。

**双向同时握手**：双方各自发送 HELLO、各自重发（400ms 间隔，最多 40 次），收到对端 HELLO 即完成。无需区分角色，任一侧探测成功都能收敛。

---

## 6. 密钥派生

以 `staticPub` 字典序确定 low/high：

```
shared = X25519(ephPriv_self, ephPub_peer)
salt   = SHA256(nonce_low || nonce_high || pub_low || pub_high)
okm    = HKDF-SHA256(32+4+4=72 字节, ikm=shared, salt=salt, info="p2pnet/v1 session")
  a2b.key = okm[0..32)   a2b.tag = okm[32..36)
  b2a.key = okm[36..68)  b2a.tag = okm[68..72)
```

本方为 low 则发送用 `a2b`、接收用 `b2a`，否则相反。临时密钥每会话重新生成 → 前向保密。

---

## 7. 加密帧

```
tag(4) | counter(8, BE, 从 1 递增) | ciphertext | GCM tag(16)
```

- `ciphertext` 长度 = 桶长 − 28；桶长只允许 **64 / 256 / 1024 / 4096**。
- 明文 = 内层内容 + 随机填充至 `桶长 − 28`。
- AES-256-GCM，nonce = `00000000 || counter`（每方向独立密钥，counter 不重用）。
- AAD = 前 12 字节头（`tag || counter`），防篡改与反重放。
- 接收端要求 `counter > lastCounter`，否则丢弃（重放保护；乱序交给重传层）。

### 内层明文头（12 字节）

```
0    1    类型：0x10 DATA / 0x11 ACK / 0x12 CHAFF
1    1    应用类型：1 CHAT / 2 PING / 3 PONG / 4 BYE（ACK/CHAFF 时为 0 或随机）
2    2    chunkIndex
4    2    chunkCount
6    2    payloadLen
8    4    msgId
12   ...  payload
```

---

## 8. 可靠性

- 应用消息 ≤ 4 MiB，按 960 字节切片（`12 + 960 + 28 = 1000 ≤ 1024`）。
- 收到 DATA 立即回 ACK（同一 `msgId + chunkIndex`），ACK 帧固定 64 字节。
- 发送端 200ms 轮询：未确认且超过 RTO 的分片重传，RTO 从 500ms 起每次 ×1.7，上限 8s，单分片最多 10 次；全部确认后清除。
- 接收端按 `msgId` 组装，`chunkCount == 1` 直接投递；已投递的 `msgId` 记入 1024 条滑动窗口去重。

---

## 9. 保活与掩护流量

- 每 12 秒无发送则发一个空 `PING`（同时维持 NAT 映射）。
- 60 秒未收到任何帧 → 判定 `idle-timeout` 并关闭。
- `chaff > 0` 时，每会话按 `chaff × (0.5 ~ 1.5)` 的随机间隔发送 `CHAFF` 帧，桶长随机取四种之一，使"真实消息何时发出"不可从流量曲线上辨认。
- 真实帧发送前加 0~`jitter` 毫秒随机延迟。

---

## 10. 状态机

```
            punch / handshake 到达
                    │
                    ▼
              handshaking ──── 40 次握手无果 ──▶ closed(handshake-timeout)
                    │
             收到合法 HELLO
                    │
                    ▼
                 open ──── BYE / idle-timeout / 对端关闭 ──▶ closed
                    │
             同一 peerId 已有更早会话 ──▶ closed(duplicate)
```

`self-connect`：握手后发现 `peerId == 自身 peerId`，立即关闭，并把该来源 IP 记入 `selfHosts` 用于过滤多出口 CGNAT 下的自身条目。
