/**
 * manage_contacts.py 的 Node.js 移植
 *
 * 管理本地持久化的联系人沉淀和推荐事件。用于群组发现工作流的本地关系沉淀 CLI。
 *
 * Python 源文件：python/scripts/manage_contacts.py
 * 分析报告：doc/scripts/manage_contacts.py/py.md
 * 蒸馏数据：doc/scripts/manage_contacts.py/py.json
 *
 * [INPUT]: credential_store identity data, local_store, logging_config
 * [OUTPUT]: Local contact snapshot updates and append-only relationship events
 * [POS]: Local relationship-sedimentation CLI for group discovery workflows
 */

const { SDKConfig } = require('./utils/config');
const { configureLogging } = require('./utils/logging');
const localStore = require('./local-store');
const { createAuthenticator } = require('./credential-store');

const logger = {
  info: (msg, ...args) => {
    console.log('[INFO] ' + msg.replace(/%s/g, () => args.shift()));
  },
  warn: (msg, ...args) => {
    console.warn('[WARN] ' + msg.replace(/%s/g, () => args.shift()));
  },
  error: (msg, ...args) => {
    console.error('[ERROR] ' + msg.replace(/%s/g, () => args.shift()));
  },
  debug: (msg, ...args) => {
    console.log('[DEBUG] ' + msg.replace(/%s/g, () => args.shift()));
  }
};

/**
 * 加载本地身份元数据或在用户可见错误时退出
 * @param {string} credentialName - 凭证名称
 * @returns {Object} 身份数据
 */
function _identityOrExit(credentialName) {
  const config = SDKConfig.load();
  const authResult = createAuthenticator(credentialName, config);
  if (authResult === null) {
    console.log(`Credential '${credentialName}' unavailable; please create an identity first`);
    process.exit(1);
  }
  const [_auth, data] = authResult;
  return data;
}

/**
 * 返回 ISO 8601 格式的当前 UTC 时间戳
 * @returns {string} ISO 8601 格式的时间戳
 */
function _nowIso() {
  return new Date().toISOString();
}

/**
 * 构建 CLI 解析器
 * @returns {Object} CLI 解析器
 */
function _buildParser() {
  // 简单的 CLI 参数解析器
  const args = process.argv.slice(2);
  const parsed = {
    recordRecommendation: false,
    saveFromGroup: false,
    markFollowed: false,
    markMessaged: false,
    note: false,
    targetDid: null,
    targetHandle: null,
    sourceType: null,
    sourceName: null,
    sourceGroupId: null,
    reason: null,
    score: null,
    text: null,
    connectedAt: null,
    credential: 'default',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--record-recommendation':
        parsed.recordRecommendation = true;
        break;
      case '--save-from-group':
        parsed.saveFromGroup = true;
        break;
      case '--mark-followed':
        parsed.markFollowed = true;
        break;
      case '--mark-messaged':
        parsed.markMessaged = true;
        break;
      case '--note':
        parsed.note = true;
        break;
      case '--target-did':
        parsed.targetDid = args[++i];
        break;
      case '--target-handle':
        parsed.targetHandle = args[++i];
        break;
      case '--source-type':
        parsed.sourceType = args[++i];
        break;
      case '--source-name':
        parsed.sourceName = args[++i];
        break;
      case '--source-group-id':
        parsed.sourceGroupId = args[++i];
        break;
      case '--reason':
        parsed.reason = args[++i];
        break;
      case '--score':
        parsed.score = parseFloat(args[++i]);
        break;
      case '--text':
        parsed.text = args[++i];
        break;
      case '--connected-at':
        parsed.connectedAt = args[++i];
        break;
      case '--credential':
        parsed.credential = args[++i];
        break;
      case '--help':
      case '-h':
        _printHelp();
        process.exit(0);
    }
  }

  return parsed;
}

/**
 * 打印帮助信息
 */
