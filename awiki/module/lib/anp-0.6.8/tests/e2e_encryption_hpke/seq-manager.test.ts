/**
 * SeqManager 类单元测�? * 测试序号管理和防重放功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SeqManager, SeqMode } from '../../src/e2e_encryption_hpke/index';

describe('SeqManager', () => {
  describe('构造函�?, () => {
    it('应该创建 STRICT 模式的序号管理器', () => {
      const manager = new SeqManager(SeqMode.STRICT);
      
      expect(manager.sendSeqValue).toBe(0);
      expect(manager.recvSeqValue).toBe(0);
    });

    it('应该创建 WINDOW 模式的序号管理器', () => {
      const manager = new SeqManager(SeqMode.WINDOW);
      
      expect(manager.sendSeqValue).toBe(0);
      expect(manager.recvSeqValue).toBe(0);
    });

    it('应该使用默认参数', () => {
      const manager = new SeqManager();
      
      expect(manager.sendSeqValue).toBe(0);
      expect(manager.recvSeqValue).toBe(0);
    });

    it('应该接受自定�?maxSkip �?skipKeyTtl', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 512, 600);
      
      expect(manager.sendSeqValue).toBe(0);
      expect(manager.recvSeqValue).toBe(0);
    });
  });

  describe('nextSendSeq', () => {
    it('应该返回并递增发送序�?, () => {
      const manager = new SeqManager();
      
      expect(manager.nextSendSeq()).toBe(0);
      expect(manager.sendSeqValue).toBe(1);
      
      expect(manager.nextSendSeq()).toBe(1);
      expect(manager.sendSeqValue).toBe(2);
      
      expect(manager.nextSendSeq()).toBe(2);
      expect(manager.sendSeqValue).toBe(3);
    });
  });

  describe('validateRecvSeq - STRICT 模式', () => {
    it('应该只接受期望的序号', () => {
      const manager = new SeqManager(SeqMode.STRICT);
      
      expect(manager.validateRecvSeq(0)).toBe(true);
      expect(manager.validateRecvSeq(1)).toBe(false);
      expect(manager.validateRecvSeq(2)).toBe(false);
    });

    it('应该拒绝已使用的序号（防重放�?, () => {
      const manager = new SeqManager(SeqMode.STRICT);
      
      expect(manager.validateRecvSeq(0)).toBe(true);
      manager.markSeqUsed(0);
      manager.advanceRecvTo(0);
      
      expect(manager.validateRecvSeq(0)).toBe(false);
    });

    it('在推进后应该接受下一个序�?, () => {
      const manager = new SeqManager(SeqMode.STRICT);
      
      expect(manager.validateRecvSeq(0)).toBe(true);
      manager.advanceRecvTo(0);
      
      expect(manager.validateRecvSeq(1)).toBe(true);
      expect(manager.validateRecvSeq(0)).toBe(false);
    });
  });

  describe('validateRecvSeq - WINDOW 模式', () => {
    it('应该接受窗口内的序号', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 10);
      
      // 窗口 [0, 10)
      expect(manager.validateRecvSeq(0)).toBe(true);
      expect(manager.validateRecvSeq(5)).toBe(true);
      expect(manager.validateRecvSeq(9)).toBe(true);
      expect(manager.validateRecvSeq(10)).toBe(false);
    });

    it('应该拒绝窗口外的序号', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 10);
      
      expect(manager.validateRecvSeq(10)).toBe(false);
      expect(manager.validateRecvSeq(100)).toBe(false);
    });

    it('应该拒绝已使用的序号', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 10);
      
      expect(manager.validateRecvSeq(5)).toBe(true);
      manager.markSeqUsed(5);
      
      expect(manager.validateRecvSeq(5)).toBe(false);
    });

    it('在推进后应该更新窗口', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 10);
      
      // 初始窗口 [0, 10)
      expect(manager.validateRecvSeq(0)).toBe(true);
      expect(manager.validateRecvSeq(9)).toBe(true);
      expect(manager.validateRecvSeq(10)).toBe(false);
      
      // 推进�?5，新窗口 [6, 16)
      manager.advanceRecvTo(5);
      
      expect(manager.validateRecvSeq(5)).toBe(false);
      expect(manager.validateRecvSeq(6)).toBe(true);
      expect(manager.validateRecvSeq(15)).toBe(true);
      expect(manager.validateRecvSeq(16)).toBe(false);
    });
  });

  describe('markSeqUsed / isSeqUsed', () => {
    it('应该标记序号为已使用', () => {
      const manager = new SeqManager();
      
      expect(manager.isSeqUsed(0)).toBe(false);
      manager.markSeqUsed(0);
      expect(manager.isSeqUsed(0)).toBe(true);
    });

    it('应该�?TTL 过期后自动清�?, async () => {
      const manager = new SeqManager(SeqMode.STRICT, 256, 1); // 1 �?TTL
      
      manager.markSeqUsed(0);
      expect(manager.isSeqUsed(0)).toBe(true);
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(manager.isSeqUsed(0)).toBe(false);
    });

    it('应该区分不同序号', () => {
      const manager = new SeqManager();
      
      manager.markSeqUsed(0);
      manager.markSeqUsed(2);
      
      expect(manager.isSeqUsed(0)).toBe(true);
      expect(manager.isSeqUsed(1)).toBe(false);
      expect(manager.isSeqUsed(2)).toBe(true);
    });
  });

  describe('advanceRecvTo', () => {
    it('应该推进接收序号到指定值的下一�?, () => {
      const manager = new SeqManager();
      
      expect(manager.recvSeqValue).toBe(0);
      
      manager.advanceRecvTo(0);
      expect(manager.recvSeqValue).toBe(1);
      
      manager.advanceRecvTo(5);
      expect(manager.recvSeqValue).toBe(6);
    });
  });

  describe('cleanupExpiredCache', () => {
    it('应该清理过期的防重放缓存', async () => {
      const manager = new SeqManager(SeqMode.STRICT, 256, 1); // 1 �?TTL
      
      manager.markSeqUsed(0);
      manager.markSeqUsed(1);
      manager.markSeqUsed(2);
      
      expect(manager.isSeqUsed(0)).toBe(true);
      expect(manager.isSeqUsed(1)).toBe(true);
      expect(manager.isSeqUsed(2)).toBe(true);
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      manager.cleanupExpiredCache();
      
      expect(manager.isSeqUsed(0)).toBe(false);
      expect(manager.isSeqUsed(1)).toBe(false);
      expect(manager.isSeqUsed(2)).toBe(false);
    });
  });

  describe('reset', () => {
    it('应该重置所有序号状�?, () => {
      const manager = new SeqManager();
      
      manager.nextSendSeq();
      manager.nextSendSeq();
      manager.advanceRecvTo(5);
      manager.markSeqUsed(0);
      manager.markSeqUsed(1);
      
      expect(manager.sendSeqValue).toBe(2);
      expect(manager.recvSeqValue).toBe(6);
      expect(manager.isSeqUsed(0)).toBe(true);
      
      manager.reset();
      
      expect(manager.sendSeqValue).toBe(0);
      expect(manager.recvSeqValue).toBe(0);
      expect(manager.isSeqUsed(0)).toBe(false);
    });
  });

  describe('防重放攻�?, () => {
    it('应该防止序号重放攻击', () => {
      const manager = new SeqManager(SeqMode.STRICT);
      
      // 正常接收消息
      expect(manager.validateRecvSeq(0)).toBe(true);
      manager.markSeqUsed(0);
      manager.advanceRecvTo(0);
      
      // 攻击者重放消�?      expect(manager.validateRecvSeq(0)).toBe(false);
      
      // 正常接收下一�?      expect(manager.validateRecvSeq(1)).toBe(true);
    });

    it('�?WINDOW 模式下也应该防止重放', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 10);
      
      // 接收消息 5
      expect(manager.validateRecvSeq(5)).toBe(true);
      manager.markSeqUsed(5);
      manager.advanceRecvTo(5);
      
      // 重放攻击
      expect(manager.validateRecvSeq(5)).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理大序�?, () => {
      const manager = new SeqManager();
      
      manager.advanceRecvTo(999999);
      expect(manager.recvSeqValue).toBe(1000000);
      expect(manager.validateRecvSeq(1000000)).toBe(true);
    });

    it('应该处理 WINDOW 模式下的边界', () => {
      const manager = new SeqManager(SeqMode.WINDOW, 256);
      
      // 在边界处
      expect(manager.validateRecvSeq(0)).toBe(true);
      expect(manager.validateRecvSeq(255)).toBe(true);
      expect(manager.validateRecvSeq(256)).toBe(false);
    });
  });
});
