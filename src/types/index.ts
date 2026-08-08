/**
 * Core type definitions for Suwaku
 * @module types
 */

/**
 * Loop modes for queue playback
 */
export enum LoopMode {
  OFF = 'off',
  TRACK = 'track',
  QUEUE = 'queue'
}

/**
 * Player states
 */
export enum PlayerState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  DESTROYED = 'destroyed'
}

/**
 * Track sources
 */
export enum TrackSource {
  YOUTUBE = 'youtube',
  YOUTUBE_MUSIC = 'youtubemusic',
  SOUNDCLOUD = 'soundcloud',
  SPOTIFY = 'spotify',
  DEEZER = 'deezer',
  APPLE_MUSIC = 'applemusic',
  LASTFM = 'lastfm',
  HTTP = 'http',
  LOCAL = 'local'
}

/**
 * Search prefixes for Lavalink
 */
export enum SearchPrefix {
  YOUTUBE = 'ytsearch',
  YOUTUBE_MUSIC = 'ytmsearch',
  SOUNDCLOUD = 'scsearch',
  LASTFM = 'lastfm',
  DEEZER = 'dzsearch',
  APPLE_MUSIC = 'amsearch'
}

/**
 * Search engines available
 */
export enum SearchEngine {
  YOUTUBE = 'youtube',
  YOUTUBE_MUSIC = 'youtubemusic',
  SOUNDCLOUD = 'soundcloud',
  LASTFM = 'lastfm',
  DEEZER = 'deezer',
  APPLE_MUSIC = 'applemusic'
}

/**
 * Lavalink event types
 */
export enum LavalinkEvent {
  TRACK_START = 'TrackStartEvent',
  TRACK_END = 'TrackEndEvent',
  TRACK_EXCEPTION = 'TrackExceptionEvent',
  TRACK_STUCK = 'TrackStuckEvent',
  WEBSOCKET_CLOSED = 'WebSocketClosedEvent'
}

/**
 * Track end reasons
 */
export enum TrackEndReason {
  FINISHED = 'finished',
  LOAD_FAILED = 'loadFailed',
  STOPPED = 'stopped',
  REPLACED = 'replaced',
  CLEANUP = 'cleanup'
}

/**
 * Error codes
 */
export enum ErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  TRACK_LOAD_FAILED = 'TRACK_LOAD_FAILED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  VOICE_CONNECTION_FAILED = 'VOICE_CONNECTION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  AUTOPLAY_NOT_FOUND = 'AUTOPLAY_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  QUEUE_FULL = 'QUEUE_FULL'
}

/**
 * Lavalink opcodes
 */
export enum LavalinkOpcode {
  VOICE_UPDATE = 'voiceUpdate',
  PLAY = 'play',
  STOP = 'stop',
  PAUSE = 'pause',
  SEEK = 'seek',
  VOLUME = 'volume',
  FILTERS = 'filters',
  DESTROY = 'destroy',
  PLAYER_UPDATE = 'playerUpdate',
  STATS = 'stats',
  EVENT = 'event',
  READY = 'ready'
}

/**
 * Filter types
 */
export enum FilterType {
  EQUALIZER = 'equalizer',
  KARAOKE = 'karaoke',
  TIMESCALE = 'timescale',
  TREMOLO = 'tremolo',
  VIBRATO = 'vibrato',
  ROTATION = 'rotation',
  DISTORTION = 'distortion',
  CHANNEL_MIX = 'channelMix',
  LOW_PASS = 'lowPass',
  HIGH_PASS = 'highPass',
  NORMALIZATION = 'normalization',
  ECHO = 'echo'
}

/**
 * Filter presets
 */
export enum FilterPreset {
  BASSBOOST_LOW = 'bassboost-low',
  BASSBOOST_MEDIUM = 'bassboost-medium',
  BASSBOOST_HIGH = 'bassboost-high',
  NIGHTCORE = 'nightcore',
  VAPORWAVE = 'vaporwave',
  EIGHTD = '8d',
  KARAOKE = 'karaoke',
  TREMOLO = 'tremolo',
  VIBRATO = 'vibrato',
  SOFT = 'soft',
  POP = 'pop',
  ROCK = 'rock',
  ELECTRONIC = 'electronic',
  CLASSICAL = 'classical',
  ROBOT = 'robot',
  CHIPMUNK = 'chipmunk',
  MONSTER = 'monster',
  TELEPHONE = 'telephone',
  RADIO = 'radio'
}

