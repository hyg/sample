# p2pnode —— 无服务器的 P2P 节点

一个纯 Node.js 实现的对等节点程序：**用 DHT 公布/发现公网地址，用 STUN 探测 NAT 映射，打洞后全程点对点直连通信**。
不含任何自建服务端代码，通信阶段不经过任何服务器。

```
 局域网A                         公网                         局域网B
┌──────────────┐                                          ┌──────────────┐
│  p2pnode A   │──┐                                    ┌──│  p2pnode B   │
│  udp 6881    │  │   ┌─────────┐    ┌─────────────┐    │  │  udp 6881    │
└──────────────┘  ├──▶│  NAT A  │    │ 公共 DHT    │    │  └──────────────┘
                  │   └────┬────┘    │ (只存地址)  │    │   ┌────┬────┐
                  │        │         └──────┬──────┘    │   │    │    │
                  │        │  ①announce/   │  ①announce │   │    │    │
                  │        │    get_peers   │  /get_peers│   │    │    │
                  │        ▼                ▼            ▼   │    │    │
                  │   ┌──────────────────────────────────┐   │    │    │
                  │   │  ②STUN: 我出去后长什么样？        │   │    │    │
                  │   └──────────────────────────────────┘   │    │    │
                  │                    │                     │    │    │
                  └────────────────────┼─────────────────────┘    │    │
                                       ▼                          │    │
                        ③ 双向同时打洞，UDP 直连（不经服务器）      │    │
                        A ◀════════════════════════════════════▶ B
                              AES-256-GCM 端到端加密
```

---

## 一、需求对照

| 需求 | 实现 | 代码位置 |
|---|---|---|
| 节点分布在各自局域网，出口是 NAT | 单 UDP 端口复用；STUN 探测映射；端口/地址全部动态处理 | `src/net/stun.js` `src/net/nat.js` |
| 用 DHT 协议公布自己的公网地址、获取别人地址 | 标准 BEP-5 `announce_peer` / `get_peers`，自研 Kademlia（160bit、k=8、α=3） | `src/dht/*` |
| 不写服务端代码；可借第三方服务器（中国大陆可用、多备选） | 只依赖**公共 DHT 引导节点**与**公共 STUN**，均为给定清单，可在配置文件/命令行替换 | `src/app/config.js` |
| 通信时不使用服务器 | 拿到地址后仅两端 UDP 直连；无中继、无信令、无打洞服务 | `src/net/punch.js` `src/net/session.js` |
| 时间/内容/长度/地址最小知情 | DHT 只写 IP:port（无身份无内容）；长度定长分桶；时间抖动+掩护包；主题按小时轮换 | `src/net/secure.js` `src/net/session.js` |
| 停止运行时输出可用 ip:port 供下次当 BOOTSTRAPS | 退出时逐个 `ping` 校验，只输出"此刻真能应答"的地址，并按可直接粘贴的格式打印 + 落盘 | `src/app/report.js` `P2PNode#collectBootstraps` |

---

## 二、快速开始

无需 `npm install`，**零第三方依赖**，只要 Node.js ≥ 18。

### 1. 两台机器 / 两个终端互通

```bash
# 终端 1
node bin/p2pnode.js --network my-net --secret "一个足够长的口令" --port 6881

# 终端 2（同一网络名与口令）
node bin/p2pnode.js --network my-net --secret "一个足够长的口令" --port 6882
```

几秒内你会看到：

```
[+] 节点接入 3mzqk7vx2b1a @ 203.0.113.7:51422
> /send all 你好
```

### 2. 单机双节点演示（不联外网，走回环）

```bash
node bin/p2pnode.js --port 19001 --no-stun --no-public-bootstrap \
  --network demo --secret demo123 --data-dir /tmp/n1 --exec "/sleep 20000;/bootstraps"

node bin/p2pnode.js --port 19002 --no-stun --no-public-bootstrap \
  --bootstrap 127.0.0.1:19001 --network demo --secret demo123 --data-dir /tmp/n2
```

