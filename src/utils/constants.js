/**
 * Constants used throughout Suwaku
 * @module utils/constants
 */

/**
 * Loop modes for queue playback
 * @enum {string}
 */
export const LoopMode = {
  OFF: 'off',
  TRACK: 'track',
  QUEUE: 'queue'
};

/**
 * Player states
 * @enum {string}
 */
export const PlayerState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DESTROYED: 'destroyed'
};

/**
 * Track sources
 * @enum {string}
 */
export const TrackSource = {
  YOUTUBE: 'youtube',
  SPOTIFY: 'spotify',
  SOUNDCLOUD: 'soundcloud',
  HTTP: 'http',
  LOCAL: 'local'
};

/**
 * Search prefixes for Lavalink
 * @enum {string}
 */
export const SearchPrefix = {
  YOUTUBE: 'ytsearch',
  YOUTUBE_MUSIC: 'ytmsearch',
  SOUNDCLOUD: 'scsearch',
  SPOTIFY: 'spsearch',
  DEEZER: 'dzsearch',
  APPLE_MUSIC: 'amsearch'
};

/**
 * Search engines available
 * @enum {string}
 */
export const SearchEngine = {
  YOUTUBE: 'youtube',
  YOUTUBE_MUSIC: 'youtubemusic',
  SOUNDCLOUD: 'soundcloud',
  SPOTIFY: 'spotify',
  DEEZER: 'deezer',
  APPLE_MUSIC: 'applemusic'
};

/**
 * Lavalink event types
 * @enum {string}
 */
export const LavalinkEvent = {
  TRACK_START: 'TrackStartEvent',
  TRACK_END: 'TrackEndEvent',
  TRACK_EXCEPTION: 'TrackExceptionEvent',
  TRACK_STUCK: 'TrackStuckEvent',
  WEBSOCKET_CLOSED: 'WebSocketClosedEvent'
};

/**
 * Track end reasons
 * @enum {string}
 */
export const TrackEndReason = {
  FINISHED: 'finished',
  LOAD_FAILED: 'loadFailed',
  STOPPED: 'stopped',
  REPLACED: 'replaced',
  CLEANUP: 'cleanup'
};

/**
 * Error codes
 * @enum {string}
 */
export const ErrorCode = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  TRACK_LOAD_FAILED: 'TRACK_LOAD_FAILED',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  VOICE_CONNECTION_FAILED: 'VOICE_CONNECTION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  AUTOPLAY_NOT_FOUND: 'AUTOPLAY_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT'
};

/**
 * Default options for Suwaku Player
 * @type {Object}
 */
export const DefaultPlayerOptions = {
  autoplayPlatform: ['spsearch', 'ytsearch'],
  autoResume: true,
  maxReconnects: Infinity,
  reconnectInterval: 5000,
  volume: 100
};

/**
 * Default configuration values
 */
export const Defaults = {
  VOLUME: 80,
  SEARCH_SOURCE: 'spotify',
  PLAYBACK_ENGINE: 'youtubemusic',
  AUTO_LEAVE_DELAY: 300000, // 5 minutes
  HISTORY_SIZE: 50,
  RECONNECT_DELAY: 5000,
  RECONNECT_ATTEMPTS: 5,
  IDLE_TIMEOUT: 300000, // 5 minutes
  CACHE_TTL: {
    SEARCH: 300000, // 5 minutes
    LYRICS: 3600000, // 1 hour
    NODE_INFO: 60000 // 1 minute
  }
};

/**
 * Lavalink opcodes
 * @enum {string}
 */
export const LavalinkOpcode = {
  VOICE_UPDATE: 'voiceUpdate',
  PLAY: 'play',
  STOP: 'stop',
  PAUSE: 'pause',
  SEEK: 'seek',
  VOLUME: 'volume',
  FILTERS: 'filters',
  DESTROY: 'destroy',
  PLAYER_UPDATE: 'playerUpdate',
  STATS: 'stats',
  EVENT: 'event',
  READY: 'ready'
};

/**
 * Filter types
 * @enum {string}
 */
export const FilterType = {
  EQUALIZER: 'equalizer',
  KARAOKE: 'karaoke',
  TIMESCALE: 'timescale',
  TREMOLO: 'tremolo',
  VIBRATO: 'vibrato',
  ROTATION: 'rotation',
  DISTORTION: 'distortion',
  CHANNEL_MIX: 'channelMix',
  LOW_PASS: 'lowPass',
  HIGH_PASS: 'highPass',
  NORMALIZATION: 'normalization',
  ECHO: 'echo'
};

/**
 * Filter presets
 * @enum {string}
 */
export const FilterPreset = {
  BASSBOOST_LOW: 'bassboost-low',
  BASSBOOST_MEDIUM: 'bassboost-medium',
  BASSBOOST_HIGH: 'bassboost-high',
  NIGHTCORE: 'nightcore',
  VAPORWAVE: 'vaporwave',
  EIGHTD: '8d',
  KARAOKE: 'karaoke',
  TREMOLO: 'tremolo',
  VIBRATO: 'vibrato',
  SOFT: 'soft',
  POP: 'pop',
  ROCK: 'rock',
  ELECTRONIC: 'electronic',
  CLASSICAL: 'classical'
};

/**
 * Player events
 * @enum {string}
 */
export const PlayerEvent = {
  // Playback events
  TRACK_START: 'trackStart',
  TRACK_END: 'trackEnd',
  TRACK_ERROR: 'trackError',
  TRACK_STUCK: 'trackStuck',

  // Queue events
  QUEUE_END: 'queueEnd',
  QUEUE_ADD: 'queueAdd',
  QUEUE_UPDATE: 'queueUpdate',
  QUEUE_SHUFFLE: 'queueShuffle',
  QUEUE_CLEAR: 'queueClear',

  // Track operations
  TRACK_ADD: 'trackAdd',
  TRACKS_ADD: 'tracksAdd',
  TRACK_ADD_PLAYLIST: 'trackAddPlaylist',
  TRACK_REMOVE: 'trackRemove',

  // Player state events
  PAUSE: 'pause',
  RESUME: 'resume',
  STOP: 'stop',
  SEEK: 'seek',
  VOLUME_CHANGE: 'volumeChange',
  LOOP_CHANGE: 'loopChange',

  // Connection events
  CONNECTING: 'connecting',
  DISCONNECT: 'disconnect',
  VOICE_WEBSOCKET_CLOSED: 'voiceWebSocketClosed',

  // Filter events
  FILTERS_UPDATE: 'filtersUpdate',

  // History events
  HISTORY_CLEARED: 'historyCleared',

  // Autoplay events
  AUTOPLAY_CHANGE: 'autoplayChange',

  // Lifecycle events
  DESTROY: 'destroy',
  ERROR: 'error'
};

/**
 * Sort properties for queue
 * @enum {string}
 */
export const QueueSortProperty = {
  TITLE: 'title',
  AUTHOR: 'author',
  DURATION: 'duration',
  ADDED_AT: 'addedAt'
};

/**
 * YouTube thumbnail sizes
 * @enum {string}
 */
export const YoutubeThumbnailSize = {
  DEFAULT: 'default',        // 120x90
  MEDIUM: 'mqdefault',       // 320x180
  HIGH: 'hqdefault',         // 480x360
  STANDARD: 'sddefault',     // 640x480
  MAX: 'maxresdefault'       // 1280x720 or higher
};

/**
 * Player movement states
 * @enum {string}
 */
export const PlayerMovedState = {
  JOINED: 'JOINED',
  LEFT: 'LEFT',
  MOVED: 'MOVED'
};
