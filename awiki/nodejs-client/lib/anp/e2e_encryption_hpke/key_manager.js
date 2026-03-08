/**
 * Multi-session/group chat key manager.
 * 
 * @module e2ee_key_manager
 */

import { E2eeHpkeSession } from './e2ee_session.js';

/**
 * Manage multiple private chat and group chat E2EE sessions.
 */
export class HpkeKeyManager {
    constructor() {
        // Private chat: indexed by DID pair
        this.sessionsByDidPair = new Map();
        // Private chat: indexed by session_id
        this.sessionsBySessionId = new Map();
        // Group chat: indexed by group_did
        this.groupSessions = new Map();
    }
    
    /**
     * Create DID pair key.
     * @param {string} localDid 
     * @param {string} peerDid 
     * @returns {string}
     */
    static didPairKey(localDid, peerDid) {
        return `${localDid}|${peerDid}`;
    }
    
    /**
     * Get active session for DID pair.
     * @param {string} localDid 
     * @param {string} peerDid 
     * @returns {E2eeHpkeSession|null}
     */
    getActiveSession(localDid, peerDid) {
        const key = HpkeKeyManager.didPairKey(localDid, peerDid);
        const session = this.sessionsByDidPair.get(key);
        
        if (session && !session.isExpired()) {
            return session;
        }
        
        return null;
    }
    
    /**
     * Get session by session_id.
     * @param {string} sessionId 
     * @returns {E2eeHpkeSession|null}
     */
    getSessionById(sessionId) {
        const session = this.sessionsBySessionId.get(sessionId);
        
        if (session && !session.isExpired()) {
            return session;
        }
        
        return null;
    }
    
    /**
     * Register session.
     * @param {E2eeHpkeSession} session 
     */
    registerSession(session) {
        const key = HpkeKeyManager.didPairKey(session.localDid, session.peerDid);
        
        // Remove old session
        const old = this.sessionsByDidPair.get(key);
        if (old && old.sessionId) {
            this.sessionsBySessionId.delete(old.sessionId);
        }
        
        this.sessionsByDidPair.set(key, session);
        
        if (session.sessionId) {
            this.sessionsBySessionId.set(session.sessionId, session);
        }
    }
    
    /**
     * Remove session for DID pair.
     * @param {string} localDid 
     * @param {string} peerDid 
     */
    removeSession(localDid, peerDid) {
        const key = HpkeKeyManager.didPairKey(localDid, peerDid);
        const session = this.sessionsByDidPair.get(key);
        
        this.sessionsByDidPair.delete(key);
        
        if (session && session.sessionId) {
            this.sessionsBySessionId.delete(session.sessionId);
        }
    }
    
    /**
     * Get group session.
     * @param {string} groupDid 
     * @returns {Object|null}
     */
    getGroupSession(groupDid) {
        return this.groupSessions.get(groupDid) || null;
    }
    
    /**
     * Register group session.
     * @param {Object} session 
     */
    registerGroupSession(session) {
        this.groupSessions.set(session.groupDid, session);
    }
    
    /**
     * Remove group session.
     * @param {string} groupDid 
     */
    removeGroupSession(groupDid) {
        this.groupSessions.delete(groupDid);
    }
    
    /**
     * Cleanup all expired sessions.
     */
    cleanupExpired() {
        // Private chat
        const expiredPairs = [];
        for (const [key, session] of this.sessionsByDidPair.entries()) {
            if (session.isExpired()) {
                expiredPairs.push(key);
            }
        }
        
        for (const key of expiredPairs) {
            const session = this.sessionsByDidPair.get(key);
            this.sessionsByDidPair.delete(key);
            if (session && session.sessionId) {
                this.sessionsBySessionId.delete(session.sessionId);
            }
        }
        
        // Group chat cleanup would go here
    }
}

export default {
    HpkeKeyManager
};
