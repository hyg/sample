/**
 * Credential Layout Manager
 * 
 * 负责凭证目录结构管理和 index.json 读写
 * 
 * 移植自：python/scripts/credential_layout.py
 */

import * as fs from 'fs';
import * as path from 'path';

const CREDENTIAL_DIR = '.openclaw/credentials/awiki-agent-id-message';
const INDEX_FILENAME = 'index.json';
const SCHEMA_VERSION = 3;

/**
 * 获取凭证存储根目录
 */
export function get_credential_root() {
  const home = process.env.USERPROFILE || process.env.HOME;
  return path.join(home, CREDENTIAL_DIR);
}

/**
 * 加载 index.json
 */
export function load_index() {
  const indexPath = path.join(get_credential_root(), INDEX_FILENAME);
  
  if (!fs.existsSync(indexPath)) {
    // 创建新的 index.json
    const newIndex = {
      schema_version: SCHEMA_VERSION,
      default_credential_name: 'default',
      credentials: {},
    };
    
    // 确保目录存在
    const credRoot = get_credential_root();
    if (!fs.existsSync(credRoot)) {
      fs.mkdirSync(credRoot, { recursive: true, mode: 0o700 });
    }
    
    write_secure_json(indexPath, newIndex);
    return newIndex;
  }
  
  const content = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 保存 index.json
 */
export function save_index(index) {
  const indexPath = path.join(get_credential_root(), INDEX_FILENAME);
  write_secure_json(indexPath, index);
}

/**
 * 安全地写入 JSON 文件（600 权限）
 */
export function write_secure_json(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, {
    encoding: 'utf-8',
    mode: 0o600, // 只有所有者可读写
  });
}

/**
 * 安全地写入文本文件（600 权限）
 */
export function write_secure_text(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  
  fs.writeFileSync(filePath, content, {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * 构建凭证目录路径
 */
export function build_credential_paths(dirName) {
  const baseDir = path.join(get_credential_root(), dirName);
  return {
    credential_dir: baseDir,
    did_document: path.join(baseDir, 'did_document.json'),
    private_key: path.join(baseDir, 'private_key.pem'),
    public_key: path.join(baseDir, 'public_key.pem'),
    jwt: path.join(baseDir, 'jwt.json'),
    e2ee_signing_private: path.join(baseDir, 'e2ee_signing_private.pem'),
    e2ee_signing_public: path.join(baseDir, 'e2ee_signing_public.pem'),
    e2ee_agreement_private: path.join(baseDir, 'e2ee_agreement_private.pem'),
    e2ee_agreement_public: path.join(baseDir, 'e2ee_agreement_public.pem'),
  };
}

/**
 * 确保凭证目录存在
 */
export function ensure_credential_directory(dirName) {
  const paths = build_credential_paths(dirName);
  if (!fs.existsSync(paths.credential_dir)) {
    fs.mkdirSync(paths.credential_dir, { recursive: true, mode: 0o700 });
  }
  return paths.credential_dir;
}

/**
 * 列出所有凭证名称
 */
export function list_credential_names() {
  const index = load_index();
  return Object.keys(index.credentials);
}

/**
 * 获取凭证的索引条目
 */
export function get_index_entry(credentialName) {
  const index = load_index();
  return index.credentials[credentialName] || null;
}

/**
 * 设置凭证的索引条目
 */
export function set_index_entry(credentialName, entry) {
  const index = load_index();
  index.credentials[credentialName] = entry;
  save_index(index);
}

/**
 * 移除凭证的索引条目
 */
export function remove_index_entry(credentialName) {
  const index = load_index();
  if (!index.credentials[credentialName]) {
    return false;
  }
  delete index.credentials[credentialName];
  save_index(index);
  return true;
}

// 默认导出
export default {
  get_credential_root,
  load_index,
  save_index,
  write_secure_json,
  write_secure_text,
  build_credential_paths,
  ensure_credential_directory,
  list_credential_names,
  get_index_entry,
  set_index_entry,
  remove_index_entry,
};