function _printHelp() {
  console.log(`
Manage local contact sedimentation for group discovery

Usage:
  node manage-contacts.js --record-recommendation --target-did <did> --source-type <type> --source-name <name> --source-group-id <id> --reason <reason> [--score <score>] [--credential <name>]
  node manage-contacts.js --save-from-group --target-did <did> --target-handle <handle> --source-type <type> --source-name <name> --source-group-id <id> --reason <reason> [--score <score>] [--credential <name>]
  node manage-contacts.js --mark-followed --target-did <did> [--credential <name>]
  node manage-contacts.js --mark-messaged --target-did <did> [--credential <name>]
  node manage-contacts.js --note --target-did <did> --text <text> [--credential <name>]

Options:
  --record-recommendation  Record an AI recommendation candidate without writing contacts
  --save-from-group        Save a confirmed contact from a discovery group
  --mark-followed          Mark a contact as followed locally
  --mark-messaged          Mark a contact as messaged locally
  --note                   Update the local note for one contact
  --target-did             Target DID
  --target-handle          Target handle
  --source-type            Source type: event / meetup / hiring / dinner / private_session / online_group
  --source-name            Source name
  --source-group-id        Source group ID
  --reason                 Recommendation or save reason
  --score                  Recommendation score
  --text                   Free-form note text
  --connected-at           Connection timestamp in ISO 8601 format (defaults to now)
  --credential             Credential name (default: default)
  --help, -h               Show this help message
`);
}

/**
 * 要求并返回目标 DID
 * @param {Object} args - 解析的参数
 * @returns {string} 目标 DID
 */
function _requireTargetDid(args) {
  if (!args.targetDid) {
    console.error('This action requires --target-did');
    process.exit(1);
  }
  return args.targetDid;
}

/**
 * 要求群组沉淀的最小源上下文
 * @param {Object} args - 解析的参数
 */
function _requireGroupContext(args) {
  const missing = [];
  if (!args.sourceType) missing.push('source-type');
  if (!args.sourceName) missing.push('source-name');
  if (!args.sourceGroupId) missing.push('source-group-id');
  if (!args.reason) missing.push('reason');

  if (missing.length > 0) {
    const flags = missing.map(f => `--${f}`).join(' ');
    console.error(`This action requires ${flags}`);
    process.exit(1);
  }
}

/**
 * 将 AI 推荐候选记录为待处理事件
 * @param {Object} args - 解析的参数
 */
function recordRecommendation(args) {
  const identity = _identityOrExit(args.credential);
  const connectedAt = args.connectedAt || _nowIso();
  const conn = localStore.getConnection();
  try {
    localStore.ensureSchema(conn);
    const eventId = localStore.appendRelationshipEvent(conn, {
      ownerDid: String(identity.did),
      targetDid: args.targetDid,
      targetHandle: args.targetHandle,
      eventType: 'ai_recommended',
      sourceType: args.sourceType,
      sourceName: args.sourceName,
      sourceGroupId: args.sourceGroupId,
      reason: args.reason,
      score: args.score,
      status: 'pending',
      metadata: { connected_at: connectedAt },
      credentialName: args.credential,
    });
  } finally {
    conn.close();
  }
  console.log(JSON.stringify({
    ok: true,
    event_id: eventId,
    status: 'pending',
    target_did: args.targetDid,
  }, null, 2));
}

/**
 * 持久化确认的联系人快照和接受事件
 * @param {Object} args - 解析的参数
 */
function saveFromGroup(args) {
  const identity = _identityOrExit(args.credential);
  const connectedAt = args.connectedAt || _nowIso();
  const conn = localStore.getConnection();
  try {
    localStore.ensureSchema(conn);
    localStore.upsertContact(conn, {
      ownerDid: String(identity.did),
      did: args.targetDid,
      handle: args.targetHandle,
      sourceType: args.sourceType,
      sourceName: args.sourceName,
      sourceGroupId: args.sourceGroupId,
      connectedAt: connectedAt,
      recommendedReason: args.reason,
      note: args.text,
    });
    const eventId = localStore.appendRelationshipEvent(conn, {
      ownerDid: String(identity.did),
      targetDid: args.targetDid,
      targetHandle: args.targetHandle,
      eventType: 'saved_to_contacts',
      sourceType: args.sourceType,
      sourceName: args.sourceName,
      sourceGroupId: args.sourceGroupId,
      reason: args.reason,
      score: args.score,
      status: 'accepted',
      metadata: { connected_at: connectedAt, note: args.text },
      credentialName: args.credential,
    });
  } finally {
    conn.close();
  }
  console.log(JSON.stringify({
    ok: true,
    event_id: eventId,
    target_did: args.targetDid,
    saved: true,
  }, null, 2));
}