### 3. 交互命令

| 命令 | 说明 |
|---|---|
| `/peers` | 已连接节点（peerId、地址、时长、收发计数） |
| `/send <id\|all> <text>` | 发送消息，`id` 支持前缀匹配 |
| `/status` | NAT 类型、公网映射、候选端口、DHT 节点数、主题、候选地址 |
| `/find` | 立即再做一轮"公告 + 发现" |
| `/bootstraps` | 立即校验并打印当前可用 BOOTSTRAPS |
| `/stun` | 重新探测 NAT 映射 |
| `/quit` | 退出（**退出时打印可用 BOOTSTRAPS**） |

### 4. 退出时的输出

```
══════════════════════════════════════════════════════════════
 本轮运行结束：当前可用的 DHT BOOTSTRAPS（已逐个 ping 验证）
══════════════════════════════════════════════════════════════
  共 62 个可用节点，按 RTT 排序：

const BOOTSTRAPS = [
  { host: '122.193.252.163',port: 37761 },
  { host: '114.80.9.168',   port: 6890 },
  ...
]

── 本节点信息 ──────────────────────────────────────────────
  peerId    : uuiu4ggbg6n7
  UDP 端口  : 55274
  公网映射  : 203.0.113.7:48459
  NAT 类型  : endpoint-independent
  候选端口  : 48459, 55274
  报告已存  : ./data/bootstraps-latest.json（下次启动会自动加载）
```

`data/bootstraps-latest.json` 会在**下次启动时自动作为引导节点加载**，所以同一个节点反复运行时不需要再手工填 BOOTSTRAPS。

---

## 三、参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `--network <name>` | `p2pnet-demo` | 网络名，决定 DHT rendezvous 主题；不同名互不可见 |
| `--secret <passphrase>` | 由网络名派生 | **网络口令**，参与会话密钥派生。不设则安全性大打折扣 |
| `--port <n>` | `6881` | 本地 UDP 端口；`0` 为随机 |
| `--data-dir <dir>` | `./data` | 身份私钥、DHT node-id、退出报告 |
| `--stun <url>` | 内置 4 台 | 追加 STUN，可多次 |
| `--no-stun` | — | 不用 STUN（纯局域网/已知映射） |
| `--bootstrap <host:port>` | — | 追加 DHT 引导节点，可多次 |
| `--no-public-bootstrap` | — | 不用内置公共引导节点 |
| `--epoch <ms>` | `3600000` | 主题轮换周期，`0` 关闭轮换 |
| `--chaff <ms>` | `6000` | 掩护流量平均间隔，`0` 关闭 |
| `--jitter <ms>` | `80` | 发送抖动上限，`0` 关闭 |
| `--announce <ms>` / `--lookup <ms>` | `60000` / `20000` | 公告 / 发现周期 |
| `--log <level>` | `info` | `silent\|error\|warn\|info\|debug` |
| `--debug-report <url>` | — | 上报到一个 Cloudflare Worker 调试面板（见 `../cf-debug-worker`），仅调试期用 |
| `--exec "<cmd;cmd>"` | — | 启动后自动执行命令（脚本化演示/测试） |
| `--exit-after <ms>` | — | 运行指定毫秒后自动退出 |

---

## 四、关键设计

### 1. DHT 只当"地址簿"，不写任何内容

用标准 BEP-5：

```js
announce_peer(info_hash, port, token)   // "我这个 IP（由 DHT 节点观察）在这个端口"
get_peers(info_hash)  →  values: [ <ip:port 的 6 字节紧凑格式>, ... ]
```

第三方 DHT 节点能知道的上限是：**某个 IP:port 对某个 160bit 数字（主题）感兴趣**。没有昵称、没有公钥、没有消息、没有在线状态。

主题不是明文，而是：

```
topic = SHA1("p2pnet/v1/topic/" + network + "|" + floor(now / epoch))
```

按小时轮换，跨 epoch 时同时查上一轮，避免"同一个 IP 长期挂在同一个主题下"这种可长期关联的痕迹。

