/**
 * Credential Store - 凭证存储管理
 * 
 * 负责身份的保存、加载、删除
 * 
 * 移植自：python/scripts/credential_store.py
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  load_index,
  save_index,
  write_secure_json,
  write_secure_text,
  build_credential_paths,
  ensure_credential_directory,
  get_index_entry,
  set_index_entry,
  remove_index_entry,
  list_credential_names,
} from './credential_layout.js';

/**
 * 保存身份到凭证存储
 */
export async function save_identity(credentialName, identity) {
  const dirName = identity.unique_id;
  
  // 确保凭证目录存在
  const paths = build_credential_paths(dirName);
  ensure_credential_directory(dirName);
  
  // 写入 DID 文档
  write_secure_json(paths.did_document, identity.did_document);
  
  // 写入私钥 (key-1-private.pem)
  const key1PrivatePath = path.join(paths.credential_dir, 'key-1-private.pem');
  write_secure_text(key1PrivatePath, identity.private_key_pem);
  
  // 写入公钥 (key-1-public.pem)
  const key1PublicPath = path.join(paths.credential_dir, 'key-1-public.pem');
  write_secure_text(key1PublicPath, identity.public_key_pem);
  
  // 写入身份元数据 (identity.json)
  const identityPath = path.join(paths.credential_dir, 'identity.json');
  write_secure_json(identityPath, {
    did: identity.did,
    unique_id: identity.unique_id,
    user_id: identity.user_id,
    name: identity.name || null,
    handle: identity.handle || null,
  });
  
  // 写入 JWT (auth.json)
  if (identity.jwt_token) {
    const authPath = path.join(paths.credential_dir, 'auth.json');
    write_secure_json(authPath, {
      jwt_token: identity.jwt_token,
      updated_at: new Date().toISOString(),
    });
  }
  
  // 写入 E2EE 密钥
  if (identity.e2ee_signing_private_pem) {
    const e2eeSigningPath = path.join(paths.credential_dir, 'e2ee-signing-private.pem');
    write_secure_text(e2eeSigningPath, identity.e2ee_signing_private_pem);
  }
  
  if (identity.e2ee_agreement_private_pem) {
    const e2eeAgreementPath = path.join(paths.credential_dir, 'e2ee-agreement-private.pem');
    write_secure_text(e2eeAgreementPath, identity.e2ee_agreement_private_pem);
  }
  
  // 更新索引
  const indexEntry = {
    credential_name: credentialName,
    dir_name: dirName,
    did: identity.did,
    unique_id: identity.unique_id,
    user_id: identity.user_id,
    name: identity.name || null,
    handle: identity.handle || null,
    created_at: new Date().toISOString(),
    is_default: credentialName === 'default',
  };
  
  set_index_entry(credentialName, indexEntry);
  
  return paths;
}

/**
 * 从凭证存储加载身份
 */
export async function load_identity(credentialName) {
  const entry = get_index_entry(credentialName);
  if (!entry) {
    return null;
  }
  
  const dirName = entry.dir_name;
  const credDir = path.join(process.env.USERPROFILE || process.env.HOME, '.openclaw/credentials/awiki-agent-id-message', dirName);
  
  // 检查目录是否存在
  if (!fs.existsSync(credDir)) {
    return null;
  }
  
  // 读取 DID 文档
  const didDocumentPath = path.join(credDir, 'did_document.json');
  if (!fs.existsSync(didDocumentPath)) {
    return null;
  }
  const didDocument = JSON.parse(fs.readFileSync(didDocumentPath, 'utf-8'));
  
  // 读取私钥 (key-1-private.pem)
  const key1PrivatePath = path.join(credDir, 'key-1-private.pem');
  if (!fs.existsSync(key1PrivatePath)) {
    return null;
  }
  const privateKeyPem = fs.readFileSync(key1PrivatePath, 'utf-8');
  
  // 读取公钥 (key-1-public.pem)
  const key1PublicPath = path.join(credDir, 'key-1-public.pem');
  const publicKeyPem = fs.existsSync(key1PublicPath) 
    ? fs.readFileSync(key1PublicPath, 'utf-8') 
    : null;
  
  // 读取身份元数据 (identity.json)
  const identityPath = path.join(credDir, 'identity.json');
  let userId = entry.user_id;
  let name = entry.name;
  let handle = entry.handle;
  if (fs.existsSync(identityPath)) {
    const identityData = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
    userId = identityData.user_id || userId;
    name = identityData.name || name;
    handle = identityData.handle || handle;
  }
  
  // 读取 JWT (auth.json)
  let jwtToken = null;
  const authPath = path.join(credDir, 'auth.json');
  if (fs.existsSync(authPath)) {
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    jwtToken = authData.jwt_token;
  }
  
  // 读取 E2EE 密钥
  let e2eeSigningPrivatePem = null;
  const e2eeSigningPath = path.join(credDir, 'e2ee-signing-private.pem');
  if (fs.existsSync(e2eeSigningPath)) {
    e2eeSigningPrivatePem = fs.readFileSync(e2eeSigningPath, 'utf-8');
  }
  
  let e2eeAgreementPrivatePem = null;
  const e2eeAgreementPath = path.join(credDir, 'e2ee-agreement-private.pem');
  if (fs.existsSync(e2eeAgreementPath)) {
    e2eeAgreementPrivatePem = fs.readFileSync(e2eeAgreementPath, 'utf-8');
  }
  
  // 构建身份对象
  const identity = {
    did: entry.did,
    did_document: didDocument,
    private_key_pem: privateKeyPem,
    public_key_pem: publicKeyPem,
    user_id: userId,
    jwt_token: jwtToken,
    e2ee_signing_private_pem: e2eeSigningPrivatePem,
    e2ee_agreement_private_pem: e2eeAgreementPrivatePem,
    name: name,
    handle: handle,
  };
  
  // 添加 unique_id getter
  Object.defineProperty(identity, 'unique_id', {
    get: function() {
      return this.did.split(':').pop();
    },
    enumerable: true,
  });
  
  // 添加 get_private_key 方法
  identity.get_private_key = function() {
    const { createPrivateKey } = require('crypto');
    return createPrivateKey(this.private_key_pem);
  };
  
  return identity;
}

/**
 * 列出所有身份
 */
export function list_identities() {
  const index = load_index();
  return Object.values(index.credentials);
}

/**
 * 删除身份
 */
export function delete_identity(credentialName) {
  const entry = get_index_entry(credentialName);
  if (!entry) {
    return false;
  }
  
  const credDir = path.join(process.env.USERPROFILE || process.env.HOME, '.openclaw/credentials/awiki-agent-id-message', entry.dir_name);
  
  // 删除目录
  if (fs.existsSync(credDir)) {
    fs.rmSync(credDir, { recursive: true, force: true });
  }
  
  // 移除索引条目
  remove_index_entry(credentialName);
  
  return true;
}

/**
 * 获取认证头（用于 authenticated_rpc_call）
 */
export async function create_authenticator(credentialName) {
  const identity = await load_identity(credentialName);
  if (!identity) {
    throw new Error(`Identity '${credentialName}' not found`);
  }
  
  return {
    getAuthHeader: async (forceNew = false) => {
      if (!identity.jwt_token) {
        return {};
      }
      return {
        'Authorization': `Bearer ${identity.jwt_token}`,
      };
    },
  };
}

// 默认导出
export default {
  save_identity,
  load_identity,
  list_identities,
  delete_identity,
  create_authenticator,
};
