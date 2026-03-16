/**
 * WebSocket 客户端类型定义
 * 
 * 对应 Python websockets 库的类型系统
 */

/**
 * JSON-RPC 2.0 消息接口
 */
export interface JsonRpcMessage {
    jsonrpc: '2.0';
    method?: string;
    params?: Record<string, unknown>;
    id?: number | string;
    result?: unknown;
    error?: JsonRpcError;
}

/**
 * JSON-RPC 错误接口
 */
export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

/**
 * JSON-RPC 请求接口
 */
export interface JsonRpcRequest extends JsonRpcMessage {
    method: string;
    id: number | string;
}

/**
 * JSON-RPC 响应接口
 */
export interface JsonRpcResponse extends JsonRpcMessage {
    id: number | string;
    result?: unknown;
    error?: JsonRpcError;
}

/**
 * JSON-RPC 通知接口 (无 id 字段)
 */
export interface JsonRpcNotification extends JsonRpcMessage {
    method: string;
    params?: Record<string, unknown>;
}

/**
 * WebSocket 客户端配置接口
 * 
 * 对应 Python SDKConfig + DIDIdentity
 */
export interface WsClientConfig {
    /** WebSocket 服务端 URL (http/https 或 ws/wss) */
    url: string;
    /** JWT token 用于认证 */
    token: string;
    /** CA 证书 bundle (用于 SSL 验证) */
    caBundle?: string;
    /** Ping 间隔 (秒)，默认 20 */
    pingInterval?: number;
    /** Ping 超时 (秒)，默认 20 */
    pingTimeout?: number;
    /** 请求超时 (秒)，默认 30 */
    requestTimeout?: number;
    /** 接收超时 (秒)，默认 10 */
    receiveTimeout?: number;
}

/**
 * 发送消息参数接口
 * 
 * 对应 Python send_message 方法参数
 */
export interface SendMessageParams {
    /** 消息内容 */
    content: string;
    /** 接收者 DID */
    receiverDid?: string;
    /** 接收者用户 ID */
    receiverId?: string;
    /** 群组 DID */
    groupDid?: string;
    /** 群组 ID */
    groupId?: string;
    /** 消息类型，默认 'text' */
    msgType?: string;
    /** 客户端消息 ID (用于幂等投递)，自动生成 */
    clientMsgId?: string;
    /** 消息标题 */
    title?: string;
}

/**
 * WebSocket 连接状态
 */
export enum WebSocketState {
    /** 未连接 */
    DISCONNECTED = 0,
    /** 连接中 */
    CONNECTING = 1,
    /** 已连接 */
    OPEN = 2,
    /** 关闭中 */
    CLOSING = 3,
    /** 已关闭 */
    CLOSED = 4,
}

/**
 * WebSocket 事件接口
 */
export interface WebSocketEvents {
    /** 连接打开 */
    open: () => void;
    /** 连接关闭 */
    close: (code: number, reason: string) => void;
    /** 连接错误 */
    error: (error: Error) => void;
    /** 收到消息 */
    message: (data: JsonRpcMessage) => void;
    /** 收到 pong (心跳响应) */
    pong: () => void;
}

/**
 * 推送通知接口
 * 
 * 对应 Python receive_notification 返回的通知
 */
export interface PushNotification extends JsonRpcNotification {
    params: {
        /** 消息 ID */
        id?: string;
        /** 发送者 DID */
        sender_did?: string;
        /** 发送者名称 */
        sender_name?: string;
        /** 接收者 DID */
        receiver_did?: string;
        /** 群组 DID */
        group_did?: string;
        /** 群组 ID */
        group_id?: string;
        /** 群组名称 */
        group_name?: string;
        /** 消息类型 */
        type?: string;
        /** 消息内容 */
        content?: string;
        /** 标题 */
        title?: string;
        /** 服务器序列号 */
        server_seq?: number;
        /** 发送时间 */
        sent_at?: string;
        /** 是否 E2EE 加密 */
        _e2ee?: boolean;
        /** E2EE 提示 */
        _e2ee_notice?: string;
        /** 系统事件 */
        system_event?: Record<string, unknown>;
    };
}
