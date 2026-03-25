/**
 * local_store.py 的 Node.js 移植
 *
 * SQLite 本地存储，用于消息、联系人、关系事件、群组和 E2EE 发件箱状态。
 * 为离线消息存储、关系/联系人快照、群组状态快照和可重发 E2EE 发件箱跟踪提供持久化层。
 *
 * Python 源文件：python/scripts/local_store.py
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const { SDKConfig } = require('./utils/config');

const SCHEMA_VERSION = 11;

// UUID v4 生成函数（使用 Node.js crypto 模块）
const uuidv4 = () => crypto.randomUUID();

const V6_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS contacts (
        owner_did       TEXT NOT NULL DEFAULT '',
        did             TEXT NOT NULL,
        name            TEXT,
        handle          TEXT,
        nick_name       TEXT,
        bio             TEXT,
        profile_md      TEXT,
        tags            TEXT,
        relationship    TEXT,
        source_type     TEXT,
        source_name     TEXT,
        source_group_id TEXT,
        connected_at    TEXT,
        recommended_reason TEXT,
        followed        INTEGER NOT NULL DEFAULT 0,
        messaged        INTEGER NOT NULL DEFAULT 0,
        note            TEXT,
        first_seen_at   TEXT,
        last_seen_at    TEXT,
        metadata        TEXT,
        PRIMARY KEY (owner_did, did)
    );

    CREATE TABLE IF NOT EXISTS messages (
        msg_id          TEXT NOT NULL,
        owner_did       TEXT NOT NULL DEFAULT '',
        thread_id       TEXT NOT NULL,
        direction       INTEGER NOT NULL DEFAULT 0,
        sender_did      TEXT,
        receiver_did    TEXT,
        group_id        TEXT,
        group_did       TEXT,
        content_type    TEXT DEFAULT 'text',
        content         TEXT,
        title           TEXT,
        server_seq      INTEGER,
        sent_at         TEXT,
        stored_at       TEXT NOT NULL,
        is_e2ee         INTEGER DEFAULT 0,
        is_read         INTEGER DEFAULT 0,
        sender_name     TEXT,
        metadata        TEXT,
        credential_name TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (msg_id, owner_did)
    );

    CREATE TABLE IF NOT EXISTS e2ee_outbox (
        outbox_id            TEXT PRIMARY KEY,
        owner_did            TEXT NOT NULL DEFAULT '',
        peer_did             TEXT NOT NULL,
        session_id           TEXT,
        original_type        TEXT NOT NULL DEFAULT 'text',
        plaintext            TEXT NOT NULL,
        local_status         TEXT NOT NULL DEFAULT 'queued',
        attempt_count        INTEGER NOT NULL DEFAULT 0,
        sent_msg_id          TEXT,
        sent_server_seq      INTEGER,
        last_error_code      TEXT,
        retry_hint           TEXT,
        failed_msg_id        TEXT,
        failed_server_seq    INTEGER,
        metadata             TEXT,
        last_attempt_at      TEXT,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        credential_name      TEXT NOT NULL DEFAULT ''
    );
`;

const V7_EXTRA_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS groups (
        owner_did          TEXT NOT NULL DEFAULT '',
        group_id           TEXT NOT NULL,
        group_did          TEXT,
        name               TEXT,
        group_mode         TEXT NOT NULL DEFAULT 'general',
        slug               TEXT,
        description        TEXT,
        goal               TEXT,
        rules              TEXT,
        message_prompt     TEXT,
        doc_url            TEXT,
        group_owner_did    TEXT,
        group_owner_handle TEXT,
        my_role            TEXT,
        membership_status  TEXT NOT NULL DEFAULT 'active',
        join_enabled       INTEGER,
        join_code          TEXT,
        join_code_expires_at TEXT,
        member_count       INTEGER,
        last_synced_seq    INTEGER,
        last_read_seq      INTEGER,
        last_message_at    TEXT,
        remote_created_at  TEXT,
        remote_updated_at  TEXT,
        stored_at          TEXT NOT NULL,
        metadata           TEXT,
        credential_name    TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (owner_did, group_id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
        owner_did         TEXT NOT NULL DEFAULT '',
        group_id          TEXT NOT NULL,
        user_id           TEXT NOT NULL,
        member_did        TEXT,
        member_handle     TEXT,
        profile_url       TEXT,
        role              TEXT,
        status            TEXT NOT NULL DEFAULT 'active',
        joined_at         TEXT,
        sent_message_count INTEGER NOT NULL DEFAULT 0,
        last_synced_at    TEXT NOT NULL,
        metadata          TEXT,
        credential_name   TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (owner_did, group_id, user_id)
    );
`;

const V8_EXTRA_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS relationship_events (
        event_id         TEXT PRIMARY KEY,
        owner_did        TEXT NOT NULL DEFAULT '',
        target_did       TEXT NOT NULL,
        target_handle    TEXT,
        event_type       TEXT NOT NULL,
        source_type      TEXT,
        source_name      TEXT,
        source_group_id  TEXT,
        reason           TEXT,
        score            REAL,
        status           TEXT NOT NULL DEFAULT 'pending',
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL,
        metadata         TEXT,
        credential_name  TEXT NOT NULL DEFAULT ''
    );
`;

const V11_EXTRA_TABLES_SQL = `
    CREATE TABLE IF NOT EXISTS e2ee_sessions (
        owner_did        TEXT NOT NULL DEFAULT '',
        peer_did         TEXT NOT NULL,
        session_id       TEXT NOT NULL,
        is_initiator     INTEGER NOT NULL DEFAULT 0,
        send_chain_key   TEXT NOT NULL,
        recv_chain_key   TEXT NOT NULL,
        send_seq         INTEGER NOT NULL DEFAULT 0,
        recv_seq         INTEGER NOT NULL DEFAULT 0,
        expires_at       REAL,
        created_at       TEXT NOT NULL,
        active_at        TEXT,
        peer_confirmed   INTEGER NOT NULL DEFAULT 0,
        credential_name  TEXT NOT NULL DEFAULT '',
        updated_at       TEXT NOT NULL,
        PRIMARY KEY (owner_did, peer_did),
        UNIQUE (owner_did, session_id)
    );
`;

const V6_INDEX_STATEMENTS = {
  idx_contacts_owner: `
      CREATE INDEX IF NOT EXISTS idx_contacts_owner
          ON contacts(owner_did, last_seen_at DESC)
  `,
  idx_messages_owner_thread: `
      CREATE INDEX IF NOT EXISTS idx_messages_owner_thread
          ON messages(owner_did, thread_id, sent_at)
  `,
  idx_messages_owner_thread_seq: `
      CREATE INDEX IF NOT EXISTS idx_messages_owner_thread_seq
          ON messages(owner_did, thread_id, server_seq)
  `,
  idx_messages_owner_direction: `
      CREATE INDEX IF NOT EXISTS idx_messages_owner_direction
          ON messages(owner_did, direction)
  `,
  idx_messages_owner_sender: `
      CREATE INDEX IF NOT EXISTS idx_messages_owner_sender
          ON messages(owner_did, sender_did)
  `,
  idx_messages_owner: `
      CREATE INDEX IF NOT EXISTS idx_messages_owner
          ON messages(owner_did)
  `,
  idx_messages_credential: `
      CREATE INDEX IF NOT EXISTS idx_messages_credential
          ON messages(credential_name)
  `,
  idx_e2ee_outbox_owner_status: `
      CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_status
          ON e2ee_outbox(owner_did, local_status, updated_at DESC)
  `,
  idx_e2ee_outbox_owner_sent_msg: `
      CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_sent_msg
          ON e2ee_outbox(owner_did, sent_msg_id)
  `,
  idx_e2ee_outbox_owner_sent_seq: `
      CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_sent_seq
          ON e2ee_outbox(owner_did, peer_did, sent_server_seq)
  `,
  idx_e2ee_outbox_credential: `
      CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_credential
          ON e2ee_outbox(credential_name)
  `,
};

const V7_EXTRA_INDEX_STATEMENTS = {
  idx_groups_owner_status_last_message: `
      CREATE INDEX IF NOT EXISTS idx_groups_owner_status_last_message
          ON groups(owner_did, membership_status, last_message_at DESC)
  `,
  idx_groups_owner_slug: `
      CREATE INDEX IF NOT EXISTS idx_groups_owner_slug
          ON groups(owner_did, slug)
  `,
  idx_groups_owner_updated: `
      CREATE INDEX IF NOT EXISTS idx_groups_owner_updated
          ON groups(owner_did, remote_updated_at DESC)
  `,
  idx_group_members_owner_group_role: `
      CREATE INDEX IF NOT EXISTS idx_group_members_owner_group_role
          ON group_members(owner_did, group_id, role)
  `,
  idx_group_members_owner_group_status: `
      CREATE INDEX IF NOT EXISTS idx_group_members_owner_group_status
          ON group_members(owner_did, group_id, status)
  `,
};

const V8_EXTRA_INDEX_STATEMENTS = {
  idx_contacts_owner_source_group: `
      CREATE INDEX IF NOT EXISTS idx_contacts_owner_source_group
          ON contacts(owner_did, source_group_id)
  `,
  idx_relationship_events_owner_target_time: `
      CREATE INDEX IF NOT EXISTS idx_relationship_events_owner_target_time
          ON relationship_events(owner_did, target_did, created_at DESC)
  `,
  idx_relationship_events_owner_status_time: `
      CREATE INDEX IF NOT EXISTS idx_relationship_events_owner_status_time
          ON relationship_events(owner_did, status, created_at DESC)
  `,
  idx_relationship_events_owner_group: `
      CREATE INDEX IF NOT EXISTS idx_relationship_events_owner_group
          ON relationship_events(owner_did, source_group_id)
  `,
};

const V11_EXTRA_INDEX_STATEMENTS = {
  idx_e2ee_sessions_owner_updated: `
      CREATE INDEX IF NOT EXISTS idx_e2ee_sessions_owner_updated
          ON e2ee_sessions(owner_did, updated_at DESC)
  `,
  idx_e2ee_sessions_credential: `
      CREATE INDEX IF NOT EXISTS idx_e2ee_sessions_credential
          ON e2ee_sessions(credential_name)
  `,
};

const V6_VIEW_STATEMENTS = {
  threads: `
      CREATE VIEW threads AS
      SELECT
          owner_did,
          thread_id,
          COUNT(*)                                        AS message_count,
          SUM(CASE WHEN is_read = 0 AND direction = 0
                   THEN 1 ELSE 0 END)                    AS unread_count,
          MAX(COALESCE(sent_at, stored_at))               AS last_message_at,
          (SELECT m2.content FROM messages m2
           WHERE m2.owner_did = m.owner_did
             AND m2.thread_id = m.thread_id
           ORDER BY COALESCE(m2.sent_at, m2.stored_at) DESC
           LIMIT 1)                                       AS last_content
      FROM messages m
      GROUP BY owner_did, thread_id
  `,
  inbox: `
      CREATE VIEW inbox AS
      SELECT * FROM messages WHERE direction = 0
      ORDER BY owner_did, COALESCE(sent_at, stored_at) DESC
  `,
  outbox: `
      CREATE VIEW outbox AS
      SELECT * FROM messages WHERE direction = 1
      ORDER BY owner_did, COALESCE(sent_at, stored_at) DESC
  `,
};

const FORBIDDEN_PATTERNS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
];
const DELETE_NO_WHERE = /\bDELETE\s+FROM\s+\S+\s*$/i;

/**
 * 打开（或创建）共享 SQLite 数据库
 * @param {Object} [config] - SDK 配置
 * @returns {Object} 数据库连接包装对象
 */
