/**
 * Player Manager - Manages all players
 * @module managers/PlayerManager
 */

import { EventEmitter } from 'events';
import { SuwakuPlayer } from '../structures/SuwakuPlayer.js';
import { validateNonEmptyString, validateObject } from '../utils/validators.js';

/**
 * Manages all music players
 * @extends EventEmitter
 */
class PlayerManager extends EventEmitter {
  /**
   * @param {SuwakuClient} client - The Suwaku client instance
   */
  constructor(client) {
    super();

    this.client = client;

    /**
     * Map of players by guild ID
     * @type {Map<string, SuwakuPlayer>}
     */
    this.players = new Map();
  }

  /**
   * Create a new player
   * @param {Object} options - Player options
   * @param {string} options.guildId - Guild ID
   * @param {string} options.voiceChannelId - Voice channel ID
   * @param {string} [options.textChannelId] - Text channel ID
   * @param {LavalinkNode} [options.node] - Specific node to use
   * @returns {SuwakuPlayer} Created player
   */
  create(options) {
    validateObject(options, 'Player options');
    validateNonEmptyString(options.guildId, 'Guild ID');

    // Return existing player if it exists
    if (this.players.has(options.guildId)) {
      return this.players.get(options.guildId);
    }

    // Get node if not provided
    if (!options.node) {
      options.node = this.client.nodes.getNodeForPlayer();
    }

    // Create new player
    const player = new SuwakuPlayer(this.client, options);

    // Store player
    this.players.set(options.guildId, player);

    // Forward player events
    this._setupPlayerEvents(player);

    this.emit('playerCreate', player);
    this.emit('debug', `Created player for guild ${options.guildId}`);

    return player;
  }

  /**
   * Get a player by guild ID
   * @param {string} guildId - Guild ID
   * @returns {SuwakuPlayer|undefined} Player or undefined
   */
  get(guildId) {
    validateNonEmptyString(guildId, 'Guild ID');
    return this.players.get(guildId);
  }

  /**
   * Check if a player exists
   * @param {string} guildId - Guild ID
   * @returns {boolean} Whether player exists
   */
  has(guildId) {
    return this.players.has(guildId);
  }

  /**
   * Destroy a player
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Whether player was destroyed
   */
  async destroy(guildId) {
    validateNonEmptyString(guildId, 'Guild ID');

    const player = this.players.get(guildId);
    if (!player) return false;

    await player.destroy();
    this.players.delete(guildId);

    this.emit('playerDestroy', player);
    this.emit('debug', `Destroyed player for guild ${guildId}`);

    return true;
  }

  /**
   * Get all players
   * @returns {Array<SuwakuPlayer>} Array of all players
   */
  getAll() {
    return Array.from(this.players.values());
  }

  /**
   * Get all playing players
   * @returns {Array<SuwakuPlayer>} Array of playing players
   */
  getPlaying() {
    return this.getAll().filter(player => player.playing);
  }

  /**
   * Get all idle players
   * @returns {Array<SuwakuPlayer>} Array of idle players
   */
  getIdle() {
    return this.getAll().filter(player => player.state === 'idle');
  }

  /**
   * Destroy all players
   * @returns {Promise<number>} Number of players destroyed
   */
  async destroyAll() {
    const count = this.players.size;
    const promises = [];

    for (const [guildId] of this.players) {
      promises.push(this.destroy(guildId));
    }

    await Promise.all(promises);
    return count;
  }

  /**
   * Get player statistics
   * @returns {Object} Player statistics
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      playing: all.filter(p => p.playing).length,
      paused: all.filter(p => p.paused).length,
      idle: all.filter(p => p.state === 'idle').length,
      connected: all.filter(p => p.connected).length
    };
  }

  /**
   * Set up event forwarding for a player
   * @param {SuwakuPlayer} player - Player instance
   * @private
   */
  _setupPlayerEvents(player) {
    // Forward all player events to manager
    const events = [
      'trackStart', 'trackEnd', 'trackError', 'trackStuck',
      'queueEnd', 'pause', 'resume', 'stop', 'seek',
      'volumeChange', 'loopChange', 'connecting', 'disconnect',
      'voiceWebSocketClosed', 'destroy', 'error',
      'trackAdd', 'tracksAdd', 'trackAddPlaylist', 'trackRemove',
      'playerJoin', 'playerLeave', 'playlistProgress'
    ];

    for (const event of events) {
      player.on(event, (...args) => {
        this.emit(event, player, ...args);
      });
    }
  }

  /**
   * Get the total number of players
   * @returns {number} Number of players
   */
  get size() {
    return this.players.size;
  }
}

export { PlayerManager };