/**
 * 在本地标记一个联系人为已关注
 * @param {Object} args - 解析的参数
 */
function markFollowed(args) {
  const identity = _identityOrExit(args.credential);
  const conn = localStore.getConnection();
  try {
    localStore.ensureSchema(conn);
    localStore.upsertContact(conn, {
      ownerDid: String(identity.did),
      did: args.targetDid,
      handle: args.targetHandle,
      followed: true,
    });
    const eventId = localStore.appendRelationshipEvent(conn, {
      ownerDid: String(identity.did),
      targetDid: args.targetDid,
      targetHandle: args.targetHandle,
      eventType: 'followed',
      status: 'applied',
      credentialName: args.credential,
    });
  } finally {
    conn.close();
  }
  console.log(JSON.stringify({
    ok: true,
    event_id: eventId,
  }, null, 2));
}

/**
 * 在本地标记一个联系人为已发消息
 * @param {Object} args - 解析的参数
 */
function markMessaged(args) {
  const identity = _identityOrExit(args.credential);
  const conn = localStore.getConnection();
  try {
    localStore.ensureSchema(conn);
    localStore.upsertContact(conn, {
      ownerDid: String(identity.did),
      did: args.targetDid,
      handle: args.targetHandle,
      messaged: true,
    });
    const eventId = localStore.appendRelationshipEvent(conn, {
      ownerDid: String(identity.did),
      targetDid: args.targetDid,
      targetHandle: args.targetHandle,
      eventType: 'messaged',
      status: 'applied',
      credentialName: args.credential,
    });
  } finally {
    conn.close();
  }
  console.log(JSON.stringify({
    ok: true,
    event_id: eventId,
  }, null, 2));
}

/**
 * 更新一个联系人的本地备注
 * @param {Object} args - 解析的参数
 */
function updateNote(args) {
  const identity = _identityOrExit(args.credential);
  const conn = localStore.getConnection();
  try {
    localStore.ensureSchema(conn);
    localStore.upsertContact(conn, {
      ownerDid: String(identity.did),
      did: args.targetDid,
      handle: args.targetHandle,
      note: args.text,
    });
    const eventId = localStore.appendRelationshipEvent(conn, {
      ownerDid: String(identity.did),
      targetDid: args.targetDid,
      targetHandle: args.targetHandle,
      eventType: 'note_updated',
      reason: args.text,
      status: 'applied',
      credentialName: args.credential,
    });
  } finally {
    conn.close();
  }
  console.log(JSON.stringify({
    ok: true,
    event_id: eventId,
  }, null, 2));
}

/**
 * CLI 入口点
 */
function main() {
  configureLogging({
    level: 'INFO',
    consoleLevel: 'INFO',
    force: false,
    config: null,
    prefix: 'awiki-agent',
    mirrorStdio: true
  });

  const args = _buildParser();
  logger.info('manage_contacts CLI started credential=%s', args.credential);

  if (args.recordRecommendation) {
    _requireTargetDid(args);
    _requireGroupContext(args);
    recordRecommendation(args);
  } else if (args.saveFromGroup) {
    _requireTargetDid(args);
    _requireGroupContext(args);
    saveFromGroup(args);
  } else if (args.markFollowed) {
    _requireTargetDid(args);
    markFollowed(args);
  } else if (args.markMessaged) {
    _requireTargetDid(args);
    markMessaged(args);
  } else if (args.note) {
    _requireTargetDid(args);
    if (!args.text) {
      console.error('--note requires --text');
      process.exit(1);
    }
    updateNote(args);
  } else {
    console.error('No action selected');
    process.exit(1);
  }
}

module.exports = {
  // camelCase 导出
  recordRecommendation,
  saveFromGroup,
  markFollowed,
  markMessaged,
  updateNote,
  main,
  // 内部函数导出（用于测试）
  _identityOrExit,
  _nowIso,
  _buildParser,
  _requireTargetDid,
  _requireGroupContext,
  // snake_case 别名（Python 兼容性）
  record_recommendation: recordRecommendation,
  save_from_group: saveFromGroup,
  mark_followed: markFollowed,
  mark_messaged: markMessaged,
  update_note: updateNote,
};
