/**
 * Manages multiple Lavalink nodes with load balancing
 * @module lavalink/NodeManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { LavalinkNode } from './LavalinkNode';
import { LavalinkREST } from './LavalinkREST';
import { NodeConfig, NodeStats, NodeManagerOptions, NodeStatsSummary } from '../types';
import { validateObject, validateArray, validateNonEmptyString, validateNumber, validateRange, validateBoolean } from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';

/**
 * Manages multiple Lavalink nodes with load balancing and health checks
 */
export class NodeManager extends EventEmitter {
  #client: SuwakuClient;
  #nodes: Map<string, LavalinkNode> = new Map();
  #loadBalancer: boolean;
  #enableHealthCheck: boolean;
  #healthCheckInterval: number;
  #sortByRegion: boolean;
  #healthCheckTimeout: NodeJS.Timeout | null = null;

  constructor(client: SuwakuClient, options: NodeManagerOptions = {}) {
    super();
    validateObject(client, 'Client');
    validateObject(options, 'Node manager options');

    const opts = options as NodeManagerOptions;
    this.#client = client;
    this.#loadBalancer = opts.loadBalancer ?? true;
    this.#enableHealthCheck = opts.enableHealthCheck ?? true;
    this.#healthCheckInterval = opts.healthCheckInterval ?? 30_000;
    this.#sortByRegion = opts.sortByRegion ?? false;
  }