/**
 * Player events
 */
export enum PlayerEvent {
  TRACK_START = 'trackStart',
  TRACK_END = 'trackEnd',
  TRACK_ERROR = 'trackError',
  TRACK_STUCK = 'trackStuck',
  QUEUE_END = 'queueEnd',
  QUEUE_ADD = 'queueAdd',
  QUEUE_UPDATE = 'queueUpdate',
  QUEUE_SHUFFLE = 'queueShuffle',
  QUEUE_CLEAR = 'queueClear',
  TRACK_ADD = 'trackAdd',
  TRACKS_ADD = 'tracksAdd',
  TRACK_ADD_PLAYLIST = 'trackAddPlaylist',
  TRACK_REMOVE = 'trackRemove',
  PAUSE = 'pause',
  RESUME = 'resume',
  STOP = 'stop',
  SEEK = 'seek',
  VOLUME_CHANGE = 'volumeChange',
  LOOP_CHANGE = 'loopChange',
  CONNECTING = 'connecting',
  DISCONNECT = 'disconnect',
  VOICE_WEBSOCKET_CLOSED = 'voiceWebSocketClosed',
  FILTERS_UPDATE = 'filtersUpdate',
  HISTORY_CLEARED = 'historyCleared',
  AUTOPLAY_CHANGE = 'autoplayChange',
  DESTROY = 'destroy',
  ERROR = 'error'
}

/**
 * Queue sort properties
 */
export enum QueueSortProperty {
  TITLE = 'title',
  AUTHOR = 'author',
  DURATION = 'duration',
  ADDED_AT = 'addedAt'
}

/**
 * YouTube thumbnail sizes
 */
export enum YoutubeThumbnailSize {
  DEFAULT = 'default',
  MEDIUM = 'mqdefault',
  HIGH = 'hqdefault',
  STANDARD = 'sddefault',
  MAX = 'maxresdefault'
}

/**
 * Player movement states
 */
export enum PlayerMovedState {
  JOINED = 'JOINED',
  LEFT = 'LEFT',
  MOVED = 'MOVED'
}

/**
 * Reasons a player was destroyed
 */
export enum PlayerDestroyReason {
  MANUAL = 'manual',
  CHANNEL_DELETED = 'channelDeleted',
  BOT_DISCONNECTED = 'botDisconnected',
  VOICE_CHANNEL_EMPTY = 'voiceChannelEmpty',
  QUEUE_EMPTY = 'queueEmpty',
  IDLE_TIMEOUT = 'idleTimeout',
  NODE_DISCONNECTED = 'nodeDisconnected',
  ERROR = 'error',
  SHUTDOWN = 'shutdown',
  LEAVE_COMMAND = 'leaveCommand'
}

/**
 * SponsorBlock categories to skip
 */
export enum SponsorBlockCategory {
  SPONSOR = 'sponsor',
  SELFPROMO = 'selfpromo',
  INTERACTION = 'interaction',
  INTRO = 'intro',
  OUTRO = 'outro',
  PREVIEW = 'preview',
  MUSIC_OFFTOPIC = 'music_offtopic',
  FILLER = 'filler'
}

/**
 * Default options for Suwaku Player
 */
export interface DefaultPlayerOptions {
  autoplayPlatform: string[];
  autoResume: boolean;
  maxReconnects: number;
  reconnectInterval: number;
  volume: number;
}

export const DefaultPlayerOptions: DefaultPlayerOptions = {
  autoplayPlatform: ['lastfm', 'ytsearch'],
  autoResume: true,
  maxReconnects: Infinity,
  reconnectInterval: 5000,
  volume: 100
};

/**
 * Default configuration values
 */
export interface Defaults {
  VOLUME: number;
  SEARCH_SOURCE: SearchEngine;
  PLAYBACK_ENGINE: SearchEngine;
  AUTO_LEAVE_DELAY: number;
  HISTORY_SIZE: number;
  RECONNECT_DELAY: number;
  RECONNECT_ATTEMPTS: number;
  IDLE_TIMEOUT: number;
  CACHE_TTL: {
    SEARCH: number;
    LYRICS: number;
    NODE_INFO: number;
  };
}

