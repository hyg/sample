/**
 * SDK 配置选项接口
 */
export interface SDKConfigOptions {
  /** 用户服务 URL */
  user_service_url?: string;
  /** molt-message HTTP URL */
  molt_message_url?: string;
  /** molt-message WebSocket URL (可为空) */
  molt_message_ws_url?: string | null;
  /** DID 域名 */
  did_domain?: string;
  /** 凭证目录路径 */
  credentials_dir?: string;
  /** 数据目录路径 */
  data_dir?: string;
}

/**
 * SDK 配置类接口
 */
export interface ISDKConfig {
  readonly user_service_url: string;
  readonly molt_message_url: string;
  readonly molt_message_ws_url: string | null;
  readonly did_domain: string;
  readonly credentials_dir: string;
  readonly data_dir: string;
}