### 2. 一个 UDP 端口承载全部流量

NAT 映射是绑定到 `内部IP:端口` 的。如果 DHT 用一个端口、打洞用另一个端口，**公布出去的端口就不是真正收发数据的端口**，打洞必然失败。所以：

```
同一个 socket
 ├─ KRPC（bencode 字典，首字节 'd'）
 ├─ STUN（magic cookie 0x2112A442）
 ├─ 打洞探测（'P2PN'，16 字节定长）
 ├─ 握手（'P2PH'，192 字节定长）
 └─ 加密数据帧（其余，只有 64/256/1024/4096 四种长度）
```

### 3. 打洞：双向同时 + 对"观测到的源地址"回包

1. 双方各自算出候选端口（STUN 映射端口 + 本地端口 + 对称型时的线性预测），用 `announce_peer` 多端口公告；
2. 从 DHT 拿到对方候选地址后，每 400ms 向每个候选发 16 字节探测包；
3. **收到任何探测包都立刻向"包的真实来源"回包**（而不是向公告的地址回包）。

第 3 步很关键：当一侧是对称 NAT 时，它公告的端口对"你"这个目标并不成立，但它发过来的包的真实源端口是成立的。回包打这个源端口就能穿过去。

判定逻辑（`P2PNode#_wire`）：

```
收到探测包
  ├─ 该地址本来就在打洞目标表里     → 立即开始握手
  └─ 否则累计收到第 2 次           → 开始握手（防扫描者轻易触发 192 字节回包）
```

### 4. 加密与"最小知情"

| 维度 | 做法 |
|---|---|
| 内容 | Ed25519 身份 + X25519 临时密钥 ECDH + HKDF-SHA256 + AES-256-GCM；临时密钥保证前向保密 |
| 身份 | 长期 Ed25519 公钥签名握手中所有字段，peerId = base32(SHA256(pub))[:12] |
| 成员资格 | HMAC-SHA256(网络口令, 握手字段)，**证明知道口令但不泄露口令**；同时挡住网络外扫描者 |
| 报文长度 | 所有帧只允许 64 / 256 / 1024 / 4096 四种长度，明文不足则随机填充 |
| 发送时刻 | 每帧 0~80ms 随机抖动；另按平均 6s 的随机间隔发送掩护帧（chaff），长度也随机取四种之一 |
| 地址 | DHT 只承载 IP:port；STUN 只承载 IP:port；二者都拿不到消息内容与对端身份 |

握手包布局（固定 192 字节，长度本身不泄露信息）：

```
'P2PH'(4) | ver(1) | flags(1) | rsv(2) | ephX25519(32) | ed25519(32) | nonce(16) | sig(64) | HMAC(32) | 随机填充(8)
```

### 5. 可靠传输

UDP 之上自建轻量可靠层：

- 消息按 960 字节切片，`msgId + chunkIndex + chunkCount` 编号；
- 收到即回 ACK（64 字节定长帧），发送端对未确认分片做指数退避重传（RTO 500ms 起，上限 8s，最多 10 次）；
- 乱序/重复通过组装缓冲 + 已完成 msgId 滑动窗口（1024 条）去重；
- 双向同时握手，无需区分发起方，任一侧探测成功即可收敛。

实测：**40% 数据帧被丢弃**时，8KB 消息仍能完整送达。

---

## 四点五、跨机联调（可选）

两台机器打不通时，怎么判断是"没发现"还是"打不穿"？用 `cf-debug-worker` 里的对账面板：

```bash
# 两台机器各自加上（同一房间名）
node bin/p2pnode.js --network my-net --secret "口令" \
  --debug-report https://p2pnode-debug.xxx.workers.dev/r/room1
```

浏览器打开该 Worker 首页即可看到逐对结论：地址成立 / 对称 NAT / DHT 发现失败 / 包被丢弃。
它只是观测点，不参与通信，调试完去掉参数即可。

## 五、局限与须知（请务必读）

