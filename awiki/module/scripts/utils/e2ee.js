/**
 * E2EE end-to-end encryption client (wraps ANP e2e_encryption_hpke).
 *
 * Python 源文件：python/scripts/utils/e2ee.py
 * 分析报告：doc/scripts/utils/e2ee.py/py.md
 * 蒸馏数据：doc/scripts/utils/e2ee.py/py.json
 *
 * [INPUT]: ANP E2eeHpkeSession / HpkeKeyManager / detect_message_type, local_did,
 *          signing_pem (secp256r1 key-2), x25519_pem (key-3)
 * [OUTPUT]: E2eeClient class providing high-level API for one-step initialization,
 *           encryption, decryption, proof-field-compatible protocol processing,
 *           state export/restore, and canonical e2ee_error message text generation
 * [POS]: Wraps ANP's underlying HPKE E2EE protocol (RFC 9180 + Chain Ratchet) to provide
 *        a simple encrypt/decrypt interface for upper-layer applications;
 *        supports cross-process state persistence and emits sender-facing e2ee_error
 *        responses for terminal protocol failures
 */

// 延迟加载依赖
let _E2eeHpkeSession = null;
let _SessionState = null;
let _HpkeKeyManager = null;
let _MessageType = null;
let _generate_proof = null;
let _validate_proof = null;
let _detect_message_type = null;
let _extract_x25519_public_key_from_did_document = null;
let _extract_signing_public_key_from_did_document = null;
let _resolve_did_wba_document = null;
let _SeqManager = null;
let _SeqMode = null;
let _load_pem_private_key = null;
let _ec = null;
let _X25519PrivateKey = null;

// 常量
const SUPPORTED_E2EE_VERSION = "1.1";
const _STATE_VERSION = "hpke_v1";

/**
 * 初始化依赖
 * @private
 */
function _initDeps() {
  if (_E2eeHpkeSession === null) {
    const e2eEncryption = require('../../lib/anp-0.6.8/e2e_encryption_hpke');
    _E2eeHpkeSession = e2eEncryption.E2eeHpkeSession;
    _SessionState = e2eEncryption.SessionState;
    _HpkeKeyManager = e2eEncryption.HpkeKeyManager;
    _MessageType = e2eEncryption.MessageType;
    _generate_proof = e2eEncryption.generate_proof;
    _validate_proof = e2eEncryption.validate_proof;
    _detect_message_type = e2eEncryption.detect_message_type;
    _extract_x25519_public_key_from_did_document = e2eEncryption.extract_x25519_public_key_from_did_document;
    _extract_signing_public_key_from_did_document = e2eEncryption.extract_signing_public_key_from_did_document;
  }
  if (_resolve_did_wba_document === null) {
    const authentication = require('../../lib/anp-0.6.8/authentication');
    _resolve_did_wba_document = authentication.resolve_did_wba_document;
  }
  if (_SeqManager === null) {
    const sessionModule = require('../../lib/anp-0.6.8/e2e_encryption_hpke/session');
    _SeqManager = sessionModule.SeqManager;
    _SeqMode = sessionModule.SeqMode;
  }
  if (_load_pem_private_key === null) {
    const serialization = require('cryptography').hazmat.primitives.serialization;
    _load_pem_private_key = serialization.load_pem_private_key;
  }
  if (_ec === null) {
    const crypto = require('cryptography');
    _ec = crypto.hazmat.primitives.asymmetric.ec;
    _X25519PrivateKey = crypto.hazmat.primitives.asymmetric.x25519.X25519PrivateKey;
  }
}

/**
 * 提取证明验证方法（兼容 snake_case 和 camelCase）
 *
 * @param {any} proof - E2EE 消息内容中的证明对象
 * @returns {string} 验证方法 ID，如果不可用则返回空字符串
 * @private
 */
function _extract_proof_verification_method(proof) {
  if (typeof proof !== 'object' || proof === null) {
    return "";
  }
  return String(
    proof.verification_method ||
    proof.verificationMethod ||
    ""
  );
}

/**
 * 验证 E2EE 内容版本
 *
 * @param {Object} content - E2EE 内容字典
 * @returns {string} 版本号
 * @throws {Error} 如果版本不支持
 */
