/**
 * Suwaku Client - Main client class
 * @module client/SuwakuClient
 */

import { EventEmitter } from "events";
import { NodeManager } from "../lavalink/NodeManager.js";
import { PlayerManager } from "../managers/PlayerManager.js";
import { SearchManager } from "../managers/SearchManager.js";
import { StatsManager } from "../managers/StatsManager.js";
import { LyricsManager } from "../managers/LyricsManager.js";
import { VoiceStateManager } from "../lavalink/VoiceStateManager.js";
import { Defaults } from "../utils/constants.js";
import Structure from "../structures/Structure.js";
import { PersistenceManager } from "../persistence/PersistenceManager.js";
import { SuwakuTrack } from "../structures/SuwakuTrack.js";
import { SuwakuPlayer } from "../structures/SuwakuPlayer.js";
import { SuwakuQueue } from "../structures/SuwakuQueue.js";
import { LavalinkNode as Node } from "../lavalink/LavalinkNode.js";
import {
  validateObject,
  validateNonEmptyArray,
  validateNonEmptyString,
} from "../utils/validators.js";
import packageJson from "../../package.json" with { type: "json" };
const { version } = packageJson;

/**
 * Main Suwaku client
 * @extends EventEmitter
 */
class SuwakuClient extends EventEmitter {
  /**
   * @param {Client} discordClient - Discord.js client instance
   * @param {Object} options - Client options
   * @param {Array<Object>} options.nodes - Array of Lavalink node configurations
   * @param {number} [options.defaultVolume=80] - Default player volume (0-1000)
   * @param {string} [options.searchEngine='youtube'] - Default search engine
   * @param {boolean} [options.autoPlay=false] - Enable autoplay when queue ends
   * @param {boolean} [options.autoLeave=true] - Auto-leave when queue ends
   * @param {number} [options.autoLeaveDelay=300000] - Delay before auto-leave (ms)
   * @param {boolean} [options.leaveOnEmpty=false] - Leave when voice channel is empty
   * @param {number} [options.leaveOnEmptyDelay=60000] - Delay before leaving empty channel (ms)
   * @param {boolean} [options.leaveOnEnd=false] - Leave immediately when queue ends
   * @param {number} [options.idleTimeout=300000] - Idle timeout before destroying player (ms)
   * @param {number} [options.historySize=50] - Maximum history size per player
   * @param {boolean} [options.enableFilters=true] - Enable audio filters
   * @param {boolean} [options.enableLyrics=false] - Enable lyrics fetching
   * @param {number} [options.maxQueueSize=1000] - Maximum queue size
   * @param {number} [options.maxPlaylistSize=500] - Maximum playlist size
   * @param {boolean} [options.allowDuplicates=true] - Allow duplicate tracks in queue
   * @param {boolean} [options.sortByRegion=false] - Sort nodes by region
   * @param {boolean} [options.resumeOnReconnect=true] - Resume playback after reconnection
   * @param {number} [options.reconnectDelay=5000] - Delay between reconnection attempts (ms)
   * @param {number} [options.reconnectAttempts=5] - Maximum reconnection attempts
   * @param {boolean} [options.enableHealthCheck=true] - Enable player health checks
   * @param {number} [options.healthCheckInterval=30000] - Health check interval (ms)
   * @param {boolean} [options.loadBalancer=true] - Enable load balancer for distributing players
   * @param {string} [options.defaultYoutubeThumbnail='maxresdefault'] - Default YouTube thumbnail size
   * @param {boolean} [options.trackPlayerMoved=true] - Track when bot moves between voice channels
   * @param {boolean} [options.retryOnStuck=true] - Try to resume stuck tracks before skipping
   * @param {number} [options.stuckThreshold=10000] - Threshold for considering track stuck (ms)
   * @param {number} [options.maxStuckRetries=3] - Maximum number of retry attempts for stuck tracks
   * @param {boolean} [options.enableHealthMonitor=true] - Enable continuous health monitoring and auto-correction
   * @param {number} [options.healthMonitorInterval=15000] - Health monitor check interval (ms)
   * @param {Object} [options.spotify] - Spotify credentials for fallback resolution
   * @param {string} [options.spotify.clientId] - Spotify Client ID
   * @param {string} [options.spotify.clientSecret] - Spotify Client Secret
   */
  constructor(discordClient, options = {}) {
    super();

    validateObject(discordClient, "Discord client");
    validateObject(options, "Options");
    validateNonEmptyArray(options.nodes, "Nodes");

    /**
     * Discord.js client
     * @type {Client}
     */
    this.discordClient = discordClient;

    /**
     * Client options
     * @type {Object}
     */
    this.options = {
      // Playback
      defaultVolume: options.defaultVolume ?? Defaults.VOLUME,
      searchEngine: options.searchEngine ?? Defaults.SEARCH_SOURCE,
      playbackEngine: options.playbackEngine ?? Defaults.PLAYBACK_ENGINE,

      // Auto behaviors
      autoPlay: options.autoPlay ?? false,
      autoLeave: options.autoLeave ?? true,
      autoLeaveDelay: options.autoLeaveDelay ?? Defaults.AUTO_LEAVE_DELAY,
      leaveOnEmpty: options.leaveOnEmpty ?? false,
      leaveOnEmptyDelay: options.leaveOnEmptyDelay ?? 60000,
      leaveOnEnd: options.leaveOnEnd ?? false,

      // Timeouts
      idleTimeout: options.idleTimeout ?? Defaults.IDLE_TIMEOUT,

      // Queue
      historySize: options.historySize ?? Defaults.HISTORY_SIZE,
      maxQueueSize: options.maxQueueSize ?? 1000,
      maxPlaylistSize: options.maxPlaylistSize ?? 500,
      allowDuplicates: options.allowDuplicates ?? true,

      // Persistence
      persistencePrefix: options.persistencePrefix ?? "suwaku:player:",
      storageAdapter: options.storageAdapter ?? null,

      // Features
      enableFilters: options.enableFilters ?? true,
      enableLyrics: options.enableLyrics ?? false,

      // Search
      enableSourceFallback: options.enableSourceFallback ?? true,

      // Connection
      sortByRegion: options.sortByRegion ?? false,
      resumeOnReconnect: options.resumeOnReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? Defaults.RECONNECT_DELAY,
      reconnectAttempts:
        options.reconnectAttempts ?? Defaults.RECONNECT_ATTEMPTS,
      loadBalancer: options.loadBalancer ?? true,

      // Health
      enableHealthCheck: options.enableHealthCheck ?? true,

      // Media
      defaultYoutubeThumbnail:
        options.defaultYoutubeThumbnail ?? "maxresdefault",

      // Tracking
      trackPlayerMoved: options.trackPlayerMoved ?? true,
      healthCheckInterval: options.healthCheckInterval ?? 30000,

      // Stuck track handling
      retryOnStuck: options.retryOnStuck ?? true,
      stuckThreshold: options.stuckThreshold ?? 10000,
      maxStuckRetries: options.maxStuckRetries ?? 3,

      // Health monitoring
      enableHealthMonitor: options.enableHealthMonitor ?? true,
      healthMonitorInterval: options.healthMonitorInterval ?? 15000,

      ...options,
    };

    // Register Default Structures
    Structure.structures.Track = Structure.structures.Track || SuwakuTrack;
    Structure.structures.Player = Structure.structures.Player || SuwakuPlayer;
    Structure.structures.Queue = Structure.structures.Queue || SuwakuQueue;
    Structure.structures.Node = Structure.structures.Node || Node;

    /**
     * Suwaku version
     * @type {string}
     */
    this.version = version;

    /**
     * Client ID (Discord bot user ID)
     * @type {string|null}
     */
    this.clientId = null;

    /**
     * Whether client is ready
     * @type {boolean}
     */
    this.ready = false;

    /**
     * Node manager
     * @type {NodeManager}
     */
    this.nodes = new NodeManager(this);

    /**
     * Player manager
     * @type {PlayerManager}
     */
    this.playerManager = new PlayerManager(this);

    /**
     * Search manager
     * @type {SearchManager}
     */
    this.searchManager = new SearchManager(this);

    /**
     * Stats manager (AQUAlink Feature)
     * @type {StatsManager}
     */
    this.statsManager = new StatsManager(this);

    /**
     * Lyrics manager (AQUAlink Feature)
     * @type {LyricsManager}
     */
    this.lyricsManager = new LyricsManager(this);

    /**
     * Persistence Manager
     * @type {PersistenceManager}
     */
    this.persistence = new PersistenceManager(this, {
      storage: this.options.storageAdapter,
      prefix: this.options.persistencePrefix
    });

    /**
     * Voice state manager
     * @type {VoiceStateManager}
     */
    this.voiceStates = new VoiceStateManager(this);

    // Set up event forwarding
    this._setupEventForwarding();

    // Set up Discord client listeners
    this._setupDiscordListeners();

    // Initialize nodes
    this.nodes.init(options.nodes);
  }

