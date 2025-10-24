/**
 * Suwaku Player - Manages music playback for a guild
 * @module structures/SuwakuPlayer
 */

import { EventEmitter } from 'events';
import { SuwakuQueue } from './SuwakuQueue.js';
import { FilterManager } from '../managers/FilterManager.js';
import { PlayerState, TrackEndReason } from '../utils/constants.js';
import { validateNonEmptyString, validateNumber, validateRange } from '../utils/validators.js';

/**
 * Represents a music player for a guild
 * @extends EventEmitter
 */
class SuwakuPlayer extends EventEmitter {
  /**
   * @param {SuwakuClient} client - The Suwaku client instance
   * @param {Object} options - Player options
   * @param {string} options.guildId - Guild ID
   * @param {string} options.voiceChannelId - Voice channel ID
   * @param {string} [options.textChannelId] - Text channel ID
   * @param {LavalinkNode} [options.node] - Lavalink node to use
   */
  constructor(client, options) {
    super();

    validateNonEmptyString(options.guildId, 'Guild ID');
    validateNonEmptyString(options.voiceChannelId, 'Voice channel ID');

    this.client = client;

    /**
     * Guild ID
     * @type {string}
     */
    this.guildId = options.guildId;

    /**
     * Voice channel ID
     * @type {string}
     */
    this.voiceChannelId = options.voiceChannelId;

    /**
     * Text channel ID
     * @type {string|null}
     */
    this.textChannelId = options.textChannelId || null;

    /**
     * Lavalink node
     * @type {LavalinkNode}
     */
    this.node = options.node || this.client.nodes.getNodeForPlayer();

    /**
     * Queue instance
     * @type {SuwakuQueue}
     */
    this.queue = new SuwakuQueue(this);

    /**
     * Filter manager
     * @type {FilterManager}
     */
    this.filters = new FilterManager(this);

    /**
     * Whether track is currently playing
     * @type {boolean}
     */
    this.playing = false;

    /**
     * Player state
     * @type {string}
     */
    this.state = PlayerState.IDLE;

    /**
     * Whether player is connected to voice
     * @type {boolean}
     */
    this.connected = false;

    /**
     * Whether playback is paused
     * @type {boolean}
     */
    this.paused = false;

    /**
     * Current volume (0-1000)
     * @type {number}
     */
    this.volume = this.client.options.defaultVolume || 80;

    /**
     * Current position in milliseconds
     * @type {number}
     */
    this.position = 0;

    /**
     * Last position update timestamp
     * @type {number}
     */
    this.lastPositionUpdate = Date.now();

    /**
     * Idle timeout
     * @type {NodeJS.Timeout|null}
     */
    this.idleTimeout = null;

    /**
     * Player creation timestamp
     * @type {number}
     */
    this.createdAt = Date.now();

    // Set up node event listeners
    this._setupNodeListeners();
  }

  /**
   * Get current track
   * @returns {SuwakuTrack|null} Current track
   */
  get current() {
    return this.queue.current;
  }

  /**
   * Get loop mode
   * @returns {string} Loop mode
   */
  get loop() {
    return this.queue.loop;
  }

  /**
   * Set up node event listeners
   * @private
   */
  _setupNodeListeners() {
    this.node.on('message', this._handleNodeMessage.bind(this));
  }

  /**
   * Handle messages from Lavalink node
   * @param {Object} message - Message from node
   * @private
   */
  _handleNodeMessage(message) {
    if (message.guildId !== this.guildId) return;

    switch (message.op) {
      case 'playerUpdate':
        this._handlePlayerUpdate(message);
        break;
      case 'event':
        this._handleEvent(message);
        break;
    }
  }

  /**
   * Handle player update from Lavalink
   * @param {Object} data - Update data
   * @private
   */
  _handlePlayerUpdate(data) {
    if (data.state) {
      this.position = data.state.position || 0;
      this.lastPositionUpdate = Date.now();
      this.connected = data.state.connected || false;
    }
  }