function ensure_supported_e2ee_version(content) {
  const version = String(content.e2ee_version || "").trim();
  if (!version) {
    throw new Error(`unsupported_version: missing e2ee_version (required ${SUPPORTED_E2EE_VERSION})`);
  }
  if (version !== SUPPORTED_E2EE_VERSION) {
    throw new Error(`unsupported_version: expected ${SUPPORTED_E2EE_VERSION}, got ${version}`);
  }
  return version;
}

/**
 * 构建 E2EE 错误载荷
 *
 * @param {string} errorCode - 错误码
 * @param {Object} options - 可选参数
 * @param {string|null} [options.sessionId=null] - 会话 ID
 * @param {string|null} [options.failedMsgId=null] - 失败的消息 ID
 * @param {number|null} [options.failedServerSeq=null] - 失败的服务器序列号
 * @param {string|null} [options.retryHint=null] - 重试提示
 * @param {string|null} [options.requiredE2eeVersion=null] - 要求的 E2EE 版本
 * @param {string|null} [options.message=null] - 错误消息
 * @returns {Object} E2EE 错误内容字典
 */
function build_e2ee_error_content(
  errorCode,
  {
    sessionId = null,
    failedMsgId = null,
    failedServerSeq = null,
    retryHint = null,
    requiredE2eeVersion = null,
    message = null
  } = {}
) {
  const content = {
    e2ee_version: SUPPORTED_E2EE_VERSION,
    error_code: errorCode
  };
  if (sessionId !== null) {
    content.session_id = sessionId;
  }
  if (failedMsgId !== null) {
    content.failed_msg_id = failedMsgId;
  }
  if (failedServerSeq !== null) {
    content.failed_server_seq = failedServerSeq;
  }
  if (retryHint !== null) {
    content.retry_hint = retryHint;
  }
  if (requiredE2eeVersion !== null) {
    content.required_e2ee_version = requiredE2eeVersion;
  }
  if (message !== null) {
    content.message = message;
  }
  return content;
}

/**
 * 构建人类可读的 e2ee_error 消息
 *
 * @param {string} errorCode - 错误码
 * @param {Object} options - 可选参数
 * @param {string|null} [options.requiredE2eeVersion=null] - 要求的 E2EE 版本
 * @param {string|null} [options.detail=null] - 详细信息
 * @returns {string} 错误消息文本
 */
function build_e2ee_error_message(
  errorCode,
  {
    requiredE2eeVersion = null,
    detail = null
  } = {}
) {
  const version = requiredE2eeVersion || SUPPORTED_E2EE_VERSION;
  const baseMessages = {
    unsupported_version: `Peer E2EE content version is unsupported. Please upgrade to e2ee_version=${version}.`,
    session_not_found: "E2EE session was not found on the receiver. Please rekey or re-initialize before resending.",
    session_expired: "E2EE session has expired. Please rekey and resend the message.",
    decryption_failed: "E2EE decryption failed on the receiver. You may resend the message or rekey and resend.",
    invalid_seq: "E2EE message sequence is invalid. Please rekey before resending.",
    proof_expired: "The E2EE control message expired before it was processed. Please resend it with a fresh timestamp.",
    proof_from_future: "The E2EE control message timestamp is too far in the future. Please sync the sender clock and resend."
  };
  let message = baseMessages[errorCode] || "E2EE processing failed.";
  if (detail) {
    return `${message} Detail: ${detail}`;
  }
  return message;
}

/**
 * 将协议处理失败映射到发送方可视的错误码
 *
 * @param {Error} exc - 异常对象
 * @returns {Array<[string, string]>|null} [错误码，重试提示] 或 null
 * @private
 */
function _classify_protocol_error(exc) {
  const msg = String(exc.message || exc).toLowerCase();
  if (msg.includes("unsupported_version")) {
    return ["unsupported_version", "drop"];
  }
  if (msg.includes("proof_expired")) {
    return ["proof_expired", "resend"];
  }
  if (msg.includes("proof_from_future")) {
    return ["proof_from_future", "drop"];
  }
  return null;
}