export const Defaults: Defaults = {
  VOLUME: 80,
  SEARCH_SOURCE: SearchEngine.LASTFM,
  PLAYBACK_ENGINE: SearchEngine.YOUTUBE_MUSIC,
  AUTO_LEAVE_DELAY: 300_000,
  HISTORY_SIZE: 50,
  RECONNECT_DELAY: 5_000,
  RECONNECT_ATTEMPTS: 5,
  IDLE_TIMEOUT: 300_000,
  CACHE_TTL: {
    SEARCH: 300_000,
    LYRICS: 3_600_000,
    NODE_INFO: 60_000
  }
};

/**
 * Requester information
 */
export interface Requester {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string | null;
}

/**
 * Track data structure
 */
export interface TrackData {
  id?: string;
  title: string;
  author: string;
  url?: string;
  uri?: string;
  duration?: number;
  length?: number;
  thumbnail?: string;
  artworkUrl?: string;
  source?: TrackSource;
  sourceName?: string;
  requester?: Requester;
  isStream?: boolean;
  isSeekable?: boolean;
  position?: number;
  encoded?: string;
  info?: Record<string, unknown>;
  pluginInfo?: Record<string, unknown>;
  isrc?: string;
  album?: string;
  playlistName?: string;
  playlistUrl?: string;
  playlistId?: string;
  identifier?: string;
  isUnavailable?: boolean;
}

/**
 * Queue data structure
 */
export interface QueueData {
  tracks: TrackData[];
  previous: TrackData[];
  loopMode: LoopMode;
  maxHistorySize: number;
}

/**
 * Player data structure
 */
export interface PlayerData {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string | null;
  state: PlayerState;
  volume: number;
  loopMode: LoopMode;
  tracks: TrackData[];
  position: number;
  playing: boolean;
  paused: boolean;
  filters: Record<string, unknown>;
  options: PlayerOptions;
  currentTrack?: TrackData | null;
}

/**
 * Player options
 */
export interface PlayerOptions {
  deaf?: boolean;
  mute?: boolean;
  volume?: number;
  autoLeave?: boolean;
  autoLeaveDelay?: number;
  leaveOnEmpty?: boolean;
  leaveOnEmptyDelay?: number;
  leaveOnEnd?: boolean;
  idleTimeout?: number;
  historySize?: number;
  maxQueueSize?: number;
  maxPlaylistSize?: number;
  allowDuplicates?: boolean;
  enableFilters?: boolean;
  enableLyrics?: boolean;
  enableSourceFallback?: boolean;
  sortByRegion?: boolean;
  resumeOnReconnect?: boolean;
  reconnectDelay?: number;
  reconnectAttempts?: number;
  loadBalancer?: boolean;
  enableHealthCheck?: boolean;
  defaultYoutubeThumbnail?: string;
  trackPlayerMoved?: boolean;
  healthCheckInterval?: number;
  retryOnStuck?: boolean;
  stuckThreshold?: number;
  maxStuckRetries?: number;
  enableHealthMonitor?: boolean;
  healthMonitorInterval?: number;
  sponsorBlockCategories?: SponsorBlockCategory[];
  autoplayPlatform?: string[];
  playbackEngine?: SearchEngine;
  searchEngine?: SearchEngine;
  defaultVolume?: number;
  autoPlay?: boolean;
  onDisconnect?: PlayerDestroyReason;
  onEmptyQueue?: 'destroy' | 'idle' | 'none';
  onEmptyQueueDelay?: number;
  volumeDecrementer?: number;
  instaFixFilter?: boolean;
  dynamicRhythm?: boolean;
}

/**
 * Node configuration
 */
export interface NodeConfig {
  host: string;
  port: number;
  password: string;
  secure?: boolean;
  identifier?: string;
  region?: string;
}

/**
 * Lavalink node statistics
 */