  /**
   * Get all players
   * @returns {Map<string, SuwakuPlayer>} Players map
   */
  get players() {
    return this.playerManager.players;
  }

  /**
   * Initialize the client
   * @returns {Promise<void>}
   */
  async init() {
    if (this.ready) return;

    // Wait for Discord client to be ready
    if (!this.discordClient.isReady()) {
      await new Promise((resolve) => {
        this.discordClient.once("clientReady", resolve);
      });
    }

    this.clientId = this.discordClient.user.id;

    // Connect all nodes
    this.nodes.connectAll();

    this.ready = true;
    this.emit("ready");
    this.emit("debug", "Suwaku client initialized");
  }

  /**
   * Search for tracks
   * @param {string} query - Search query or URL
   * @param {Object} [options] - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options) {
    return this.searchManager.search(query, options);
  }

  /**
   * Autocomplete for Discord slash commands
   * @param {string} query - Search query
   * @param {Object} [options] - Autocomplete options
   * @param {string} [options.source] - Search source
   * @param {number} [options.limit=10] - Result limit
   * @returns {Promise<Array<{name: string, value: string}>>} Autocomplete choices
   */
  async autocomplete(query, options) {
    return this.searchManager.autocomplete(query, options);
  }

  /**
   * Search for tracks by mood (AQUAlink Feature)
   * @param {string} mood - The mood to search for
   * @param {Object} [options] - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchByMood(mood, options) {
    return this.searchManager.searchByMood(mood, options);
  }

  /**
   * Play a track or search result
   * @param {Object} options - Play options
   * @param {string} [options.query] - Search query or URL (if not providing track/searchResult)
   * @param {SuwakuTrack|Array<SuwakuTrack>|Object} [options.track] - Track, tracks array, or search result to play
   * @param {VoiceChannel} options.voiceChannel - Voice channel to join
   * @param {TextChannel} [options.textChannel] - Text channel for messages
   * @param {GuildMember|Object} [options.member] - Member who requested (if not already set in track)
   * @param {string} [options.source] - Search source (if using query)
   * @param {string} [options.engine] - Alias for source (if using query)
   * @param {Array<string>} [options.fallbackSources] - Fallback sources (if using query)
   * @param {number} [options.volume] - Initial volume for the player
   * @param {boolean} [options.paused] - Whether to start paused
   * @param {number} [options.startTime] - Start time in milliseconds
   * @param {number} [options.endTime] - End time in milliseconds
   * @param {boolean} [options.noReplace] - Don't replace current track if playing
   * @returns {Promise<SuwakuTrack|Object>} Added track or playlist info
   */
  async play(options) {
    validateObject(options, "Play options");

    const {
      query,
      track,
      voiceChannel,
      textChannel,
      member,
      source,
      engine,
      fallbackSources,
      volume,
      paused,
      startTime,
      endTime,
      noReplace,
    } = options;

    if (!voiceChannel) {
      throw new Error("Voice channel is required for play()");
    }

    // Get or create player
    const player =
      this.playerManager.get(voiceChannel.guild.id) ||
      this.playerManager.create({
        guildId: voiceChannel.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: textChannel?.id,
      });

    // Update text channel if provided
    if (textChannel) {
      player.textChannelId = textChannel.id;
    }

    // Apply reproduction options to player
    if (volume !== undefined) player.setVolume(volume);
    if (paused !== undefined) player.setPaused(paused);

    // If already playing or connecting, ensure we're in the right channel
    if (!player.connected) {
      await player.connect();
    }

    let searchResult;

    // Handle different input types (track, tracks array, search result, or query)
    if (track) {
      if (track.tracks && Array.isArray(track.tracks)) {
        // It's a search result object
        searchResult = track;
      } else if (Array.isArray(track)) {
        // It's an array of tracks
        searchResult = { loadType: "search", tracks: track };
      } else {
        // It's a single track
        searchResult = { loadType: "track", tracks: [track] };
      }
    } else if (query) {
      // Legacy support: search if only query is provided
      this.emit("debug", `Searching for: ${query}`);
      searchResult = await this.searchManager.search(query, {
        source: source || engine,
        fallbackSources: fallbackSources,
        requester: member,
      });
    } else {
      throw new Error("Either 'query' or 'track' must be provided to play()");
    }

    if (
      !searchResult ||
      !searchResult.tracks ||
      searchResult.tracks.length === 0
    ) {
      throw new Error(`No tracks found to play`);
    }

    // Check if it's a playlist result
    const isPlaylist = searchResult.loadType === "playlist";
    const tracks = searchResult.tracks;
    const playlistInfo = searchResult.playlistInfo || (searchResult.playlistName ? { name: searchResult.playlistName } : null);

    // Set requester if provided and not already set
    if (member) {
      const requesterInfo =
        typeof member === "string"
          ? { id: member }
          : {
            id: member.id,
            username: member.user?.username || member.username,
            displayName: member.displayName || member.username,
            avatar: member.user?.displayAvatarURL() || null
          };

      tracks.forEach((t) => {
        t.setRequester(requesterInfo);
      });
    }

    // Add to queue
    const wasEmpty = player.queue.isEmpty && !player.current;

    // Determine if we should add multiple tracks
    // Add multiple if it's explicitly a playlist OR if tracks array has more than one item and it's not a single-result search
    const shouldAddMultiple = isPlaylist || (tracks.length > 1 && (Array.isArray(track) || options.addAllResults));

    if (shouldAddMultiple) {
      if (tracks.length > (this.options.batchThreshold || 50)) {
        await player.addTracksBatch(tracks, { playlistInfo });
      } else {
        player.addTracks(tracks, playlistInfo);
      }
    } else if (tracks.length > 0) {
      player.addTrack(tracks[0]);
    }

    // Start playing if queue was empty
    if (wasEmpty && tracks.length > 0) {
      await player.play(undefined, {
        startTime,
        endTime,
        noReplace,
      });
    }

    // Return result
    if (isPlaylist) {
      return {
        isPlaylist: true,
        playlistInfo,
        tracks,
        firstTrack: tracks[0],
      };
    }

    return tracks[0];
  }