/**
 * E2EE 端到端加密客户端 (HPKE 方案)
 *
 * 封装 ANP E2eeHpkeSession 和 HpkeKeyManager，提供:
 * - 一步会话初始化 (无需多步握手)
 * - 消息加密和解密 (Chain Ratchet 前向保密)
 * - 过期会话清理
 *
 * 密钥设计：E2EE 使用两个独立的密钥对
 * - key-2 secp256r1: 证明签名 (身份验证)
 * - key-3 X25519: HPKE 密钥协商
 * 两者都与 DID 身份密钥 (secp256k1 key-1) 分开
 */
class E2eeClient {
  /**
   * 初始化 E2EE 客户端
   *
   * @param {string} localDid - 本地 DID 标识符
   * @param {Object} options - 可选参数
   * @param {string|null} [options.signingPem=null] - secp256r1 签名密钥 PEM (key-2)
   * @param {string|null} [options.x25519Pem=null] - X25519 协商密钥 PEM (key-3)
   */
  constructor(localDid, { signingPem = null, x25519Pem = null } = {}) {
    _initDeps();
    this.local_did = localDid;
    this._signing_pem = signingPem;
    this._x25519_pem = x25519Pem;

    // 加载密钥对象
    this._signing_key = null;
    if (signingPem !== null) {
      const key = _load_pem_private_key(Buffer.from(signingPem, 'utf-8'), null);
      if (key instanceof _ec.EllipticCurvePrivateKey) {
        this._signing_key = key;
      }
    }

    this._x25519_key = null;
    if (x25519Pem !== null) {
      const key = _load_pem_private_key(Buffer.from(x25519Pem, 'utf-8'), null);
      if (key instanceof _X25519PrivateKey) {
        this._x25519_key = key;
      }
    }

    this._key_manager = new _HpkeKeyManager();
    this._confirmed_session_ids = new Set();
  }

  /**
   * 发起 E2EE 会话 (一步初始化)
   *
   * 从 peer 的 DID 文档中获取 X25519 公钥，然后创建会话并发送 e2ee_init。
   * 会话在发送后立即变为 ACTIVE，无需 peer 响应。
   *
   * @param {string} peerDid - Peer DID 标识符
   * @returns {Promise<[string, Object]>} (msg_type, content_dict) 元组，msg_type 为 "e2ee_init"
   * @throws {Error} 如果缺少必需的密钥或无法获取 peer DID 文档
   */
  async initiate_handshake(peerDid) {
    if (this._signing_key === null || this._x25519_key === null) {
      throw new Error("Missing E2EE keys (signing_pem or x25519_pem), please recreate identity");
    }

    // 获取 peer DID 文档
    const peerDoc = await _resolve_did_wba_document(peerDid);
    if (peerDoc === null) {
      throw new Error(`Unable to retrieve peer DID document: ${peerDid}`);
    }

    // 提取 peer X25519 公钥
    const [peerPk, peerKeyId] = _extract_x25519_public_key_from_did_document(peerDoc);

    // 确定本地签名验证方法 ID
    const signingVm = `${this.local_did}#key-2`;

    // 确定本地 X25519 密钥 ID
    const localX25519KeyId = `${this.local_did}#key-3`;

    const session = new _E2eeHpkeSession(
      this.local_did,
      peerDid,
      this._x25519_key,
      localX25519KeyId,
      this._signing_key,
      signingVm
    );

    const [msgType, content] = session.initiate_session(peerPk, peerKeyId);

    // 一步初始化：发送后立即 ACTIVE
    this._key_manager.register_session(session);

    return [msgType, content];
  }