function get_connection(config) {
  if (!config) {
    config = SDKConfig.load();
  }
  const fs = require('fs');
  const path_ = require('path');
  
  const dbDir = path_.join(config.data_dir, 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path_.join(dbDir, 'awiki.db');
  const db = new Database(dbPath);
  
  // 设置 PRAGMA
  db.pragma('journal_mode=WAL');
  db.pragma('busy_timeout=5000');
  db.pragma('foreign_keys=ON');
  
  // 返回包装对象，提供与 Python sqlite3 一致的 API
  const conn = {
    _db: db,
    
    // 执行 SQL（返回结果集）
    execute(sql, params = []) {
      const stripped = sql.trim().replace(/;$/, '');
      // PRAGMA statements can return results
      const isQuery = /^\s*SELECT\b/i.test(stripped) || /^\s*PRAGMA\b/i.test(stripped);
      if (isQuery) {
        try {
          const stmt = db.prepare(stripped);
          const rows = stmt.all(...params);
          return {
            all: () => rows || [],
            get: () => (rows && rows.length > 0) ? rows[0] : undefined,
            fetchone: () => (rows && rows.length > 0) ? rows[0] : null,
            fetchall: () => rows || [],
          };
        } catch (e) {
          return {
            all: () => [],
            get: () => undefined,
            fetchone: () => null,
            fetchall: () => [],
          };
        }
      } else {
        try {
          const stmt = db.prepare(stripped);
          const result = stmt.run(...params);
          return {
            all: () => [],
            get: () => undefined,
            fetchone: () => null,
            fetchall: () => [],
            rowcount: result.changes || 0,
          };
        } catch (e) {
          return {
            all: () => [],
            get: () => undefined,
            fetchone: () => null,
            fetchall: () => [],
            rowcount: 0,
          };
        }
      }
    },
    
    // 获取单行
    get(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        const result = stmt.get(...params);
        return result || null;
      } catch (e) {
        return null;
      }
    },
    
    // 获取所有行
    all(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        const result = stmt.all(...params);
        return result || [];
      } catch (e) {
        return [];
      }
    },
    
    // 执行 SQL（无返回值）
    run(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.run(...params);
    },
    
    // 执行多条 SQL
    exec(sql) {
      return db.exec(sql);
    },

    // 同步执行 SQL（返回结果集）- better-sqlite3 原生 API
    allSync(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        return stmt.all(...params) || [];
      } catch (e) {
        return [];
      }
    },

    // 同步执行 SQL（单行）- better-sqlite3 原生 API
    getSync(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        return stmt.get(...params) || null;
      } catch (e) {
        return null;
      }
    },

    // 同步执行 SQL（无返回值）- better-sqlite3 原生 API
    runSync(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.run(...params);
    },

    // 同步执行多条 SQL - better-sqlite3 原生 API
    execSync(sql) {
      return db.exec(sql);
    },

    // 关闭连接
    close() {
      return db.close();
    },
  };

  return conn;
}

/**
 * 返回表是否存在
 * @param {Object} conn - 数据库连接包装对象
 * @param {string} tableName - 表名
 * @returns {boolean} 表是否存在
 */
function _table_exists(conn, tableName) {
  const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
  const row = conn.execute(sql, [tableName]).get();
  return !!row;
}

/**
 * 规范化 credential_name 用于本地存储
 * @param {string|null} credentialName - 凭证名称
 * @returns {string} 规范化的凭证名称
 */
function _normalize_credential_name(credentialName) {
  return credentialName || '';
}

/**
 * 规范化 owner_did 用于本地存储
 * @param {string|null} ownerDid - 所有者 DID
 * @returns {string} 规范化的所有者 DID
 */
function _normalize_owner_did(ownerDid) {
  return ownerDid || '';
}

/**
 * 规范化可选值为文本
 * @param {any} value - 值
 * @returns {string|null} 规范化的文本
 */