  /**
   * Join a voice channel
   * @param {Object} options - Join options
   * @param {VoiceChannel} options.voiceChannel - Voice channel to join
   * @param {TextChannel} [options.textChannel] - Text channel for messages
   * @param {boolean} [options.deaf=false] - Whether to deafen the bot
   * @param {boolean} [options.mute=false] - Whether to mute the bot
   * @returns {Promise<SuwakuPlayer>} Created or existing player
   */
  async join(options) {
    validateObject(options, "Join options");
    validateObject(options.voiceChannel, "Voice channel");

    const { voiceChannel, textChannel, deaf = false, mute = false } = options;
    const guildId = voiceChannel.guild.id;

    // Check if player already exists
    let player = this.playerManager.get(guildId);

    if (player) {
      // Player exists, check if it's in the same channel
      if (player.voiceChannelId === voiceChannel.id) {
        this.emit(
          "debug",
          `Player already in voice channel ${voiceChannel.id}`,
        );
        return player;
      }

      // Player exists but in different channel, move it
      this.emit(
        "debug",
        `Moving player from ${player.voiceChannelId} to ${voiceChannel.id}`,
      );
      player.voiceChannelId = voiceChannel.id;
      if (textChannel) {
        player.textChannelId = textChannel.id;
      }
    } else {
      // Create new player
      this.emit(
        "debug",
        `Creating player for guild ${guildId} in channel ${voiceChannel.id}`,
      );
      player = this.playerManager.create({
        guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: textChannel?.id,
        deaf,
        mute,
      });
    }

    // Connect to voice channel
    await player.connect();

    this.emit("playerJoin", player, voiceChannel);

    return player;
  }