  /**
   * 处理接收的 E2EE 协议消息
   *
   * @param {string} msgType - 消息类型 (e2ee_init/e2ee_rekey/e2ee_error)
   * @param {Object} content - 消息内容字典
   * @returns {Promise<Array<[string, Object]>>} 要发送的消息列表 (HPKE 方案通常为空)
   */
  async process_e2ee_message(msgType, content) {
    if (msgType === "e2ee_ack") {
      return await this._handle_ack(content);
    }

    const detected = _detect_message_type(msgType);
    if (detected === null) {
      console.warn(`Unrecognized E2EE message type: ${msgType}`);
      return [];
    }

    if (detected !== _MessageType.E2EE_ERROR) {
      try {
        ensure_supported_e2ee_version(content);
      } catch (exc) {
        console.warn(`Unsupported E2EE version for ${msgType}: ${exc.message}`);
        const senderDid = content.sender_did;
        if (senderDid) {
          return [[
            "e2ee_error",
            build_e2ee_error_content(
              "unsupported_version",
              {
                sessionId: content.session_id,
                retryHint: "drop",
                requiredE2eeVersion: SUPPORTED_E2EE_VERSION,
                message: build_e2ee_error_message(
                  "unsupported_version",
                  { requiredE2eeVersion: SUPPORTED_E2EE_VERSION }
                )
              }
            )
          ]];
        }
        return [];
      }
    }

    if (detected === _MessageType.E2EE_INIT) {
      return await this._handle_init(content);
    } else if (detected === _MessageType.E2EE_REKEY) {
      return await this._handle_rekey(content);
    } else if (detected === _MessageType.E2EE_ERROR) {
      return await this._handle_error(content);
    } else if (detected === _MessageType.E2EE_MSG) {
      console.warn("process_e2ee_message does not handle encrypted messages, use decrypt_message instead");
      return [];
    } else {
      console.warn(`Unhandled E2EE message subtype: ${detected}`);
      return [];
    }
  }

  /**
   * 检查是否存在与指定 peer 的活跃会话
   *
   * @param {string} peerDid - Peer DID 标识符
   * @returns {boolean} 是否存在活跃会话
   */
  has_active_session(peerDid) {
    const session = this._key_manager.get_active_session(this.local_did, peerDid);
    return session !== null;
  }

  /**
   * 检查指定的 session_id 是否存在且活跃
   *
   * @param {string|null} sessionId - 会话 ID
   * @returns {boolean} 会话是否存在
   */
  has_session_id(sessionId) {
    if (!sessionId) {
      return false;
    }
    return this._key_manager.get_session_by_id(sessionId) !== null;
  }

  /**
   * 检查会话是否已通过 e2ee_ack 远程确认
   *
   * @param {string|null} sessionId - 会话 ID
   * @returns {boolean} 会话是否已确认
   */
  is_session_confirmed(sessionId) {
    if (!sessionId) {
      return false;
    }
    return this._confirmed_session_ids.has(sessionId);
  }

  /**
   * 确保与 peer 存在活跃会话，自动握手
   *
   * @param {string} peerDid - Peer DID 标识符
   * @returns {Promise<Array<[string, Object]>>} 要发送的握手消息列表 (空或 [("e2ee_init", ...)])
   * @throws {Error} 如果缺少必需的密钥或无法获取 peer DID 文档
   */
  async ensure_active_session(peerDid) {
    if (this.has_active_session(peerDid)) {
      return [];
    }
    const [msgType, content] = await this.initiate_handshake(peerDid);
    console.info(`Auto-handshake initiated for expired/missing session: peer=${peerDid.substring(0, 20)}`);
    return [[msgType, content]];
  }

  /**
   * 加密消息
   *
   * @param {string} peerDid - Peer DID 标识符
   * @param {string} plaintext - 明文内容
   * @param {string} [originalType="text"] - 原始消息类型
   * @returns {[string, Object]} (msg_type, content_dict) 元组，msg_type 为 "e2ee_msg"
   * @throws {Error} 如果与 peer 没有活跃会话
   */
  encrypt_message(peerDid, plaintext, originalType = "text") {
    const session = this._key_manager.get_active_session(this.local_did, peerDid);
    if (session === null) {
      throw new Error(`No active E2EE session with ${peerDid}`);
    }
    return session.encrypt_message(originalType, plaintext);
  }