  /**
   * Handle event from Lavalink
   * @param {Object} event - Event data
   * @private
   */
  _handleEvent(event) {
    try {
      switch (event.type) {
        case 'TrackStartEvent':
          this._handleTrackStart(event);
          break;
        case 'TrackEndEvent':
          this._handleTrackEnd(event);
          break;
        case 'TrackExceptionEvent':
          this._handleTrackException(event);
          break;
        case 'TrackStuckEvent':
          this._handleTrackStuck(event);
          break;
        case 'WebSocketClosedEvent':
          this._handleWebSocketClosed(event);
          break;
      }
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Unknown event handling error';
      this.client.emit('debug', `Error handling event ${event.type}: ${errorMessage}`);
      this.emit('error', error || new Error('Unknown error in event handler'));
    }
  }

  /**
   * Handle track start event
   * @param {Object} event - Event data
   * @private
   */
  _handleTrackStart(event) {
    this.state = PlayerState.PLAYING;
    this.playing = true;
    this.paused = false;
    this._clearIdleTimeout();

    // If current is null, we can't do much - just log a warning
    if (!this.current) {
      this.client.emit('debug', 'Track started but no current track in queue');
      this.state = PlayerState.IDLE;
      return;
    }

    this.client.emit('debug', `Track started: ${this.current.title} in guild ${this.guildId}`);

    // Emit on player - PlayerManager will forward to client
    this.emit('trackStart', this.current);
  }

  /**
   * Handle track end event
   * @param {Object} event - Event data
   * @private
   */
  _handleTrackEnd(event) {
    const track = this.current;
    const reason = event.reason;

    this.state = PlayerState.ENDED;
    this.playing = false;

    this.client.emit('debug', `Track ended: ${track?.title || 'Unknown'} - Reason: ${reason}`);

    if (track) {
      this.emit('trackEnd', track, reason);
    }

    // Auto-play next track if reason is finished
    if (reason === TrackEndReason.FINISHED || reason === TrackEndReason.LOAD_FAILED) {
      this._playNext();
    } else {
      this.state = PlayerState.IDLE;
    }
  }

  /**
   * Handle track exception event
   * @param {Object} event - Event data
   * @private
   */
  _handleTrackException(event) {
    const error = new Error(event.exception?.message || 'Track exception');
    error.severity = event.exception?.severity;
    error.cause = event.exception?.cause;

    this.state = PlayerState.ERRORED;
    this.playing = false;

    this.client.emit('debug', `Track exception: ${error.message} - Severity: ${error.severity}`);

    if (this.current) {
      this.emit('trackError', this.current, error);
    } else {
      this.emit('error', error);
    }

    // Try to play next track
    this._playNext();
  }

  /**
   * Handle track stuck event
   * @param {Object} event - Event data
   * @private
   */
  async _handleTrackStuck(event) {
    this.state = PlayerState.STUCK;
    this.playing = false;

    this.client.emit('debug', `Track stuck: ${this.current?.title || 'Unknown'} - Threshold: ${event.thresholdMs}ms`);

    if (this.current) {
      this.emit('trackStuck', this.current, event.thresholdMs);
    }

    // Check if retry is enabled
    const retryEnabled = this.client.options.retryOnStuck ?? true;

    // Try to resume the track first (retry mechanism)
    if (retryEnabled && this.current && this.position > 0) {
      this.client.emit('debug', `Attempting to resume stuck track at position ${this.position}ms`);
      
      try {
        // Try to seek to current position to resume
        await this.seek(this.position);
        this.client.emit('debug', 'Successfully resumed stuck track');
        
        // Update state back to playing
        this.state = PlayerState.PLAYING;
        this.playing = true;
        return;
      } catch (error) {
        this.client.emit('debug', `Failed to resume stuck track: ${error.message}`);
      }
    }

    // If resume failed, disabled, or not possible, play next track
    this.client.emit('debug', 'Skipping stuck track and playing next');
    this._playNext();
  }

  /**
   * Handle WebSocket closed event
   * @param {Object} event - Event data
   * @private
   */
  _handleWebSocketClosed(event) {
    this.connected = false;
    this.emit('voiceWebSocketClosed', event.code, event.reason);
  }

  /**
   * Play next track in queue
   * @private
   */
  async _playNext() {
    const next = this.queue.shift();

    if (!next) {
      this.state = PlayerState.IDLE;
      this.emit('queueEnd', this);
      this._startIdleTimeout();
      return;
    }

    await this.play(next);
  }

