/**
 * Node Manager - Manages multiple Lavalink nodes
 * @module lavalink/NodeManager
 */

import { EventEmitter } from 'events';
import { LavalinkNode } from './LavalinkNode.js';
import { NodeNotFoundError } from '../utils/errors.js';
import { validateNonEmptyArray, validateNonEmptyString } from '../utils/validators.js';

/**
 * Manages multiple Lavalink nodes with load balancing
 * @extends EventEmitter
 */
class NodeManager extends EventEmitter {
  /**
   * @param {Object} suwakuClient - The Suwaku client instance
   */
  constructor(suwakuClient) {
    super();

    this.client = suwakuClient;

    /**
     * Map of nodes by identifier
     * @type {Map<string, LavalinkNode>}
     */
    this.nodes = new Map();

    /**
     * Whether nodes have been initialized
     * @type {boolean}
     */
    this.initialized = false;
  }

  /**
   * Initialize nodes from configuration
   * @param {Array<Object>} nodeConfigs - Array of node configurations
   */
  init(nodeConfigs) {
    validateNonEmptyArray(nodeConfigs, 'Node configurations');

    for (const config of nodeConfigs) {
      this.add(config);
    }

    this.initialized = true;
    this.emit('debug', `Initialized ${this.nodes.size} node(s)`);
  }

  /**
   * Add a new node
   * @param {Object} config - Node configuration
   * @returns {LavalinkNode} The created node
   */
  add(config) {
    const node = new LavalinkNode(this.client, config);

    // Forward node events
    node.on('connect', () => {
      this.emit('nodeConnect', node);
      this.emit('debug', `Node ${node.identifier} connected`);
    });

    node.on('disconnect', data => {
      this.emit('nodeDisconnect', node, data);
      this.emit('debug', `Node ${node.identifier} disconnected`);
      
      // AQUAlink Feature: Fail-safe / Auto-resume
      // If a node disconnects, move its players to another healthy node
      this._handleNodeFailure(node);
    });

    node.on('error', error => {
      this.emit('nodeError', node, error);
      this.emit('error', error);
    });

    node.on('message', message => {
      this.emit('nodeMessage', node, message);
    });

    node.on('stats', stats => {
      this.emit('nodeStats', node, stats);
    });

    node.on('ready', data => {
      this.emit('nodeReady', node, data);
    });

    node.on('debug', message => {
      this.emit('debug', message);
    });

    node.on('warn', message => {
      this.emit('warn', message);
    });

    this.nodes.set(node.identifier, node);

    // Auto-connect if client is ready
    if (this.client.ready) {
      node.connect();
    }

    return node;
  }

  /**
   * Handle node failure by migrating players to another node (AQUAlink Feature)
   * @param {LavalinkNode} failedNode - The node that failed
   * @private
   */
  async _handleNodeFailure(failedNode) {
    const players = this.client.playerManager.getAll().filter(p => p.node.identifier === failedNode.identifier);
    if (players.length === 0) return;

    this.emit('debug', `Node ${failedNode.identifier} failed. Migrating ${players.length} players...`);

    const bestNode = this.getBest();
    if (!bestNode) {
      this.emit('error', new Error(`Critical: Node ${failedNode.identifier} failed and no other nodes are available for migration!`));
      return;
    }

    for (const player of players) {
      try {
        await player.moveNode(bestNode);
      } catch (error) {
        this.emit('error', new Error(`Failed to migrate player for guild ${player.guildId}: ${error.message}`));
      }
    }
  }

  /**
   * Remove a node
   * @param {string} identifier - Node identifier
   * @returns {boolean} Whether the node was removed
   */
  remove(identifier) {
    validateNonEmptyString(identifier, 'Node identifier');

    const node = this.nodes.get(identifier);
    if (!node) return false;

    node.disconnect();
    node.removeAllListeners();
    this.nodes.delete(identifier);

    this.emit('debug', `Removed node ${identifier}`);
    return true;
  }

  /**
   * Get a node by identifier
   * @param {string} identifier - Node identifier
   * @returns {LavalinkNode|undefined} The node or undefined
   */
  get(identifier) {
    return this.nodes.get(identifier);
  }

  /**
   * Check if a node exists
   * @param {string} identifier - Node identifier
   * @returns {boolean} Whether the node exists
   */
  has(identifier) {
    return this.nodes.has(identifier);
  }