  /**
   * 解密消息
   *
   * @param {Object} content - 加密消息内容字典 (包含 session_id, ciphertext 等)
   * @returns {[string, string]} (original_type, plaintext) 元组
   * @throws {Error} 如果找不到对应的会话
   */
  decrypt_message(content) {
    const sessionId = content.session_id;
    if (!sessionId) {
      throw new Error("Message missing session_id");
    }

    ensure_supported_e2ee_version(content);

    const session = this._key_manager.get_session_by_id(sessionId);
    if (session === null) {
      throw new Error(`Cannot find session for session_id=${sessionId}`);
    }
    return session.decrypt_message(content);
  }

  /**
   * 清理过期会话
   */
  cleanup_expired() {
    this._key_manager.cleanup_expired();
  }

  /**
   * 导出客户端状态 (用于持久化)
   *
   * @returns {Object} JSON 可序列化的字典
   */
  export_state() {
    const sessions = [];
    for (const session of Object.values(this._key_manager._sessions_by_did_pair)) {
      if (session.state === _SessionState.ACTIVE && !session.is_expired()) {
        const exported = this._export_session(session);
        if (exported !== null) {
          sessions.push(exported);
        }
      }
    }
    return {
      version: _STATE_VERSION,
      local_did: this.local_did,
      signing_pem: this._signing_pem,
      x25519_pem: this._x25519_pem,
      confirmed_session_ids: Array.from(this._confirmed_session_ids).sort(),
      sessions: sessions
    };
  }

  /**
   * 从导出 dict 恢复客户端
   *
   * @param {Object} state - export_state() 生成的字典
   * @returns {E2eeClient} 恢复的 E2eeClient 实例
   */
  static from_state(state) {
    _initDeps();
    // 检测旧格式：无版本标记或版本不匹配
    if (state.version !== _STATE_VERSION) {
      console.info("Detected old E2EE state format, creating new client");
      return new E2eeClient(
        state.local_did,
        {
          signingPem: state.signing_pem,
          x25519Pem: state.x25519_pem
        }
      );
    }

    const client = new E2eeClient(
      state.local_did,
      {
        signingPem: state.signing_pem,
        x25519Pem: state.x25519_pem
      }
    );
    for (const sessionData of state.sessions || []) {
      const session = E2eeClient._restore_session(sessionData);
      if (session !== null) {
        client._key_manager.register_session(session);
      }
    }
    client._confirmed_session_ids = new Set(state.confirmed_session_ids || []);
    return client;
  }

  /**
   * 构建已接受会话的签名 e2ee_ack 载荷
   *
   * @param {Object} options - 参数
   * @param {string} options.sessionId - 会话 ID
   * @param {string} options.recipientDid - 接收者 DID
   * @param {number} [options.expires=86400] - 过期时间 (秒)
   * @returns {Object} e2ee_ack 内容
   * @private
   */
  _build_ack_content({ sessionId, recipientDid, expires = 86400 } = {}) {
    if (this._signing_key === null) {
      throw new Error("Missing E2EE signing key for ack");
    }
    const content = {
      e2ee_version: SUPPORTED_E2EE_VERSION,
      session_id: sessionId,
      sender_did: this.local_did,
      recipient_did: recipientDid,
      expires: expires
    };
    return _generate_proof(content, this._signing_key, `${this.local_did}#key-2`);
  }

  /**
   * 序列化单个 ACTIVE 会话
   *
   * @param {E2eeHpkeSession} session - 会话对象
   * @returns {Object|null} 序列化的会话数据
   * @private
   */
  _export_session(session) {
    if (session.state !== _SessionState.ACTIVE) {
      return null;
    }
    const sendChainKey = session._send_chain_key;
    const recvChainKey = session._recv_chain_key;
    if (sendChainKey === null || recvChainKey === null) {
      return null;
    }
    return {
      session_id: session.session_id,
      local_did: session.local_did,
      peer_did: session.peer_did,
      is_initiator: session._is_initiator,
      send_chain_key: Buffer.from(sendChainKey).toString('base64'),
      recv_chain_key: Buffer.from(recvChainKey).toString('base64'),
      send_seq: session._seq_manager._send_seq,
      recv_seq: session._seq_manager._recv_seq,
      expires_at: session._expires_at,
      created_at: session._created_at,
      active_at: session._active_at
    };
  }

