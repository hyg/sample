/**
 * E2EE state persistence.
 * 
 * Compatible with Python's e2ee_store.py.
 * 
 * Stores:
 * - Session state (chain keys, sequence numbers)
 * - Peer E2EE keys
 * - Session metadata
 */


const __dirname = dirname(fileURLToPath(import.meta.url));
const E2EE_STORE_DIR = join(__dirname, '..', '.e2ee_store');

/**
 * Ensure E2EE store directory exists.
 * @private
 */
function ensureStoreDir() {
    if (!existsSync(E2EE_STORE_DIR)) {
        mkdirSync(E2EE_STORE_DIR, { recursive: true });
    }
}

/**
 * Get store file path for a credential.
 * 
 * @param {string} credentialName - Credential name.
 * @returns {string} Store file path.
 * @private
 */
function getStorePath(credentialName) {
    return join(E2EE_STORE_DIR, `${credentialName}.json`);
}

/**
 * Save E2EE state to disk.
 * 
 * @param {Object} state - E2EE state object.
 * @param {string} credentialName - Credential name.
 */
export function saveE2eeState(state, credentialName = 'default') {
    ensureStoreDir();
    const storePath = getStorePath(credentialName);
    
    try {
        // Add timestamp
        state.updated_at = new Date().toISOString();
        
        writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
        console.warn('Failed to save E2EE state:', error.message);
    }
}

/**
 * 
 * @param {string} credentialName - Credential name.
 * @returns {Object|null} E2EE state object or null.
 */
export function loadE2eeState(credentialName = 'default') {
    const storePath = getStorePath(credentialName);
    
    if (!existsSync(storePath)) {
        return null;
    }
    
    try {
        const data = readFileSync(storePath, 'utf-8');
        const state = JSON.parse(data);
        
        // Validate state
        if (!state.local_did || !state.sessions) {
            console.warn('Invalid E2EE state format');
            return null;
        }
        
        return state;
    } catch (error) {
        console.warn('Failed to load E2EE state:', error.message);
        return null;
    }
}

/**
 * 
 * @param {string} credentialName - Credential name.
 */
export function deleteE2eeState(credentialName = 'default') {
    const storePath = getStorePath(credentialName);
    
    if (existsSync(storePath)) {
        try {
            storePath.unlinkSync(storePath);
        } catch (error) {
            console.warn('Failed to delete E2EE state:', error.message);
        }
    }
}

/**
 * Get session for a specific peer.
 * 
 * @param {string} credentialName - Credential name.
 * @param {string} peerDid - Peer DID identifier.
 * @returns {Object|null} Session state or null.
 */
export function getSession(credentialName, peerDid) {
    const state = loadE2eeState(credentialName);
    
    if (!state || !state.sessions) {
        return null;
    }
    
    // Find session by peer_did
    for (const [sessionId, session] of Object.entries(state.sessions)) {
        if (session.peer_did === peerDid) {
            return { sessionId, ...session };
        }
    }
    
    return null;
}

/**
 * Update session state.
 * 
 * @param {string} credentialName - Credential name.
 * @param {string} sessionId - Session ID.
 * @param {Object} updates - Session updates.
 */
export function updateSession(credentialName, sessionId, updates) {
    const state = loadE2eeState(credentialName) || { local_did: '', sessions: {} };
    
    if (state.sessions[sessionId]) {
        state.sessions[sessionId] = {
            ...state.sessions[sessionId],
            ...updates,
            updated_at: new Date().toISOString()
        };
        
        saveE2eeState(state, credentialName);
    }
}

/**
 * Delete session.
 * 
 * @param {string} credentialName - Credential name.
 * @param {string} sessionId - Session ID.
 */
export function deleteSession(credentialName, sessionId) {
    const state = loadE2eeState(credentialName);
    
    if (state && state.sessions[sessionId]) {
        delete state.sessions[sessionId];
        saveE2eeState(state, credentialName);
    }
}

/**
 * List all sessions.
 * 
 * @param {string} credentialName - Credential name.
 * @returns {Array<Object>} List of session states.
 */
export function listSessions(credentialName = 'default') {
    const state = loadE2eeState(credentialName);
    
    if (!state || !state.sessions) {
        return [];
    }
    
    return Object.entries(state.sessions).map(([sessionId, session]) => ({
        session_id: sessionId,
        ...session
    }));
}

/**
 * Clear expired sessions (older than 30 days).
 * 
 * @param {string} credentialName - Credential name.
 */
export function clearExpiredSessions(credentialName = 'default') {
    const state = loadE2eeState(credentialName);
    
    if (!state || !state.sessions) {
        return;
    }
    
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let changed = false;
    
    for (const sessionId of Object.keys(state.sessions)) {
        const session = state.sessions[sessionId];
        if (session.updated_at && session.updated_at < cutoff) {
            delete state.sessions[sessionId];
            changed = true;
        }
    }
    
    if (changed) {
        saveE2eeState(state, credentialName);
    }
}

export default {
    saveE2eeState,
    loadE2eeState,
    deleteE2eeState,
    getSession,
    updateSession,
    deleteSession,
    listSessions,
    clearExpiredSessions
};
