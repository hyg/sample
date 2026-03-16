/**
 * 序号管理和防重放
 */

import { DEFAULT_MAX_SKIP, DEFAULT_SKIP_KEY_TTL, SeqMode } from "./types";

/**
 * 消息序号管理器，支持严格模式和窗口模式
 */
export class SeqManager {
  private mode: SeqMode;
  private maxSkip: number;
  private skipKeyTtl: number;

  private sendSeq: number;
  private recvSeq: number;
  // 防重放：已使用的 seq 集合 {seq: expireTime}
  private usedSeqs: Map<number, number>;

  /**
   * @param mode - 序号验证策略
   * @param maxSkip - 窗口模式最大允许跳跃量
   * @param skipKeyTtl - 跳跃密钥缓存有效期（秒）
   */
  constructor(
    mode: SeqMode = SeqMode.STRICT,
    maxSkip: number = DEFAULT_MAX_SKIP,
    skipKeyTtl: number = DEFAULT_SKIP_KEY_TTL
  ) {
    this.mode = mode;
    this.maxSkip = maxSkip;
    this.skipKeyTtl = skipKeyTtl;

    this.sendSeq = 0;
    this.recvSeq = 0;
    this.usedSeqs = new Map();
  }

  /**
   * 获取发送序号
   */
  get sendSeqValue(): number {
    return this.sendSeq;
  }

  /**
   * 获取接收序号
   */
  get recvSeqValue(): number {
    return this.recvSeq;
  }

  /**
   * 获取并递增发送序号
   */
  nextSendSeq(): number {
    const seq = this.sendSeq;
    this.sendSeq++;
    return seq;
  }

  /**
   * 验证接收序号合法性
   * @param seq - 序号
   * @returns true 表示序号合法
   */
  validateRecvSeq(seq: number): boolean {
    // 防重放检查
    if (this.isSeqUsed(seq)) {
      return false;
    }

    if (this.mode === SeqMode.STRICT) {
      return seq === this.recvSeq;
    } else {
      // 窗口模式
      return this.recvSeq <= seq && seq < this.recvSeq + this.maxSkip;
    }
  }

  /**
   * 推进接收序号到指定值的下一个
   * @param seq - 当前序号
   */
  advanceRecvTo(seq: number): void {
    this.recvSeq = seq + 1;
  }

  /**
   * 标记序号已使用（防重放）
   * @param seq - 序号
   */
  markSeqUsed(seq: number): void {
    this.usedSeqs.set(seq, Date.now() / 1000 + this.skipKeyTtl);
  }

  /**
   * 检查序号是否已使用
   * @param seq - 序号
   * @returns true 表示已使用
   */
  isSeqUsed(seq: number): boolean {
    const expireTime = this.usedSeqs.get(seq);
    if (expireTime !== undefined) {
      if (expireTime > Date.now() / 1000) {
        return true;
      }
      // 已过期，移除
      this.usedSeqs.delete(seq);
    }
    return false;
  }

  /**
   * 清理过期的防重放缓存
   */
  cleanupExpiredCache(): void {
    const now = Date.now() / 1000;
    for (const [seq, expireTime] of this.usedSeqs.entries()) {
      if (expireTime <= now) {
        this.usedSeqs.delete(seq);
      }
    }
  }

  /**
   * 重置序号状态（会话重建时调用）
   */
  reset(): void {
    this.sendSeq = 0;
    this.recvSeq = 0;
    this.usedSeqs.clear();
  }
}