1. **对称 NAT ↔ 对称 NAT 无法直连。** 这是 NAT 的物理限制，任何"不用中继"的方案都做不到。本程序的做法是：能通就通，通不了就明确失败（不打无限重试、不偷偷降级到某台服务器）。中国大陆的移动网络 / 部分企业网是多出口 CGNAT，属于这种最坏情况。
2. **多出口 IP 的 CGNAT** 会让 DHT 里记录的"你的地址"出现多个不同 IP（每个 DHT 节点观测到的不一样）。程序会自适应学习自身出口 IP 并过滤自连，但跨出口的连通性仍然取决于运营商。
3. **公共 DHT 是公开设施。** 任何人知道你的 `network` 名都能查到"某些 IP:port 在关心这个主题"（但拿不到内容、身份和消息）。`--secret` 只保护内容，不保护地址的存在性。需要更强隐匿性时请叠加 Tor/VPN。
4. **口令强度就是安全上限。** 会话密钥由 `scrypt(network + secret)` 派生，弱口令可被离线暴力破解（需要先抓到一个握手包）。
5. **仅 IPv4 UDP。** 没有实现 IPv6（IPv6 场景不需要打洞，另行扩展更简单）。
6. 本程序**不是**匿名通信工具：对端天然知道你的 IP。它解决的是"没有服务器也能连上"，不是"隐藏我是谁"。

---

## 六、测试

```bash
node test/integration.test.js
```

不需要外网：3 个节点跑在 `127.0.0.1` 的不同端口，验证 DHT 公告/发现、打洞握手、小消息、8KB 分片消息、40% 丢包下的重传、线上抓包不含明文、退出报告落盘。

```
[1] A 启动 udp=40169
[1] B 启动 udp=47600
[1] C 启动 udp=59202
[2] DHT 发现 + 握手成功：A=2 B=2 C=2 个会话
[3] 小消息端到端送达 OK
[4] 分片大消息 OK（8006 字节，9 片）
[5] 线上抓包不含明文 OK
[5.5] 40% 丢包下仍完整送达 OK（丢弃 3 个数据帧，靠重传补齐）
[6] B 退出时可用 BOOTSTRAPS：127.0.0.1:40169, 127.0.0.1:59202
[6] BOOTSTRAPS 报告 + 落盘 OK
全部测试通过 ✅
```

真实公网环境实测（同一台机器、两个进程、经公共 DHT 互发现）：

```
[11:25:22] DHT: 已公布 182.254.166.196:21973,51996,51997（主题 6a22ff56…）
[11:25:28] DHT: 发现节点 42.193.191.200:62238
[11:25:28] DHT: 发现节点 106.52.240.29:50597
```

即：**跨 NAT 的地址交换在公共 DHT 上可用**；最终能否直连取决于双方 NAT 类型。

---

## 七、目录结构

```
bin/p2pnode.js            命令行入口 / 交互 REPL
src/protocol.js           协议常量（魔术字、分桶、类型）
src/dht/bencode.js *      最小 bencode
src/dht/routing.js        160 桶 Kademlia 路由表
src/dht/dht.js            KRPC、迭代查询、announce/get_peers、token
src/net/udp.js            单端口复用 + 报文分类
src/net/stun.js           STUN Binding（RFC5389）
src/net/nat.js            NAT 行为判定 + 候选端口预测
src/net/punch.js          打洞探测
src/net/secure.js         握手 / 密钥派生 / 定长分桶加密
src/net/session.js        会话：可靠性、保活、掩护流量
src/app/node.js           节点编排：发现、会话、退出报告
src/app/report.js         BOOTSTRAPS 输出格式
src/app/config.js         默认 STUN / BOOTSTRAPS 清单
test/integration.test.js  本机多节点联调测试
docs/PROTOCOL.md          协议细节
docs/architecture.html    架构与威胁模型（浏览器打开）
```

> `*` 实际路径为 `src/util/bencode.js`。

---

## 八、许可

MIT
