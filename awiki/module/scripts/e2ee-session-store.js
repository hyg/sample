/**
 * SQLite-backed E2EE session state store.
 *
 * Node.js implementation based on Python version:
 * python/scripts/e2ee_session_store.py
 *
 * [INPUT]: local_store SQLite connection/schema, credential_store identity keys,
 *          legacy JSON E2EE state (migration), and utils.e2ee E2eeClient export/
 *          restore helpers
 * [OUTPUT]: Disk-first E2EE client load/save helpers plus SQLite transaction
 *           wrapper for state mutations
 * [POS]: Persistence bridge between E2EE runtime code and awiki.db, replacing
 *        JSON-file session truth with SQLite rows and transactional updates
 */

const { E2eeClient } = require('./utils/e2ee');
const { load_identity } = require('./credential-store');
const { load_e2ee_state, delete_e2ee_state } = require('./e2ee_store');
const local_store = require('./local-store');

const _STATE_VERSION = "hpke_v1";

/**
 * Return the current UTC time as an ISO 8601 string.
 * @returns {string} ISO format timestamp
 */
function _utc_now_iso() {
  return new Date().toISOString();
}

/**
 * Load the credential's E2EE private keys.
 * @param {string} credentialName - Credential name
 * @returns {[string|null, string|null]} Tuple of (signing private PEM, agreement private PEM)
 */
function _load_key_material(credentialName) {
  const cred = load_identity(credentialName);
  if (cred === null) {
    return [null, null];
  }
  return [
    cred.e2ee_signing_private_pem || null,
    cred.e2ee_agreement_private_pem || null
  ];
}

/**
 * Build an E2eeClient.from_state payload from SQLite rows.
 * @param {Object} options - Options
 * @param {Array} options.rows - SQLite rows
 * @param {string} options.localDid - Local DID
 * @param {string|null} options.signingPem - Signing PEM
 * @param {string|null} options.x25519Pem - X25519 PEM
 * @returns {Object} E2EE state dictionary
 */
function _rows_to_state({ rows, localDid, signingPem, x25519Pem }) {
  const sessions = [];
  const confirmedSessionIds = [];

  for (const row of rows) {
    const session = {
      session_id: row.session_id,
      local_did: localDid,
      peer_did: row.peer_did,
      is_initiator: !!row.is_initiator,
      send_chain_key: row.send_chain_key,
      recv_chain_key: row.recv_chain_key,
      send_seq: row.send_seq,
      recv_seq: row.recv_seq,
      expires_at: row.expires_at,
      created_at: row.created_at,
      active_at: row.active_at
    };
    sessions.push(session);

    if (row.peer_confirmed) {
      confirmedSessionIds.push(row.session_id);
    }
  }

  return {
    version: _STATE_VERSION,
    local_did: localDid,
    signing_pem: signingPem,
    x25519_pem: x25519Pem,
    confirmed_session_ids: confirmedSessionIds.sort(),
    sessions: sessions
  };
}

/**
 * Load all persisted E2EE sessions for one owner.
 * @param {Object} conn - SQLite connection
 * @param {Object} options - Options
 * @param {string} options.localDid - Local DID
 * @returns {Array} List of session rows
 */
function _load_rows_locked(conn, { localDid }) {
  const sql = `
    SELECT owner_did, peer_did, session_id, is_initiator, send_chain_key,
           recv_chain_key, send_seq, recv_seq, expires_at, created_at,
           active_at, peer_confirmed, credential_name, updated_at
    FROM e2ee_sessions
    WHERE owner_did = ?
    ORDER BY peer_did
  `;
  const stmt = conn._db.prepare(sql);
  return stmt.all(localDid);
}

/**
 * Persist the current E2EE client state into SQLite rows.
 * @param {Object} conn - SQLite connection
 * @param {Object} options - Options
 * @param {string} options.localDid - Local DID
 * @param {string} options.credentialName - Credential name
 * @param {E2eeClient} options.client - E2EE client
 * @param {Set<string>} options.loadedPeerDids - Loaded peer DID set
 */
