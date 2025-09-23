// sop-machine.js
const { Machine, State } = require('./hfsm');

class TaskState extends State {
  constructor(code, role, opts = {}) {
    super(code, {
      onEnter: () => {
        console.log(`[${code}] ${role} 开始处理`);
        this.startAt = Date.now();
      },
      onExit: () => {
        console.log(`[${code}] 完成，耗时 ${Date.now() - this.startAt}ms`);
      }
    });
    this.code = code;
    this.role = role;
    this.allowSkip = opts.allowSkip || false;
  }
}

function buildSOP(sopDef, instId) {
  const { sopId, name, nodes, deps } = sopDef;
  const root = new Machine(name, { data: { instId, sopId, vars: {} } });

  // 0. 建一个虚拟“Start”状态
  root.add('Start', new State('Start'));

  // 1. 创建所有任务节点
  nodes.forEach(n => root.add(n.code, new TaskState(n.code, n.role, n)));

  // 2. 加转移：Start → 所有无前置的节点
  nodes.filter(n => !(deps[n.code]?.length))
       .forEach(n => root.addTrans('Start', n.code,
         d => true,
         d => d.vars[n.code] = 'RUN'));

  // 3. 任务节点之间的转移
  nodes.forEach(post => {
    const preCodes = deps[post.code] || [];
    root.addTrans('*', post.code,
      d => preCodes.every(c => d.vars[c] === 'OK'),
      d => d.vars[post.code] = 'RUN');
  });

  // 4. 暴露外部 API
  root.completeTask = (code, success = true) => {
    root.data.vars[code] = success ? 'OK' : 'FAIL';
    root.update('complete');
  };

  root.setInitial('Start');
  return root;
}

module.exports = { buildSOP, TaskState };