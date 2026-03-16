/**
 * Auth 模块类型定义
 *
 * 移植自：python/scripts/utils/auth.py
 *
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

import type { DIDIdentity } from '@awiki/identity';
import type { SDKConfig } from '@awiki/config';
import type { AsyncClient } from '@awiki/client';

/**
 * 注册 DID 选项
 */
export interface RegisterDidOptions {
  /** 显示名称 */
  name?: string | null;
  /** 是否公开可见 */
  isPublic?: boolean;
  /** 是否为 AI Agent */
  isAgent?: boolean;
  /** 角色 */
  role?: string | null;
  /** 连接端点 */
  endpointUrl?: string | null;
  /** 描述 */
  description?: string | null;
}

/**
 * 更新 DID 文档选项
 */
export interface UpdateDidDocumentOptions {
  /** 是否公开可见 */
  isPublic?: boolean;
  /** 是否为 AI Agent */
  isAgent?: boolean;
  /** 角色 */
  role?: string | null;
  /** 连接端点 */
  endpointUrl?: string | null;
}

/**
 * 创建认证身份选项
 */
export interface CreateAuthenticatedIdentityOptions {
  /** 显示名称 */
  name?: string | null;
  /** 是否公开可见 */
  isPublic?: boolean;
  /** 是否为 AI Agent */
  isAgent?: boolean;
  /** 角色 */
  role?: string | null;
  /** 连接端点 */
  endpointUrl?: string | null;
  /** 自定义服务列表 */
  services?: Array<Record<string, unknown>> | null;
}

/**
 * 注册结果
 */
export interface RegisterResult {
  /** DID 标识符 */
  did: string;
  /** 用户 ID */
  user_id: string;
  /** 消息 */
  message: string;
}

/**
 * 更新结果
 */
export interface UpdateResult {
  /** DID 标识符 */
  did: string;
  /** 用户 ID */
  user_id: string;
  /** 消息 */
  message: string;
  /** 访问令牌（可选） */
  access_token?: string;
}

/**
 * 签名回调函数类型
 *
 * 对应 Python: sign_callback(content: bytes, vm_fragment: str) -> bytes
 */
export type SignCallback = (
  content: Buffer,
  verificationMethodFragment: string
) => Buffer | Promise<Buffer>;

/**
 * 生成认证头选项
 */
export interface GenerateAuthHeaderOptions {
  /** DID 文档 */
  didDocument: Record<string, unknown>;
  /** 服务域名 */
  serviceDomain: string;
  /** 签名回调 */
  signCallback: SignCallback;
}
