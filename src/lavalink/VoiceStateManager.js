/**
 * Voice State Manager - Handles Discord voice state updates
 * @module lavalink/VoiceStateManager
 */

import { EventEmitter } from 'events';

/**
 * Manages voice state updates from Discord
 * @extends EventEmitter
 */
class VoiceStateManager extends EventEmitter {
  /**
   * @param {SuwakuClient} client - The Suwaku client instance
   */
  constructor(client) {
    super();

    this.client = client;

    /**
     * Map of voice states by guild ID
     * @type {Map<string, Object>}
     */
    this.states = new Map();
  }

  /**
   * Handle raw Discord packet
   * @param {Object} packet - Discord gateway packet
   */
  handlePacket(packet) {
    if (!packet || !packet.t || !packet.d) return;

    const { t: type, d: data } = packet;

    switch (type) {
    case 'VOICE_STATE_UPDATE':
      this._handleVoiceStateUpdate(data);
      break;
    case 'VOICE_SERVER_UPDATE':
      this._handleVoiceServerUpdate(data);
      break;
    }
  }

  /**
   * Handle VOICE_STATE_UPDATE packet
   * @param {Object} data - Voice state data
   * @private
   */
  _handleVoiceStateUpdate(data) {
    const { guild_id: guildId, user_id: userId, session_id: sessionId, channel_id: channelId } = data;

    // Only handle bot's own voice state
    if (userId !== this.client.discordClient.user.id) {
      return;
    }

    const state = this.states.get(guildId) || {};
    state.sessionId = sessionId;
    state.channelId = channelId;

    this.states.set(guildId, state);

    this.emit('voiceStateUpdate', {
      guildId,
      sessionId,
      channelId,
      state
    });

    // If we have both session and server info, attempt connection
    if (state.sessionId && state.event) {
      this._attemptConnection(guildId, state);
    }

    // Handle disconnection
    if (!channelId) {
      this.emit('voiceDisconnect', { guildId });
      this.states.delete(guildId);
    }
  }

  /**
   * Handle VOICE_SERVER_UPDATE packet
   * @param {Object} data - Voice server data
   * @private
   */
  _handleVoiceServerUpdate(data) {
    const { guild_id: guildId, token, endpoint } = data;

    const state = this.states.get(guildId) || {};
    state.event = { token, endpoint, guild_id: guildId };

    this.states.set(guildId, state);

    this.emit('voiceServerUpdate', {
      guildId,
      token,
      endpoint,
      state
    });

    // If we have both session and server info, attempt connection
    if (state.sessionId && state.event) {
      this._attemptConnection(guildId, state);
    }
  }

  /**
   * Attempt to establish voice connection with Lavalink
   * @param {string} guildId - Guild ID
   * @param {Object} state - Voice state
   * @private
   */
  _attemptConnection(guildId, state) {
    const player = this.client.players.get(guildId);
    if (!player) {
      return;
    }

    const { sessionId, event } = state;
    if (!sessionId || !event) {
      return;
    }

    // In Lavalink v4, we don't send voiceUpdate via WebSocket anymore
    // Instead, we send it via REST API when creating/updating the player
    // Just emit the event so the player knows the voice state is ready
    this.emit('voiceConnectionAttempt', { guildId, player });
  }

  /**
   * Get voice state for a guild
   * @param {string} guildId - Guild ID
   * @returns {Object|null} Voice state
   */
  get(guildId) {
    return this.states.get(guildId) || null;
  }

  /**
   * Set voice state for a guild
   * @param {string} guildId - Guild ID
   * @param {Object} state - Voice state
   */
  set(guildId, state) {
    this.states.set(guildId, state);
  }

  /**
   * Delete voice state for a guild
   * @param {string} guildId - Guild ID
   * @returns {boolean} Whether state was deleted
   */
  delete(guildId) {
    return this.states.delete(guildId);
  }

  /**
   * Clear all voice states
   */
  clear() {
    this.states.clear();
  }
}

export { VoiceStateManager };
