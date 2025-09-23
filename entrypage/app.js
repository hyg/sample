// 加载左侧菜单
async function loadMenu() {
    const menu = await fetch('data/menu.json').then(r => r.json());
    renderList('dutyList', menu.duty, item => `${item.title}（截止 ${item.dueDate}）`, 'duty');
    renderList('sopList', menu.sop, item => item.title, 'sop');
    renderList('powerList', menu.power, item => `${item.title}（剩余 ${item.daysLeft} 天）`, 'power');
    renderList('benefitList', menu.benefit, item => `${item.title} ${item.amount} 元`, 'benefit');
  }
  
  function renderList(ulId, arr, fmt, type) {
    const ul = document.getElementById(ulId);
    ul.innerHTML = '';
    arr.forEach(it => {
      const li = document.createElement('li');
      li.textContent = fmt(it);
      li.onclick = () => loadDetail(type, it.id);
      ul.appendChild(li);
    });
  }
  
  // 右侧加载详情
  async function loadDetail(type, id) {
    const url = `data/${type}-${id}.json`;
    const data = await fetch(url).then(r => r.json());
    let html = `<h2>${data.title}</h2><p>状态：${data.status}</p>`;
    if (type === 'sop') {
      // 用 HFSM 引擎渲染状态图
      const fsm = new Machine(data.id); // 简例：直接 new 前文 hfsm
      fsm.states = data.states;
      fsm.trans = data.trans;
      fsm.setInitial(data.initial);
      html += `<pre>${JSON.stringify(fsm.current, null, 2)}</pre>`;
      html += `<button onclick="fsm.update()">下一步</button>`;
    }
    if (type === 'power') {
      html += `<button onclick="exercisePower('${id}')\">行使</button>`;
      html += `<button onclick="waivePower('${id}')\">放弃</button>`;
    }
    document.getElementById('content').innerHTML = html;
  }
  
  async function exercisePower(id) {
    await fetch(`/api/power/${id}/exercise`, { method: 'POST' }); // 本地可改 indexedDB
    loadMenu(); // 刷新
  }
  async function waivePower(id) {
    await fetch(`/api/power/${id}/waive`, { method: 'POST' });
    loadMenu();
  }
  
  // 初始加载
  loadMenu();