  get nodes(): Map<string, LavalinkNode> {
    return new Map(this.#nodes);
  }

  get size(): number {
    return this.#nodes.size;
  }

  get connectedCount(): number {
    let count = 0;
    for (const node of this.#nodes.values()) {
      if (node.connected) count++;
    }
    return count;
  }

  /**
   * Initialize nodes from configuration
   */
  init(nodes: NodeConfig[]): void {
    validateArray(nodes, 'Nodes');

    this.#nodes.clear();

    nodes.forEach(nodeConfig => {
      this.add(nodeConfig);
    });

    if (this.#enableHealthCheck) {
      this.#startHealthCheck();
    }
  }

  /**
   * Add a new node
   */
  add(config: NodeConfig): LavalinkNode {
    validateObject(config, 'Node config');
    validateNonEmptyString(config.host, 'Node host');
    validateNumber(config.port, 'Node port');
    validateRange(config.port, 'Node port', 1, 65535);
    validateNonEmptyString(config.password, 'Node password');
    validateBoolean(config.secure ?? false, 'Node secure');
    validateNonEmptyString(config.identifier ?? `${config.host}:${config.port}`, 'Node identifier');

    const identifier = config.identifier ?? `${config.host}:${config.port}`;

    if (this.#nodes.has(identifier)) {
      return this.#nodes.get(identifier)!;
    }

    const node = new LavalinkNode(config, this.#client);

    node.on('nodeConnect', () => this.#onNodeConnect(node));
    node.on('nodeDisconnect', (node, data) => this.#onNodeDisconnect(node, data));
    node.on('nodeError', (node, error) => this.#onNodeError(node, error));
    node.on('nodeReady', (node, data) => this.#onNodeReady(node, data));
    node.on('nodeStats', (node, stats) => this.#onNodeStats(node, stats));
    node.on('playerUpdate', (player) => this.#onPlayerUpdate(player));
    node.on('trackStart', (data) => this.#onTrackStart(data));
    node.on('trackEnd', (data) => this.#onTrackEnd(data));
    node.on('trackException', (data) => this.#onTrackException(data));
    node.on('trackStuck', (data) => this.#onTrackStuck(data));
    node.on('websocketClosed', (data) => this.#onWebSocketClosed(data));

    this.#nodes.set(identifier, node);

    return node;
  }

  /**
   * Remove a node
   */
  remove(identifier: string): LavalinkNode | undefined {
    validateNonEmptyString(identifier, 'Identifier');

    const node = this.#nodes.get(identifier);
    if (!node) return undefined;

    this.#disconnectNode(node);
    node.removeAllListeners();
    this.#nodes.delete(identifier);

    return node;
  }

  /**
   * Get a node by identifier
   */
  get(identifier: string): LavalinkNode | undefined {
    validateNonEmptyString(identifier, 'Identifier');
    return this.#nodes.get(identifier);
  }

  /**
   * Get all nodes
   */
  getAll(): LavalinkNode[] {
    return Array.from(this.#nodes.values());
  }

  /**
   * Get all nodes (alias for getAll)
   */
  getAllNodes(): LavalinkNode[] {
    return this.getAll();
  }

  /**
   * Get connected nodes
   */
  getConnected(): LavalinkNode[] {
    return Array.from(this.#nodes.values()).filter(node => node.connected);
  }

  /**
   * Get the best node based on load balancing
   */
  getBest(): LavalinkNode | undefined {
    const connectedNodes = this.getConnected();
    if (connectedNodes.length === 0) return undefined;

    if (!this.#loadBalancer || connectedNodes.length === 1) {
      return connectedNodes[0];
    }

    return connectedNodes.sort((a, b) => {
      const loadA = a.stats?.cpu?.systemLoad ?? 1;
      const loadB = b.stats?.cpu?.systemLoad ?? 1;
      return loadA - loadB;
    })[0];
  }

  /**
   * Connect all disconnected nodes
   */
  connectAll(): void {
    this.#nodes.forEach(node => {
      if (!node.connected) {
        this.#connectNode(node);
      }
    });
  }

  /**
   * Disconnect all nodes
   */
  disconnectAll(): void {
    this.#nodes.forEach(node => {
      if (node.connected) {
        this.#disconnectNode(node);
      }
    });

    if (this.#healthCheckTimeout) {
      clearTimeout(this.#healthCheckTimeout);
      this.#healthCheckTimeout = null;
    }
  }

  /**
   * Perform a health check on all nodes
   */
  healthCheck(): void {
    this.#nodes.forEach(node => {
      if (node.connected) {
        node.fetchStats().catch((error) => {
          this.emit('debug', `Health check failed for node ${node.id}: ${error.message}`);
        });
      }
    });
  }

  /**
   * Get statistics for all nodes
   */
  getStats(): NodeStatsSummary {
    return {
      size: this.#nodes.size,
      connectedCount: this.connectedCount
    };
  }

  // ==================== Private Methods ====================

  #connectNode(node: LavalinkNode): void {
    node.connect().catch(error => {
      this.#client.emit('error', new Error(`Failed to connect to node ${node.id}: ${error.message}`));
      this.#scheduleReconnect(node);
    });
  }

  #disconnectNode(node: LavalinkNode): void {
    node.disconnect().catch(error => {
      this.#client.emit('error', new Error(`Failed to disconnect from node ${node.id}: ${error.message}`));
    });
  }

  #scheduleReconnect(node: LavalinkNode): void {
    const attempts = node.reconnectAttempts;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30_000);

    if (this.#healthCheckTimeout) {
      clearTimeout(this.#healthCheckTimeout);
    }

    this.#healthCheckTimeout = setTimeout(() => {
      this.#connectNode(node);
    }, delay);
  }

  #onNodeConnect(node: LavalinkNode): void {
    this.emit('nodeConnect', node);
  }

  #onNodeDisconnect(node: LavalinkNode, data: any): void {
    this.emit('nodeDisconnect', node, data);
    this.#scheduleReconnect(node);
  }

  #onNodeError(node: LavalinkNode, error: any): void {
    this.emit('nodeError', node, error);
  }

  #onNodeReady(node: LavalinkNode, data: any): void {
    this.emit('nodeReady', node, data);
  }

  #onNodeStats(node: LavalinkNode, stats: NodeStats): void {
    this.emit('nodeStats', node, stats);
  }

  #onPlayerUpdate(player: any): void {
    this.emit('playerUpdate', player);
  }

  #onTrackStart(data: any): void {
    this.emit('trackStart', data);
  }

  #onTrackEnd(data: any): void {
    this.emit('trackEnd', data);
  }

  #onTrackException(data: any): void {
    this.emit('trackException', data);
  }

  #onTrackStuck(data: any): void {
    this.emit('trackStuck', data);
  }

  #onWebSocketClosed(data: any): void {
    this.emit('websocketClosed', data);
  }

  #startHealthCheck(): void {
    this.#healthCheckTimeout = setInterval(() => {
      this.healthCheck();
    }, this.#healthCheckInterval);
  }
}