function _save_rows_locked(conn, { localDid, credentialName, client, loadedPeerDids }) {
  const state = client.export_state();
  const sessions = state.sessions || [];
  const confirmedIds = new Set(state.confirmed_session_ids || []);

  const currentPeerDids = new Set();
  for (const session of sessions) {
    if (session.peer_did) {
      currentPeerDids.add(String(session.peer_did));
    }
  }

  // Delete sessions for peers that no longer exist
  for (const removedPeerDid of Array.from(loadedPeerDids).filter(did => !currentPeerDids.has(did)).sort()) {
    const deleteSql = conn._db.prepare(
      "DELETE FROM e2ee_sessions WHERE owner_did = ? AND peer_did = ?"
    );
    deleteSql.run(localDid, removedPeerDid);
  }

  // Insert or update sessions
  const insertSql = conn._db.prepare(`
    INSERT INTO e2ee_sessions
    (owner_did, peer_did, session_id, is_initiator, send_chain_key,
     recv_chain_key, send_seq, recv_seq, expires_at, created_at,
     active_at, peer_confirmed, credential_name, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_did, peer_did) DO UPDATE SET
        session_id = excluded.session_id,
        is_initiator = excluded.is_initiator,
        send_chain_key = excluded.send_chain_key,
        recv_chain_key = excluded.recv_chain_key,
        send_seq = excluded.send_seq,
        recv_seq = excluded.recv_seq,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at,
        active_at = excluded.active_at,
        peer_confirmed = excluded.peer_confirmed,
        credential_name = excluded.credential_name,
        updated_at = excluded.updated_at
  `);

  const now = _utc_now_iso();
  for (const session of sessions) {
    const peerDid = String(session.peer_did);
    const sessionId = String(session.session_id);
    const createdAt = session.created_at || now;

    insertSql.run(
      localDid,
      peerDid,
      sessionId,
      session.is_initiator ? 1 : 0,
      session.send_chain_key,
      session.recv_chain_key,
      session.send_seq !== undefined ? session.send_seq : 0,
      session.recv_seq !== undefined ? session.recv_seq : 0,
      session.expires_at !== undefined ? session.expires_at : null,
      createdAt,
      session.active_at !== undefined ? session.active_at : null,
      confirmedIds.has(sessionId) ? 1 : 0,
      credentialName,
      now
    );
  }
}

/**
 * Import legacy JSON E2EE state into SQLite on first access.
 * @param {Object} conn - SQLite connection
 * @param {Object} options - Options
 * @param {string} options.localDid - Local DID
 * @param {string} options.credentialName - Credential name
 * @param {string|null} options.signingPem - Signing PEM
 * @param {string|null} options.x25519Pem - X25519 PEM
 * @returns {Array} Migrated session rows
 */
function _migrate_legacy_json_locked(conn, { localDid, credentialName, signingPem, x25519Pem }) {
  let existingRows = _load_rows_locked(conn, { localDid });
  if (existingRows.length > 0) {
    return existingRows;
  }

  const legacyState = load_e2ee_state(credentialName);
  if (legacyState === null || legacyState.local_did !== localDid) {
    return existingRows;
  }

  if (signingPem !== null) {
    legacyState.signing_pem = signingPem;
  }
  if (x25519Pem !== null) {
    legacyState.x25519_pem = x25519Pem;
  }

  const client = E2eeClient.from_state(legacyState);
  _save_rows_locked(conn, {
    localDid,
    credentialName,
    client,
    loadedPeerDids: new Set()
  });

  delete_e2ee_state(credentialName);
  return _load_rows_locked(conn, { localDid });
}

/**
 * Load a disk-first E2EE client inside an open SQLite transaction.
 * @param {Object} conn - SQLite connection
 * @param {Object} options - Options
 * @param {string} options.localDid - Local DID
 * @param {string} options.credentialName - Credential name
 * @returns {[E2eeClient, Set<string>]} Tuple of (E2EE client, loaded peer DID set)
 */