export interface NodeStats {
  players: number;
  playingPlayers: number;
  uptime: number;
  memory: {
    free: number;
    used: number;
    allocated: number;
    reservable: number;
  };
  cpu: {
    cores: number;
    systemLoad: number;
    lavalinkLoad: number;
  };
  frameStats?: {
    sent: number;
    nulled: number;
    deficit: number;
  };
  version?: {
    version: string;
    semver: string;
    major: number;
    minor: number;
    patch: number;
    prerelease: string;
    build: string;
    available: boolean;
  };
}

/**
 * Lavalink node player information
 */
export interface NodePlayer {
  guildId: string;
  state: PlayerState;
  volume: number;
  track: string | null;
  identifiers: string[];
  position: number;
  connected: boolean;
  ping: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  source?: SearchEngine;
  requester?: Requester;
  limit?: number;
  fallbackSources?: SearchEngine[];
}

/**
 * Search result structure
 */
export interface SearchResult {
  loadType: 'track' | 'playlist' | 'search' | 'empty' | 'error';
  tracks: import('../structures/SuwakuTrack').SuwakuTrack[];
  albums?: Array<{
    name: string;
    artist: string;
    url?: string;
    artworkUrl?: string;
    trackCount?: number;
  }>;
  artists?: Array<{
    name: string;
    url?: string;
    artworkUrl?: string;
    trackCount?: number;
  }>;
  playlistInfo?: {
    name: string;
    url?: string;
    duration?: number;
    artworkUrl?: string;
    selectedTrack?: number;
  };
  exception?: {
    message: string;
    severity: string;
  };
  suggestedPreset?: FilterPreset;
}

/**
 * Equalizer band
 */
export interface EqualizerBand {
  band: number;
  gain: number;
}

/**
 * Timescale filter settings
 */
export interface TimescaleSettings {
  speed: number;
  pitch: number;
  rate: number;
}

/**
 * Karaoke filter settings
 */
export interface KaraokeSettings {
  level: number;
  monoLevel: number;
  filterBand: number;
  filterWidth: number;
}

/**
 * Tremolo filter settings
 */
export interface TremoloSettings {
  frequency: number;
  depth: number;
}

/**
 * Vibrato filter settings
 */
export interface VibratoSettings {
  frequency: number;
  depth: number;
}

/**
 * Rotation filter settings
 */
export interface RotationSettings {
  rotationHz: number;
}

/**
 * Distortion filter settings
 */
export interface DistortionSettings {
  sinOffset: number;
  sinScale: number;
  cosOffset: number;
  cosScale: number;
  tanOffset: number;
  tanScale: number;
  offset: number;
  scale: number;
}

/**
 * Channel mix filter settings
 */
export interface ChannelMixSettings {
  leftToLeft: number;
  leftToRight: number;
  rightToLeft: number;
  rightToRight: number;
}

/**
 * Low pass filter settings
 */
export interface LowPassSettings {
  smoothing: number;
}

/**
 * Filter settings union type - allows individual filter configs or combined object
 */
export type FilterSettings =
  | EqualizerBand[]
  | TimescaleSettings
  | KaraokeSettings
  | TremoloSettings
  | VibratoSettings
  | RotationSettings
  | DistortionSettings
  | ChannelMixSettings
  | LowPassSettings
  | Record<string, unknown>;

/**
 * Lyrics line
 */
export interface LyricsLine {
  time: number;
  text: string;
}

/**
 * Lyrics result
 */
export interface LyricsResult {
  title: string;
  author: string;
  lyrics: string;
  lines: LyricsLine[];
  isSynced: boolean;
  source: string;
  provider: string;
  artworkUrl?: string;
}

/**
 * Plugin info for tracks
 */
export interface PluginInfo {
  [key: string]: unknown;
}

/**
 * Voice state update packet
 */
export interface VoiceStateUpdate {
  guildId: string;
  channelId: string | null;
  userId: string;
  sessionId: string;
  deaf: boolean;
  mute: boolean;
  selfDeaf: boolean;
  selfMute: boolean;
  selfVideo: boolean;
  suppress: boolean;
}

/**
 * Voice server update packet
 */
export interface VoiceServerUpdate {
  guildId: string;
  endpoint: string;
  token: string;
}

/**
 * Lavalink REST track response
 */
