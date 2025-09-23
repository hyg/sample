# SOP & 合同数据结构 + Node.js 引擎启动文档  
（机器可读 + AI 提示词，≤5000 字）

---

## 1. 目标与边界
- **合同**：确立「责-权-利」与违约后果，用「条件-事件-赔偿」表达。  
- **SOP**：确立「最优操作步骤」，用「状态-事件-动作-异常」表达。  
- **Node.js 引擎**：纯前端也可加载，零容器依赖，Git 版本化。

---

## 2. 文件结构（机器可读 JSON-Schema）

```json
{
  "$schema": "https://schema.example.com/sop-contract/v1",
  "contract": { "$ref": "#/$defs/Contract" },
  "sop": { "$ref": "#/$defs/SOP" }
}
```

### 2.1 Contract 根对象
```json
{
  "id": "contract-20250923001",
  "name": "原料采购合同",
  "lang": "zh-CN",
  "version": "1.0.0",
  "status": "effective",
  "parties": ["buyer", "seller"],
  "rootClauseId": "c-001",
  "clauseLibrary": { "$ref": "#/$defs/ClauseLibrary" },
  "variables": { "$ref": "#/$defs/VariablePool" },
  "rules": { "$ref": "#/$defs/RuleSet" }
}
```

### 2.2 SOP 根对象
```json
{
  "id": "sop-20250923001",
  "name": "原料放行流程",
  "version": "1.0.0",
  "status": "running",
  "rootTaskId": "t-001",
  "taskLibrary": { "$ref": "#/$defs/TaskLibrary" },
  "hfsm": { "$ref": "#/$defs/HFSM" }
}
```

