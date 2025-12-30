/**
 * Stats Manager - Handles real-time analytics for Suwaku (AQUAlink Feature)
 * @module managers/StatsManager
 */

import { EventEmitter } from 'events';

/**
 * Manages real-time statistics and analytics
 * @extends EventEmitter
 */
class StatsManager extends EventEmitter {
  /**
   * @param {SuwakuClient} client - The Suwaku client instance
   */
  constructor(client) {
    super();
    this.client = client;

    /**
     * Start time of the client
     * @type {number}
     */
    this.startTime = Date.now();

    /**
     * Total tracks played
     * @type {number}
     */
    this.totalTracksPlayed = 0;

    /**
     * Total search requests
     * @type {number}
     */
    this.totalSearches = 0;

    /**
     * Total errors encountered
     * @type {number}
     */
    this.totalErrors = 0;

    /**
     * Map of source usage
     * @type {Map<string, number>}
     */
    this.sourceUsage = new Map();

    /**
     * Track playback history for analytics
     * @type {Array<Object>}
     */
    this.playbackHistory = [];

    this._setupListeners();
  }

  /**
   * Set up event listeners for tracking
   * @private
   */
  _setupListeners() {
    this.client.on('trackStart', (player, track) => {
      this.totalTracksPlayed++;
      const source = track.source || 'unknown';
      this.sourceUsage.set(source, (this.sourceUsage.get(source) || 0) + 1);
      
      this.playbackHistory.push({
        trackId: track.identifier,
        guildId: player.guildId,
        timestamp: Date.now(),
        source: source
      });

      // Keep only last 1000 entries
      if (this.playbackHistory.length > 1000) {
        this.playbackHistory.shift();
      }
    });

    this.client.on('error', () => {
      this.totalErrors++;
    });

    this.client.on('nodeError', () => {
      this.totalErrors++;
    });
  }

  /**
   * Log a search request
   * @param {string} source - Search source
   */
  logSearch(source) {
    this.totalSearches++;
    const s = source || 'unknown';
    this.sourceUsage.set(`search_${s}`, (this.sourceUsage.get(`search_${s}`) || 0) + 1);
  }

  /**
   * Get comprehensive analytics
   * @returns {Object} Analytics data
   */
  getAnalytics() {
    const uptime = Date.now() - this.startTime;
    const players = this.client.playerManager.getStats();
    const nodes = this.client.nodes.getAll().map(n => n.getInfo());

    return {
      uptime,
      totalTracksPlayed: this.totalTracksPlayed,
      totalSearches: this.totalSearches,
      totalErrors: this.totalErrors,
      players,
      nodes,
      sourceUsage: Object.fromEntries(this.sourceUsage),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }
}

export { StatsManager };
