# README  
面向 AI 与后续维护者的「分层有限状态机（HFSM）实现 SOP」速查手册

---

## 1. 概念：用 HFSM 表达 SOP

- **SOP（Standard Operating Procedure）**  
  由「阶段 → 任务 → 步骤」组成，天然存在**串行/并行/重试/回退**的混合流程。

- **HFSM（Hierarchical Finite-State Machine）**  
  把「阶段/任务/步骤」分别抽象成**可嵌套的状态机实例**：  
  上层状态机的「状态」本身又是一台完整的状态机，从而做到：

  | 层级 | 示例状态 | 典型转移条件 |
  |----|--------|-------------|
  | L1 | 顶层 SOP 生命周期 | Draft → Review → Running → Done |
  | L2 | 阶段（Phase）（串/并） | Phase-1 取样(串) → Phase-2 检验(并) → Phase-3 放行(串) |
  | L3 | 原子任务（Task） | Idle → Running → (OK \| Fail) → Retry |

- **好处**  
  1. 任意层可单独测试、复用、替换；  
  2. 转移逻辑集中在 `guard/ action` 表，消灭 `if/else` 地狱；  
  3. 事件驱动，易于与 REST/消息队列/数据库审计对接。

---

## 2. 仓库文件一览

| 文件 | 作用 | 改动频率 | AI 提示 |
|----|-----|--------|--------|
| `hfsm.js` | 通用分层状态机引擎 | 极低 | **禁止修改**，除非要加日志或并发锁；所有业务逻辑下沉到业务文件。 |
| `sop.js` | 单层 SOP 封装（1 台顶层机 + 1 层任务） | 中 | 仅用于**简单流程**；新增 SOP 时优先拷贝后改 `sopDef`。 |
| `tower.js` | 三层 Tower-SOP 封装（L1→L2→L3） | 高 | **主要战场**；新增阶段/任务/重试策略只改这里。 |
| `sop.demo.js` | 单层示例运行入口 | 低 | 跑 `node sop.demo.js` 验证引擎是否正常。 |
| `tower.demo.js` | 三层示例运行入口 | 低 | 跑 `node tower.demo.js` 验证 Tower 模型；可当做**单元测试**使用。 |

---

## 3. 核心 API（维护者必须知道）

### 3.1 引擎级 (`hfsm.js`)
- `machine.add(name, state)` 注册子状态  
- `machine.addTrans(from, to, guard, action)` 注册转移  
- `machine.setInitial(name)` 设置初态  
- `machine.update(evt)` 驱动一次状态扫描（一帧最多一次转移）  
- `machine.emit() / .on()` 事件总线，用于审计、发消息、同步 DB。

**AI 提示**：  
- `guard` 必须是**纯函数**（只读 `data`），严禁副作用。  
- `action` 里才能写数据库、发 Kafka、调 API。  
- 若要在 `guard` 里读数据库，请先缓存到 `data.vars`，避免频繁 IO。

### 3.2 业务级 (`sop.js` / `tower.js`)
- `buildSOP(sopDef, instId)` → 返回根状态机实例  
- `root.completeTask(code, success)` → 原子地完成一个任务（会自动推进下游）。  
- `root.data.vars` → **黑板数据**，跨层传递结果/重试次数/失败原因。  
- `root.update('anyEvent')` → 手动触发再评估（框架也会定时调用）。

---

## 4. 如何新增一条全新 SOP（AI 速查）

### Step 1 画三层图
```
L1: 生命周期（Draft→Review→Running→Done）
L2: 阶段（串并）
L3: 任务（重试/跳过）
```

### Step 2 写 `sopDef`（以 tower.js 为例）

```js
const sopDef = {
  name: 'MyNewSOP',
  phases: [
    {
      name: 'Phase-X',
      tasks: [
        { code: 'X1', role: 'Operator', maxRetry: 3 },
        { code: 'X2', role: 'QA',       maxRetry: 1 }
      ],
      edges: [                      // 串行
        { from: 'X1', to: 'X2', guard: d => d.ok, action: () => {} }
      ]
    },
    ...
  ]
};
```

### Step 3 提供 completeTask 钩子
```js
const inst = buildTowerSOP(sopDef, 'bizKey123');
inst.completeTask('Phase-X', 'X1', true);
```

### Step 4 把 `inst` 挂在 HTTP/消息队列
```js
router.post('/sop/:instId/task/:code/complete', (req, res) => {
  inst.completeTask(req.body.phase, req.params.code, req.body.ok);
  res.json({ vars: inst.data.vars });
});
```

---

## 5. 常见坑与 AI 快速定位

| 现象 | 90% 原因 | 搜索关键词 |
|----|--------|-----------|
| `unknown state XXX` | `setInitial` 名与 `add` 名不一致 | `grep -n setInitial` |
| `Cannot read properties of undefined (reading 'change')` | 未正确继承 EventEmitter | 检查 `hfsm.js` 末尾 `Object.setPrototypeOf` |
| 任务不推进 | `guard` 返回 false | 打印 `data.vars` 看前置是否 OK |
| 重试无效 | `maxRetry` 变量作用域被覆盖 | 确保 `retry` 闭包在 `makeRetryTask` 内部 |

---

## 6. 单元测试模板（供 AI 自动生成）

```js
// test/tower.test.js
const { buildTowerSOP } = require('../tower.js');
const assert = require('assert');

const def = /* 最小 SOPDef */;
const inst = buildTowerSOP(def, 'test');
inst.completeTask('P', 'T', true);
assert.strictEqual(inst.data.vars.phase0_done, true);
```

---

## 7. 一句话总结

> **「阶段-任务-重试」三层状态机，事件驱动，guard/action 表驱动转移，任何流程变体只需改 `sopDef` 与 `completeTask` 调用点，引擎层保持零侵入。**