  /**
   * Connect to voice channel
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      this.client.emit('debug', `Player already connected in guild ${this.guildId}`);
      return;
    }

    this.state = PlayerState.CONNECTING;
    this.client.emit('debug', `Connecting player in guild ${this.guildId} to channel ${this.voiceChannelId}`);

    // Send raw voice state update to Discord
    // This is the correct way for music bots with Lavalink
    this.client.discordClient.ws.shards.first()?.send({
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: this.voiceChannelId,
        self_mute: false,
        self_deaf: false
      }
    });

    this.emit('connecting', this);
  }

  /**
   * Disconnect from voice channel
   */
  disconnect() {
    if (!this.connected) {
      this.client.emit('debug', `Player already disconnected in guild ${this.guildId}`);
      return;
    }

    this.client.emit('debug', `Disconnecting player in guild ${this.guildId}`);

    // Send voice state update to Discord (null channel = disconnect)
    this.client.discordClient.guilds.cache.get(this.guildId)?.members?.me?.voice?.disconnect();

    this.connected = false;
    this.state = PlayerState.IDLE;
    this.emit('disconnect', this);
  }

  /**
   * Play a track
   * @param {SuwakuTrack} [track] - Track to play (uses queue if not provided)
   * @param {Object} [options] - Play options
   * @param {number} [options.startTime] - Start time in milliseconds
   * @param {number} [options.endTime] - End time in milliseconds
   * @param {boolean} [options.noReplace=false] - Don't replace current track
   * @returns {Promise<boolean>} Whether play was successful
   */
  async play(track, options = {}) {
    if (!track) {
      track = this.queue.shift();
    }

    if (!track) {
      this.client.emit('debug', 'No track to play');
      return false;
    }

    // Check player health
    const health = this.healthCheck();
    if (!health.healthy && this.state !== PlayerState.IDLE) {
      this.client.emit('debug', `Player health check failed: ${health.issues.join(', ')}`);
    }

    this.client.emit('debug', `Playing track: ${track.title} in guild ${this.guildId}`);

    // Ensure we're connected
    if (!this.connected) {
      await this.connect();

      // Wait for voice connection to establish
      // We need to wait for the voiceUpdate to be processed by Lavalink
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Get voice state info
    const voiceState = this.client.voiceStates.get(this.guildId);

    if (!voiceState || !voiceState.sessionId || !voiceState.event) {
      this.client.emit('debug', 'Voice state not ready');
      this.state = PlayerState.ERRORED;
      return false;
    }

    try {
      // Build the complete update data with voice info AND track
      // This creates the player in Lavalink if it doesn't exist
      const updateData = {
        voice: {
          token: voiceState.event.token,
          endpoint: voiceState.event.endpoint,
          sessionId: voiceState.sessionId
        },
        track: {
          encoded: track.encoded
        },
        position: options.startTime || 0,
        volume: this.volume
      };

      if (options.endTime) {
        updateData.endTime = options.endTime;
      }

      await this.node.rest.updatePlayer(this.guildId, updateData, options.noReplace);

      this.queue.current = track;
      this.state = PlayerState.CONNECTED;
      this.playing = true;
      this.paused = false;
      this.position = options.startTime || 0;
      this.lastPositionUpdate = Date.now();
      this.connected = true; // Mark as connected after successful play

      this.client.emit('debug', `Successfully started playing: ${track.title}`);

      return true;
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Unknown play error';
      this.client.emit('debug', `Error playing track: ${errorMessage}`);
      this.state = PlayerState.ERRORED;
      this.emit('error', error || new Error('Unknown error while playing track'));
      return false;
    }
  }

  /**
   * Pause playback
   * @returns {Promise<boolean>} Whether pause was successful
   */
  async pause() {
    if (this.paused || !this.playing) return false;

    try {
      await this.node.rest.updatePlayer(this.guildId, { paused: true });
      this.paused = true;
      this.emit('pause', this);
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Resume playback
   * @returns {Promise<boolean>} Whether resume was successful
   */
  async resume() {
    if (!this.paused) return false;

    try {
      await this.node.rest.updatePlayer(this.guildId, { paused: false });
      this.paused = false;
      this.emit('resume', this);
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop playback
   * @returns {Promise<boolean>} Whether stop was successful
   */
  async stop() {
    try {
      await this.node.rest.updatePlayer(this.guildId, { track: { encoded: null } });
      this.state = PlayerState.IDLE;
      this.queue.current = null;
      this.position = 0;
      this.emit('stop', this);
      this._startIdleTimeout();
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Skip to next track
   * @param {number} [amount=1] - Number of tracks to skip
   * @returns {Promise<boolean>} Whether skip was successful
   */
  async skip(amount = 1) {
    validateNumber(amount, 'Skip amount');
    validateRange(amount, 'Skip amount', 1, this.queue.size + 1);

    // Skip multiple tracks if needed
    for (let i = 1; i < amount; i++) {
      this.queue.shift();
    }

    // Stop current track and play next
    await this.stop();
    await this._playNext();

    return true;
  }

  /**
   * Seek to position
   * @param {number} position - Position in milliseconds
   * @returns {Promise<boolean>} Whether seek was successful
   */
  async seek(position) {
    validateNumber(position, 'Position');

    if (!this.current || !this.current.isSeekable) {
      return false;
    }

    validateRange(position, 'Position', 0, this.current.duration);

    try {
      await this.node.rest.updatePlayer(this.guildId, { position });
      this.position = position;
      this.lastPositionUpdate = Date.now();
      this.emit('seek', position);
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Set volume
   * @param {number} volume - Volume (0-1000)
   * @returns {Promise<boolean>} Whether volume change was successful
   */
  async setVolume(volume) {
    validateNumber(volume, 'Volume');
    validateRange(volume, 'Volume', 0, 1000);

    try {
      await this.node.rest.updatePlayer(this.guildId, { volume });
      this.volume = volume;
      this.emit('volumeChange', volume);
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Set loop mode
   * @param {string} mode - Loop mode ('off', 'track', 'queue')
   */
  setLoop(mode) {
    this.queue.setLoop(mode);
    this.emit('loopChange', mode);
  }

  /**
   * Replay current track
   * @returns {Promise<boolean>} Whether replay was successful
   */
  async replay() {
    if (!this.current) return false;
    return await this.seek(0);
  }

  /**
   * Seek forward by specified amount
   * @param {number} amount - Amount in milliseconds
   * @returns {Promise<boolean>} Whether seek was successful
   */
  async seekForward(amount = 10000) {
    validateNumber(amount, 'Seek amount');
    const newPosition = Math.min(this.position + amount, this.current?.duration || 0);
    return await this.seek(newPosition);
  }

  /**
   * Seek backward by specified amount
   * @param {number} amount - Amount in milliseconds
   * @returns {Promise<boolean>} Whether seek was successful
   */
  async seekBackward(amount = 10000) {
    validateNumber(amount, 'Seek amount');
    const newPosition = Math.max(this.position - amount, 0);
    return await this.seek(newPosition);
  }

  /**
   * Go back to previous track
   * @returns {Promise<boolean>} Whether back was successful
   */
  async back() {
    const previous = this.queue.back();
    if (!previous) return false;
    return await this.play(previous);
  }

  /**
   * Shuffle the queue
   * @returns {Array<SuwakuTrack>} Shuffled queue
   */
  shuffleQueue() {
    const shuffled = this.queue.shuffle();
    this.emit('queueShuffle', this);
    return shuffled;
  }

  /**
   * Remove duplicate tracks from queue
   * @returns {number} Number of duplicates removed
   */
  removeDuplicates() {
    const seen = new Set();
    const original = this.queue.size;

    this.queue.tracks = this.queue.tracks.filter(track => {
      const key = `${track.title}-${track.author}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const removed = original - this.queue.size;
    if (removed > 0) {
      this.emit('queueUpdate', this);
    }

    return removed;
  }

  /**
   * Get queue history
   * @param {number} [limit] - Maximum number of tracks to return
   * @returns {Array<SuwakuTrack>} Previous tracks
   */
  getHistory(limit) {
    if (limit) {
      return this.queue.previous.slice(-limit);
    }
    return [...this.queue.previous];
  }

  /**
   * Clear queue history
   */
  clearHistory() {
    this.queue.previous = [];
    this.emit('historyCleared', this);
  }

  /**
   * Get current playback position with real-time calculation
   * @returns {number} Current position in milliseconds
   */
  getCurrentPosition() {
    if (!this.playing || this.paused) {
      return this.position;
    }

    const timeSinceUpdate = Date.now() - this.lastPositionUpdate;
    return Math.min(this.position + timeSinceUpdate, this.current?.duration || 0);
  }

  /**
   * Get remaining time for current track
   * @returns {number} Remaining time in milliseconds
   */
  getRemainingTime() {
    if (!this.current) return 0;
    return Math.max(this.current.duration - this.getCurrentPosition(), 0);
  }

  /**
   * Get total queue duration
   * @returns {number} Total duration in milliseconds
   */
  getTotalQueueDuration() {
    let total = this.getRemainingTime();
    total += this.queue.duration;
    return total;
  }

  /**
   * Get player statistics
   * @returns {Object} Player statistics
   */
  getStats() {
    return {
      guildId: this.guildId,
      state: this.state,
      playing: this.playing,
      paused: this.paused,
      connected: this.connected,
      volume: this.volume,
      position: this.getCurrentPosition(),
      remainingTime: this.getRemainingTime(),
      queueSize: this.queue.size,
      queueDuration: this.queue.duration,
      totalDuration: this.getTotalQueueDuration(),
      historySize: this.queue.previous.length,
      loop: this.loop,
      hasFilters: Object.keys(this.filters.filters).length > 0,
      activeFilters: Object.keys(this.filters.filters),
      uptime: Date.now() - this.createdAt
    };
  }

  /**
   * Set autoplay mode
   * @param {boolean} enabled - Whether to enable autoplay
   */
  setAutoplay(enabled) {
    this.autoplay = !!enabled;
    this.emit('autoplayChange', this.autoplay);
  }

  /**
   * Jump to a specific track in the queue
   * @param {number} position - Track position (0-based)
   * @returns {Promise<boolean>} Whether jump was successful
   */
  async jumpTo(position) {
    validateNumber(position, 'Position');
    validateRange(position, 'Position', 0, this.queue.size - 1);

    // Remove all tracks before the target position
    for (let i = 0; i < position; i++) {
      this.queue.shift();
    }

    // Play the target track
    return await this.skip();
  }

  /**
   * Move a track in the queue
   * @param {number} from - Current position
   * @param {number} to - Target position
   * @returns {Array<SuwakuTrack>} Updated queue
   */
  moveTrack(from, to) {
    const result = this.queue.move(from, to);
    this.emit('queueUpdate', this);
    return result;
  }

  /**
   * Remove a track from the queue
   * @param {number} position - Track position (0-based)
   * @returns {SuwakuTrack} Removed track
   */
  removeTrack(position) {
    const removed = this.queue.remove(position);
    this.emit('trackRemove', removed, position);
    return removed;
  }

  /**
   * Clear the queue
   * @returns {Array<SuwakuTrack>} Cleared tracks
   */
  clearQueue() {
    const cleared = this.queue.clear();
    this.emit('queueClear', this);
    return cleared;
  }

  /**
   * Add track to queue
   * @param {SuwakuTrack} track - Track to add
   * @returns {number} New queue size
   */
  addTrack(track) {
    const size = this.queue.add(track);
    this.emit('trackAdd', track);
    return size;
  }

  /**
   * Add multiple tracks to queue
   * @param {Array<SuwakuTrack>} tracks - Tracks to add
   * @param {Object} [playlistInfo] - Optional playlist information
   * @returns {number} New queue size
   */
  addTracks(tracks, playlistInfo = null) {
    if (!tracks || tracks.length === 0) {
      return this.queue.size;
    }

    const startTime = Date.now();
    const size = this.queue.addMultiple(tracks);
    const addTime = Date.now() - startTime;

    this.client.emit('debug', `Added ${tracks.length} tracks to queue in ${addTime}ms`);

    // If playlist info is provided, emit trackAddPlaylist event
    if (playlistInfo) {
      this.emit('trackAddPlaylist', {
        name: playlistInfo.name || 'Unknown Playlist',
        tracks: tracks,
        trackCount: tracks.length,
        requester: tracks[0]?.requester || null,
        playlistInfo: playlistInfo
      });
    } else {
      // Otherwise emit tracksAdd event for bulk add
      this.emit('tracksAdd', tracks);
    }

    return size;
  }

  /**
   * Add tracks in batches (optimized for large playlists)
   * @param {Array<SuwakuTrack>} tracks - Tracks to add
   * @param {Object} [options] - Options
   * @param {number} [options.batchSize=100] - Batch size
   * @param {Object} [options.playlistInfo] - Playlist information
   * @returns {Promise<number>} New queue size
   */
  async addTracksBatch(tracks, options = {}) {
    if (!tracks || tracks.length === 0) {
      return this.queue.size;
    }

    const batchSize = options.batchSize || 100;
    const playlistInfo = options.playlistInfo || null;
    const totalTracks = tracks.length;

    this.client.emit('debug', `Adding ${totalTracks} tracks in batches of ${batchSize}...`);

    const startTime = Date.now();
    let addedCount = 0;

    // Process in batches
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      this.queue.addMultiple(batch);
      addedCount += batch.length;

      // Emit progress for large playlists
      if (totalTracks > 100 && i + batchSize < tracks.length) {
        this.emit('playlistProgress', {
          added: addedCount,
          total: totalTracks,
          percentage: Math.round((addedCount / totalTracks) * 100)
        });
      }

      // Allow event loop to process other tasks
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const totalTime = Date.now() - startTime;
    this.client.emit('debug', `Added ${totalTracks} tracks in ${totalTime}ms (${Math.round(totalTracks / (totalTime / 1000))} tracks/sec)`);

    // Emit final event
    if (playlistInfo) {
      this.emit('trackAddPlaylist', {
        name: playlistInfo.name || 'Unknown Playlist',
        tracks: tracks,
        trackCount: tracks.length,
        requester: tracks[0]?.requester || null,
        playlistInfo: playlistInfo
      });
    } else {
      this.emit('tracksAdd', tracks);
    }

    return this.queue.size;
  }

  /**
   * Set voice channel
   * @param {string} channelId - Voice channel ID
   */
  setVoiceChannel(channelId) {
    validateNonEmptyString(channelId, 'Channel ID');
    this.voiceChannelId = channelId;
  }

  /**
   * Set text channel
   * @param {string} channelId - Text channel ID
   */
  setTextChannel(channelId) {
    validateNonEmptyString(channelId, 'Channel ID');
    this.textChannelId = channelId;
  }

  /**
   * Start idle timeout
   * @private
   */
  _startIdleTimeout() {
    this._clearIdleTimeout();

    const timeout = this.client.options.idleTimeout;
    if (!timeout || timeout <= 0) return;

    this.idleTimeout = setTimeout(() => {
      if (this.state === PlayerState.IDLE && this.queue.isEmpty) {
        this.destroy();
      }
    }, timeout);
  }

  /**
   * Clear idle timeout
   * @private
   */
  _clearIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  /**
   * Check if player is healthy and ready to play
   * @returns {Object} Health check result
   */
  healthCheck() {
    const issues = [];

    if (!this.connected) {
      issues.push('Player not connected to voice channel');
    }

    if (!this.node || !this.node.connected) {
      issues.push('Lavalink node not connected');
    }

    if (this.state === PlayerState.DESTROYED) {
      issues.push('Player is destroyed');
    }

    if (this.state === PlayerState.ERRORED) {
      issues.push('Player is in error state');
    }

    return {
      healthy: issues.length === 0,
      issues,
      state: this.state,
      connected: this.connected,
      nodeConnected: this.node?.connected || false
    };
  }

  /**
   * Destroy the player
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.state === PlayerState.DESTROYED) {
      this.client.emit('debug', `Player already destroyed in guild ${this.guildId}`);
      return;
    }

    this.client.emit('debug', `Destroying player in guild ${this.guildId}`);

    this._clearIdleTimeout();

    try {
      await this.node.rest.destroyPlayer(this.guildId);
    } catch (error) {
      this.client.emit('debug', `Error destroying player: ${error.message}`);
      // Ignore errors during destruction
    }

    this.disconnect();
    this.queue.clear();
    this.playing = false;
    this.paused = false;
    this.state = PlayerState.DESTROYED;

    this.emit('destroy', this);
    this.removeAllListeners();

    // Remove from client's player map
    this.client.players.delete(this.guildId);
  }

  /**
   * Get player information
   * @returns {Object} Player information
   */
  getInfo() {
    return {
      guildId: this.guildId,
      voiceChannelId: this.voiceChannelId,
      textChannelId: this.textChannelId,
      state: this.state,
      connected: this.connected,
      playing: this.playing,
      paused: this.paused,
      volume: this.volume,
      position: this.position,
      loop: this.loop,
      current: this.current?.toJSON() || null,
      queue: this.queue.toJSON(),
      node: this.node.identifier,
      createdAt: this.createdAt
    };
  }
}

export { SuwakuPlayer };
