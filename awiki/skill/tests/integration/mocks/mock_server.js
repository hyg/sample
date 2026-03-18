/**
 * Mock 服务器 - 模拟 awiki.ai 服务
 * 
 * 模拟以下服务：
 * - /user-service/did-auth/rpc - DID 认证
 * - /user-service/handle/rpc - Handle 管理
 * - /message/rpc - 消息服务
 * - /group/rpc - 群组管理
 * - /user-service/.well-known/handle/{handle} - Handle 解析
 * - /user-service/rpc - 用户服务（关注、搜索等）
 */

import { createServer } from 'http';
import { URL } from 'url';

// Mock 服务器配置
export const MOCK_PORT = 9999;
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;

// 内存存储
const storage = {
  identities: new Map(),      // did -> identity
  handles: new Map(),         // handle -> did
  messages: new Map(),        // did -> [messages]
  groups: new Map(),          // group_id -> group
  group_members: new Map(),   // group_id -> [did]
  group_messages: new Map(),  // group_id -> [messages]
  following: new Map(),       // did -> [followed_dids]
  followers: new Map(),       // did -> [follower_dids]
  otp_codes: new Map(),       // phone -> otp_code
};

// 生成唯一 ID
let id_counter = 1000;
function generate_id(prefix = 'id') {
  return `${prefix}_${++id_counter}`;
}

// 生成群组 ID
let group_id_counter = 100;
function generate_group_id() {
  return `group_${++group_id_counter}`;
}

