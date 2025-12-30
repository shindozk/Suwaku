/**
 * Lavalink Node - Manages WebSocket connection to a Lavalink server
 * @module lavalink/LavalinkNode
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { LavalinkOpcode, Defaults } from '../utils/constants.js';
import { ConnectionError } from '../utils/errors.js';
import { validateNodeConfig } from '../utils/validators.js';
import { LavalinkREST } from './LavalinkREST.js';

/**
 * Represents a connection to a Lavalink node
 * @extends EventEmitter
 */
class LavalinkNode extends EventEmitter {
  /**
   * @param {Object} manager - The node manager instance
   * @param {Object} options - Node configuration options
   * @param {string} options.host - Lavalink server host
   * @param {number} options.port - Lavalink server port
   * @param {string} options.password - Lavalink server password
   * @param {boolean} [options.secure=false] - Use secure WebSocket (wss://)
   * @param {string} [options.identifier] - Unique identifier for this node
   * @param {number} [options.retryAmount=5] - Number of reconnection attempts
   * @param {number} [options.retryDelay=5000] - Delay between reconnection attempts (ms)
   */
  constructor(manager, options) {
    super();

    validateNodeConfig(options);

    this.manager = manager;
    this.options = {
      host: options.host,
      port: options.port,
      password: options.password,
      secure: options.secure || false,
      identifier: options.identifier || `${options.host}:${options.port}`,
      retryAmount: options.retryAmount || Defaults.RECONNECT_ATTEMPTS,
      retryDelay: options.retryDelay || Defaults.RECONNECT_DELAY,
      ...options
    };

    /**
     * Unique identifier for this node
     * @type {string}
     */
    this.identifier = this.options.identifier;

    /**
     * WebSocket connection
     * @type {WebSocket|null}
     */
    this.ws = null;

    /**
     * Connection state
     * @type {boolean}
     */
    this.connected = false;

    /**
     * Number of reconnection attempts made
     * @type {number}
     */
    this.reconnectAttempts = 0;

    /**
     * Number of calls made to this node (for load balancing)
     * @type {number}
     */
    this.calls = 0;

    /**
     * Node statistics
     * @type {Object|null}
     */
    this.stats = null;

    /**
     * Reconnection timeout
     * @type {NodeJS.Timeout|null}
     */
    this.reconnectTimeout = null;

    /**
     * REST API client
     * @type {LavalinkREST}
     */
    this.rest = new LavalinkREST(this);

    /**
     * Session ID from Lavalink
     * @type {string|null}
     */
    this.sessionId = null;

    /**
     * Ping to node in milliseconds
     * @type {number}
     */
    this.ping = 0;

    /**
     * Last ping timestamp
     * @type {number}
     */
    this.lastPing = Date.now();

    /**
     * Ping interval
     * @type {NodeJS.Timeout|null}
     */
    this.pingInterval = null;
  }

  /**
   * Get the WebSocket URL for this node
   * @returns {string} WebSocket URL
   */
  get url() {
    const protocol = this.options.secure ? 'wss' : 'ws';
    return `${protocol}://${this.options.host}:${this.options.port}/v4/websocket`;
  }

  /**
   * Connect to the Lavalink node
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    const headers = {
      'Authorization': this.options.password,
      'User-Id': this.manager.clientId,
      'Client-Name': `Suwaku/${this.manager.version}`
    };

    if (this.options.resumeKey) {
      headers['Resume-Key'] = this.options.resumeKey;
    }

    try {
      this.ws = new WebSocket(this.url, { headers });

      this.ws.on('open', this._onOpen.bind(this));
      this.ws.on('message', this._onMessage.bind(this));
      this.ws.on('close', this._onClose.bind(this));
      this.ws.on('error', this._onError.bind(this));

      this.emit('debug', `[${this.identifier}] Connecting to ${this.url}`);
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Unknown connection error';
      this.emit('error', new ConnectionError(
        `Failed to create WebSocket connection: ${errorMessage}`,
        { node: this.identifier, error }
      ));
    }
  }

  /**
   * Disconnect from the Lavalink node
   * @param {number} [code=1000] - WebSocket close code
   * @param {string} [reason='Manual disconnect'] - Disconnect reason
   */
  disconnect(code = 1000, reason = 'Manual disconnect') {
    if (!this.ws) return;

    this.connected = false;
    this.reconnectAttempts = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.ws.close(code, reason);
    this.ws = null;

    this.emit('debug', `[${this.identifier}] Disconnected: ${reason}`);
  }

