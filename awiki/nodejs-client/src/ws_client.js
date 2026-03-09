/**
 * WebSocket client for real-time message push.
 * 
 * Compatible with Python's ws_client.py.
 * 
 * Connects to wss://awiki.ai/ws?token=<jwt_token>
 * Receives: new_message, e2ee_message, relationship_update, group_update
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const WS_URL = 'wss://awiki.ai/ws';

/**
 * WebSocket Client class.
 */
export class WSClient extends EventEmitter {
    /**
     * Create WebSocket client.
     * 
     * @param {string} jwtToken - JWT token for authentication.
     */
    constructor(jwtToken) {
        super();
        this.jwtToken = jwtToken;
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }
    
    /**
     * Connect to WebSocket server.
     */
    connect() {
        const url = `${WS_URL}?token=${this.jwtToken}`;
        
        console.log('[WS] Connecting to', url.replace(this.jwtToken, '***'));
        
        this.ws = new WebSocket(url);
        
        this.ws.on('open', () => {
            console.log('[WS] Connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
        });
        
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('[WS] Received:', message.type);
                this.emit('message', message);
                
                // Emit specific event types
                if (message.type) {
                    this.emit(message.type, message);
                }
            } catch (error) {
                console.error('[WS] Failed to parse message:', error.message);
                this.emit('error', { type: 'parse_error', error: error.message });
            }
        });
        
        this.ws.on('close', (code, reason) => {
            console.log('[WS] Closed:', code, reason?.toString());
            this.connected = false;
            this.emit('closed', { code, reason: reason?.toString() });
            
            // Auto-reconnect
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectDelay *= 2; // Exponential backoff
            } else {
                console.log('[WS] Max reconnect attempts reached');
                this.emit('max_reconnect_reached');
            }
        });
        
        this.ws.on('error', (error) => {
            console.error('[WS] Error:', error.message);
            this.emit('error', error);
        });
        
        this.ws.on('ping', () => {
            console.log('[WS] Ping received');
        });
        
        this.ws.on('pong', () => {
            console.log('[WS] Pong received');
        });
    }
    
    /**
     * Disconnect from WebSocket server.
     */
    disconnect() {
        if (this.ws) {
            console.log('[WS] Disconnecting');
            this.ws.close();
            this.ws = null;
            this.connected = false;
        }
    }
    
    /**
     * Send a message to the server.
     * 
     * @param {Object} message - Message to send.
     */
    send(message) {
        if (this.ws && this.connected) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('[WS] Not connected, cannot send message');
        }
    }
    
    /**
     * Check if connected.
     * 
     * @returns {boolean} Connection status.
     */
    isConnected() {
        return this.connected && this.ws !== null;
    }
}

/**
 * Create and manage WebSocket listener service.
 */
export class WSListener extends EventEmitter {
    /**
     * Create WebSocket listener.
     * 
     * @param {string} jwtToken - JWT token for authentication.
     * @param {Object} options - Listener options.
     */
    constructor(jwtToken, options = {}) {
        super();
        this.client = new WSClient(jwtToken);
        this.options = {
            autoReconnect: true,
            handleMessage: null,
            ...options
        };
        
        this._setupHandlers();
    }
    
    /**
     * Setup event handlers.
     * @private
     */
    _setupHandlers() {
        this.client.on('connected', () => {
            this.emit('connected');
        });
        
        this.client.on('closed', (info) => {
            this.emit('closed', info);
        });
        
        this.client.on('error', (error) => {
            this.emit('error', error);
        });
        
        this.client.on('message', (message) => {
            if (this.options.handleMessage) {
                this.options.handleMessage(message);
            }
            this.emit('message', message);
        });
        
        this.client.on('max_reconnect_reached', () => {
            this.emit('max_reconnect_reached');
        });
    }
    
    /**
     * Start listening.
     */
    start() {
        console.log('[WSListener] Starting');
        this.client.connect();
    }
    
    /**
     * Stop listening.
     */
    stop() {
        console.log('[WSListener] Stopping');
        this.client.disconnect();
    }
    
    /**
     * Check if running.
     * 
     * @returns {boolean} Running status.
     */
    isRunning() {
        return this.client.isConnected();
    }
}

export default {
    WSClient,
    WSListener
};