  /**
   * 从 dict 恢复单个 ACTIVE 会话
   *
   * @param {Object} data - 序列化的会话数据
   * @returns {E2eeHpkeSession|null} 恢复的会话对象
   * @private
   */
  static _restore_session(data) {
    _initDeps();
    const expiresAt = data.expires_at;
    if (expiresAt !== null && expiresAt !== undefined && Date.now() / 1000 > expiresAt) {
      return null;
    }

    const session = Object.create(_E2eeHpkeSession.prototype);
    session.local_did = data.local_did;
    session.peer_did = data.peer_did;
    session._session_id = data.session_id;
    session._state = _SessionState.ACTIVE;
    session._is_initiator = data.is_initiator !== undefined ? data.is_initiator : true;
    session._send_chain_key = Buffer.from(data.send_chain_key, 'base64');
    session._recv_chain_key = Buffer.from(data.recv_chain_key, 'base64');
    session._expires_at = expiresAt;
    session._created_at = data.created_at !== undefined ? data.created_at : Math.floor(Date.now() / 1000);
    session._active_at = data.active_at;

    // 恢复 SeqManager
    const seqMgr = Object.create(_SeqManager.prototype);
    seqMgr._mode = _SeqMode.STRICT;
    seqMgr._send_seq = data.send_seq !== undefined ? data.send_seq : 0;
    seqMgr._recv_seq = data.recv_seq !== undefined ? data.recv_seq : 0;
    seqMgr._max_skip = 256;
    seqMgr._used_seqs = {};
    seqMgr._skip_key_ttl = 300;
    session._seq_manager = seqMgr;

    // ACTIVE 状态不需要的属性，设为 null 防止 AttributeError
    session._local_x25519_private_key = null;
    session._local_x25519_key_id = "";
    session._signing_private_key = null;
    session._signing_verification_method = "";
    session._default_expires = data.expires_at !== undefined ? data.expires_at : 86400;

    return session;
  }

  /**
   * 处理 e2ee_init：获取发送者 DID 文档以验证证明，创建并激活会话
   *
   * @param {Object} content - e2ee_init 消息内容
   * @returns {Promise<Array<[string, Object]>>} 要发送的消息列表
   * @private
   */
  async _handle_init(content) {
    if (this._signing_key === null || this._x25519_key === null) {
      console.error("Missing E2EE keys, cannot process e2ee_init");
      return [];
    }

    const senderDid = content.sender_did || "";
    if (!senderDid) {
      console.warn("e2ee_init message missing sender_did");
      return [];
    }

    // 获取发送者 DID 文档
    const senderDoc = await _resolve_did_wba_document(senderDid);
    if (senderDoc === null) {
      console.warn(`Unable to retrieve sender DID document: ${senderDid}`);
      return [];
    }

    // 提取发送者签名公钥 (用于证明验证)
    const proof = content.proof || {};
    const vmId = _extract_proof_verification_method(proof);
    let senderSigningPk;
    try {
      senderSigningPk = _extract_signing_public_key_from_did_document(senderDoc, vmId);
    } catch (e) {
      console.warn(`Unable to extract sender signing public key: ${e.message}`);
      return [];
    }

    // 确定本地密钥 ID
    const signingVm = `${this.local_did}#key-2`;
    const localX25519KeyId = `${this.local_did}#key-3`;

    const session = new _E2eeHpkeSession(
      this.local_did,
      senderDid,
      this._x25519_key,
      localX25519KeyId,
      this._signing_key,
      signingVm
    );

    try {
      session.process_init(content, senderSigningPk);
    } catch (e) {
      console.warn(`Failed to process e2ee_init: ${e.message}`);
      const classified = _classify_protocol_error(e);
      if (classified === null) {
        return [];
      }
      const [errorCode, retryHint] = classified;
      return [[
        "e2ee_error",
        build_e2ee_error_content(
          errorCode,
          {
            sessionId: content.session_id,
            retryHint: retryHint,
            requiredE2eeVersion: errorCode === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
            message: build_e2ee_error_message(
              errorCode,
              {
                requiredE2eeVersion: errorCode === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
                detail: String(e)
              }
            )
          }
        )
      ]];
    }

    // 注册会话 (立即 ACTIVE)
    this._key_manager.register_session(session);
    console.info(
      `E2EE session activated (receiver): ${session.local_did} <-> ${session.peer_did} (session_id=${session.session_id})`
    );

    const ackContent = this._build_ack_content({
      sessionId: session.session_id || content.session_id || "",
      recipientDid: senderDid,
      expires: content.expires !== undefined ? content.expires : 86400
    });
    this._confirmed_session_ids.add(session.session_id || content.session_id || "");
    return [["e2ee_ack", ackContent]];
  }