function _load_client_locked(conn, { localDid, credentialName }) {
  const [signingPem, x25519Pem] = _load_key_material(credentialName);

  const rows = _migrate_legacy_json_locked(conn, {
    localDid,
    credentialName,
    signingPem,
    x25519Pem
  });

  let client;
  let loadedPeerDids;

  if (rows.length > 0) {
    const state = _rows_to_state({
      rows,
      localDid,
      signingPem,
      x25519Pem
    });
    client = E2eeClient.from_state(state);
    loadedPeerDids = new Set(rows.map(row => String(row.peer_did)));
  } else {
    client = new E2eeClient(localDid, { signingPem, x25519Pem });
    loadedPeerDids = new Set();
  }

  return [client, loadedPeerDids];
}

/**
 * SQLite-backed transaction wrapper for one E2EE client mutation.
 */
class E2eeStateTransaction {
  /**
   * Create a new E2eeStateTransaction.
   * @param {Object} options - Options
   * @param {string} options.localDid - Local DID
   * @param {string} [options.credentialName="default"] - Credential name
   */
  constructor({ localDid, credentialName = "default" } = {}) {
    this.local_did = localDid;
    this.credential_name = credentialName;

    this._conn = local_store.get_connection();
    local_store.ensure_schema(this._conn);
    this._conn._db.exec("BEGIN IMMEDIATE");

    const [client, loadedPeerDids] = _load_client_locked(this._conn, {
      localDid: this.local_did,
      credentialName: this.credential_name
    });
    this.client = client;
    this._loaded_peer_dids = loadedPeerDids;
    this._closed = false;
  }

  /**
   * Persist the in-memory client back into SQLite and commit.
   */
  commit() {
    _save_rows_locked(this._conn, {
      localDid: this.local_did,
      credentialName: this.credential_name,
      client: this.client,
      loadedPeerDids: this._loaded_peer_dids
    });
    this._conn._db.exec("COMMIT");
    this._closed = true;
  }

  /**
   * Commit a read-only transaction (for migration side effects only).
   */
  commit_without_saving() {
    this._conn._db.exec("COMMIT");
    this._closed = true;
  }

  /**
   * Rollback any pending SQLite changes.
   */
  rollback() {
    this._conn._db.exec("ROLLBACK");
    this._closed = true;
  }

  /**
   * Close the underlying SQLite connection.
   */
  close() {
    if (!this._closed) {
      this.rollback();
    }
    this._conn.close();
  }

  /**
   * Context manager exit handler.
   * @param {any} excType - Exception type
   * @param {any} exc - Exception
   * @param {any} tb - Traceback
   * @returns {null} Always returns null
   */
  [Symbol.dispose]() {
    this.close();
    return null;
  }
}

/**
 * Load the latest E2EE state from SQLite (migrating legacy JSON if needed).
 * @param {string} localDid - Local DID
 * @param {string} [credentialName="default"] - Credential name
 * @returns {E2eeClient} Loaded E2EE client
 */
function load_e2ee_client(localDid, credentialName = "default") {
  const tx = new E2eeStateTransaction({ localDid, credentialName });
  try {
    tx.commit_without_saving();
    return tx.client;
  } finally {
    tx.close();
  }
}

/**
 * Persist one E2EE client into SQLite using a fresh transaction.
 * @param {E2eeClient} client - E2EE client
 * @param {string} [credentialName="default"] - Credential name
 */
function save_e2ee_client(client, credentialName = "default") {
  const tx = new E2eeStateTransaction({ localDid: client.local_did, credentialName });
  try {
    tx.client = client;
    tx.commit();
  } finally {
    tx.close();
  }
}

module.exports = {
  E2eeStateTransaction,
  load_e2ee_client,
  save_e2ee_client,
  // Also export with snake_case for compatibility
  E2ee_state_transaction: E2eeStateTransaction,
  load_e2ee_client: load_e2ee_client,
  save_e2ee_client: save_e2ee_client
};
