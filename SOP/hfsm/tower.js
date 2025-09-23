// sop-tower.js
const { Machine, State } = require('./hfsm');

/* ---------- 最底层：单任务子机 ---------- */
function makeRetryTask(code, role, maxRetry = 2) {
  let retry = 0;
  const task = new Machine(code);
  task.add('Idle',   new State('Idle'));
  task.add('Running',new State('Running', {
    onEnter: () => console.log(`[${code}] ${role} 开始处理`)
  }));
  task.add('OK',     new State('OK', {
    onEnter: () => console.log(`[${code}] 完成`)
  }));
  task.add('Fail',   new State('Fail', {
    onEnter: () => console.log(`[${code}] 失败，重试次数=${retry}`)
  }));

  task.addTrans('Idle', 'Running', () => true);
  task.addTrans('Running', 'OK',   (d) => d.ok);
  task.addTrans('Running', 'Fail', (d) => !d.ok);
  task.addTrans('Fail', 'Running', () => retry++ < maxRetry, () => console.log(`[${code}] 重试…`));
  task.setInitial('Idle');
  return task;
}

/* ---------- 中层：阶段机（串/并） ---------- */
function makePhase(name, tasks, edges) {
  const m = new Machine(name);
  tasks.forEach(t => m.add(t.code, t.machine));
  edges.forEach(e => m.addTrans(e.from, e.to, e.guard, e.action));
  m.setInitial(tasks[0].code);          // 默认第一个任务
  return m;
}

/* ---------- 顶层：SOP 生命周期机 ---------- */
function buildTowerSOP(sopDef, instId) {
  const top = new Machine(sopDef.name, { data: { vars: {}, instId } });

  /* 1. 构造三层嵌套机 */
  const phases = [];
  sopDef.phases.forEach(ph => {
    const taskMachines = ph.tasks.map(t =>
      ({ code: t.code, machine: makeRetryTask(t.code, t.role, t.maxRetry) }));
    const phaseMachine = makePhase(ph.name, taskMachines, ph.edges || []);
    top.add(ph.name, phaseMachine);
    phases.push(ph.name);
  });

  /* 2. 顶层转移：顺序推进阶段 */
  for (let i = 0; i < phases.length - 1; i++) {
    top.addTrans(phases[i], phases[i + 1],
      d => d.vars[`phase${i}_done`],          // 由外部标记
      () => console.log(`>>> 进入 ${phases[i + 1]}`));
  }

  /* 3. 暴露 API：完成某个任务 */
  top.completeTask = (phase, code, ok = true) => {
    top.states.get(phase).states.get(code).data.ok = ok;
    top.states.get(phase).states.get(code).update('complete');
    // 检查阶段是否整体完成
    const vars = top.data.vars;
    const phIdx = sopDef.phases.findIndex(p => p.name === phase);
    const allOK = sopDef.phases[phIdx].tasks.every(t => {
      const st = top.states.get(phase).states.get(t.code).current.name;
      return st === 'OK';
    });
    if (allOK) {
      vars[`phase${phIdx}_done`] = true;
      top.update('phase_done');
    }
  };

  top.setInitial(phases[0]);
  return top;
}

module.exports = { buildTowerSOP };