### 2.3 共用子模式（片段）
```json
"$defs": {
  "Clause": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "type": {"enum": ["title", "text", "condition", "duty", "power", "benefit"]},
      "guard": { "$ref": "#/$defs/JsonLogicExpr" },
      "action": { "$ref": "#/$defs/Action" },
      "variables": { "type": "array", "items": { "type": "string" } },
      "parentVars": { "type": "array", "items": { "type": "string" } },
      "children": { "type": "array", "items": { "type": "string" } },
      "executable": { "$ref": "#/$defs/Executable" }
    }
  },
  "Task": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "type": {"enum": ["action", "decision", "check", "power", "duty"]},
      "role": { "type": "string" },
      "guard": { "$ref": "#/$defs/JsonLogicExpr" },
      "due": { "$ref": "#/$defs/Due" },
      "outputs": { "type": "array", "items": { "type": "string" } },
      "executable": { "$ref": "#/$defs/Executable" }
    }
  },
  "HFSM": {
    "type": "object",
    "properties": {
      "initial": { "type": "string" },
      "states": { "type": "object", "additionalProperties": { "$ref": "#/$defs/State" } },
      "trans": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "from": { "type": "string" },
            "to": { "type": "string" },
            "guard": { "$ref": "#/$defs/JsonLogicExpr" },
            "action": { "type": "string" }
          }
        }
      }
    }
  },
  "JsonLogicExpr": {},
  "Executable": {
    "type": "object",
    "properties": {
      "engine": {"enum": ["json-logic", "wasm", "js"]},
      "entry": { "type": "string" },
      "inputs": { "type": "array", "items": { "type": "string" } },
      "outputs": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

---

## 3. Node.js 引擎（零依赖，浏览器亦可 import）

### 3.1 入口（engine.js）
```js
// engine.js (ES Module)
export { JsonLogic } from './lib/jsonlogic-es.js';
export { Machine } from './lib/hfsm.js';
export { ContractEngine } from './contract-engine.js';
export { SOPEngine } from './sop-engine.js';
```

### 3.2 ContractEngine 片段
```js
// contract-engine.js
export class ContractEngine {
  constructor(contractJson) {
    this.contract = contractJson;
    this.vars = contractJson.variables;
    this.clauses = contractJson.clauseLibrary;
  }
  evaluateClause(id) {
    const c = this.clauses[id];
    return JsonLogic.apply(c.guard, this.vars);
  }
  emitEvent(evt) {
    // 下游 HFSM 或外部总线
    window.dispatchEvent(new CustomEvent('contract-event', { detail: evt }));
  }
}
```

### 3.3 SOPEngine 片段
```js
// sop-engine.js
export class SOPEngine {
  constructor(sopJson) {
    this.sop = sopJson;
    this.fsm = new Machine(sopJson.id);
    this.fsm.states = sopJson.hfsm.states;
    this.fsm.trans = sopJson.hfsm.trans;
    this.fsm.setInitial(sopJson.hfsm.initial);
  }
  submitEvidence(inputObj) {
    this.fsm.data = { ...this.fsm.data, ...inputObj };
    this.fsm.update('evidence');
  }
  getCurrent() {
    return this.fsm.current.name;
  }
}
```

---

## 4. 本地文件范例（可直接 load）

### 4.1 contract-20250923.json
```json
{
  "id": "contract-20250923",
  "name": "原料采购合同",
  "version": "1.0.0",
  "status": "effective",
  "parties": ["buyer", "seller"],
  "rootClauseId": "c-001",
  "variables": {
    "breachSeverity": 8,
    "deliveryDate": "2025-09-30",
    "price": 100000,
    "latePenaltyPerDay": 0.05
  },
  "clauseLibrary": {
    "c-001": {
      "id": "c-001",
      "type": "power",
      "title": "解除权",
      "guard": { ">": [{ "var": "breachSeverity" }, 7] },
      "executable": {
        "engine": "wasm",
        "entry": "power-for-cause.wasm",
        "inputs": ["breachSeverity"],
        "outputs": ["terminateEvent"]
      }
    }
  }
}
```

### 4.2 sop-20250923.json
```json
{
  "id": "sop-20250923",
  "name": "原料放行流程",
  "version": "1.0.0",
  "status": "running",
  "rootTaskId": "A",
  "hfsm": {
    "initial": "A",
    "states": {
      "A": { "name": "取样", "role": "QA" },
      "B": { "name": "理化", "role": "Lab" },
      "C": { "name": "微生物", "role": "MicroLab" },
      "D": { "name": "文件复核", "role": "DocCtrl" },
      "E": { "name": "放行", "role": "QP" }
    },
    "trans": [
      { "from": "A", "to": "B", "guard": "ok" },
      { "from": "B", "to": "C", "guard": "ok" },
      { "from": "A", "to": "D", "guard": "ok" },
      { "from": "C", "to": "E", "guard": "ok" },
      { "from": "D", "to": "E", "guard": "ok" }
    ]
  }
}
```

---

## 5. AI 提示词（后续开发复制即用）

> 「用 Node.js ES Module 写一个零依赖的  
> 「合同-责权利」+「SOP-HFSM」双引擎，  
> 条件用 JsonLogic，状态机用 EventTarget 模拟 EventEmitter，  
> 文件格式按上方 JSON-Schema，  
> 提供 `evaluateClause(id)`、`submitEvidence(obj)`、`getCurrent()` 三个方法，  
> 所有复杂算法用自定义 jsonLogic 操作符指向 WASM 函数名，  
> 输出单个 `engine.js` 与 `schema.json`，方便浏览器 import。」

---

## 6. 一键运行（本地）

```bash
npx http-server -p 8080
# 浏览器打开 http://localhost:8080
```

浏览器控制台：
```js
import { ContractEngine, SOPEngine } from './engine.js';
const ce = new ContractEngine(await fetch('data/contract-20250923.json').then(r=>r.json()));
console.log(ce.evaluateClause('c-001')); // → true
const se = new SOPEngine(await fetch('data/sop-20250923.json').then(r=>r.json()));
se.submitEvidence({ ok: true });
console.log(se.getCurrent()); // → B
```

---

## 7. 一句话总结

> 用「JsonLogic 管条件，HFSM 管状态，WASM 管算法，JSON-Schema 管格式」，  
> 一份无依赖的 ES Module 引擎即可同时驱动「合同责权利」与「SOP 生命周期」，  
> 本地文件即数据库，Git 即版本链，浏览器即客户端。