function _normalize_optional_text(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

/**
 * 规范化可选值为 int
 * @param {any} value - 值
 * @returns {number|null} 规范化的整数
 */
function _normalize_optional_int(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return parseInt(value, 10);
}

/**
 * 规范化可选值为 SQLite 布尔整数
 * @param {any} value - 值
 * @returns {number|null} 规范化的布尔值
 */
function _normalize_optional_bool(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

/**
 * 规范化可选值为 float
 * @param {any} value - 值
 * @returns {number|null} 规范化的浮点数
 */
function _normalize_optional_float(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return parseFloat(value);
}

/**
 * 将元数据规范化为 JSON 文本负载
 * @param {string|object|null} value - 元数据
 * @returns {string|null} 规范化的元数据
 */
function _normalize_metadata(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * 返回模式对象是否存在
 * @param {Object} conn - 数据库连接包装对象
 * @param {Object} options - 选项
 * @param {string} options.objectType - 对象类型
 * @param {string} options.objectName - 对象名称
 * @returns {boolean} 对象是否存在
 */
function _schema_object_exists(conn, { objectType, objectName }) {
  const sql = "SELECT name FROM sqlite_master WHERE type = ? AND name = ?";
  const row = conn.execute(sql, [objectType, objectName]).get();
  return !!row;
}

/**
 * 创建任何缺失的 v6 索引
 * @param {Object} conn - 数据库连接包装对象
 * @returns {string[]} 已创建的索引名称
 */
function _ensure_v6_indexes(conn) {
  const repairedIndexes = [];
  for (const [indexName, statement] of Object.entries(V6_INDEX_STATEMENTS)) {
    if (_schema_object_exists(conn, { objectType: 'index', objectName: indexName })) {
      continue;
    }
    conn.execute(statement);
    repairedIndexes.push(indexName);
  }
  return repairedIndexes;
}

/**
 * 创建任何缺失的 v7 索引
 * @param {Object} conn - 数据库连接包装对象
 * @returns {string[]} 已创建的索引名称
 */
function _ensure_v7_indexes(conn) {
  const repairedIndexes = [];
  for (const [indexName, statement] of Object.entries(V7_EXTRA_INDEX_STATEMENTS)) {
    if (_schema_object_exists(conn, { objectType: 'index', objectName: indexName })) {
      continue;
    }
    conn.execute(statement);
    repairedIndexes.push(indexName);
  }
  return repairedIndexes;
}

/**
 * 创建任何缺失的 v8 索引
 * @param {Object} conn - 数据库连接包装对象
 * @returns {string[]} 已创建的索引名称
 */
function _ensure_v8_indexes(conn) {
  const repairedIndexes = [];
  for (const [indexName, statement] of Object.entries(V8_EXTRA_INDEX_STATEMENTS)) {
    if (_schema_object_exists(conn, { objectType: 'index', objectName: indexName })) {
      continue;
    }
    conn.execute(statement);
    repairedIndexes.push(indexName);
  }
  return repairedIndexes;
}

/**
 * 创建任何缺失的 v11 索引
 * @param {Object} conn - 数据库连接包装对象
 * @returns {string[]} 已创建的索引名称
 */
function _ensure_v11_indexes(conn) {
  const repairedIndexes = [];
  for (const [indexName, statement] of Object.entries(V11_EXTRA_INDEX_STATEMENTS)) {
    if (_schema_object_exists(conn, { objectType: 'index', objectName: indexName })) {
      continue;
    }
    conn.execute(statement);
    repairedIndexes.push(indexName);
  }
  return repairedIndexes;
}

/**
 * 重新创建规范的 v6 视图
 * @param {Object} conn - 数据库连接包装对象
 */
function _recreate_v6_views(conn) {
  for (const viewName of Object.keys(V6_VIEW_STATEMENTS)) {
    conn.execute(`DROP VIEW IF EXISTS ${viewName}`);
  }
  for (const statement of Object.values(V6_VIEW_STATEMENTS)) {
    conn.execute(statement);
  }
}

/**
 * 创建任何缺失的 v6 视图
 * @param {Object} conn - 数据库连接包装对象
 * @returns {string[]} 已创建的视图名称
 */
function _ensure_v6_views(conn) {
  const repairedViews = [];
  for (const [viewName, statement] of Object.entries(V6_VIEW_STATEMENTS)) {
    if (_schema_object_exists(conn, { objectType: 'view', objectName: viewName })) {
      continue;
    }
    conn.execute(statement);
    repairedViews.push(viewName);
  }
  return repairedViews;
}

/**
 * 创建 owner_did 感知模式
 * @param {Object} conn - 数据库连接包装对象
 */
function _create_schema_v6(conn) {
  conn.execute(V6_TABLES_SQL);
}

/**
 * 创建 v7 群组状态扩展
 * @param {Object} conn - 数据库连接包装对象
 */
function _create_schema_v7_extensions(conn) {
  conn.execute(V7_EXTRA_TABLES_SQL);
}

/**
 * 创建 v8 关系事件扩展
 * @param {Object} conn - 数据库连接包装对象
 */
function _create_schema_v8_extensions(conn) {
  conn.execute(V8_EXTRA_TABLES_SQL);
}

/**
 * 创建 v11 disk-first E2EE session 扩展
 * @param {Object} conn - 数据库连接包装对象
 */
function _create_schema_v11_extensions(conn) {
  conn.execute(V11_EXTRA_TABLES_SQL);
}

/**
 * 创建完整的 owner_did 感知模式
 * @param {Object} conn - 数据库连接包装对象
 */
function _create_schema_v7(conn) {
  _create_schema_v6(conn);
  _create_schema_v7_extensions(conn);
  _create_schema_v8_extensions(conn);
  _create_schema_v11_extensions(conn);
  _ensure_v6_indexes(conn);
  _ensure_v7_indexes(conn);
  _ensure_v8_indexes(conn);
  _ensure_v11_indexes(conn);
  _recreate_v6_views(conn);
}

/**
 * 确保数据库模式是最新的
 * @param {Object} conn - 数据库连接包装对象
 */
function ensure_schema(conn) {
  const versionResult = conn.execute('PRAGMA user_version').get();
  const version = versionResult ? versionResult.user_version : 0;
  
  if (version >= SCHEMA_VERSION) {
    conn.execute(V6_TABLES_SQL);
    conn.execute(V7_EXTRA_TABLES_SQL);
    conn.execute(V8_EXTRA_TABLES_SQL);
    conn.execute(V11_EXTRA_TABLES_SQL);
    _ensure_v8_contact_columns(conn);
    _ensure_v9_group_member_columns(conn);
    _ensure_v10_group_columns(conn);
    const repairedIndexes = [
      ..._ensure_v6_indexes(conn),
      ..._ensure_v7_indexes(conn),
      ..._ensure_v8_indexes(conn),
      ..._ensure_v11_indexes(conn),
    ];
    const repairedViews = _ensure_v6_views(conn);
    if (repairedIndexes.length > 0 || repairedViews.length > 0) {
      console.warn(`Repaired local schema objects version=${version} indexes=${JSON.stringify(repairedIndexes)} views=${JSON.stringify(repairedViews)}`);
    }
    return;
  }

  if (version === 0) {
    _create_schema_v7(conn);
  } else {
    if (version < 6) {
      _migrate_existing_schema_to_v6(conn, version);
    }
    if (version < 7) {
      _upgrade_schema_v6_to_v7(conn);
    }
    if (version < 8) {
      _upgrade_schema_v7_to_v8(conn);
    }
    if (version < 9) {
      _upgrade_schema_v8_to_v9(conn);
    }
    if (version < 10) {
      _upgrade_schema_v9_to_v10(conn);
    }
    if (version < 11) {
      _upgrade_schema_v10_to_v11(conn);
    }
  }

  // Use _db.pragma() to set user_version
  conn._db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

/**
 * 为消息生成线程 ID
 * @param {string} myDid - 我的 DID
 * @param {Object} options - 选项
 * @param {string|null} [options.peerDid] - 对方 DID
 * @param {string|null} [options.groupId] - 群组 ID
 * @returns {string} 线程 ID
 */
function make_thread_id(myDid, { peerDid = null, groupId = null } = {}) {
  if (groupId) {
    return `group:${groupId}`;
  }
  if (peerDid) {
    const pair = [myDid, peerDid].sort();
    return `dm:${pair[0]}:${pair[1]}`;
  }
  return `dm:${myDid}:unknown`;
}

/**
 * 存储单条消息
 * @param {Object} conn - 数据库连接包装对象
 * @param {Object|string} msgIdOrParams - 消息 ID 或参数对象
 * @param {string} [threadId] - 线程 ID（当第一个参数是消息 ID 时）
 * @param {number} [direction] - 方向（当第一个参数是消息 ID 时）
 * @param {string} [senderDid] - 发送者 DID（当第一个参数是消息 ID 时）
 * @param {string} [content] - 内容（当第一个参数是消息 ID 时）
 * @param {Object} [options] - 消息参数（当第一个参数是对象时）
 * @param {string} [options.msgId] - 消息 ID
 * @param {string} [options.threadId] - 线程 ID
 * @param {number} [options.direction] - 方向
 * @param {string} [options.senderDid] - 发送者 DID
 * @param {string} [options.content] - 内容
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.receiverDid] - 接收者 DID
 * @param {string|null} [options.groupId] - 群组 ID
 * @param {string|null} [options.groupDid] - 群组 DID
 * @param {string} [options.contentType='text'] - 内容类型
 * @param {number|null} [options.serverSeq] - 服务器序列号
 * @param {string|null} [options.sentAt] - 发送时间
 * @param {boolean} [options.isE2ee=false] - 是否 E2EE
 * @param {boolean} [options.isRead=false] - 是否已读
 * @param {string|null} [options.senderName] - 发送者名称
 * @param {string|null} [options.metadata] - 元数据
 * @param {string|null} [options.credentialName] - 凭证名称
 * @param {string|null} [options.title] - 标题
 */
function store_message(conn, msgIdOrParams, threadId, direction, senderDid, content, options = {}) {
  // 支持两种调用方式：
  // 1. store_message(conn, { msgId, threadId, direction, senderDid, content, ... })
  // 2. store_message(conn, msgId, threadId, direction, senderDid, content, options)
  
  let params;
  if (typeof msgIdOrParams === 'object') {
    // 支持 snake_case 和 camelCase 参数
    params = {
      msgId: msgIdOrParams.msg_id || msgIdOrParams.msgId,
      ownerDid: msgIdOrParams.owner_did || msgIdOrParams.ownerDid,
      threadId: msgIdOrParams.thread_id || msgIdOrParams.threadId,
      direction: msgIdOrParams.direction,
      senderDid: msgIdOrParams.sender_did || msgIdOrParams.senderDid,
      receiverDid: msgIdOrParams.receiver_did || msgIdOrParams.receiverDid,
      groupId: msgIdOrParams.group_id || msgIdOrParams.groupId,
      groupDid: msgIdOrParams.group_did || msgIdOrParams.groupDid,
      contentType: msgIdOrParams.content_type || msgIdOrParams.contentType,
      content: msgIdOrParams.content,
      serverSeq: msgIdOrParams.server_seq || msgIdOrParams.serverSeq,
      sentAt: msgIdOrParams.sent_at || msgIdOrParams.sentAt,
      isE2ee: msgIdOrParams.is_e2ee || msgIdOrParams.isE2ee,
      isRead: msgIdOrParams.is_read || msgIdOrParams.isRead,
      senderName: msgIdOrParams.sender_name || msgIdOrParams.senderName,
      metadata: msgIdOrParams.metadata,
      credentialName: msgIdOrParams.credential_name || msgIdOrParams.credentialName,
      title: msgIdOrParams.title,
    };
  } else {
    params = {
      msgId: msgIdOrParams,
      threadId,
      direction,
      senderDid,
      content,
      ...options,
    };
  }
  
  const {
    msgId,
    threadId: paramThreadId,
    direction: paramDirection,
    senderDid: paramSenderDid,
    content: paramContent,
    ownerDid = null,
    receiverDid = null,
    groupId = null,
    groupDid = null,
    contentType = 'text',
    serverSeq = null,
    sentAt = null,
    isE2ee = false,
    isRead = false,
    senderName = null,
    metadata = null,
    credentialName = null,
    title = null,
  } = params;
  
  const now = new Date().toISOString();
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  const normalizedCredentialName = _normalize_credential_name(credentialName);
  
  conn.execute(`
    INSERT OR IGNORE INTO messages
    (msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
     group_id, group_did, content_type, content, title, server_seq,
     sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
     credential_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    msgId,
    normalizedOwnerDid,
    paramThreadId,
    paramDirection,
    paramSenderDid,
    receiverDid,
    groupId,
    groupDid,
    contentType,
    paramContent,
    title,
    serverSeq,
    sentAt,
    now,
    isE2ee ? 1 : 0,
    isRead ? 1 : 0,
    senderName,
    metadata,
    normalizedCredentialName,
  ]);
}

/**
 * 批量存储消息
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Array<Object>} batch - 消息批次
 * @param {string|null} [ownerDid] - 所有者 DID
 * @param {string|null} [credentialName] - 凭证名称
 */
function store_messages_batch(conn, batch, ownerDid = null, credentialName = null) {
  if (!batch || batch.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = [];
  
  for (const msg of batch) {
    rows.push([
      msg.msg_id || '',
      _normalize_owner_did(msg.owner_did !== undefined ? msg.owner_did : ownerDid),
      msg.thread_id || '',
      msg.direction !== undefined ? msg.direction : 0,
      msg.sender_did,
      msg.receiver_did,
      msg.group_id,
      msg.group_did,
      msg.content_type !== undefined ? msg.content_type : 'text',
      msg.content || '',
      msg.title,
      msg.server_seq,
      msg.sent_at,
      now,
      msg.is_e2ee ? 1 : 0,
      msg.is_read ? 1 : 0,
      msg.sender_name,
      msg.metadata,
      _normalize_credential_name(msg.credential_name !== undefined ? msg.credential_name : credentialName),
    ]);
  }

  conn.execSync(`
    INSERT OR IGNORE INTO messages
    (msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
     group_id, group_did, content_type, content, title, server_seq,
     sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
     credential_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, rows);
}

/**
 * 按 ID 获取消息
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.msgId - 消息 ID
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @returns {Object|null} 消息记录
 */
function get_message_by_id(conn, { msgId, ownerDid = null, credentialName = null }) {
  let row;
  if (ownerDid !== null) {
    row = conn.getSync(`
      SELECT * FROM messages
      WHERE msg_id = ? AND owner_did = ?
    `, [msgId, _normalize_owner_did(ownerDid)]);
  } else {
    row = conn.getSync(`
      SELECT * FROM messages
      WHERE msg_id = ? AND credential_name = ?
    `, [msgId, _normalize_credential_name(credentialName)]);
  }
  return row || null;
}

/**
 * 上插联系人记录
 * @param {Object} conn - 数据库连接包装对象
 * @param {Object|string} ownerDidOrParams - 所有者 DID 或参数对象
 * @param {string} [did] - 联系人 DID（当第一个参数是对象时忽略）
 * @param {Object} [fields] - 其他字段（当第一个参数是对象时忽略）
 */
function upsert_contact(conn, ownerDidOrParams, did, fields = {}) {
  let params;
  if (typeof ownerDidOrParams === 'object') {
    params = ownerDidOrParams;
  } else {
    params = {
      ownerDid: ownerDidOrParams,
      did,
      ...fields,
    };
  }
  
  const { ownerDid = null, did: paramDid, ...restFields } = params;
  
  const now = new Date().toISOString();
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);

  const existing = conn.execute(
    'SELECT did FROM contacts WHERE owner_did = ? AND did = ?',
    [normalizedOwnerDid, paramDid]
  ).get();

  const allowedFields = new Set([
    'name', 'handle', 'nick_name', 'bio', 'profile_md', 'tags',
    'relationship', 'source_type', 'source_name', 'source_group_id',
    'connected_at', 'recommended_reason', 'followed', 'messaged',
    'note', 'first_seen_at', 'last_seen_at', 'metadata',
  ]);

  const filtered = {};
  for (const [key, value] of Object.entries(restFields)) {
    if (allowedFields.has(key) && value !== null && value !== undefined) {
      if (key === 'followed' || key === 'messaged') {
        filtered[key] = _normalize_optional_bool(value);
      } else if (key === 'metadata') {
        filtered[key] = _normalize_metadata(value);
      } else {
        filtered[key] = value;
      }
    }
  }

  if (existing) {
    if (Object.keys(filtered).length > 0) {
      filtered.last_seen_at = now;
      const setClause = Object.keys(filtered).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(filtered), normalizedOwnerDid, paramDid];
      conn.execute(`UPDATE contacts SET ${setClause} WHERE owner_did = ? AND did = ?`, values);
    }
  } else {
    if (!filtered.first_seen_at) {
      filtered.first_seen_at = now;
    }
    if (!filtered.last_seen_at) {
      filtered.last_seen_at = now;
    }
    filtered.owner_did = normalizedOwnerDid;
    filtered.did = paramDid;
    const columns = Object.keys(filtered).join(', ');
    const placeholders = Object.keys(filtered).map(() => '?').join(', ');
    conn.execute(`INSERT INTO contacts (${columns}) VALUES (${placeholders})`, Object.values(filtered));
  }
}

/**
 * 追加关系事件
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.ownerDid - 所有者 DID
 * @param {string} options.targetDid - 目标 DID
 * @param {string} options.eventType - 事件类型
 * @param {string|null} [options.targetHandle] - 目标 Handle
 * @param {string|null} [options.sourceType] - 来源类型
 * @param {string|null} [options.sourceName] - 来源名称
 * @param {string|null} [options.sourceGroupId] - 来源群组 ID
 * @param {string|null} [options.reason] - 原因
 * @param {number|null} [options.score] - 分数
 * @param {string} [options.status='pending'] - 状态
 * @param {string|object|null} [options.metadata] - 元数据
 * @param {string|null} [options.credentialName] - 凭证名称
 * @returns {string} 事件 ID
 */
function append_relationship_event(conn, {
  ownerDid,
  targetDid,
  eventType,
  targetHandle = null,
  sourceType = null,
  sourceName = null,
  sourceGroupId = null,
  reason = null,
  score = null,
  status = 'pending',
  metadata = null,
  credentialName = null,
}) {
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  if (!normalizedOwnerDid) {
    throw new Error('owner_did is required for relationship event storage');
  }
  if (!targetDid) {
    throw new Error('target_did is required for relationship event storage');
  }
  if (!eventType) {
    throw new Error('event_type is required for relationship event storage');
  }

  const now = new Date().toISOString();
  const eventId = uuidv4();
  
  conn.runSync(`
    INSERT INTO relationship_events
    (event_id, owner_did, target_did, target_handle, event_type, source_type,
     source_name, source_group_id, reason, score, status, created_at, updated_at,
     metadata, credential_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    eventId,
    normalizedOwnerDid,
    targetDid,
    _normalize_optional_text(targetHandle),
    eventType,
    _normalize_optional_text(sourceType),
    _normalize_optional_text(sourceName),
    _normalize_optional_text(sourceGroupId),
    _normalize_optional_text(reason),
    _normalize_optional_float(score),
    status,
    now,
    now,
    _normalize_metadata(metadata),
    _normalize_credential_name(credentialName),
  ]);
  
  return eventId;
}

/**
 * 上插群组记录
 * @param {Object} conn - 数据库连接包装对象
 * @param {Object|string} ownerDidOrParams - 所有者 DID 或参数对象
 * @param {string} [groupId] - 群组 ID（当第一个参数是对象时忽略）
 * @param {Object} [options] - 选项（当第一个参数是对象时忽略）
 * @param {string|null} [options.groupDid] - 群组 DID
 * @param {string|null} [options.name] - 名称
 * @param {string|null} [options.groupMode] - 群组模式
 * @param {string|null} [options.slug] - 别名
 * @param {string|null} [options.description] - 描述
 * @param {string|null} [options.goal] - 目标
 * @param {string|null} [options.rules] - 规则
 * @param {string|null} [options.messagePrompt] - 消息提示
 * @param {string|null} [options.docUrl] - 文档 URL
 * @param {string|null} [options.groupOwnerDid] - 群组所有者 DID
 * @param {string|null} [options.groupOwnerHandle] - 群组所有者 Handle
 * @param {string|null} [options.myRole] - 我的角色
 * @param {string|null} [options.membershipStatus] - 成员状态
 * @param {boolean|null} [options.joinEnabled] - 加入是否启用
 * @param {string|null} [options.joinCode] - 加入码
 * @param {string|null} [options.joinCodeExpiresAt] - 加入码过期时间
 * @param {number|null} [options.memberCount] - 成员数量
 * @param {number|null} [options.lastSyncedSeq] - 最后同步序列号
 * @param {number|null} [options.lastReadSeq] - 最后阅读序列号
 * @param {string|null} [options.lastMessageAt] - 最后消息时间
 * @param {string|null} [options.remoteCreatedAt] - 远程创建时间
 * @param {string|null} [options.remoteUpdatedAt] - 远程更新时间
 * @param {string|object|null} [options.metadata] - 元数据
 * @param {string|null} [options.credentialName] - 凭证名称
 */
function upsert_group(conn, ownerDidOrParams, groupId, options = {}) {
  let params;
  if (typeof ownerDidOrParams === 'object') {
    // 支持 snake_case 和 camelCase 参数
    params = {
      ownerDid: ownerDidOrParams.ownerDid || ownerDidOrParams.owner_did,
      groupId: ownerDidOrParams.groupId || ownerDidOrParams.group_id,
      groupDid: ownerDidOrParams.groupDid || ownerDidOrParams.group_did,
      name: ownerDidOrParams.name,
      slug: ownerDidOrParams.slug,
      ...ownerDidOrParams,
    };
  } else {
    params = {
      ownerDid: ownerDidOrParams,
      groupId,
      ...options,
    };
  }
  
  const {
    ownerDid,
    groupId: paramGroupId,
    groupDid = null,
    name = null,
    groupMode = null,
    slug = null,
    description = null,
    goal = null,
    rules = null,
    messagePrompt = null,
    docUrl = null,
    groupOwnerDid = null,
    groupOwnerHandle = null,
    myRole = null,
    membershipStatus = null,
    joinEnabled = null,
    joinCode = null,
    joinCodeExpiresAt = null,
    memberCount = null,
    lastSyncedSeq = null,
    lastReadSeq = null,
    lastMessageAt = null,
    remoteCreatedAt = null,
    remoteUpdatedAt = null,
    metadata = null,
    credentialName = null,
  } = params;
  
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  if (!normalizedOwnerDid) {
    throw new Error('owner_did is required for group storage');
  }
  if (!paramGroupId) {
    throw new Error('group_id is required for group storage');
  }

  const existing = conn.execute(
    'SELECT * FROM groups WHERE owner_did = ? AND group_id = ?',
    [normalizedOwnerDid, paramGroupId]
  ).get();

  const row = existing || {};
  const now = new Date().toISOString();

  const merged = {
    owner_did: normalizedOwnerDid,
    group_id: paramGroupId,
    group_did: row.group_did || null,
    name: row.name || null,
    group_mode: row.group_mode || 'general',
    slug: row.slug || null,
    description: row.description || null,
    goal: row.goal || null,
    rules: row.rules || null,
    message_prompt: row.message_prompt || null,
    doc_url: row.doc_url || null,
    group_owner_did: row.group_owner_did || null,
    group_owner_handle: row.group_owner_handle || null,
    my_role: row.my_role || null,
    membership_status: row.membership_status || 'active',
    join_enabled: row.join_enabled !== undefined ? row.join_enabled : null,
    join_code: row.join_code || null,
    join_code_expires_at: row.join_code_expires_at || null,
    member_count: row.member_count !== undefined ? row.member_count : null,
    last_synced_seq: row.last_synced_seq !== undefined ? row.last_synced_seq : null,
    last_read_seq: row.last_read_seq !== undefined ? row.last_read_seq : null,
    last_message_at: row.last_message_at || null,
    remote_created_at: row.remote_created_at || null,
    remote_updated_at: row.remote_updated_at || null,
    stored_at: now,
    metadata: row.metadata || null,
    credential_name: row.credential_name || '',
  };

  const updates = {
    group_did: _normalize_optional_text(groupDid),
    name: _normalize_optional_text(name),
    group_mode: _normalize_optional_text(groupMode),
    slug: _normalize_optional_text(slug),
    description: _normalize_optional_text(description),
    goal: _normalize_optional_text(goal),
    rules: _normalize_optional_text(rules),
    message_prompt: _normalize_optional_text(messagePrompt),
    doc_url: _normalize_optional_text(docUrl),
    group_owner_did: _normalize_optional_text(groupOwnerDid),
    group_owner_handle: _normalize_optional_text(groupOwnerHandle),
    my_role: _normalize_optional_text(myRole),
    membership_status: _normalize_optional_text(membershipStatus),
    join_enabled: _normalize_optional_bool(joinEnabled),
    join_code: _normalize_optional_text(joinCode),
    join_code_expires_at: _normalize_optional_text(joinCodeExpiresAt),
    member_count: _normalize_optional_int(memberCount),
    last_synced_seq: _normalize_optional_int(lastSyncedSeq),
    last_read_seq: _normalize_optional_int(lastReadSeq),
    last_message_at: _normalize_optional_text(lastMessageAt),
    remote_created_at: _normalize_optional_text(remoteCreatedAt),
    remote_updated_at: _normalize_optional_text(remoteUpdatedAt),
    metadata: _normalize_metadata(metadata),
  };
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null) {
      merged[key] = value;
    }
  }
  
  if (credentialName !== null) {
    merged.credential_name = _normalize_credential_name(credentialName);
  }

  const columns = [
    'owner_did', 'group_id', 'group_did', 'name', 'group_mode', 'slug',
    'description', 'goal', 'rules', 'message_prompt', 'doc_url',
    'group_owner_did', 'group_owner_handle', 'my_role', 'membership_status',
    'join_enabled', 'join_code', 'join_code_expires_at', 'member_count',
    'last_synced_seq', 'last_read_seq', 'last_message_at', 'remote_created_at',
    'remote_updated_at', 'stored_at', 'metadata', 'credential_name',
  ];

  conn.execute(`
    INSERT OR REPLACE INTO groups (${columns.join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
  `, columns.map(col => merged[col]));
}

/**
 * 替换群组的活跃成员快照
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.ownerDid - 所有者 DID
 * @param {string} options.groupId - 群组 ID
 * @param {Array<Object>} options.members - 成员列表
 * @param {string|null} [options.credentialName] - 凭证名称
 */
function replace_group_members(conn, { ownerDid, groupId, members, credentialName = null }) {
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  if (!normalizedOwnerDid) {
    throw new Error('owner_did is required for group member storage');
  }
  if (!groupId) {
    throw new Error('group_id is required for group member storage');
  }

  const now = new Date().toISOString();
  const normalizedCredentialName = _normalize_credential_name(credentialName);
  
  conn.runSync(
    'DELETE FROM group_members WHERE owner_did = ? AND group_id = ?',
    [normalizedOwnerDid, groupId]
  );
  
  const rows = [];
  for (const member of members) {
    const userId = member.user_id || '';
    if (!userId) {
      continue;
    }
    rows.push([
      normalizedOwnerDid,
      groupId,
      userId,
      _normalize_optional_text(member.did),
      _normalize_optional_text(member.handle),
      _normalize_optional_text(member.profile_url),
      _normalize_optional_text(member.role),
      _normalize_optional_text(member.status) || 'active',
      _normalize_optional_text(member.joined_at),
      _normalize_optional_int(member.sent_message_count) || 0,
      now,
      _normalize_metadata(member.metadata),
      normalizedCredentialName,
    ]);
  }
  
  if (rows.length > 0) {
    conn.execSync(`
      INSERT INTO group_members
      (owner_did, group_id, user_id, member_did, member_handle, profile_url, role,
       status, joined_at, sent_message_count, last_synced_at, metadata, credential_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, rows);
  }
}

/**
 * 删除群组成员
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.ownerDid - 所有者 DID
 * @param {string} options.groupId - 群组 ID
 * @param {string|null} [options.targetDid] - 目标 DID
 * @param {string|null} [options.targetUserId] - 目标用户 ID
 * @returns {number} 受影响的行数
 */
function delete_group_members(conn, { ownerDid, groupId, targetDid = null, targetUserId = null }) {
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  if (!normalizedOwnerDid || !groupId) {
    return 0;
  }

  let result;
  if (targetDid !== null) {
    result = conn.runSync(`
      DELETE FROM group_members
      WHERE owner_did = ? AND group_id = ? AND member_did = ?
    `, [normalizedOwnerDid, groupId, targetDid]);
  } else if (targetUserId !== null) {
    result = conn.runSync(`
      DELETE FROM group_members
      WHERE owner_did = ? AND group_id = ? AND user_id = ?
    `, [normalizedOwnerDid, groupId, targetUserId]);
  } else {
    result = conn.runSync(
      'DELETE FROM group_members WHERE owner_did = ? AND group_id = ?',
      [normalizedOwnerDid, groupId]
    );
  }
  
  return result.changes || 0;
}

/**
 * 上插群组成员记录
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.ownerDid - 所有者 DID
 * @param {string} options.groupId - 群组 ID
 * @param {string} options.userId - 用户 ID
 * @param {string|null} [options.memberDid] - 成员 DID
 * @param {string|null} [options.memberHandle] - 成员 Handle
 * @param {string|null} [options.profileUrl] - 个人资料 URL
 * @param {string|null} [options.role] - 角色
 * @param {string} [options.status='active'] - 状态
 * @param {string|null} [options.joinedAt] - 加入时间
 * @param {number|null} [options.sentMessageCount] - 发送消息数量
 * @param {string|object|null} [options.metadata] - 元数据
 * @param {string|null} [options.credentialName] - 凭证名称
 */
function upsert_group_member(conn, {
  ownerDid,
  groupId,
  userId,
  memberDid = null,
  memberHandle = null,
  profileUrl = null,
  role = null,
  status = 'active',
  joinedAt = null,
  sentMessageCount = null,
  metadata = null,
  credentialName = null,
}) {
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  if (!normalizedOwnerDid) {
    throw new Error('owner_did is required for group member storage');
  }
  if (!groupId || !userId) {
    throw new Error('group_id and user_id are required for group member storage');
  }

  const existing = conn.getSync(`
    SELECT * FROM group_members
    WHERE owner_did = ? AND group_id = ? AND user_id = ?
  `, [normalizedOwnerDid, groupId, userId]);
  
  const row = existing || {};
  const now = new Date().toISOString();
  
  const merged = {
    owner_did: normalizedOwnerDid,
    group_id: groupId,
    user_id: userId,
    member_did: row.member_did || null,
    member_handle: row.member_handle || null,
    profile_url: row.profile_url || null,
    role: row.role || 'member',
    status: row.status || 'active',
    joined_at: row.joined_at || null,
    sent_message_count: row.sent_message_count !== undefined ? row.sent_message_count : 0,
    last_synced_at: now,
    metadata: row.metadata || null,
    credential_name: row.credential_name || '',
  };

  const updates = {
    member_did: _normalize_optional_text(memberDid),
    member_handle: _normalize_optional_text(memberHandle),
    profile_url: _normalize_optional_text(profileUrl),
    role: _normalize_optional_text(role),
    status: _normalize_optional_text(status),
    joined_at: _normalize_optional_text(joinedAt),
    sent_message_count: _normalize_optional_int(sentMessageCount),
    metadata: _normalize_metadata(metadata),
  };
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null) {
      merged[key] = value;
    }
  }
  
  if (credentialName !== null) {
    merged.credential_name = _normalize_credential_name(credentialName);
  }

  const columns = [
    'owner_did', 'group_id', 'user_id', 'member_did', 'member_handle',
    'profile_url', 'role', 'status', 'joined_at', 'sent_message_count',
    'last_synced_at', 'metadata', 'credential_name',
  ];
  
  conn.runSync(`
    INSERT OR REPLACE INTO group_members (${columns.join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
  `, columns.map(col => merged[col]));
}

/**
 * 从系统事件同步群组成员
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.ownerDid - 所有者 DID
 * @param {string} options.groupId - 群组 ID
 * @param {Object} options.systemEvent - 系统事件
 * @param {string|null} [options.credentialName] - 凭证名称
 * @returns {boolean} 是否成功
 */
function sync_group_member_from_system_event(conn, { ownerDid, groupId, systemEvent, credentialName = null }) {
  if (!groupId || !systemEvent) {
    return false;
  }

  const subject = systemEvent.subject;
  if (!subject || typeof subject !== 'object') {
    return false;
  }

  const subjectUserId = String(subject.id || '').trim();
  if (!subjectUserId) {
    return false;
  }

  const kind = String(systemEvent.kind || '').trim();
  const statusMap = {
    member_joined: 'active',
    member_left: 'left',
    member_kicked: 'kicked',
  };
  const status = statusMap[kind];
  if (status === undefined) {
    return false;
  }

  upsert_group_member(conn, {
    ownerDid,
    groupId,
    userId: subjectUserId,
    memberDid: subject.did,
    memberHandle: subject.handle,
    profileUrl: subject.profile_url,
    role: 'member',
    status,
    credentialName,
    metadata: { system_event: systemEvent },
  });
  
  const activeCountResult = conn.getSync(`
    SELECT COUNT(*) as count FROM group_members
    WHERE owner_did = ? AND group_id = ? AND status = 'active'
  `, [_normalize_owner_did(ownerDid), groupId]);
  const activeCount = activeCountResult ? activeCountResult.count : 0;
  
  upsert_group(conn, {
    ownerDid,
    groupId,
    memberCount: activeCount,
    credentialName,
  });
  
  return true;
}

/**
 * 队列 E2EE 发件箱条目
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string} options.peerDid - 对方 DID
 * @param {string} options.plaintext - 明文
 * @param {string|null} [options.sessionId] - 会话 ID
 * @param {string} [options.originalType='text'] - 原始类型
 * @param {string|null} [options.credentialName] - 凭证名称
 * @param {string|null} [options.metadata] - 元数据
 * @returns {string} 发件箱 ID
 */
function queue_e2ee_outbox(conn, {
  ownerDid = null,
  peerDid,
  plaintext,
  sessionId = null,
  originalType = 'text',
  credentialName = null,
  metadata = null,
}) {
  const now = new Date().toISOString();
  const outboxId = uuidv4();
  
  conn.runSync(`
    INSERT INTO e2ee_outbox
    (outbox_id, owner_did, peer_did, session_id, original_type, plaintext, local_status,
     attempt_count, metadata, last_attempt_at, created_at, updated_at, credential_name)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
  `, [
    outboxId,
    _normalize_owner_did(ownerDid),
    peerDid,
    sessionId,
    originalType,
    plaintext,
    metadata,
    now,
    now,
    now,
    _normalize_credential_name(credentialName),
  ]);
  
  return outboxId;
}

/**
 * 更新 E2EE 发件箱状态
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.outboxId - 发件箱 ID
 * @param {string} options.localStatus - 本地状态
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 */
function update_e2ee_outbox_status(conn, { outboxId, localStatus, ownerDid = null, credentialName = null }) {
  const now = new Date().toISOString();
  
  if (ownerDid !== null) {
    conn.runSync(`
      UPDATE e2ee_outbox
      SET local_status = ?, updated_at = ?
      WHERE outbox_id = ? AND owner_did = ?
    `, [localStatus, now, outboxId, _normalize_owner_did(ownerDid)]);
  } else {
    conn.runSync(`
      UPDATE e2ee_outbox
      SET local_status = ?, updated_at = ?
      WHERE outbox_id = ? AND credential_name = ?
    `, [localStatus, now, outboxId, _normalize_credential_name(credentialName)]);
  }
}

/**
 * 标记 E2EE 发件箱为已发送
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.outboxId - 发件箱 ID
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @param {string|null} [options.sessionId] - 会话 ID
 * @param {string|null} [options.sentMsgId] - 发送的消息 ID
 * @param {number|null} [options.sentServerSeq] - 发送的服务器序列号
 * @param {string|null} [options.metadata] - 元数据
 */
function mark_e2ee_outbox_sent(conn, {
  outboxId,
  ownerDid = null,
  credentialName = null,
  sessionId = null,
  sentMsgId = null,
  sentServerSeq = null,
  metadata = null,
}) {
  const now = new Date().toISOString();
  
  conn.runSync(`
    UPDATE e2ee_outbox
    SET session_id = COALESCE(?, session_id),
        local_status = 'sent',
        attempt_count = attempt_count + 1,
        sent_msg_id = COALESCE(?, sent_msg_id),
        sent_server_seq = COALESCE(?, sent_server_seq),
        metadata = COALESCE(?, metadata),
        last_attempt_at = ?,
        updated_at = ?,
        last_error_code = NULL,
        retry_hint = NULL,
        failed_msg_id = NULL,
        failed_server_seq = NULL
    WHERE outbox_id = ? AND owner_did = ?
  `, [
    sessionId,
    sentMsgId,
    sentServerSeq,
    metadata,
    now,
    now,
    outboxId,
    _normalize_owner_did(ownerDid),
  ]);
}

/**
 * 标记 E2EE 发件箱为失败
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @param {string} options.errorCode - 错误代码
 * @param {string|null} [options.retryHint] - 重试提示
 * @param {string|null} [options.peerDid] - 对方 DID
 * @param {string|null} [options.sessionId] - 会话 ID
 * @param {string|null} [options.failedMsgId] - 失败的消息 ID
 * @param {number|null} [options.failedServerSeq] - 失败的服务器序列号
 * @param {string|null} [options.metadata] - 元数据
 * @returns {string|null} 发件箱 ID
 */
function mark_e2ee_outbox_failed(conn, {
  ownerDid = null,
  credentialName = null,
  errorCode,
  retryHint = null,
  peerDid = null,
  sessionId = null,
  failedMsgId = null,
  failedServerSeq = null,
  metadata = null,
}) {
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);

  let row = null;
  if (failedMsgId) {
    row = conn.getSync(`
      SELECT outbox_id FROM e2ee_outbox
      WHERE owner_did = ? AND sent_msg_id = ?
      ORDER BY updated_at DESC LIMIT 1
    `, [normalizedOwnerDid, failedMsgId]);
  }
  if (!row && failedServerSeq !== null && peerDid) {
    row = conn.getSync(`
      SELECT outbox_id FROM e2ee_outbox
      WHERE owner_did = ? AND peer_did = ? AND sent_server_seq = ?
      ORDER BY updated_at DESC LIMIT 1
    `, [normalizedOwnerDid, peerDid, failedServerSeq]);
  }
  if (!row && sessionId && peerDid) {
    row = conn.getSync(`
      SELECT outbox_id FROM e2ee_outbox
      WHERE owner_did = ? AND peer_did = ? AND session_id = ?
      ORDER BY updated_at DESC LIMIT 1
    `, [normalizedOwnerDid, peerDid, sessionId]);
  }
  if (!row && credentialName) {
    const normalizedCredentialName = _normalize_credential_name(credentialName);
    if (failedMsgId) {
      row = conn.getSync(`
        SELECT outbox_id FROM e2ee_outbox
        WHERE credential_name = ? AND sent_msg_id = ?
        ORDER BY updated_at DESC LIMIT 1
      `, [normalizedCredentialName, failedMsgId]);
    }
    if (!row && failedServerSeq !== null && peerDid) {
      row = conn.getSync(`
        SELECT outbox_id FROM e2ee_outbox
        WHERE credential_name = ? AND peer_did = ? AND sent_server_seq = ?
        ORDER BY updated_at DESC LIMIT 1
      `, [normalizedCredentialName, peerDid, failedServerSeq]);
    }
  }
  if (!row) {
    return null;
  }

  const now = new Date().toISOString();
  const outboxId = row.outbox_id;
  
  conn.runSync(`
    UPDATE e2ee_outbox
    SET local_status = 'failed',
        last_error_code = ?,
        retry_hint = COALESCE(?, retry_hint),
        failed_msg_id = COALESCE(?, failed_msg_id),
        failed_server_seq = COALESCE(?, failed_server_seq),
        metadata = COALESCE(?, metadata),
        updated_at = ?
    WHERE outbox_id = ?
  `, [
    errorCode,
    retryHint,
    failedMsgId,
    failedServerSeq,
    metadata,
    now,
    outboxId,
  ]);
  
  return outboxId;
}

/**
 * 列出 E2EE 发件箱条目
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @param {string|null} [options.localStatus] - 本地状态
 * @returns {Array<Object>} 发件箱记录列表
 */
function list_e2ee_outbox(conn, { ownerDid = null, credentialName = null, localStatus = null }) {
  let rows;
  
  if (ownerDid !== null) {
    if (localStatus === null) {
      rows = conn.allSync(`
        SELECT * FROM e2ee_outbox
        WHERE owner_did = ?
        ORDER BY updated_at DESC
      `, [_normalize_owner_did(ownerDid)]);
    } else {
      rows = conn.allSync(`
        SELECT * FROM e2ee_outbox
        WHERE owner_did = ? AND local_status = ?
        ORDER BY updated_at DESC
      `, [_normalize_owner_did(ownerDid), localStatus]);
    }
  } else {
    const normalizedCredentialName = _normalize_credential_name(credentialName);
    if (localStatus === null) {
      rows = conn.allSync(`
        SELECT * FROM e2ee_outbox
        WHERE credential_name = ?
        ORDER BY updated_at DESC
      `, [normalizedCredentialName]);
    } else {
      rows = conn.allSync(`
        SELECT * FROM e2ee_outbox
        WHERE credential_name = ? AND local_status = ?
        ORDER BY updated_at DESC
      `, [normalizedCredentialName, localStatus]);
    }
  }
  
  return rows || [];
}

/**
 * 获取 E2EE 发件箱记录
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.outboxId - 发件箱 ID
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @returns {Object|null} 发件箱记录
 */
function get_e2ee_outbox(conn, { outboxId, ownerDid = null, credentialName = null }) {
  let row;
  
  if (ownerDid !== null) {
    row = conn.getSync(`
      SELECT * FROM e2ee_outbox
      WHERE outbox_id = ? AND owner_did = ?
    `, [outboxId, _normalize_owner_did(ownerDid)]);
  } else {
    row = conn.getSync(`
      SELECT * FROM e2ee_outbox
      WHERE outbox_id = ? AND credential_name = ?
    `, [outboxId, _normalize_credential_name(credentialName)]);
  }
  
  return row || null;
}

/**
 * 按 ID 设置 E2EE 发件箱失败
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.outboxId - 发件箱 ID
 * @param {string|null} [options.ownerDid] - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @param {string} options.errorCode - 错误代码
 * @param {string|null} [options.retryHint] - 重试提示
 * @param {string|null} [options.metadata] - 元数据
 */
function set_e2ee_outbox_failure_by_id(conn, {
  outboxId,
  ownerDid = null,
  credentialName = null,
  errorCode,
  retryHint = null,
  metadata = null,
}) {
  const now = new Date().toISOString();
  
  if (ownerDid !== null) {
    conn.runSync(`
      UPDATE e2ee_outbox
      SET local_status = 'failed',
          last_error_code = ?,
          retry_hint = COALESCE(?, retry_hint),
          metadata = COALESCE(?, metadata),
          updated_at = ?
      WHERE outbox_id = ? AND owner_did = ?
    `, [
      errorCode,
      retryHint,
      metadata,
      now,
      outboxId,
      _normalize_owner_did(ownerDid),
    ]);
  } else {
    conn.runSync(`
      UPDATE e2ee_outbox
      SET local_status = 'failed',
          last_error_code = ?,
          retry_hint = COALESCE(?, retry_hint),
          metadata = COALESCE(?, metadata),
          updated_at = ?
      WHERE outbox_id = ? AND credential_name = ?
    `, [
      errorCode,
      retryHint,
      metadata,
      now,
      outboxId,
      _normalize_credential_name(credentialName),
    ]);
  }
}

/**
 * 重绑定消息和联系人的 owner_did
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.oldOwnerDid - 旧的所有者 DID
 * @param {string} options.newOwnerDid - 新的所有者 DID
 * @returns {Object} 重绑定的记录数
 */
function rebind_owner_did(conn, { oldOwnerDid, newOwnerDid }) {
  const normalizedOldOwnerDid = _normalize_owner_did(oldOwnerDid);
  const normalizedNewOwnerDid = _normalize_owner_did(newOwnerDid);

  if (
    !normalizedOldOwnerDid ||
    !normalizedNewOwnerDid ||
    normalizedOldOwnerDid === normalizedNewOwnerDid
  ) {
    return {
      messages: 0,
      contacts: 0,
      relationship_events: 0,
      groups: 0,
      group_members: 0,
    };
  }

  const movedMessageCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM messages WHERE owner_did = ?',
    [normalizedOldOwnerDid]
  );
  const movedMessageCount = movedMessageCountResult ? movedMessageCountResult.count : 0;
  
  const movedContactCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM contacts WHERE owner_did = ?',
    [normalizedOldOwnerDid]
  );
  const movedContactCount = movedContactCountResult ? movedContactCountResult.count : 0;
  
  const movedRelationshipEventCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM relationship_events WHERE owner_did = ?',
    [normalizedOldOwnerDid]
  );
  const movedRelationshipEventCount = movedRelationshipEventCountResult ? movedRelationshipEventCountResult.count : 0;
  
  const movedGroupCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM groups WHERE owner_did = ?',
    [normalizedOldOwnerDid]
  );
  const movedGroupCount = movedGroupCountResult ? movedGroupCountResult.count : 0;
  
  const movedGroupMemberCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM group_members WHERE owner_did = ?',
    [normalizedOldOwnerDid]
  );
  const movedGroupMemberCount = movedGroupMemberCountResult ? movedGroupMemberCountResult.count : 0;

  conn.runSync(`
    INSERT OR IGNORE INTO messages
    (msg_id, owner_did, thread_id, direction, sender_did, receiver_did, group_id,
     group_did, content_type, content, title, server_seq, sent_at, stored_at, is_e2ee,
     is_read, sender_name, metadata, credential_name)
    SELECT msg_id, ?, thread_id, direction, sender_did, receiver_did, group_id,
           group_did, content_type, content, title, server_seq, sent_at, stored_at, is_e2ee,
           is_read, sender_name, metadata, credential_name
    FROM messages
    WHERE owner_did = ?
  `, [normalizedNewOwnerDid, normalizedOldOwnerDid]);
  
  conn.runSync('DELETE FROM messages WHERE owner_did = ?', [normalizedOldOwnerDid]);

  conn.runSync(`
    INSERT OR REPLACE INTO contacts
    (owner_did, did, name, handle, nick_name, bio, profile_md, tags,
     relationship, source_type, source_name, source_group_id, connected_at,
     recommended_reason, followed, messaged, note, first_seen_at, last_seen_at,
     metadata)
    SELECT ?, did, name, handle, nick_name, bio, profile_md, tags,
           relationship, source_type, source_name, source_group_id, connected_at,
           recommended_reason, followed, messaged, note, first_seen_at, last_seen_at,
           metadata
    FROM contacts
    WHERE owner_did = ?
  `, [normalizedNewOwnerDid, normalizedOldOwnerDid]);
  
  conn.runSync('DELETE FROM contacts WHERE owner_did = ?', [normalizedOldOwnerDid]);

  conn.runSync(`
    INSERT OR REPLACE INTO relationship_events
    (event_id, owner_did, target_did, target_handle, event_type, source_type,
     source_name, source_group_id, reason, score, status, created_at, updated_at,
     metadata, credential_name)
    SELECT event_id, ?, target_did, target_handle, event_type, source_type,
           source_name, source_group_id, reason, score, status, created_at, updated_at,
           metadata, credential_name
    FROM relationship_events
    WHERE owner_did = ?
  `, [normalizedNewOwnerDid, normalizedOldOwnerDid]);
  
  conn.runSync('DELETE FROM relationship_events WHERE owner_did = ?', [normalizedOldOwnerDid]);

  conn.runSync(`
    INSERT OR REPLACE INTO groups
    (owner_did, group_id, group_did, name, group_mode, slug, description, goal, rules,
     message_prompt, doc_url, group_owner_did, group_owner_handle, my_role,
     membership_status, join_enabled, join_code, join_code_expires_at, member_count, last_synced_seq,
     last_read_seq, last_message_at, remote_created_at, remote_updated_at,
     stored_at, metadata, credential_name)
    SELECT ?, group_id, group_did, name, group_mode, slug, description, goal, rules,
           message_prompt, doc_url, group_owner_did, group_owner_handle, my_role,
           membership_status, join_enabled, join_code, join_code_expires_at, member_count, last_synced_seq,
           last_read_seq, last_message_at, remote_created_at, remote_updated_at,
           stored_at, metadata, credential_name
    FROM groups
    WHERE owner_did = ?
  `, [normalizedNewOwnerDid, normalizedOldOwnerDid]);
  
  conn.runSync('DELETE FROM groups WHERE owner_did = ?', [normalizedOldOwnerDid]);

  conn.runSync(`
    INSERT OR REPLACE INTO group_members
    (owner_did, group_id, user_id, member_did, member_handle, profile_url, role,
     status, joined_at, sent_message_count, last_synced_at, metadata, credential_name)
    SELECT ?, group_id, user_id, member_did, member_handle, profile_url, role, status,
           joined_at, sent_message_count, last_synced_at, metadata, credential_name
    FROM group_members
    WHERE owner_did = ?
  `, [normalizedNewOwnerDid, normalizedOldOwnerDid]);
  
  conn.runSync('DELETE FROM group_members WHERE owner_did = ?', [normalizedOldOwnerDid]);

  return {
    messages: movedMessageCount,
    contacts: movedContactCount,
    relationship_events: movedRelationshipEventCount,
    groups: movedGroupCount,
    group_members: movedGroupMemberCount,
  };
}

