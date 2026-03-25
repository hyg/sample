/**
 * scripts/utils/identity.py 的 Node.js 移植
 *
 * Python 源文件：python/scripts/utils/identity.py
 * 分析报告：doc/scripts/utils/identity.py/py.md
 * 蒸馏数据：doc/scripts/utils/identity.py/py.json
 *
 * DID 身份创建 (封装 ANP 库)
 */

// 延迟加载依赖，避免模块导入时失败
let _create_did_wba_document = null;
let _ec = null;
let _load_pem_private_key = null;

/**
 * 初始化依赖
 * @private
 */
function _initDeps() {
  if (_create_did_wba_document === null) {
    const anpAuth = require('../../lib/anp-0.6.8/authentication');
    _create_did_wba_document = anpAuth.create_did_wba_document;
  }
  if (_ec === null) {
    const crypto = require('cryptography');
    _ec = crypto.hazmat.primitives.asymmetric.ec;
  }
  if (_load_pem_private_key === null) {
    const crypto = require('cryptography');
    _load_pem_private_key = crypto.hazmat.primitives.serialization.load_pem_private_key;
  }
}

/**
 * DID 身份数据类
 *
 * Python 原型:
 * @dataclass
 * class DIDIdentity:
 *     did: str
 *     did_document: dict[str, Any]
 *     private_key_pem: bytes
 *     public_key_pem: bytes
 *     user_id: str | None = None
 *     jwt_token: str | None = None
 *     e2ee_signing_private_pem: bytes | None = None
 *     e2ee_signing_public_pem: bytes | None = None
 *     e2ee_agreement_private_pem: bytes | None = None
 *     e2ee_agreement_public_pem: bytes | None = None
 */
class DIDIdentity {
  /**
   * 创建 DID 身份实例
   *
   * @param {string} did - DID 标识符
   * @param {object} did_document - DID 文档 (包含 proof)
   * @param {Buffer} private_key_pem - secp256k1 私钥 PEM
   * @param {Buffer} public_key_pem - 公钥 PEM
   * @param {string|null} [user_id=null] - 用户 ID (注册后填充)
   * @param {string|null} [jwt_token=null] - JWT token (认证后填充)
   * @param {Buffer|null} [e2ee_signing_private_pem=null] - key-2 secp256r1
   * @param {Buffer|null} [e2ee_signing_public_pem=null]
   * @param {Buffer|null} [e2ee_agreement_private_pem=null] - key-3 X25519
   * @param {Buffer|null} [e2ee_agreement_public_pem=null]
   */
  constructor({
    did,
    did_document,
    private_key_pem,
    public_key_pem,
    user_id = null,
    jwt_token = null,
    e2ee_signing_private_pem = null,
    e2ee_signing_public_pem = null,
    e2ee_agreement_private_pem = null,
    e2ee_agreement_public_pem = null
  }) {
    this.did = did;
    this.did_document = did_document;
    this.private_key_pem = private_key_pem;
    this.public_key_pem = public_key_pem;
    this.user_id = user_id;
    this.jwt_token = jwt_token;
    this.e2ee_signing_private_pem = e2ee_signing_private_pem;
    this.e2ee_signing_public_pem = e2ee_signing_public_pem;
    this.e2ee_agreement_private_pem = e2ee_agreement_private_pem;
    this.e2ee_agreement_public_pem = e2ee_agreement_public_pem;
  }

  /**
   * 从 DID 提取 unique_id (最后一段路径)
   *
   * 例如：did:wba:localhost:user:abc123 -> abc123
   *
   * @returns {string} unique_id
   */
  get unique_id() {
    return this.did.rsplit(':', 1)[-1];
  }

  /**
   * 加载 secp256k1 私钥对象
   *
   * @returns {any} secp256k1 私钥对象
   */
  get_private_key() {
    _initDeps();
    return load_private_key(this.private_key_pem);
  }
}

