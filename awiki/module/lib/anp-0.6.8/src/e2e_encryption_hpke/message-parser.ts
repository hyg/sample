/**
 * 消息 content 解析和类型检测
 */

import { MessageType } from "./types";

/**
 * 从 type 字段检测消息类型
 * @param typeField - 消息的 type 字段值
 * @returns 对应的 MessageType，未识别则返回 null
 */
export function detectMessageType(typeField: string): MessageType | null {
  if (!typeField || typeof typeField !== 'string') {
    return null;
  }
  
  // 直接匹配枚举值
  const typeValue = typeField as MessageType;
  if (Object.values(MessageType).includes(typeValue)) {
    return typeValue;
  }
  
  return null;
}

/**
 * 解析 e2ee_init / e2ee_rekey 消息 content
 */
export function parseE2eeInit(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

/**
 * 解析 e2ee_ack 消息 content
 */
export function parseE2eeAck(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

/**
 * 解析 e2ee_msg 消息 content
 */
export function parseE2eeMsg(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

/**
 * 解析 e2ee_error 消息 content
 */
export function parseE2eeError(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

/**
 * 解析 group_e2ee_key 消息 content
 */
export function parseGroupE2eeKey(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

/**
 * 解析 group_e2ee_msg 消息 content
 */
export function parseGroupE2eeMsg(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

/**
 * 解析 group_epoch_advance 消息 content
 */
export function parseGroupEpochAdvance(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}