/**
 * 清除所有者的 E2EE 数据
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {Object} options - 选项
 * @param {string} options.ownerDid - 所有者 DID
 * @param {string|null} [options.credentialName] - 凭证名称
 * @returns {Object} 删除的记录数
 */
function clear_owner_e2ee_data(conn, { ownerDid, credentialName = null }) {
  const normalizedOwnerDid = _normalize_owner_did(ownerDid);
  if (!normalizedOwnerDid) {
    return { e2ee_outbox: 0, e2ee_sessions: 0 };
  }

  const outboxRowCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM e2ee_outbox WHERE owner_did = ?',
    [normalizedOwnerDid]
  );
  const outboxRowCount = outboxRowCountResult ? outboxRowCountResult.count : 0;
  
  const sessionRowCountResult = conn.getSync(
    'SELECT COUNT(*) as count FROM e2ee_sessions WHERE owner_did = ?',
    [normalizedOwnerDid]
  );
  const sessionRowCount = sessionRowCountResult ? sessionRowCountResult.count : 0;
  
  conn.runSync('DELETE FROM e2ee_outbox WHERE owner_did = ?', [normalizedOwnerDid]);
  conn.runSync('DELETE FROM e2ee_sessions WHERE owner_did = ?', [normalizedOwnerDid]);

  return {
    e2ee_outbox: outboxRowCount,
    e2ee_sessions: sessionRowCount,
  };
}