/**
 * 创建密钥绑定的 DID 身份 (secp256k1 密钥对 + DID 文档 + proof)
 *
 * 使用 ANP 的 create_did_wba_document() 生成完整的 DID 文档。
 * 首先生成临时文档以从公钥 JWK 中提取 key identifier (kid)，
 * 然后重新生成最终文档，将 kid 附加到路径段以创建密钥绑定的 DID。
 *
 * @param {string} hostname - DID 域名
 * @param {string[]|null} [path_prefix=null] - DID 路径前缀，如 ["user"] (默认) 或 ["agent"]
 * @param {string} [proof_purpose="authentication"] - 证明用途 (默认 "authentication")
 * @param {string|null} [domain=null] - 证明绑定的服务域名
 * @param {string|null} [challenge=null] - 证明 nonce (默认自动生成)
 * @param {object[]|null} [services=null] - 自定义服务条目列表
 * @returns {DIDIdentity} DID 身份 (did_document 包含 ANP 生成的 proof)
 */
function create_identity(
  hostname,
  path_prefix = null,
  proof_purpose = 'authentication',
  domain = null,
  challenge = null,
  services = null
) {
  _initDeps();

  // 生成随机 challenge
  if (challenge === null) {
    const crypto = require('crypto');
    challenge = crypto.randomBytes(16).toString('hex');
  }

  // Step 1: 生成临时文档以提取 kid
  const [temp_doc, temp_keys] = _create_did_wba_document(
    hostname,
    path_prefix || ['user'],
    proof_purpose,
    domain,
    challenge,
    services
  );

  // Step 2: 从第一个验证方法提取 kid
  const kid = temp_doc.verificationMethod[0].publicKeyJwk.kid;
  // 使用 k1_ 前缀表示 secp256k1 密钥
  const key_id = `k1_${kid}`;

  // Step 3: 重新生成文档，将 kid 附加到路径
  const final_path_segments = (path_prefix || ['user']).concat([key_id]);
  const [did_document, keys] = _create_did_wba_document(
    hostname,
    final_path_segments,
    proof_purpose,
    domain,
    challenge,
    services
  );

  const [private_key_pem, public_key_pem] = keys['key-1'];

  // E2EE 密钥 (ANP 中 enable_e2ee=True 时生成)
  let e2ee_signing_private_pem = null;
  let e2ee_signing_public_pem = null;
  let e2ee_agreement_private_pem = null;
  let e2ee_agreement_public_pem = null;

  if ('key-2' in keys) {
    [e2ee_signing_private_pem, e2ee_signing_public_pem] = keys['key-2'];
  }
  if ('key-3' in keys) {
    [e2ee_agreement_private_pem, e2ee_agreement_public_pem] = keys['key-3'];
  }

  return new DIDIdentity({
    did: did_document.id,
    did_document: did_document,
    private_key_pem: private_key_pem,
    public_key_pem: public_key_pem,
    e2ee_signing_private_pem: e2ee_signing_private_pem,
    e2ee_signing_public_pem: e2ee_signing_public_pem,
    e2ee_agreement_private_pem: e2ee_agreement_private_pem,
    e2ee_agreement_public_pem: e2ee_agreement_public_pem
  });
}

/**
 * 从 PEM 字节加载私钥
 *
 * @param {Buffer} pem_bytes - PEM 格式的私钥字节
 * @returns {any} EllipticCurvePrivateKey 对象
 * @throws {TypeError} 如果密钥类型不正确
 */
function load_private_key(pem_bytes) {
  _initDeps();
  const key = _load_pem_private_key(pem_bytes, null);
  if (!(key instanceof _ec.EllipticCurvePrivateKey)) {
    throw new TypeError(`Expected EllipticCurvePrivateKey, got ${key.constructor.name}`);
  }
  return key;
}

module.exports = {
  DIDIdentity,
  create_identity,
  load_private_key
};
