/**
 * awiki SDK 封装
 * 
 * 提供与 Python 版本相同的 API 接口
 * 调用 module 项目提供的底层 API
 * 
 * 命名规范：使用 snake_case 与 module 项目保持一致
 */

import { SDKConfig } from '@awiki/config';
import { createUserServiceClient, createMoltMessageClient } from '@awiki/client';
import { rpc_call, authenticated_rpc_call } from '@awiki/rpc';
import { create_authenticated_identity } from '@awiki/auth';
import { DIDIdentity } from '@awiki/identity';
import { registerHandle, recoverHandle, resolveHandle, sendOtp, lookupHandle } from '@awiki/handle';
import { resolveToDid } from '@awiki/resolve';
import { WsClient } from '@awiki/ws';
import { E2eeClient } from '@awiki/e2ee';
import { configureLogging } from '@awiki/logging-config';
import { save_identity, load_identity, list_identities } from './credential_store.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * awiki SDK 类
 */
export class AwikiSDK {
  constructor(credentialName = 'default') {
    this.credential_name = credentialName;
    this.config = null;
    this.identity = null;
    this.clients = {};
    this.ws_client = null;
    this.e2ee_client = null;
  }

  /**
   * 获取认证头（供 authenticated_rpc_call 使用）
   */
  async getAuthHeader(forceNew = false) {
    if (!this.identity || !this.identity.jwt_token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${this.identity.jwt_token}`,
    };
  }

  /**
   * 初始化 SDK
   */
  async init() {
    // 配置日志
    configureLogging();

    // 加载配置
    this.config = SDKConfig.load();

    // 创建 HTTP 客户端
    this.clients.user = createUserServiceClient(this.config);
    this.clients.message = createMoltMessageClient(this.config);

    // 加载身份
    this.identity = await this._loadIdentity();

    // 创建 E2EE 客户端
    if (this.identity) {
      this.e2ee_client = new E2eeClient(this.identity.did, {
        signingPem: this.identity.e2ee_signing_private_pem,
        x25519Pem: this.identity.e2ee_agreement_private_pem,
      });
    }

    return this;
  }

  /**
   * 加载身份
   * @private
   */
  async _loadIdentity() {
    return await load_identity(this.credential_name);
  }

  /**
   * 保存身份
   * @private
   */
  async _saveIdentity(identity) {
    await save_identity(this.credential_name, identity);
    this.identity = identity;
  }

  /**
   * 创建身份
   */
  async create_identity(options = {}) {
    const { name, path_prefix = ['user'] } = options;

    this.identity = await create_authenticated_identity(
      this.clients.user,
      this.config,
      { name, path_prefix }
    );

    // 保存身份到凭证存储
    await this._saveIdentity(this.identity);

    return this.identity;
  }

  /**
   * 注册 Handle
   */
  async register_handle(handle, phone, otp_code, options = {}) {
    const identity = await registerHandle(
      this.clients.user,
      this.config,
      phone,
      otp_code,
      handle,
      options
    );
    
    // 保存身份
    await this._saveIdentity(identity);
    
    return identity;
  }

  /**
   * 发送 OTP
   */
  async send_otp(phone) {
    return sendOtp(this.clients.user, this.config, phone);
  }

  /**
   * 恢复 Handle
   */
  async recover_handle(handle) {
    const [identity, result] = await recoverHandle(
      this.clients.user,
      this.config,
      handle
    );
    
    // 保存身份
    await this._saveIdentity(identity);
    
    return [identity, result];
  }

  /**
   * 解析 Handle 为 DID
   */
  async resolve_handle(handle) {
    return resolveToDid(handle, this.config);
  }

  /**
   * 通过 DID 查找 Handle
   */
  async lookup_handle(did) {
    return lookupHandle(this.clients.user, this.config, did);
  }

  /**
   * 发送消息
   */
  async send_message(to, content, options = {}) {
    // 解析接收方
    const receiver_did = await this.resolve_handle(to);
    
    // 发送消息
    const result = await authenticated_rpc_call(
      this.clients.message,
      '/message/rpc',
      'send_message',
      {
        receiver_did: receiver_did,
        content: content,
        type: options.type || 'text',
      },
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result;
  }

  /**
   * 发送 E2EE 加密消息
   */
  async send_e2ee_message(to, content, options = {}) {
    // 解析接收方
    const receiver_did = await this.resolve_handle(to);
    
    // 确保活跃会话
    await this.e2ee_client.ensure_active_session(receiver_did);
    
    // 加密消息
    const [msg_type, encrypted_content] = this.e2ee_client.encrypt_message(
      receiver_did,
      content
    );
    
    // 发送加密消息
    return this.send_message(to, encrypted_content, {
      ...options,
      type: 'e2ee',
      e2ee_type: msg_type,
    });
  }

  /**
   * 处理 E2EE 消息
   */
  async process_e2ee_message(from, content) {
    return this.e2ee_client.decrypt_message(content);
  }

  /**
   * 查看收件箱
   */
  async check_inbox(options = {}) {
    const { limit = 10, history = null } = options;
    
    let params = { limit };
    if (history) {
      const sender_did = await this.resolve_handle(history);
      params.sender_did = sender_did;
    }
    
    const result = await authenticated_rpc_call(
      this.clients.message,
      '/message/rpc',
      'get_inbox',
      params,
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result.messages || [];
  }

  /**
   * 创建群组
   */
  async create_group(options = {}) {
    const { name, description, is_public = false } = options;
    
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/group/rpc',
      'create',
      {
        name,
        description,
        is_public,
      },
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result;
  }

  /**
   * 加入群组
   */
  async join_group(join_code) {
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/group/rpc',
      'join',
      { join_code: join_code },
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result;
  }

  /**
   * 发送群消息
   */
  async post_group_message(group_id, content) {
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/group/rpc',
      'post_message',
      {
        group_id: group_id,
        content,
      },
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result;
  }

  /**
   * 关注用户
   */
  async follow(handle) {
    const did = await this.resolve_handle(handle);
    
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/user-service/rpc',
      'follow',
      { target_did: did },
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result;
  }

  /**
   * 获取关注列表
   */
  async get_following() {
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/user-service/rpc',
      'get_following',
      {},
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result.users || [];
  }

  /**
   * 获取粉丝列表
   */
  async get_followers() {
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/user-service/rpc',
      'get_followers',
      {},
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result.users || [];
  }

  /**
   * 搜索用户
   */
  async search_users(query) {
    const result = await authenticated_rpc_call(
      this.clients.user,
      '/user-service/rpc',
      'search',
      { query },
      {
        auth: this,
        credential_name: this.credential_name,
      }
    );
    
    return result.users || [];
  }

  /**
   * 检查状态
   */
  async check_status() {
    const status = {
      config: {
        did_domain: this.config.did_domain,
        user_service_url: this.config.user_service_url,
        molt_message_url: this.config.molt_message_url,
      },
      identity: this.identity ? {
        did: this.identity.did,
        unique_id: this.identity.unique_id,
        name: this.identity.name,
        handle: this.identity.handle,
      } : null,
      clients: {
        user: this.clients.user ? 'connected' : 'not connected',
        message: this.clients.message ? 'connected' : 'not connected',
      },
    };
    
    return status;
  }

  /**
   * 列出所有身份
   */
  async list_identities() {
    return list_identities();
  }

  /**
   * 关闭 SDK
   */
  async destroy() {
    if (this.ws_client) {
      await this.ws_client.close();
    }
    if (this.clients.user) {
      this.clients.user.close();
    }
    if (this.clients.message) {
      this.clients.message.close();
    }
  }
}

/**
 * 创建 SDK 实例
 */
export async function create_sdk(credentialName = 'default') {
  const sdk = new AwikiSDK(credentialName);
  return sdk.init();
}

// 默认导出
export default {
  AwikiSDK,
  create_sdk,
};