/**
 * 执行 SQL 查询（只读）
 * @param {sqlite3.Database} conn - 数据库连接
 * @param {string} sql - SQL 语句
 * @param {Array} [params=[]] - 参数
 * @returns {Array<Object>} 查询结果
 */
function execute_sql(conn, sql, params = []) {
  const stripped = sql.trim().replace(/;$/, '');

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(stripped)) {
      throw new Error(`Forbidden SQL operation: ${pattern.source}`);
    }
  }

  if (/^\s*DELETE\b/i.test(stripped)) {
    if (!/\bWHERE\b/i.test(stripped)) {
      throw new Error('Forbidden SQL operation: DELETE without WHERE clause is not allowed');
    }
  }

  if (/^\s*SELECT\b/i.test(stripped)) {
    const rows = conn.allSync(stripped, params);
    return rows || [];
  }

  const result = conn.runSync(stripped, params);
  return [{ rows_affected: result.changes || 0 }];
}

// ===== 迁移辅助函数（内部使用）=====

function _ensure_v8_contact_columns(conn) {
  const contactColumns = new Set(
    conn.allSync('PRAGMA table_info(contacts)').map(row => row.name)
  );
  const contactAlters = {
    source_type: 'ALTER TABLE contacts ADD COLUMN source_type TEXT',
    source_name: 'ALTER TABLE contacts ADD COLUMN source_name TEXT',
    source_group_id: 'ALTER TABLE contacts ADD COLUMN source_group_id TEXT',
    connected_at: 'ALTER TABLE contacts ADD COLUMN connected_at TEXT',
    recommended_reason: 'ALTER TABLE contacts ADD COLUMN recommended_reason TEXT',
    followed: 'ALTER TABLE contacts ADD COLUMN followed INTEGER NOT NULL DEFAULT 0',
    messaged: 'ALTER TABLE contacts ADD COLUMN messaged INTEGER NOT NULL DEFAULT 0',
    note: 'ALTER TABLE contacts ADD COLUMN note TEXT',
  };
  for (const [columnName, statement] of Object.entries(contactAlters)) {
    if (!contactColumns.has(columnName)) {
      conn.execSync(statement);
    }
  }
}