export interface LavalinkTrackResponse {
  encoded: string;
  info: {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    position: number;
    title: string;
    uri: string | null;
    artworkUrl: string | null;
    isrc: string | null;
    sourceName: string;
    pluginInfo?: Record<string, unknown>;
  };
  pluginInfo?: Record<string, unknown>;
}

/**
 * Lavalink REST load response
 */
export interface LavalinkLoadResponse {
  loadType: 'track' | 'playlist' | 'search' | 'empty' | 'error';
  data: LavalinkTrackResponse[] | LavalinkPlaylistResponse | null;
  playlistInfo?: LavalinkPlaylistInfo;
  exception?: {
    message: string;
    severity: string;
  };
}

/**
 * Lavalink playlist response
 */
export interface LavalinkPlaylistResponse {
  info: LavalinkPlaylistInfo;
  tracks: LavalinkTrackResponse[];
}

/**
 * Lavalink playlist info
 */
export interface LavalinkPlaylistInfo {
  name: string;
  selectedTrack: number;
  duration: number;
  artworkUrl?: string;
}

/**
 * Node statistics summary
 */
export interface NodeStatsSummary {
  size: number;
  connectedCount: number;
}

/**
 * Client statistics
 */
export interface ClientStats {
  version: string;
  ready: boolean;
  nodes: NodeStatsSummary;
  players: {
    total: number;
    playing: number;
  };
  uptime: number;
}

/**
 * Autocomplete choice
 */
export interface AutocompleteChoice {
  name: string;
  value: string;
}

/**
 * Mood search options
 */
export interface MoodSearchOptions {
  requester?: Requester;
}

/**
 * Play options
 */
export interface PlayOptions {
  query?: string;
  track?: TrackData | TrackData[] | SearchResult;
  voiceChannel: any;
  textChannel?: any;
  member?: any;
  source?: SearchEngine;
  engine?: SearchEngine;
  fallbackSources?: SearchEngine[];
  volume?: number;
  paused?: boolean;
  startTime?: number;
  endTime?: number;
  noReplace?: boolean;
  addAllResults?: boolean;
}

/**
 * Join options
 */
export interface JoinOptions {
  voiceChannel: any;
  textChannel?: any;
  deaf?: boolean;
  mute?: boolean;
}

/**
 * Filter preset map entry
 */
export interface FilterPresetEntry {
  name: FilterPreset;
  settings: FilterSettings;
}

/**
 * Node manager options
 */
export interface NodeManagerOptions {
  loadBalancer?: boolean;
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  sortByRegion?: boolean;
}

/**
 * Queue options
 */
export interface QueueOptions {
  maxHistorySize?: number;
  maxQueueSize?: number;
}

/**
 * Lavalink track info from REST API
 */
export interface LavalinkTrackInfo {
  identifier: string;
  isSeekable: boolean;
  author: string;
  length: number;
  isStream: boolean;
  position: number;
  title: string;
  uri: string | null;
  artworkUrl: string | null;
  isrc: string | null;
  sourceName: string;
  pluginInfo?: Record<string, unknown>;
}

/**
 * Player manager statistics
 */
export interface PlayerManagerStats {
  total: number;
  playing: number;
  paused: number;
}

/**
 * Unresolved track - only stores query info, resolves on play
 */
export interface UnresolvedTrackData {
  /** Original query or identifier used to search */
  query: string;
  /** Track title (if known) */
  title?: string;
  /** Artist name (if known) */
  author?: string;
  /** Duration in milliseconds (if known) */
  duration?: number;
  /** Requester who added this track */
  requester?: Requester;
  /** Source to search from */
  source?: SearchEngine;
  /** URI if already resolved */
  uri?: string;
}

/**
 * URL validation options for request filtering
 */
export interface URLFilterOptions {
  /** Whitelist of allowed URL patterns (strings or regex). If set, only these URLs are allowed. */
  whitelist?: (string | RegExp)[];
  /** Blacklist of blocked URL patterns (strings or regex). These are blocked even if whitelisted. */
  blacklist?: (string | RegExp)[];
}

/**
 * Structure extensions
 */
export interface StructureExtensions {
  Track?: new (...args: any[]) => any;
  Player?: new (...args: any[]) => any;
  Queue?: new (...args: any[]) => any;
  Node?: new (...args: any[]) => any;
}