  /**
   * Start ping monitoring
   * @private
   */
  _startPingMonitoring() {
    // Clear existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Ping every 30 seconds
    this.pingInterval = setInterval(() => {
      this._measurePing();
    }, 30000);

    // Initial ping
    this._measurePing();
  }

  /**
   * Measure ping to node
   * @private
   */
  async _measurePing() {
    if (!this.connected) return;

    const start = Date.now();
    
    try {
      // Use stats endpoint to measure ping
      await this.rest.getStats();
      this.ping = Date.now() - start;
      this.lastPing = Date.now();
      
      // Emit warning if ping is high
      if (this.ping > 500) {
        this.emit('warn', `[${this.identifier}] High ping: ${this.ping}ms`);
      }
      
      this.emit('debug', `[${this.identifier}] Ping: ${this.ping}ms`);
    } catch (error) {
      this.emit('debug', `[${this.identifier}] Failed to measure ping: ${error.message}`);
    }
  }

  /**
   * Send a payload to the Lavalink node
   * @param {Object} payload - Payload to send
   * @returns {boolean} Whether the payload was sent successfully
   */
  send(payload) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('warn', `[${this.identifier}] Cannot send payload: not connected`);
      return false;
    }

    try {
      const data = JSON.stringify(payload);
      this.ws.send(data);
      this.calls++;
      return true;
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Unknown send error';
      this.emit('error', new ConnectionError(
        `Failed to send payload: ${errorMessage}`,
        { node: this.identifier, payload, error }
      ));
      return false;
    }
  }

  /**
   * Handle WebSocket open event
   * @private
   */
  _onOpen() {
    this.connected = true;
    this.reconnectAttempts = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Start ping monitoring
    this._startPingMonitoring();

    this.emit('connect', this);
    this.emit('debug', `[${this.identifier}] Connected successfully`);
  }

  /**
   * Handle WebSocket message event
   * @param {Buffer|string} data - Message data
   * @private
   */
  _onMessage(data) {
    try {
      const payload = JSON.parse(data.toString());

      // Handle stats updates
      if (payload.op === LavalinkOpcode.STATS) {
        this.stats = payload;
        this.emit('stats', payload);
        return;
      }

      // Handle ready event
      if (payload.op === LavalinkOpcode.READY) {
        this.sessionId = payload.sessionId;
        this.emit('ready', payload);
        return;
      }

      // Forward all messages to manager
      this.emit('message', payload);
    } catch (error) {
      // Log the actual data that failed to parse for debugging
      this.emit('debug', `Failed to parse message. Data: ${data.toString().substring(0, 200)}`);
      const errorMessage = error?.message || error?.toString() || 'Unknown parsing error';
      this.emit('error', new ConnectionError(
        `Failed to parse message: ${errorMessage}`,
        { node: this.identifier, error, stack: error?.stack }
      ));
    }
  }

  /**
   * Handle WebSocket close event
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   * @private
   */
  _onClose(code, reason) {
    this.connected = false;
    const reasonStr = reason.toString() || 'Unknown reason';

    this.emit('disconnect', { code, reason: reasonStr });
    this.emit('debug', `[${this.identifier}] Disconnected (${code}): ${reasonStr}`);

    // Attempt reconnection if not a clean close
    if (code !== 1000 && code !== 1001) {
      this._attemptReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   * @param {Error} error - Error object
   * @private
   */
  _onError(error) {
    const errorMessage = error.message || 'Unknown error';

    // Log different types of errors with appropriate messages
    if (errorMessage.includes('502')) {
      this.emit('debug', `[${this.identifier}] ⚠️  Lavalink server returned 502 Bad Gateway - Server may be down or restarting`);
    } else if (errorMessage.includes('503')) {
      this.emit('debug', `[${this.identifier}] ⚠️  Lavalink server returned 503 Service Unavailable - Server is temporarily unavailable`);
    } else if (errorMessage.includes('404')) {
      this.emit('debug', `[${this.identifier}] ❌ Lavalink server returned 404 Not Found - Check WebSocket path (/v4/websocket)`);
    } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
      this.emit('debug', `[${this.identifier}] ❌ Authentication failed - Check your Lavalink password`);
    } else if (errorMessage.includes('ECONNREFUSED')) {
      this.emit('debug', `[${this.identifier}] ❌ Connection refused - Lavalink server is not running or wrong host/port`);
    } else if (errorMessage.includes('ETIMEDOUT')) {
      this.emit('debug', `[${this.identifier}] ⚠️  Connection timeout - Server is not responding`);
    } else if (errorMessage.includes('ENOTFOUND')) {
      this.emit('debug', `[${this.identifier}] ❌ Host not found - Check your Lavalink host configuration`);
    } else {
      this.emit('debug', `[${this.identifier}] ❌ WebSocket error: ${errorMessage}`);
    }

    const safeErrorMessage = errorMessage || error?.message || error?.toString() || 'Unknown WebSocket error';
    this.emit('error', new ConnectionError(
      `WebSocket error: ${safeErrorMessage}`,
      { node: this.identifier, error }
    ));
  }

  /**
   * Attempt to reconnect to the node
   * @private
   */
  _attemptReconnect() {
    const maxReconnects = this.options.retryAmount || Infinity;
    
    if (this.reconnectAttempts >= maxReconnects && maxReconnects !== Infinity) {
      this.emit('error', new ConnectionError(
        `Failed to reconnect after ${this.reconnectAttempts} attempts`,
        { node: this.identifier }
      ));
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff with a cap of 30 seconds
    const delay = Math.min(this.options.retryDelay * this.reconnectAttempts, 30000);

    this.emit('debug',
      `[${this.identifier}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}${maxReconnects === Infinity ? '' : '/' + maxReconnects})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Get node information
   * @returns {Object} Node information
   */
  getInfo() {
    return {
      identifier: this.identifier,
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      connected: this.connected,
      calls: this.calls,
      stats: this.stats,
      reconnectAttempts: this.reconnectAttempts,
      ping: this.ping,
      lastPing: this.lastPing
    };
  }

  /**
   * Get node health status
   * @returns {Object} Health status
   */
  getHealth() {
    const issues = [];
    let healthy = true;

    // Check connection
    if (!this.connected) {
      issues.push('Node is not connected');
      healthy = false;
    }

    // Check ping
    if (this.ping > 500) {
      issues.push(`High ping: ${this.ping}ms`);
      healthy = false;
    }

    // Check last ping time
    const timeSinceLastPing = Date.now() - this.lastPing;
    if (timeSinceLastPing > 60000) {
      issues.push(`No ping response for ${Math.round(timeSinceLastPing / 1000)}s`);
      healthy = false;
    }

    // Check stats
    if (this.stats) {
      const cpuLoad = this.stats.cpu?.systemLoad || 0;
      const memoryUsed = this.stats.memory?.used || 0;
      const memoryTotal = this.stats.memory?.reservable || 1;
      const memoryPercent = (memoryUsed / memoryTotal) * 100;

      if (cpuLoad > 0.8) {
        issues.push(`High CPU load: ${(cpuLoad * 100).toFixed(1)}%`);
        healthy = false;
      }

      if (memoryPercent > 90) {
        issues.push(`High memory usage: ${memoryPercent.toFixed(1)}%`);
        healthy = false;
      }
    }

    return {
      healthy,
      issues,
      ping: this.ping,
      connected: this.connected,
      stats: this.stats
    };
  }
}

export { LavalinkNode };
