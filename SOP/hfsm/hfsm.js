const { EventEmitter } = require('eventemitter3');

class State {
  constructor(name, opts = {}) {
    this.name = name;
    this.onEnter = opts.onEnter || (() => {});
    this.onExit  = opts.onExit  || (() => {});
    this.onTick  = opts.onTick  || (() => {});
  }
}

class Machine extends State {
  constructor(name, opts = {}) {
    super(name, opts);
    EventEmitter.call(this);          // ← 1. 初始化 EventEmitter
    this._events = this._events || Object.create(null); // ← 2. 保证 _events 存在
    this.states = new Map();
    this.trans = [];
    this.current = null;
    this.data   = opts.data || {};
    this.parent = null;
  }

  add(name, state) {
    if (state instanceof Machine) state.parent = this;
    this.states.set(name, state);
    return this;
  }

  addTrans(from, to, guard, action) {
    this.trans.push({ from, to, guard, action });
    return this;
  }

  setInitial(name) {
    this.current = this.states.get(name);
    if (!this.current) throw new Error(`unknown state ${name}`);
    this.current.onEnter(this.data);
    return this;
  }

  update(evt = 'tick') {
    if (typeof this.current.onTick === 'function') this.current.onTick(this.data);
    for (const t of this.trans) {
      if (t.from !== '*' && t.from !== this.current.name) continue;
      if (!t.guard(this.data)) continue;
      this.current.onExit(this.data);
      if (t.action) t.action(this.data);
      const next = this.states.get(t.to);
      if (!next) throw new Error(`unknown target ${t.to}`);
      this.current = next;
      next.onEnter(this.data);
      this.emit('change', { from: t.from, to: t.to });
      return;
    }
  }
}

// 让 Machine 拥有 EventEmitter 的全部能力
Object.setPrototypeOf(Machine.prototype, EventEmitter.prototype);

module.exports = { Machine, State };