  /**
   * Leave a voice channel
   * @param {string} guildId - Guild ID
   * @param {boolean} [destroy=true] - Whether to destroy the player
   * @returns {Promise<boolean>} Whether leave was successful
   */
  async leave(guildId, destroy = true) {
    validateNonEmptyString(guildId, "Guild ID");

    const player = this.playerManager.get(guildId);

    if (!player) {
      this.emit("debug", `No player found for guild ${guildId}`);
      return false;
    }

    this.emit("debug", `Leaving voice channel in guild ${guildId}`);

    // Disconnect from voice
    player.disconnect();

    // Destroy player if requested
    if (destroy) {
      await player.destroy();
    }

    this.emit("playerLeave", player);

    return true;
  }

  /**
   * Restore all players from persistent storage
   * @returns {Promise<number>} Number of restored players
   */
  async restorePlayers() {
    return this.persistence.restore();
  }
  /**
   * Get a player by guild ID
   * @param {string} guildId - Guild ID
   * @returns {SuwakuPlayer|undefined} Player or undefined
   */
  getPlayer(guildId) {
    return this.playerManager.get(guildId);
  }

  /**
   * Create a player
   * @param {Object} options - Player options
   * @returns {SuwakuPlayer} Created player
   */
  createPlayer(options) {
    return this.playerManager.create(options);
  }