  /**
   * 处理 e2ee_rekey：重建会话
   *
   * @param {Object} content - e2ee_rekey 消息内容
   * @returns {Promise<Array<[string, Object]>>} 要发送的消息列表
   * @private
   */
  async _handle_rekey(content) {
    if (this._signing_key === null || this._x25519_key === null) {
      console.error("Missing E2EE keys, cannot process e2ee_rekey");
      return [];
    }

    const senderDid = content.sender_did || "";
    if (!senderDid) {
      console.warn("e2ee_rekey message missing sender_did");
      return [];
    }

    // 获取发送者 DID 文档
    const senderDoc = await _resolve_did_wba_document(senderDid);
    if (senderDoc === null) {
      console.warn(`Unable to retrieve sender DID document: ${senderDid}`);
      return [];
    }

    // 提取发送者签名公钥
    const proof = content.proof || {};
    const vmId = _extract_proof_verification_method(proof);
    let senderSigningPk;
    try {
      senderSigningPk = _extract_signing_public_key_from_did_document(senderDoc, vmId);
    } catch (e) {
      console.warn(`Unable to extract sender signing public key: ${e.message}`);
      return [];
    }

    const signingVm = `${this.local_did}#key-2`;
    const localX25519KeyId = `${this.local_did}#key-3`;

    // 尝试获取现有会话进行 rekey
    const session = this._key_manager.get_active_session(this.local_did, senderDid);
    if (session !== null) {
      try {
        session.process_rekey(content, senderSigningPk);
        this._key_manager.register_session(session);
        console.info(
          `E2EE session rekey successful: ${this.local_did} <-> ${senderDid}`
        );
        const ackContent = this._build_ack_content({
          sessionId: session.session_id || content.session_id || "",
          recipientDid: senderDid,
          expires: content.expires !== undefined ? content.expires : 86400
        });
        this._confirmed_session_ids.add(session.session_id || content.session_id || "");
        return [["e2ee_ack", ackContent]];
      } catch (e) {
        console.warn(`Rekey of existing session failed, attempting to create new session: ${e.message}`);
      }
    }

    // 没有现有会话或 rekey 失败，创建新会话
    const newSession = new _E2eeHpkeSession(
      this.local_did,
      senderDid,
      this._x25519_key,
      localX25519KeyId,
      this._signing_key,
      signingVm
    );
    try {
      newSession.process_rekey(content, senderSigningPk);
    } catch (e) {
      console.warn(`Failed to process e2ee_rekey: ${e.message}`);
      const classified = _classify_protocol_error(e);
      if (classified === null) {
        return [];
      }
      const [errorCode, retryHint] = classified;
      return [[
        "e2ee_error",
        build_e2ee_error_content(
          errorCode,
          {
            sessionId: content.session_id,
            retryHint: retryHint,
            requiredE2eeVersion: errorCode === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
            message: build_e2ee_error_message(
              errorCode,
              {
                requiredE2eeVersion: errorCode === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
                detail: String(e)
              }
            )
          }
        )
      ]];
    }

    this._key_manager.register_session(newSession);
    console.info(
      `E2EE session rekey (new): ${this.local_did} <-> ${senderDid}`
    );
    const ackContent = this._build_ack_content({
      sessionId: newSession.session_id || content.session_id || "",
      recipientDid: senderDid,
      expires: content.expires !== undefined ? content.expires : 86400
    });
    this._confirmed_session_ids.add(newSession.session_id || content.session_id || "");
    return [["e2ee_ack", ackContent]];
  }

