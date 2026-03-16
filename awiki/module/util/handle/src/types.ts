/**
 * Handle 模块类型定义
 *
 * 移植自：python/scripts/utils/handle.py
 */

import type { DIDIdentity } from '@awiki/identity';
import type { SDKConfig } from '@awiki/config';
import type { AsyncClient } from '@awiki/client';

/**
 * OTP 发送结果
 */
export interface SendOtpResult {
  status: string;
  message: string;
  phone: string;
}

/**
 * Handle 注册选项
 */
export interface RegisterHandleOptions {
  /** 邀请码（短 Handle <= 4 字符时需要） */
  inviteCode?: string | null;
  /** 显示名称 */
  name?: string | null;
  /** 是否公开可见 */
  isPublic?: boolean;
  /** 自定义服务列表 */
  services?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }> | null;
}

/**
 * Handle 恢复选项
 */
export interface RecoverHandleOptions {
  /** 自定义服务列表 */
  services?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }> | null;
}

/**
 * Handle 解析结果
 */
export interface ResolveHandleResult {
  handle: string;
  did: string;
  status: string;
}

/**
 * Handle 查找结果
 */
export interface LookupHandleResult {
  handle: string;
  did: string;
  status: string;
}

/**
 * RPC 端点常量
 */
export const HANDLE_RPC = '/user-service/handle/rpc';
export const DID_AUTH_RPC = '/user-service/did-auth/rpc';
export const DEFAULT_COUNTRY_CODE = '+86';

/**
 * 导出所有类型
 */
export type {
  DIDIdentity,
  SDKConfig,
  AsyncClient,
};