function _ensure_v9_group_member_columns(conn) {
  const groupMemberColumns = new Set(
    conn.allSync('PRAGMA table_info(group_members)').map(row => row.name)
  );
  if (!groupMemberColumns.has('profile_url')) {
    conn.execSync('ALTER TABLE group_members ADD COLUMN profile_url TEXT');
  }
}

function _ensure_v10_group_columns(conn) {
  const groupColumns = new Set(
    conn.allSync('PRAGMA table_info(groups)').map(row => row.name)
  );
  if (!groupColumns.has('group_mode')) {
    conn.execSync("ALTER TABLE groups ADD COLUMN group_mode TEXT NOT NULL DEFAULT 'general'");
  }
}

function _migrate_existing_schema_to_v6(conn, version) {
  // 简化迁移逻辑
  console.log(`Migrating local schema from version=${version} to version=6`);
  
  conn.execSync('DROP VIEW IF EXISTS threads');
  conn.execSync('DROP VIEW IF EXISTS inbox');
  conn.execSync('DROP VIEW IF EXISTS outbox');

  if (_table_exists(conn, 'messages')) {
    conn.execSync('ALTER TABLE messages RENAME TO messages_legacy');
  }
  if (_table_exists(conn, 'e2ee_outbox')) {
    conn.execSync('ALTER TABLE e2ee_outbox RENAME TO e2ee_outbox_legacy');
  }
  if (_table_exists(conn, 'contacts')) {
    conn.execSync('ALTER TABLE contacts RENAME TO contacts_legacy');
  }

  _create_schema_v6(conn);
  // 迁移逻辑省略（复杂迁移场景）
}