  /**
   * 处理 e2ee_ack：验证证明并标记会话为已确认
   *
   * @param {Object} content - e2ee_ack 消息内容
   * @returns {Promise<Array<[string, Object]>>} 要发送的消息列表
   * @private
   */
  async _handle_ack(content) {
    try {
      ensure_supported_e2ee_version(content);
    } catch (exc) {
      console.warn(`Ignoring legacy e2ee_ack without supported version: ${exc.message}`);
      return [];
    }

    const sessionId = content.session_id || "";
    const senderDid = content.sender_did || "";
    const recipientDid = content.recipient_did || "";
    if (!sessionId || !senderDid) {
      console.warn("e2ee_ack missing session_id or sender_did");
      return [];
    }
    if (recipientDid && recipientDid !== this.local_did) {
      console.warn(`e2ee_ack recipient mismatch: expected=${this.local_did} got=${recipientDid}`);
      return [];
    }

    const senderDoc = await _resolve_did_wba_document(senderDid);
    if (senderDoc === null) {
      console.warn(`Unable to retrieve ack sender DID document: ${senderDid}`);
      return [];
    }

    const proof = content.proof || {};
    const vmId = _extract_proof_verification_method(proof);
    try {
      const senderSigningPk = _extract_signing_public_key_from_did_document(senderDoc, vmId);
      _validate_proof(
        content,
        senderSigningPk,
        { max_past_age_seconds: content.expires !== undefined ? content.expires : 86400 }
      );
    } catch (exc) {
      console.warn(`Failed to verify e2ee_ack: ${exc.message}`);
      return [];
    }

    const session = this._key_manager.get_session_by_id(sessionId);
    if (session === null) {
      console.warn(`Received e2ee_ack for unknown session_id=${sessionId}`);
      return [];
    }
    if (session.peer_did !== senderDid) {
      console.warn(`Received e2ee_ack from unexpected peer: ${senderDid}`);
      return [];
    }

    this._confirmed_session_ids.add(sessionId);
    console.info(`E2EE session confirmed by peer: ${sessionId}`);
    return [];
  }

  /**
   * 处理 E2EE 错误：记录日志，删除对应会话，对可恢复错误自动重新握手
   *
   * @param {Object} content - e2ee_error 消息内容
   * @returns {Promise<Array<[string, Object]>>} 要发送的消息列表
   * @private
   */
  async _handle_error(content) {
    try {
      ensure_supported_e2ee_version(content);
    } catch (exc) {
      console.warn(`Ignoring legacy e2ee_error without supported version: ${exc.message}`);
      return [];
    }

    const errorCode = content.error_code || "unknown";
    const sessionId = content.session_id || "";
    console.warn(
      `Received E2EE error: code=${errorCode}, session_id=${sessionId}`
    );
    let peerDid = null;
    if (sessionId) {
      const session = this._key_manager.get_session_by_id(sessionId);
      if (session !== null) {
        peerDid = session.peer_did;
        this._key_manager.remove_session(session.local_did, session.peer_did);
      }
    }

    // 对可恢复错误自动重新握手
    const recoverable = new Set(["session_not_found", "session_expired", "decryption_failed"]);
    if (peerDid === null) {
      const senderDid = content.sender_did || "";
      if (typeof senderDid === "string" && senderDid) {
        peerDid = senderDid;
        console.info(
          `E2EE error fallback using sender_did for re-handshake: ${senderDid.substring(0, 20)}`
        );
      }
    }
    if (recoverable.has(errorCode) && peerDid !== null) {
      try {
        const [msgType, initContent] = await this.initiate_handshake(peerDid);
        console.info(
          `Auto re-handshake initiated after E2EE error: peer=${peerDid.substring(0, 20)}`
        );
        return [[msgType, initContent]];
      } catch (e) {
        console.error(`Auto re-handshake failed: peer=${peerDid}`);
      }
    }
    return [];
  }
}

module.exports = {
  E2eeClient,
  SUPPORTED_E2EE_VERSION,
  _STATE_VERSION,
  ensure_supported_e2ee_version,
  build_e2ee_error_content,
  build_e2ee_error_message,
  _classify_protocol_error,
  _extract_proof_verification_method
};
