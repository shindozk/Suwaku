/**
 * Manages statistics for nodes and players
 * @module managers/StatsManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { NodeStats, PlayerManagerStats } from '../types';

interface PlayerStats {
  total: number;
  playing: number;
  paused: number;
}

/**
 * Manages statistics for nodes and players
 */
export class StatsManager extends EventEmitter {
  #client: SuwakuClient;
  #interval: NodeJS.Timeout | null = null;
  #intervalMs: number;
  #startedAt: number = 0;

  constructor(client: SuwakuClient, intervalMs = 60_000) {
    super();
    this.#client = client;
    this.#intervalMs = intervalMs;
  }

  /**
   * Start statistics collection
   */
  start(): void {
    if (this.#interval) return;

    this.#startedAt = Date.now();
    this.#interval = setInterval(() => {
      this.collect().catch(error => {
        this.emit('error', error);
      });
    }, this.#intervalMs);

    this.emit('debug', 'Stats manager started');
  }

  /**
   * Stop statistics collection
   */
  stop(): void {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
      this.emit('debug', 'Stats manager stopped');
    }
  }

  /**
   * Collect statistics from all nodes
   */
  async collect(): Promise<{
    nodes: (NodeStats & { identifier: string })[];
    players: PlayerManagerStats;
    timestamp: number;
  }> {
    const nodeStats: (NodeStats & { identifier: string })[] = [];

    for (const node of this.#client.nodes.getAll()) {
      if (node.connected) {
        try {
          const stats = await node.fetchStats();
          if (stats) {
            nodeStats.push({
              ...stats,
              identifier: node.id
            });
          }
        } catch (error) {
          this.emit('error', error);
        }
      }
    }

    const playerStats = this.#client.playerManager.getStats();

    const result = {
      nodes: nodeStats,
      players: playerStats,
      timestamp: Date.now()
    };

    this.emit('stats', result);
    return result;
  }

  /**
   * Get memory usage across all nodes
   */
  getMemoryUsage(): { used: number; allocated: number; percentage: number } {
    let totalUsed = 0;
    let totalAllocated = 0;

    for (const node of this.#client.nodes.getAll()) {
      if (node.stats?.memory) {
        totalUsed += node.stats.memory.used;
        totalAllocated += node.stats.memory.allocated;
      }
    }

    return {
      used: totalUsed,
      allocated: totalAllocated,
      percentage: totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0
    };
  }

  /**
   * Get CPU load across all nodes
   */
  getCpuLoad(): { systemLoad: number; lavalinkLoad: number; cores: number } {
    let totalSystemLoad = 0;
    let totalLavalinkLoad = 0;
    let totalCores = 0;
    let nodeCount = 0;

    for (const node of this.#client.nodes.getAll()) {
      if (node.stats?.cpu) {
        totalSystemLoad += node.stats.cpu.systemLoad;
        totalLavalinkLoad += node.stats.cpu.lavalinkLoad;
        totalCores += node.stats.cpu.cores;
        nodeCount++;
      }
    }

    return {
      systemLoad: nodeCount > 0 ? totalSystemLoad / nodeCount : 0,
      lavalinkLoad: nodeCount > 0 ? totalLavalinkLoad / nodeCount : 0,
      cores: totalCores
    };
  }

  /**
   * Get total player count
   */
  getTotalPlayers(): number {
    return this.#client.nodes.getAll().reduce((sum, node) => sum + (node.stats?.players ?? 0), 0);
  }

  /**
   * Get playing player count
   */
  getPlayingPlayers(): number {
    return this.#client.nodes.getAll().reduce((sum, node) => sum + (node.stats?.playingPlayers ?? 0), 0);
  }

  /**
   * Get average ping across nodes
   */
  getAveragePing(): number {
    const nodes = this.#client.nodes.getConnected();
    if (nodes.length === 0) return 0;

    const total = nodes.reduce((sum, node) => sum + node.ping, 0);
    return total / nodes.length;
  }

  /**
   * Get uptime of the stats manager
   */
  getUptime(): number {
    return this.#startedAt ? Date.now() - this.#startedAt : 0;
  }
}