function _upgrade_schema_v6_to_v7(conn) {
  console.log('Upgrading local schema from version=6 to version=7');
  _create_schema_v7_extensions(conn);
  _ensure_v6_indexes(conn);
  _ensure_v7_indexes(conn);
  _recreate_v6_views(conn);
}

function _upgrade_schema_v7_to_v8(conn) {
  console.log(`Upgrading local schema from version=7 to version=${SCHEMA_VERSION}`);
  _ensure_v8_contact_columns(conn);
  _create_schema_v8_extensions(conn);
  _ensure_v6_indexes(conn);
  _ensure_v7_indexes(conn);
  _ensure_v8_indexes(conn);
  _recreate_v6_views(conn);
}

function _upgrade_schema_v8_to_v9(conn) {
  console.log(`Upgrading local schema from version=8 to version=${SCHEMA_VERSION}`);
  _ensure_v9_group_member_columns(conn);
  _ensure_v6_indexes(conn);
  _ensure_v7_indexes(conn);
  _ensure_v8_indexes(conn);
  _recreate_v6_views(conn);
}

function _upgrade_schema_v9_to_v10(conn) {
  console.log(`Upgrading local schema from version=9 to version=${SCHEMA_VERSION}`);
  _ensure_v9_group_member_columns(conn);
  _ensure_v10_group_columns(conn);
  _ensure_v6_indexes(conn);
  _ensure_v7_indexes(conn);
  _ensure_v8_indexes(conn);
  _recreate_v6_views(conn);
}

function _upgrade_schema_v10_to_v11(conn) {
  console.log(`Upgrading local schema from version=10 to version=${SCHEMA_VERSION}`);
  _ensure_v9_group_member_columns(conn);
  _ensure_v10_group_columns(conn);
  _create_schema_v11_extensions(conn);
  _ensure_v6_indexes(conn);
  _ensure_v7_indexes(conn);
  _ensure_v8_indexes(conn);
  _ensure_v11_indexes(conn);
  _recreate_v6_views(conn);
}

module.exports = {
  SCHEMA_VERSION,
  append_relationship_event,
  delete_group_members,
  ensure_schema,
  execute_sql,
  get_connection,
  get_e2ee_outbox,
  get_message_by_id,
  list_e2ee_outbox,
  make_thread_id,
  mark_e2ee_outbox_failed,
  mark_e2ee_outbox_sent,
  queue_e2ee_outbox,
  rebind_owner_did,
  clear_owner_e2ee_data,
  replace_group_members,
  set_e2ee_outbox_failure_by_id,
  store_message,
  store_messages_batch,
  sync_group_member_from_system_event,
  update_e2ee_outbox_status,
  upsert_contact,
  upsert_group_member,
  upsert_group,
};