  /**
   * Destroy a player
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Whether player was destroyed
   */
  async destroyPlayer(guildId) {
    return await this.playerManager.destroy(guildId);
  }

  /**
   * Set up event forwarding from managers
   * @private
   */
  _setupEventForwarding() {
    // Forward node events
    this.nodes.on("nodeConnect", (node) => this.emit("nodeConnect", node));
    this.nodes.on("nodeDisconnect", (node, data) =>
      this.emit("nodeDisconnect", node, data),
    );
    this.nodes.on("nodeError", (node, error) =>
      this.emit("nodeError", node, error),
    );
    this.nodes.on("nodeReady", (node, data) =>
      this.emit("nodeReady", node, data),
    );
    this.nodes.on("nodeStats", (node, stats) =>
      this.emit("nodeStats", node, stats),
    );
    this.nodes.on("debug", (msg) => this.emit("debug", msg));
    this.nodes.on("warn", (msg) => this.emit("warn", msg));
    this.nodes.on("error", (error) => this.emit("error", error));

    // Forward player events
    this.playerManager.on("playerCreate", (player) =>
      this.emit("playerCreate", player),
    );
    this.playerManager.on("playerDestroy", (player) =>
      this.emit("playerDestroy", player),
    );
    this.playerManager.on("playerJoin", (player, voiceChannel) =>
      this.emit("playerJoin", player, voiceChannel),
    );
    this.playerManager.on("playerLeave", (player) =>
      this.emit("playerLeave", player),
    );
    this.playerManager.on("trackStart", (player, track) =>
      this.emit("trackStart", player, track),
    );
    this.playerManager.on("trackEnd", (player, track, reason) =>
      this.emit("trackEnd", player, track, reason),
    );
    this.playerManager.on("trackError", (player, track, error) =>
      this.emit("trackError", player, track, error),
    );
    this.playerManager.on("trackStuck", (player, track, threshold) =>
      this.emit("trackStuck", player, track, threshold),
    );
    this.playerManager.on("queueEnd", (player) =>
      this.emit("queueEnd", player),
    );
    this.playerManager.on("trackAdd", (player, track) =>
      this.emit("trackAdd", player, track),
    );
    this.playerManager.on("tracksAdd", (player, tracks) =>
      this.emit("tracksAdd", player, tracks),
    );
    this.playerManager.on("trackAddPlaylist", (player, playlistData) =>
      this.emit("trackAddPlaylist", player, playlistData),
    );
    this.playerManager.on("playlistProgress", (player, progress) =>
      this.emit("playlistProgress", player, progress),
    );
    this.playerManager.on("trackRemove", (player, track, position) =>
      this.emit("trackRemove", player, track, position),
    );
    this.playerManager.on("debug", (msg) => this.emit("debug", msg));
    this.playerManager.on("error", (error) => this.emit("error", error));

    // Forward voice state events
    this.voiceStates.on("voiceStateUpdate", (data) =>
      this.emit("voiceStateUpdate", data),
    );
    this.voiceStates.on("voiceServerUpdate", (data) =>
      this.emit("voiceServerUpdate", data),
    );
    this.voiceStates.on("voiceDisconnect", (data) =>
      this.emit("voiceDisconnect", data),
    );
    this.voiceStates.on("voiceConnectionAttempt", (data) =>
      this.emit("voiceConnectionAttempt", data),
    );
  }