// 生成 join code
function generate_join_code() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 生成 OTP code
function generate_otp_code() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 解析请求体
function parse_body(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// 发送 JSON 响应
function send_json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// RPC 响应格式
function rpc_response(result, error = null) {
  return {
    jsonrpc: '2.0',
    id: 1,
    result,
    error,
  };
}

// 处理 DID 认证
async function handle_did_auth(req, res) {
  const body = await parse_body(req);
  const { method, params } = body;

  console.log(`[MOCK] did-auth method: ${method}, params:`, JSON.stringify(params));

  if (method === 'auth.create') {
    // 创建身份
    const { name } = params || {};
    const did = `did:wba:awiki.ai:user:k1_${generate_id('auth')}`;
    const unique_id = generate_id('uid');
    
    const identity = {
      did,
      unique_id,
      name: name || 'Unknown',
      e2ee_signing_private_pem: '-----BEGIN PRIVATE KEY-----\nsigning_key_placeholder\n-----END PRIVATE KEY-----',
      e2ee_agreement_private_pem: '-----BEGIN PRIVATE KEY-----\nagreement_key_placeholder\n-----END PRIVATE KEY-----',
      created_at: new Date().toISOString(),
    };

    storage.identities.set(did, identity);

    send_json(res, 200, rpc_response({
      did,
      unique_id,
      ...identity,
    }));
  } else if (method === 'auth.verify') {
    // 验证身份
    const { did } = params || {};
    const identity = storage.identities.get(did);
    
    if (identity) {
      send_json(res, 200, rpc_response({ valid: true, ...identity }));
    } else {
      send_json(res, 200, rpc_response(null, { code: -32000, message: 'Identity not found' }));
    }
  } else {
    send_json(res, 400, rpc_response(null, { code: -32601, message: 'Method not found' }));
  }
}

// 处理 Handle 管理
async function handle_handle_rpc(req, res) {
  const body = await parse_body(req);
  const { method, params } = body;

  console.log(`[MOCK] handle-rpc method: ${method}, params:`, JSON.stringify(params));

  if (method === 'send_otp') {
    // 发送 OTP
    const { phone } = params || {};
    
    if (!phone || typeof phone !== 'string') {
      send_json(res, 200, rpc_response(null, { 
        code: -32000, 
        message: 'Phone number is required and must be a string' 
      }));
      return;
    }
    
    const otp_code = generate_otp_code();
    storage.otp_codes.set(phone, otp_code);
    
    console.log(`[MOCK] OTP for ${phone}: ${otp_code}`);
    
    send_json(res, 200, rpc_response({
      success: true,
      message: 'OTP sent',
      expires_in: 300,
    }));
  } else if (method === 'handle.register') {
    // 注册 Handle
    const { handle, phone, otp_code, did } = params || {};
    
    console.log(`[MOCK] Register handle: ${handle}, phone: ${phone}, did: ${did}`);
    
    // 验证 OTP
    const stored_otp = storage.otp_codes.get(phone);
    if (!stored_otp || stored_otp !== otp_code) {
      send_json(res, 200, rpc_response(null, { 
        code: -32001, 
        message: 'Invalid or expired OTP code' 
      }));
      return;
    }

    // 检查 Handle 是否已存在
    if (storage.handles.has(handle)) {
      send_json(res, 200, rpc_response(null, { 
        code: -32002, 
        message: 'Handle already registered' 
      }));
      return;
    }

    // 注册 Handle
    storage.handles.set(handle, did);
    
    // 更新身份
    const identity = storage.identities.get(did);
    if (identity) {
      identity.handle = handle;
      storage.identities.set(did, identity);
    }

    send_json(res, 200, rpc_response({
      success: true,
      handle,
      did,
    }));
  } else if (method === 'handle.resolve') {
    // 解析 Handle
    const { handle } = params || {};
    const did = storage.handles.get(handle);
    
    if (did) {
      send_json(res, 200, rpc_response({ did }));
    } else {
      send_json(res, 200, rpc_response(null, { 
        code: -32003, 
        message: 'Handle not found' 
      }));
    }
  } else if (method === 'handle.lookup') {
    // 通过 DID 查找 Handle
    const { did } = params || {};
    const identity = storage.identities.get(did);
    
    if (identity && identity.handle) {
      send_json(res, 200, rpc_response({ handle: identity.handle }));
    } else {
      send_json(res, 200, rpc_response(null, { 
        code: -32003, 
        message: 'Handle not found for DID' 
      }));
    }
  } else {
    send_json(res, 400, rpc_response(null, { code: -32601, message: 'Method not found' }));
  }
}

// 处理消息服务
async function handle_message_rpc(req, res) {
  const body = await parse_body(req);
  const { method, params } = body;

  console.log(`[MOCK] message-rpc method: ${method}, params:`, JSON.stringify(params));

  if (method === 'send_message') {
    // 发送消息
    const { receiver_did, content, type = 'text', e2ee_type } = params || {};
    
    const message = {
      id: generate_id('msg'),
      sender_did: params?.sender_did || 'unknown',
      receiver_did,
      content,
      type,
      e2ee_type,
      server_seq: generate_id('seq'),
      sent_at: new Date().toISOString(),
    };

    // 存储消息
    if (!storage.messages.has(receiver_did)) {
      storage.messages.set(receiver_did, []);
    }
    storage.messages.get(receiver_did).push(message);

    send_json(res, 200, rpc_response({
      id: message.id,
      server_seq: message.server_seq,
      sent_at: message.sent_at,
    }));
  } else if (method === 'get_inbox') {
    // 获取收件箱
    const { limit = 10, sender_did } = params || {};
    
    // 获取当前用户的所有消息（简化：返回所有存储的消息）
    let all_messages = [];
    for (const [did, messages] of storage.messages) {
      all_messages = all_messages.concat(messages);
    }

    // 按时间排序
    all_messages.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

    // 限制数量
    const messages = all_messages.slice(0, limit);

    send_json(res, 200, rpc_response({
      messages,
      has_more: all_messages.length > limit,
    }));
  } else {
    send_json(res, 400, rpc_response(null, { code: -32601, message: 'Method not found' }));
  }
}

// 处理群组管理
async function handle_group_rpc(req, res) {
  const body = await parse_body(req);
  const { method, params } = body;

  console.log(`[MOCK] group-rpc method: ${method}, params:`, JSON.stringify(params));

  if (method === 'create') {
    // 创建群组
    const { name, description, is_public = false } = params || {};
    
    const group_id = generate_group_id();
    const join_code = generate_join_code();
    
    const group = {
      group_id,
      name,
      description,
      is_public,
      join_code,
      created_at: new Date().toISOString(),
      creator_did: params?.creator_did || 'unknown',
    };

    storage.groups.set(group_id, group);
    storage.group_members.set(group_id, [group.creator_did]);
    storage.group_messages.set(group_id, []);

    send_json(res, 200, rpc_response({
      group_id,
      join_code,
      ...group,
    }));
  } else if (method === 'join') {
    // 加入群组
    const { join_code } = params || {};
    
    // 查找群组
    let target_group = null;
    let target_group_id = null;
    for (const [gid, group] of storage.groups) {
      if (group.join_code === join_code) {
        target_group = group;
        target_group_id = gid;
        break;
      }
    }

    if (!target_group) {
      send_json(res, 200, rpc_response(null, { 
        code: -32004, 
        message: 'Invalid join code' 
      }));
      return;
    }

    // 添加成员
    const members = storage.group_members.get(target_group_id) || [];
    const member_did = params?.member_did || 'unknown';
    if (!members.includes(member_did)) {
      members.push(member_did);
      storage.group_members.set(target_group_id, members);
    }

    send_json(res, 200, rpc_response({
      group_id: target_group_id,
      name: target_group.name,
      success: true,
    }));
  } else if (method === 'post_message') {
    // 发送群消息
    const { group_id, content } = params || {};
    
    const group = storage.groups.get(group_id);
    if (!group) {
      send_json(res, 200, rpc_response(null, { 
        code: -32005, 
        message: 'Group not found' 
      }));
      return;
    }

    const message = {
      id: generate_id('gmsg'),
      group_id,
      sender_did: params?.sender_did || 'unknown',
      content,
      type: 'text',
      sent_at: new Date().toISOString(),
    };

    const messages = storage.group_messages.get(group_id) || [];
    messages.push(message);
    storage.group_messages.set(group_id, messages);

    send_json(res, 200, rpc_response({
      id: message.id,
      ...message,
    }));
  } else if (method === 'list') {
    // 列出群组
    const member_did = params?.member_did || 'unknown';
    const user_groups = [];
    
    for (const [group_id, members] of storage.group_members) {
      if (members.includes(member_did)) {
        const group = storage.groups.get(group_id);
        if (group) {
          user_groups.push({ group_id, ...group });
        }
      }
    }

    send_json(res, 200, rpc_response({ groups: user_groups }));
  } else {
    send_json(res, 400, rpc_response(null, { code: -32601, message: 'Method not found' }));
  }
}

// 处理用户服务（关注、搜索等）
async function handle_user_rpc(req, res) {
  const body = await parse_body(req);
  const { method, params } = body;

  console.log(`[MOCK] user-rpc method: ${method}, params:`, JSON.stringify(params));

  if (method === 'follow') {
    // 关注用户
    const { target_did } = params || {};
    const follower_did = params?.follower_did || 'unknown';

    // 添加关注关系
    if (!storage.following.has(follower_did)) {
      storage.following.set(follower_did, []);
    }
    const following = storage.following.get(follower_did);
    if (!following.includes(target_did)) {
      following.push(target_did);
    }

    if (!storage.followers.has(target_did)) {
      storage.followers.set(target_did, []);
    }
    const followers = storage.followers.get(target_did);
    if (!followers.includes(follower_did)) {
      followers.push(follower_did);
    }

    send_json(res, 200, rpc_response({
      success: true,
      following: true,
    }));
  } else if (method === 'get_following') {
    // 获取关注列表
    const did = params?.did || 'unknown';
    const following_dids = storage.following.get(did) || [];
    
    const users = following_dids.map(did => {
      const identity = storage.identities.get(did);
      return {
        did,
        handle: identity?.handle || null,
        name: identity?.name || 'Unknown',
      };
    });

    send_json(res, 200, rpc_response({ users }));
  } else if (method === 'get_followers') {
    // 获取粉丝列表
    const did = params?.did || 'unknown';
    const follower_dids = storage.followers.get(did) || [];
    
    const users = follower_dids.map(did => {
      const identity = storage.identities.get(did);
      return {
        did,
        handle: identity?.handle || null,
        name: identity?.name || 'Unknown',
      };
    });

    send_json(res, 200, rpc_response({ users }));
  } else if (method === 'search') {
    // 搜索用户
    const { query } = params || {};
    
    const users = [];
    for (const [handle, did] of storage.handles) {
      if (handle.toLowerCase().includes(query.toLowerCase())) {
        const identity = storage.identities.get(did);
        users.push({
          did,
          handle,
          name: identity?.name || 'Unknown',
        });
      }
    }

    send_json(res, 200, rpc_response({ users }));
  } else {
    send_json(res, 400, rpc_response(null, { code: -32601, message: 'Method not found' }));
  }
}

// 处理 Handle 解析（well-known）
async function handle_well_known_handle(req, res, handle) {
  const did = storage.handles.get(handle);
  
  if (did) {
    send_json(res, 200, { did });
  } else {
    send_json(res, 404, { error: 'Handle not found' });
  }
}

// 主请求处理器
async function handle_request(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  console.log(`[MOCK] ${req.method} ${path}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 路由
    if (path === '/user-service/did-auth/rpc') {
      await handle_did_auth(req, res);
    } else if (path === '/user-service/handle/rpc') {
      await handle_handle_rpc(req, res);
    } else if (path === '/message/rpc') {
      await handle_message_rpc(req, res);
    } else if (path === '/group/rpc') {
      await handle_group_rpc(req, res);
    } else if (path === '/user-service/rpc') {
      await handle_user_rpc(req, res);
    } else if (path.startsWith('/user-service/.well-known/handle/')) {
      const handle = path.split('/').pop();
      await handle_well_known_handle(req, res, handle);
    } else {
      send_json(res, 404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('[MOCK] Error:', error);
    send_json(res, 500, { error: error.message });
  }
}

// 创建服务器
const server = createServer(handle_request);

// 导出
export function start_mock_server(port = MOCK_PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[MOCK] Server running on port ${port}`);
      resolve(server);
    });
  });
}

export function stop_mock_server(server) {
  return new Promise((resolve) => {
    server.close(() => {
      console.log('[MOCK] Server stopped');
      resolve();
    });
  });
}

export function clear_storage() {
  storage.identities.clear();
  storage.handles.clear();
  storage.messages.clear();
  storage.groups.clear();
  storage.group_members.clear();
  storage.group_messages.clear();
  storage.following.clear();
  storage.followers.clear();
  storage.otp_codes.clear();
  id_counter = 1000;
  group_id_counter = 100;
}

export function get_storage() {
  return storage;
}

// 如果直接运行
if (process.argv[1]?.includes('mock_server.js')) {
  start_mock_server(MOCK_PORT);
}
