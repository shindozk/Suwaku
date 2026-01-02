/**
 * Suwaku Player - Manages music playback for a guild
 * @module structures/SuwakuPlayer
 */

import { EventEmitter } from "events";
import Structure from "./Structure.js";
import { FilterManager } from "../managers/FilterManager.js";
import { PlayerState, TrackEndReason, DefaultPlayerOptions } from "../utils/constants.js";
import {
  validateNonEmptyString,
  validateNumber,
  validateRange,
} from "../utils/validators.js";

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
   * @param {string[]} [options.autoplayPlatform] - Platforms for autoplay
   * @param {boolean} [options.autoResume] - Whether to auto-resume playback
   * @param {number} [options.maxReconnects] - Maximum reconnect attempts
   * @param {number} [options.reconnectInterval] - Reconnect interval in ms
   */
  constructor(client, options) {
    super();

    validateNonEmptyString(options.guildId, "Guild ID");
    validateNonEmptyString(options.voiceChannelId, "Voice channel ID");

    this.client = client;

    /**
     * Player options merged with defaults
     * @type {Object}
     */
    this.options = {
      sponsorBlockCategories: [],
      ...DefaultPlayerOptions,
      ...options
    };

    /**
     * Guild ID
     * @type {string}
     */
    this.guildId = this.options.guildId;

    /**
     * Voice channel ID
     * @type {string}
     */
    this.voiceChannelId = this.options.voiceChannelId;

    /**
     * Text channel ID
     * @type {string|null}
     */
    this.textChannelId = this.options.textChannelId || null;

    /**
     * Lavalink node
     * @type {LavalinkNode}
     */
    this.node = this.options.node || this.client.nodes.getNodeForPlayer();

    /**
     * Queue instance
     * @type {SuwakuQueue}
     */
    const QueueClass = Structure.get('Queue');
    this.queue = new QueueClass(this);

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
     * @private
     */
    this._idleTimeout = null;

    // Set up node event listeners
    this._setupNodeListeners();

    // Start health monitoring if enabled
    if (this.client.options.enableHealthMonitor !== false) {
      this._startHealthMonitoring();
    }

    /**
     * Timestamp when player was created
     * @type {number}
     */
    this.createdAt = Date.now();
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
   * Toggle dynamic rhythm mode (Suwaku Exclusive Innovation)
   * This effect changes filters dynamically based on the track's playback state
   * @param {boolean} [enable] - Whether to enable
   * @returns {boolean} New state
   */
  toggleDynamicRhythm(enable) {
    const newState = enable ?? !this._dynamicRhythmInterval;

    if (newState && !this._dynamicRhythmInterval) {
      this.client.emit('debug', `Enabling Dynamic Rhythm for guild ${this.guildId}`);

      let step = 0;
      this._dynamicRhythmInterval = setInterval(async () => {
        if (!this.playing || this.paused) return;

        step = (step + 1) % 4;

        // Dynamic Bass Pulse
        const pulseGains = [
          { band: 0, gain: 0.6 },
          { band: 1, gain: 0.3 },
          { band: 0, gain: 0.1 },
          { band: 1, gain: 0.3 }
        ];

        try {
          await this.filters.setEqualizer([pulseGains[step]]);
        } catch (e) {
          this.client.emit('debug', `Dynamic Rhythm error: ${e.message}`);
        }
      }, 500); // Pulse every 500ms
    } else if (!newState && this._dynamicRhythmInterval) {
      this.client.emit('debug', `Disabling Dynamic Rhythm for guild ${this.guildId}`);
      clearInterval(this._dynamicRhythmInterval);
      this._dynamicRhythmInterval = null;
      this.filters.removeFilter('equalizer');
    }

    return !!this._dynamicRhythmInterval;
  }

  /**
   * Set up node event listeners
   * @private
   */
  _setupNodeListeners() {
    this._nodeMessageListener = this._handleNodeMessage.bind(this);
    this.node.on("message", this._nodeMessageListener);

    this.node.on("ready", async () => {
      this.client.emit("debug", `Node ${this.node.identifier} ready for player in guild ${this.guildId}`);
      if (this.options.sponsorBlockCategories?.length > 0) {
        await this.setSponsorBlock(this.options.sponsorBlockCategories);
      }
    });
  }

  /**
   * Handle voice state update
   * @private
   */
  handleVoiceStateUpdate() {
    this._checkIdleState();
  }

  /**
   * Handle messages from Lavalink node
   * @param {Object} message - Message from node
   * @private
   */
  _handleNodeMessage(message) {
    if (message.guildId !== this.guildId) return;

    switch (message.op) {
      case "playerUpdate":
        this._handlePlayerUpdate(message);
        break;
      case "event":
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
        case "TrackStartEvent":
          this._handleTrackStart(event);
          break;
        case "TrackEndEvent":
          this._handleTrackEnd(event);
          break;
        case "TrackExceptionEvent":
          this._handleTrackException(event);
          break;
        case "TrackStuckEvent":
          this._handleTrackStuck(event);
          break;
        case "WebSocketClosedEvent":
          this._handleWebSocketClosed(event);
          break;
      }
    } catch (error) {
      const errorMessage =
        error?.message || error?.toString() || "Unknown event handling error";
      this.client.emit(
        "debug",
        `Error handling event ${event.type}: ${errorMessage}`,
      );
      this.emit("error", error || new Error("Unknown error in event handler"));
    }
  }

  /**
   * Handle track start event
   * @param {Object} event - Event data
   * @private
   */
  async _handleTrackStart(event) {
    this.state = PlayerState.PLAYING;
    this.playing = true;
    this.paused = false;
    this.position = 0;
    this.lastPositionUpdate = Date.now();
    this._checkIdleState();

    // If current is null, we can't do much - just log a warning
    if (!this.current) {
      this.client.emit("debug", `[Player ${this.guildId}] Track started but no current track in queue. Queue state: ${this.queue.tracks.length} tracks, state: ${this.state}`);
      this.state = PlayerState.IDLE;
      return;
    }

    this.client.emit(
      "debug",
      `[Player ${this.guildId}] Track started: ${this.current.title}. TextChannel: ${this.textChannelId}`,
    );

    // Emit on player - PlayerManager will forward to client
    this.emit("trackStart", this.current);
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

    this.client.emit(
      "debug",
      `Track ended: ${track?.title || "Unknown"} - Reason: ${reason}`,
    );

    if (track) {
      this.emit("trackEnd", track, reason);
    }

    // Auto-play next track if reason is finished
    if (
      reason === TrackEndReason.FINISHED ||
      reason === TrackEndReason.LOAD_FAILED
    ) {
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
    const error = new Error(event.exception?.message || "Track exception");
    error.severity = event.exception?.severity;
    error.cause = event.exception?.cause;

    this.state = PlayerState.ERRORED;
    this.playing = false;

    this.client.emit(
      "debug",
      `Track exception: ${error.message} - Severity: ${error.severity}`,
    );

    if (this.current) {
      this.emit("trackError", this.current, error);
    } else {
      this.emit("error", error);
    }

    // Try to play next track
    this._playNext();
  }

  /**
   * Handle track stuck event with advanced retry system
   * @param {Object} event - Event data
   * @private
   */
  async _handleTrackStuck(event) {
    this.state = PlayerState.STUCK;
    this.playing = false;

    this.client.emit(
      "debug",
      `Track stuck: ${this.current?.title || "Unknown"} - Threshold: ${event.thresholdMs}ms`,
    );

    if (this.current) {
      this.emit("trackStuck", this.current, event.thresholdMs);
    }

    // Check if retry is enabled
    const retryEnabled = this.client.options.retryOnStuck ?? true;
    const maxRetries = this.client.options.maxStuckRetries ?? 3;

    // Initialize retry counter if not exists
    if (!this._stuckRetryCount) {
      this._stuckRetryCount = 0;
    }

    // Try to resume the track with multiple retry attempts
    if (retryEnabled && this.current && this._stuckRetryCount < maxRetries) {
      this._stuckRetryCount++;

      this.client.emit(
        "debug",
        `Attempting to recover stuck track (attempt ${this._stuckRetryCount}/${maxRetries})`,
      );

      try {
        // Strategy 1: Try to seek to current position
        if (this.position > 0) {
          await this.seek(this.position);
          this.client.emit(
            "debug",
            "Successfully resumed stuck track via seek",
          );

          // Update state back to playing
          this.state = PlayerState.PLAYING;
          this.playing = true;

          // Reset retry counter on success
          this._stuckRetryCount = 0;
          return;
        }

        // Strategy 2: Try to replay from start if position is 0
        await this.replay();
        this.client.emit(
          "debug",
          "Successfully resumed stuck track via replay",
        );

        this.state = PlayerState.PLAYING;
        this.playing = true;
        this._stuckRetryCount = 0;
        return;
      } catch (error) {
        this.client.emit(
          "debug",
          `Retry attempt ${this._stuckRetryCount} failed: ${error.message}`,
        );

        // If we haven't reached max retries, try again after a delay
        if (this._stuckRetryCount < maxRetries) {
          this.client.emit(
            "debug",
            `Waiting 2 seconds before next retry attempt...`,
          );

          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Try one more time
          return this._handleTrackStuck(event);
        }
      }
    }

    // If all retries failed or retry is disabled, play next track
    this.client.emit(
      "debug",
      "All recovery attempts failed, skipping to next track",
    );
    this._stuckRetryCount = 0; // Reset counter
    this._playNext();
  }

  /**
   * Handle WebSocket closed event
   * @param {Object} event - Event data
   * @private
   */
  _handleWebSocketClosed(event) {
    this.connected = false;
    this.emit("voiceWebSocketClosed", event.code, event.reason);
  }

  /**
   * Autoplay related tracks (AQUAlink Feature)
   * @param {SuwakuTrack} [track] - Base track for autoplay
   * @returns {Promise<boolean>} Whether autoplay was successful
   */
  async autoplay(track) {
    if (!this.options.autoplayPlatform || this.options.autoplayPlatform.length === 0) return false;

    const baseTrack = track || this.queue.previous || this.queue.current;
    if (!baseTrack) return false;

    this.client.emit("debug", `Autoplay: Searching for tracks related to "${baseTrack.title}"`);

    try {
      // Use the configured autoplay platforms in order
      for (const platform of this.options.autoplayPlatform) {
        // Search for related tracks using the platform and base track info
        const query = `${baseTrack.title} ${baseTrack.author}`;
        const results = await this.client.search(query, {
          source: platform,
          limit: 5
        });

        if (results && results.tracks && results.tracks.length > 0) {
          // Filter out current and previous tracks to avoid loops
          const nextTrack = results.tracks.find(t =>
            t.identifier !== baseTrack.identifier &&
            !this.queue.history.some(h => h.identifier === t.identifier)
          );

          if (nextTrack) {
            this.client.emit("debug", `Autoplay: Found match on ${platform}: "${nextTrack.title}"`);
            this.queue.add(nextTrack);
            return true;
          }
        }
      }
    } catch (error) {
      this.client.emit("debug", `Autoplay Error: ${error.message}`);
    }

    return false;
  }

  /**
   * Restart the current track (AQUAlink Feature)
   * Useful for recovering from errors or node migrations
   * @returns {Promise<boolean>} Whether restart was successful
   */
  async restart() {
    if (!this.queue.current) return false;

    this.client.emit("debug", `Restarting track: ${this.queue.current.title}`);

    // Save current position for accurate resume
    const resumePosition = this.position;

    return this.play(this.queue.current, {
      startTime: resumePosition,
      noReplace: false
    });
  }

  /**
   * Move the player to a new Lavalink node (AQUAlink Feature)
   * @param {LavalinkNode} node - The new node to move to
   * @returns {Promise<boolean>} Whether move was successful
   */
  async moveNode(node) {
    if (!node) throw new Error("No node provided for moveNode");
    if (node.identifier === this.node.identifier) return false;
    if (!node.connected) throw new Error(`Cannot move to node ${node.identifier} because it's not connected`);

    this.client.emit("debug", `Moving player from ${this.node.identifier} to ${node.identifier}`);

    // Mark as transitioning to prevent event collisions
    this._isMoving = true;

    // Pause/Stop current node if possible
    try {
      if (this.playing) {
        await this.node.rest.updatePlayer(this.guildId, { paused: true });
      }
    } catch (e) {
      this.client.emit("debug", `Warning: Failed to cleanup old node during migration: ${e.message}`);
    }

    // Update node reference
    this.node = node;

    // Resume on new node if it was playing
    let success = true;
    if (this.playing) {
      success = await this.restart();
    }

    this._isMoving = false;
    return success;
  }

  /**
   * Set SponsorBlock categories to skip (Lavalink SponsorBlock Plugin Feature)
   * @param {Array<string>} categories - Categories to skip (sponsor, intro, etc)
   * @returns {Promise<boolean>} Whether categories were set
   */
  async setSponsorBlock(categories = []) {
    if (!Array.isArray(categories)) throw new Error("Categories must be an array");

    this.client.emit("debug", `Setting SponsorBlock categories for guild ${this.guildId}: ${categories.join(", ")}`);

    try {
      // In Lavalink v4 with SponsorBlock plugin, this is done via a REST PUT to /v4/sessions/{sessionId}/players/{guildId}/sponsorblock/categories
      // Note: This requires the SponsorBlock Lavalink plugin to be installed.
      await this.node.rest.doRequest(`/sessions/${this.node.sessionId}/players/${this.guildId}/sponsorblock/categories`, {
        method: 'PUT',
        data: categories
      });

      this.options.sponsorBlockCategories = categories;
      return true;
    } catch (error) {
      this.client.emit("debug", `Failed to set SponsorBlock: ${error.message}`);
      // Fallback: If REST fails, it might be an older version or plugin is missing
      return false;
    }
  }

  /**
   * Disable SponsorBlock for this player
   * @returns {Promise<boolean>} Whether SponsorBlock was disabled
   */
  async disableSponsorBlock() {
    return this.setSponsorBlock([]);
  }

  /**
   * Play next track in queue
   * @private
   */
  async _playNext() {
    let next = this.queue.shift();

    if (!next) {
      // If queue is empty, try autoplay if enabled
      if (this.options.autoPlay) {
        const success = await this.autoplay();
        if (success) {
          next = this.queue.shift();
        }
      }

      if (!next) {
        this.state = PlayerState.IDLE;
        this.playing = false;
        this.emit("queueEnd", this);

        this._checkIdleState(); // Centralized idle check
        return;
      }
    }

    await this.play(next);
  }

  /**
   * Connect to voice channel
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      this.client.emit(
        "debug",
        `Player already connected in guild ${this.guildId}`,
      );
      return;
    }

    this.state = PlayerState.CONNECTING;
    this.client.emit(
      "debug",
      `Connecting player in guild ${this.guildId} to channel ${this.voiceChannelId}`,
    );

    // Send raw voice state update to Discord
    // This is the correct way for music bots with Lavalink
    this.client.discordClient.ws.shards.first()?.send({
      op: 4,
      d: {
        guild_id: this.guildId,
        channel_id: this.voiceChannelId,
        self_mute: false,
        self_deaf: false,
      },
    });

    this.emit("connecting", this);
  }

  /**
   * Disconnect from voice channel
   */
  disconnect() {
    this.client.emit("debug", `Disconnecting player in guild ${this.guildId}`);

    try {
      // Method 1: Try using Discord.js voice disconnect
      const guild = this.client.discordClient.guilds.cache.get(this.guildId);
      if (guild?.members?.me?.voice?.channel) {
        guild.members.me.voice.disconnect();
      }
    } catch (error) {
      this.client.emit(
        "debug",
        `Discord.js disconnect failed: ${error.message}`,
      );
    }

    try {
      // Method 2: Send raw voice state update (null channel = disconnect)
      this.client.discordClient.ws.shards.first()?.send({
        op: 4,
        d: {
          guild_id: this.guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: false,
        },
      });
    } catch (error) {
      this.client.emit("debug", `Raw disconnect failed: ${error.message}`);
    }

    this.connected = false;
    this.state = PlayerState.IDLE;
    this.playing = false;
    this.paused = false;
    this.emit("disconnect", this);
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
      this.client.emit("debug", "No track to play");
      return false;
    }

    // Check player health
    const health = this.healthCheck();
    if (!health.healthy && this.state !== PlayerState.IDLE) {
      this.client.emit(
        "debug",
        `Player health check failed: ${health.issues.join(", ")}`,
      );
    }

    this.client.emit(
      "debug",
      `Playing track: ${track.title} in guild ${this.guildId}`,
    );

    // Ensure we're connected
    if (!this.connected) {
      await this.connect();

      // Wait for voice connection to establish
      // We need to wait for the voiceUpdate to be processed by Lavalink
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Get voice state info
    const voiceState = this.client.voiceStates.get(this.guildId);

    if (!voiceState || !voiceState.sessionId || !voiceState.event) {
      this.client.emit("debug", "Voice state not ready");
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
          sessionId: voiceState.sessionId,
        },
        track: {
          encoded: track.encoded,
        },
        position: options.startTime || 0,
        volume: this.volume,
        filters: this.filters?.filters || {}
      };

      if (options.endTime) {
        updateData.endTime = options.endTime;
      }

      // Move current track to history if we're playing a new one provided directly
      if (track && this.queue.current && track.id !== this.queue.current.id) {
        this.queue.addToHistory(this.queue.current);
      }

      this.queue.current = track;

      await this.node.rest.updatePlayer(
        this.guildId,
        updateData,
        options.noReplace,
      );

      this.state = PlayerState.CONNECTED;
      this.playing = true;
      this.paused = false;
      this.position = options.startTime || 0;
      this.lastPositionUpdate = Date.now();
      this.connected = true; // Mark as connected after successful play

      this.client.emit("debug", `Successfully started playing: ${track.title}`);

      return true;
    } catch (error) {
      const errorMessage =
        error?.message || error?.toString() || "Unknown play error";
      this.client.emit("debug", `Error playing track: ${errorMessage}`);
      this.state = PlayerState.ERRORED;
      this.emit(
        "error",
        error || new Error("Unknown error while playing track"),
      );
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
      this.emit("pause", this);
      return true;
    } catch (error) {
      this.emit("error", error);
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
      this.emit("resume", this);
      return true;
    } catch (error) {
      this.emit("error", error);
      return false;
    }
  }

  /**
   * Stop playback
   * @returns {Promise<boolean>} Whether stop was successful
   */
  async stop() {
    try {
      await this.node.rest.updatePlayer(this.guildId, {
        track: { encoded: null },
      });
      this.state = PlayerState.IDLE;
      this.playing = false;

      // Add current track to history before clearing it
      if (this.current) {
        this.queue.addToHistory(this.current);
      }

      this.queue.current = null;
      this.position = 0;
      this.emit("stop", this);
      this._checkIdleState();
      return true;
    } catch (error) {
      this.emit("error", error);
      return false;
    }
  }

  /**
   * Skip to next track
   * @param {number} [amount=1] - Number of tracks to skip
   * @returns {Promise<boolean>} Whether skip was successful
   */
  async skip(amount = 1) {
    validateNumber(amount, "Skip amount");
    validateRange(amount, "Skip amount", 1, this.queue.size + 1);

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
    validateNumber(position, "Position");

    if (!this.current || !this.current.isSeekable) {
      return false;
    }

    validateRange(position, "Position", 0, this.current.duration);

    try {
      await this.node.rest.updatePlayer(this.guildId, { position });
      this.position = position;
      this.lastPositionUpdate = Date.now();
      this.emit("seek", position);
      return true;
    } catch (error) {
      this.emit("error", error);
      return false;
    }
  }

  /**
   * Set volume
   * @param {number} volume - Volume (0-1000)
   * @returns {Promise<boolean>} Whether volume change was successful
   */
  async setVolume(volume) {
    validateNumber(volume, "Volume");
    validateRange(volume, "Volume", 0, 1000);

    try {
      await this.node.rest.updatePlayer(this.guildId, { volume });
      this.volume = volume;
      this.emit("volumeChange", volume);
      return true;
    } catch (error) {
      this.emit("error", error);
      return false;
    }
  }

  /**
   * Set loop mode
   * @param {string} mode - Loop mode ('off', 'track', 'queue')
   */
  setLoop(mode) {
    this.queue.setLoop(mode);
    this.emit("loopChange", mode);
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
    validateNumber(amount, "Seek amount");
    const newPosition = Math.min(
      this.position + amount,
      this.current?.duration || 0,
    );
    return await this.seek(newPosition);
  }

  /**
   * Seek backward by specified amount
   * @param {number} amount - Amount in milliseconds
   * @returns {Promise<boolean>} Whether seek was successful
   */
  async seekBackward(amount = 10000) {
    validateNumber(amount, "Seek amount");
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
    this.emit("queueShuffle", this);
    return shuffled;
  }

  /**
   * Remove duplicate tracks from the queue
   * @returns {number} Number of duplicates removed
   */
  removeDuplicates() {
    const removedCount = this.queue.removeDuplicates();
    if (removedCount > 0) {
      this.emit("queueUpdate", this);
    }
    return removedCount;
  }

  /**
   * Remove tracks added by a specific user
   * @param {string} userId - The ID of the user
   * @returns {number} Number of tracks removed
   */
  removeByRequester(userId) {
    const removedCount = this.queue.removeByRequester(userId);
    if (removedCount > 0) {
      this.emit("queueUpdate", this);
    }
    return removedCount;
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
    this.emit("historyCleared", this);
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
    // Applying a small offset (200ms) to compensate for network latency and Lavalink update lag
    // This makes the lyrics sync feel more "on the beat"
    return Math.min(
      this.position + timeSinceUpdate + 200,
      this.current?.duration || 0,
    );
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
      uptime: Date.now() - this.createdAt,
    };
  }

  /**
   * Set autoplay mode
   * @param {boolean} enabled - Whether to enable autoplay
   */
  setAutoplay(enabled) {
    this.autoplay = !!enabled;
    this.emit("autoplayChange", this.autoplay);
  }

  /**
   * Jump to a specific track in the queue
   * @param {number} position - Track position (0-based)
   * @returns {Promise<boolean>} Whether jump was successful
   */
  async jumpTo(position) {
    validateNumber(position, "Position");
    validateRange(position, "Position", 0, this.queue.size - 1);

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
    this.emit("queueUpdate", this);
    return result;
  }

  /**
   * Remove a track from the queue
   * @param {number} position - Track position (0-based)
   * @returns {SuwakuTrack} Removed track
   */
  removeTrack(position) {
    const removed = this.queue.remove(position);
    this.emit("trackRemove", removed, position);
    return removed;
  }

  /**
   * Clear the queue
   * @returns {Array<SuwakuTrack>} Cleared tracks
   */
  clearQueue() {
    const cleared = this.queue.clear();
    this.emit("queueClear", this);
    return cleared;
  }

  /**
   * Add track to queue
   * @param {SuwakuTrack} track - Track to add
   * @returns {number} New queue size
   */
  addTrack(track) {
    const size = this.queue.add(track);
    this.emit("trackAdd", track);
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

    this.client.emit(
      "debug",
      `Added ${tracks.length} tracks to queue in ${addTime}ms`,
    );

    // If playlist info is provided, emit trackAddPlaylist event
    if (playlistInfo) {
      this.emit("trackAddPlaylist", {
        name: playlistInfo.name || "Unknown Playlist",
        tracks: tracks,
        trackCount: tracks.length,
        requester: tracks[0]?.requester || null,
        playlistInfo: playlistInfo,
      });
    } else {
      // Otherwise emit tracksAdd event for bulk add
      this.emit("tracksAdd", tracks);
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

    this.client.emit(
      "debug",
      `Adding ${totalTracks} tracks in batches of ${batchSize}...`,
    );

    const startTime = Date.now();
    let addedCount = 0;

    // Process in batches
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      this.queue.addMultiple(batch);
      addedCount += batch.length;

      // Emit progress for large playlists
      if (totalTracks > 100 && i + batchSize < tracks.length) {
        this.emit("playlistProgress", {
          added: addedCount,
          total: totalTracks,
          percentage: Math.round((addedCount / totalTracks) * 100),
        });
      }

      // Allow event loop to process other tasks
      if (i + batchSize < tracks.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    const totalTime = Date.now() - startTime;
    this.client.emit(
      "debug",
      `Added ${totalTracks} tracks in ${totalTime}ms (${Math.round(totalTracks / (totalTime / 1000))} tracks/sec)`,
    );

    // Emit final event
    if (playlistInfo) {
      this.emit("trackAddPlaylist", {
        name: playlistInfo.name || "Unknown Playlist",
        tracks: tracks,
        trackCount: tracks.length,
        requester: tracks[0]?.requester || null,
        playlistInfo: playlistInfo,
      });
    } else {
      this.emit("tracksAdd", tracks);
    }

    return this.queue.size;
  }

  /**
   * Set voice channel
   * @param {string} channelId - Voice channel ID
   */
  setVoiceChannel(channelId) {
    validateNonEmptyString(channelId, "Channel ID");
    this.voiceChannelId = channelId;
  }

  /**
   * Set text channel
   * @param {string} channelId - Text channel ID
   */
  setTextChannel(channelId) {
    validateNonEmptyString(channelId, "Channel ID");
    this.textChannelId = channelId;
  }

  /**
   * Handles voice state updates to trigger idle checks.
   * Called by SuwakuClient.
   */
  handleVoiceStateUpdate() {
    this._checkIdleState();
  }

  /**
   * Centralized method to check if the player should leave due to inactivity.
   * @private
   */
  _checkIdleState() {
    // Clear any existing timer
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      this._idleTimeout = null;
    }

    // If we are playing or paused, we are not idle
    if (this.playing || this.paused) {
      return;
    }

    const {
      leaveOnEnd,
      autoLeave,
      autoLeaveDelay,
      leaveOnEmpty,
      leaveOnEmptyDelay,
      idleTimeout,
    } = this.client.options;

    // --- Condition 1: `leaveOnEnd` is true and queue is empty ---
    if (leaveOnEnd && this.queue.isEmpty) {
      this.client.emit(
        "debug",
        `Queue ended, leaving immediately (leaveOnEnd) in guild ${this.guildId}`,
      );
      this.client.leave(this.guildId, true); // Don't await, let it run
      return;
    }

    const voiceChannel = this.client.discordClient.channels.cache.get(
      this.voiceChannelId,
    );
    const humanMembers =
      voiceChannel?.members?.filter((m) => !m.user.bot).size ?? 0;

    // --- Condition 2: `leaveOnEmpty` is true and channel is empty ---
    if (leaveOnEmpty && humanMembers === 0) {
      const delay = leaveOnEmptyDelay ?? 60000;
      this.client.emit(
        "debug",
        `Channel empty, starting ${delay}ms leave timer (leaveOnEmpty) in guild ${this.guildId}`,
      );
      this._idleTimeout = setTimeout(() => {
        // Re-check conditions before leaving
        const currentHumans =
          this.client.discordClient.channels.cache
            .get(this.voiceChannelId)
            ?.members?.filter((m) => !m.user.bot).size ?? 0;
        if (currentHumans === 0 && !this.playing) {
          this.client.emit(
            "debug",
            `Leaving empty channel for guild ${this.guildId}`,
          );
          this.client.leave(this.guildId, true);
        }
      }, delay);
      return;
    }

    // --- Condition 3: `autoLeave` is true and queue is empty ---
    if (autoLeave && this.queue.isEmpty) {
      const delay = autoLeaveDelay ?? 30000;
      this.client.emit(
        "debug",
        `Queue empty, starting ${delay}ms leave timer (autoLeave) in guild ${this.guildId}`,
      );
      this._idleTimeout = setTimeout(() => {
        // Re-check conditions before leaving
        if (this.queue.isEmpty && !this.playing) {
          this.client.emit(
            "debug",
            `Auto-leaving guild ${this.guildId} after queue end`,
          );
          this.client.leave(this.guildId, true);
        }
      }, delay);
      return;
    }

    // --- Condition 4: General idle timeout (from original implementation) ---
    if (idleTimeout && idleTimeout > 0 && this.queue.isEmpty) {
      this.client.emit(
        "debug",
        `Queue empty, starting ${idleTimeout}ms idle timer in guild ${this.guildId}`,
      );
      this._idleTimeout = setTimeout(() => {
        if (this.state === PlayerState.IDLE && this.queue.isEmpty) {
          this.client.emit(
            "debug",
            `Destroying player due to idle timeout for guild ${this.guildId}`,
          );
          this.destroy();
        }
      }, idleTimeout);
    }
  }

  /**
   * Start health monitoring
   * @private
   */
  _startHealthMonitoring() {
    const interval = this.client.options.healthCheckInterval || 15000; // 15 seconds default

    this._healthMonitor = setInterval(() => {
      this._performHealthCheck();
    }, interval);

    this.client.emit(
      "debug",
      `Health monitoring started for player ${this.guildId} (interval: ${interval}ms)`,
    );
  }

  /**
   * Stop health monitoring
   * @private
   */
  _stopHealthMonitoring() {
    if (this._healthMonitor) {
      clearInterval(this._healthMonitor);
      this._healthMonitor = null;
      this.client.emit(
        "debug",
        `Health monitoring stopped for player ${this.guildId}`,
      );
    }
  }

  /**
   * Perform health check and auto-correct issues
   * @private
   */
  async _performHealthCheck() {
    // Skip if not playing
    if (!this.playing || this.paused || !this.current) {
      return;
    }

    const now = Date.now();
    const currentPosition = this.getCurrentPosition();
    const timeSinceLastCheck = now - this._lastPositionCheck;

    // Check if position is progressing
    if (timeSinceLastCheck > 5000) {
      // Check every 5 seconds
      const positionDiff = currentPosition - this._lastKnownPosition;
      const expectedDiff = timeSinceLastCheck * 0.9; // Allow 10% tolerance

      // If position hasn't progressed as expected, audio might be stuck
      if (positionDiff < expectedDiff && this.playing && !this.paused) {
        this.client.emit(
          "debug",
          `Audio playback appears stuck (position: ${currentPosition}ms, expected progress: ${expectedDiff}ms, actual: ${positionDiff}ms)`,
        );

        // Try to auto-correct
        await this._autoCorrectPlayback();
      }

      // Update last known values
      this._lastPositionCheck = now;
      this._lastKnownPosition = currentPosition;
    }

    // Check node health fallback
    if (this.node && !this.node.connected && !this._isMoving) {
      this.client.emit("debug", `Node disconnected for player ${this.guildId}. Attempting local recovery...`);

      const newNode = this.client.nodes.getBest(this.node.identifier);
      if (newNode) {
        this.moveNode(newNode).catch(err => {
          this.client.emit("debug", `Local recovery failed: ${err.message}`);
        });
      }
    }
  }

  /**
   * Auto-correct playback issues
   * @private
   */
  async _autoCorrectPlayback() {
    if (!this.current) return;

    this.client.emit(
      "debug",
      `Auto-correcting playback for: ${this.current.title}`,
    );

    try {
      // Strategy 1: Try to seek to current position + 1 second
      const targetPosition = Math.min(
        this.position + 1000,
        this.current.duration,
      );
      await this.seek(targetPosition);

      this.client.emit("debug", "Playback auto-corrected via seek");

      // Emit warning event
      this.client.emit(
        "warn",
        `Auto-corrected playback for ${this.current.title} in guild ${this.guildId}`,
      );
    } catch (error) {
      this.client.emit("debug", `Auto-correction failed: ${error.message}`);

      // Strategy 2: Try to replay the track
      try {
        await this.play(this.current, { startTime: this.position });
        this.client.emit("debug", "Playback auto-corrected via replay");
      } catch (replayError) {
        this.client.emit(
          "debug",
          `Replay failed: ${replayError.message}, skipping to next track`,
        );
        await this.skip();
      }
    }
  }

  /**
   * Check if player is healthy and ready to play
   * @returns {Object} Health check result
   */
  healthCheck() {
    const issues = [];

    if (!this.connected) {
      issues.push("Player not connected to voice channel");
    }

    if (!this.node || !this.node.connected) {
      issues.push("Lavalink node not connected");
    }

    if (this.state === PlayerState.DESTROYED) {
      issues.push("Player is destroyed");
    }

    if (this.state === PlayerState.ERRORED) {
      issues.push("Player is in error state");
    }

    // Check if audio is progressing
    if (this.playing && !this.paused && this.current) {
      const now = Date.now();
      const timeSinceUpdate = now - this.lastPositionUpdate;

      if (timeSinceUpdate > 10000) {
        // No update in 10 seconds
        issues.push("Audio playback may be stuck (no position updates)");
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      state: this.state,
      connected: this.connected,
      nodeConnected: this.node?.connected || false,
      lastPositionUpdate: this.lastPositionUpdate,
      timeSinceUpdate: Date.now() - this.lastPositionUpdate,
    };
  }

  /**
   * Destroy the player
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.state === PlayerState.DESTROYED) {
      this.client.emit(
        "debug",
        `Player already destroyed in guild ${this.guildId}`,
      );
      return;
    }

    this.client.emit("debug", `Destroying player in guild ${this.guildId}`);

    this._stopHealthMonitoring();

    // Clear idle timeout
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      this._idleTimeout = null;
    }

    try {
      await this.node.rest.destroyPlayer(this.guildId);
    } catch (error) {
      this.client.emit("debug", `Error destroying player: ${error.message}`);
      // Ignore errors during destruction
    }

    this.disconnect();
    this.queue.clear();
    this.playing = false;
    this.paused = false;
    this.state = PlayerState.DESTROYED;

    this.emit("destroy", this);
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
      createdAt: this.createdAt,
    };
  }

  /**
   * Convert player to JSON for persistence
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      guildId: this.guildId,
      voiceChannelId: this.voiceChannelId,
      textChannelId: this.textChannelId,
      state: this.state,
      playing: this.playing,
      paused: this.paused,
      volume: this.volume,
      position: this.position,
      options: this.options,
      loop: this.queue.loop,
      current: this.current?.toJSON() || null,
      queue: this.queue.toJSON(),
      filters: this.filters.toJSON(),
      node: this.node?.identifier,
      createdAt: this.createdAt
    };
  }
}

export { SuwakuPlayer };