  /**
   * Set up Discord client listeners
   * @private
   */
  _setupDiscordListeners() {
    // Handle raw packets for voice state using ws.on instead of client.on('raw')
    // Discord.js v14 removed the 'raw' event, so we need to listen to the websocket directly
    this.discordClient.ws.on("VOICE_STATE_UPDATE", (data) => {
      this.voiceStates.handlePacket({ t: "VOICE_STATE_UPDATE", d: data });
    });

    this.discordClient.ws.on("VOICE_SERVER_UPDATE", (data) => {
      this.voiceStates.handlePacket({ t: "VOICE_SERVER_UPDATE", d: data });
    });

    // Track when bot moves between voice channels
    if (this.options.trackPlayerMoved) {
      this.discordClient.on("voiceStateUpdate", (oldState, newState) => {
        this._handleVoiceStateUpdate(oldState, newState);
      });
    }

    // Auto-initialize when Discord client is ready
    this.discordClient.once("clientReady", () => {
      if (!this.ready) {
        this.init().catch((error) => {
          this.emit("error", error);
        });
      }
    });
  }

  /**
   * Handle voice state updates to detect player movement and empty channels
   * @param {VoiceState} oldState - Old voice state
   * @param {VoiceState} newState - New voice state
   * @private
   */
  _handleVoiceStateUpdate(oldState, newState) {
    const guildId = newState.guild.id;
    const player = this.players.get(guildId);

    // Handle bot's own voice state
    if (newState.id === this.clientId) {
      if (!player) return;

      const oldChannelId = oldState.channelId || oldState.channel?.id;
      const newChannelId = newState.channelId || newState.channel?.id;

      // Determine the state
      let state = "UNKNOWN";
      if (!oldChannelId && newChannelId) {
        state = "JOINED";
      } else if (oldChannelId && !newChannelId) {
        state = "LEFT";
      } else if (
        oldChannelId &&
        newChannelId &&
        oldChannelId !== newChannelId
      ) {
        state = "MOVED";
      }

      if (state === "UNKNOWN") return;

      this.emit(
        "debug",
        `Player ${state.toLowerCase()} voice channel in guild ${guildId}`,
      );

      // Update player's voice channel ID if moved
      if (state === "MOVED") {
        player.voiceChannelId = newChannelId;
      }

      /**
       * Emitted when bot moves, joins, or leaves a voice channel
       * @event SuwakuClient#playerMoved
       * @param {SuwakuPlayer} player - The player
       * @param {string} state - Movement state (JOINED, LEFT, MOVED)
       * @param {Object} channels - Channel information
       * @param {string|null} channels.oldChannelId - Old channel ID
       * @param {string|null} channels.newChannelId - New channel ID
       */
      this.emit("playerMoved", player, state, {
        oldChannelId,
        newChannelId,
      });
    }

    // Forward voice state updates to the player for idle checks
    if (player) {
      player.handleVoiceStateUpdate();
    }
  }

  /**
   * Get client statistics
   * @returns {Object} Client statistics
   */
  getStats() {
    return {
      version: this.version,
      ready: this.ready,
      nodes: this.nodes.getStats(),
      players: this.playerManager.getStats(),
      uptime: this.ready ? Date.now() - this._readyTimestamp : 0,
    };
  }

  /**
   * Destroy the client
   * @returns {Promise<void>}
   */
  async destroy() {
    this.emit("debug", "Destroying Suwaku client");

    // Destroy all players
    await this.playerManager.destroyAll();

    // Disconnect all nodes
    this.nodes.disconnectAll();

    // Clear voice states
    this.voiceStates.clear();

    // Remove all listeners
    this.removeAllListeners();
    this.nodes.removeAllListeners();
    this.playerManager.removeAllListeners();
    this.voiceStates.removeAllListeners();

    this.ready = false;
    this.emit("destroy");
  }

  /**
   * Restore all players from persistent storage
   * @returns {Promise<number>} Number of restored players
   */
  async restorePlayers() {
    return this.persistence.restore();
  }
}

export { SuwakuClient };