  /**
   * Get all nodes
   * @returns {Array<LavalinkNode>} Array of all nodes
   */
  getAll() {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all connected nodes
   * @returns {Array<LavalinkNode>} Array of connected nodes
   */
  getConnected() {
    return this.getAll().filter(node => node.connected);
  }

  /**
   * Get the best node using Least Load balancing (AQUAlink Feature)
   * @returns {LavalinkNode|null} The best node or null
   */
  getBest() {
    const connected = this.getConnected();
    if (connected.length === 0) return null;

    // Least Load Balancing algorithm
    return connected.sort((a, b) => {
      const loadA = this._calculateNodeLoad(a);
      const loadB = this._calculateNodeLoad(b);
      return loadA - loadB;
    })[0];
  }

  /**
   * Calculate node load score (lower is better)
   * @param {LavalinkNode} node - The node to calculate load for
   * @returns {number} Load score
   * @private
   */
  _calculateNodeLoad(node) {
    if (!node.stats) return node.calls;

    const stats = node.stats;
    
    // Penalize high CPU load (0-1 range)
    const cpuLoad = (stats.cpu?.systemLoad || 0) * 100;
    
    // Penalize high memory usage
    const memUsed = stats.memory?.used || 0;
    const memTotal = stats.memory?.reservable || 1;
    const memUsage = (memUsed / memTotal) * 100;
    
    // Player count is a major factor
    const playingPlayers = stats.playingPlayers || 0;
    const totalPlayers = stats.players || 0;
    
    // Frame issues are serious
    const framesDeficit = stats.frameStats?.deficit || 0;
    const framesNulled = stats.frameStats?.nulled || 0;
    
    // Calculate score (weighted)
    let score = (playingPlayers * 2) + (totalPlayers * 0.5);
    score += cpuLoad * 1.5;
    score += memUsage * 0.5;
    score += (framesDeficit + framesNulled) * 10;
    
    // Also consider node-specific calls as a tie-breaker
    score += (node.calls / 1000);
    
    return score;
  }

  /**
   * Get the least used node (legacy, now uses getBest)
   * @returns {LavalinkNode|null} The least used node or null
   */
  getLeastUsed() {
    return this.getBest();
  }

  /**
   * Get a random connected node
   * @returns {LavalinkNode|null} A random node or null
   */
  getRandom() {
    const connected = this.getConnected();
    if (connected.length === 0) return null;

    return connected[Math.floor(Math.random() * connected.length)];
  }

  /**
   * Get the best node based on stats
   * @returns {LavalinkNode|null} The best node or null
   */
  getBest() {
    const connected = this.getConnected();
    if (connected.length === 0) return null;

    // Sort by CPU usage (lower is better)
    return connected.reduce((prev, curr) => {
      if (!prev.stats || !curr.stats) return prev;

      const prevCpu = prev.stats.cpu?.systemLoad || 1;
      const currCpu = curr.stats.cpu?.systemLoad || 1;

      return currCpu < prevCpu ? curr : prev;
    });
  }

  /**
   * Get a node by region (for region-based routing)
   * @param {string} region - Region identifier
   * @returns {LavalinkNode|null} A node in the region or null
   */
  getByRegion(region) {
    const connected = this.getConnected();
    if (connected.length === 0) return null;

    // Try to find a node with matching region
    const regional = connected.find(node => 
      node.options.region && node.options.region === region
    );

    // Fallback to least used if no regional node found
    return regional || this.getLeastUsed();
  }

  /**
   * Connect all nodes
   */
  connectAll() {
    for (const node of this.nodes.values()) {
      if (!node.connected) {
        node.connect();
      }
    }
  }

  /**
   * Disconnect all nodes
   */
  disconnectAll() {
    for (const node of this.nodes.values()) {
      if (node.connected) {
        node.disconnect();
      }
    }
  }

  /**
   * Get statistics for all nodes
   * @returns {Array<Object>} Array of node statistics
   */
  getStats() {
    return this.getAll().map(node => ({
      identifier: node.identifier,
      connected: node.connected,
      calls: node.calls,
      reconnectAttempts: node.reconnectAttempts,
      stats: node.stats
    }));
  }

  /**
   * Get a suitable node for a new player
   * @param {string} [region] - Preferred region
   * @returns {LavalinkNode} A suitable node
   * @throws {NodeNotFoundError} If no nodes are available
   */
  getNodeForPlayer(region) {
    let node = null;

    // Try region-based routing first
    if (region) {
      node = this.getByRegion(region);
    }

    // Fallback to least used
    if (!node) {
      node = this.getLeastUsed();
    }

    // Fallback to best node
    if (!node) {
      node = this.getBest();
    }

    // Fallback to random
    if (!node) {
      node = this.getRandom();
    }

    if (!node) {
      throw new NodeNotFoundError('No available nodes found');
    }

    return node;
  }

  /**
   * Health check for all nodes
   * @returns {Promise<Object>} Health check results
   */
  async healthCheck() {
    const results = {
      total: this.nodes.size,
      connected: 0,
      disconnected: 0,
      nodes: []
    };

    for (const node of this.nodes.values()) {
      const nodeResult = {
        identifier: node.identifier,
        connected: node.connected,
        healthy: false,
        latency: null,
        error: null
      };

      if (node.connected) {
        results.connected++;
        try {
          const start = Date.now();
          await node.rest.getInfo();
          nodeResult.latency = Date.now() - start;
          nodeResult.healthy = true;
        } catch (error) {
          nodeResult.error = error.message;
        }
      } else {
        results.disconnected++;
      }

      results.nodes.push(nodeResult);
    }

    return results;
  }

  /**
   * Get the total number of nodes
   * @returns {number} Number of nodes
   */
  get size() {
    return this.nodes.size;
  }

  /**
   * Get the number of connected nodes
   * @returns {number} Number of connected nodes
   */
  get connectedCount() {
    return this.getConnected().length;
  }
}

export { NodeManager };
