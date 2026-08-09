/**
 * Suwaku - A powerful Lavalink-based music player for Discord bots
 * @module suwaku
 */

// Main client
export { SuwakuClient } from './client/SuwakuClient';

// Structures
export { SuwakuPlayer } from './structures/SuwakuPlayer';
export { SuwakuQueue } from './structures/SuwakuQueue';
export { SuwakuTrack } from './structures/SuwakuTrack';
export { Structure } from './structures/Structure';

// Managers
export { PlayerManager } from './managers/PlayerManager';
export { SearchManager } from './managers/SearchManager';
export { FilterManager } from './managers/FilterManager';
export { LyricsManager } from './managers/LyricsManager';
export { StatsManager } from './managers/StatsManager';
export { LastFMManager } from './managers/LastFMManager';

// Lavalink
export { NodeManager } from './lavalink/NodeManager';
export { LavalinkNode } from './lavalink/LavalinkNode';
export { LavalinkREST } from './lavalink/LavalinkREST';
export { VoiceStateManager } from './lavalink/VoiceStateManager';

// Persistence
export { PersistenceManager } from './persistence/PersistenceManager';
export { StorageAdapter } from './persistence/StorageAdapter';
export { MemoryStorageAdapter } from './persistence/MemoryStorageAdapter';
export { JSONStorageAdapter } from './persistence/JSONStorageAdapter';

// Types - explicit exports to avoid duplicates
export {
  LoopMode,
  PlayerState,
  TrackSource,
  SearchPrefix,
  SearchEngine,
  LavalinkEvent,
  TrackEndReason,
  ErrorCode,
  LavalinkOpcode,
  FilterType,
  FilterPreset,
  PlayerEvent,
  QueueSortProperty,
  YoutubeThumbnailSize,
  PlayerMovedState,
  SponsorBlockCategory,
  DefaultPlayerOptions,
  Defaults,
  Requester,
  TrackData,
  QueueData,
  PlayerData,
  PlayerOptions,
  NodeConfig,
  NodeStats,
  NodePlayer,
  SearchOptions,
  SearchResult,
  EqualizerBand,
  TimescaleSettings,
  KaraokeSettings,
  TremoloSettings,
  VibratoSettings,
  RotationSettings,
  DistortionSettings,
  ChannelMixSettings,
  LowPassSettings,
  FilterSettings,
  LyricsLine,
  LyricsResult,
  PluginInfo,
  VoiceStateUpdate,
  VoiceServerUpdate,
  LavalinkTrackResponse,
  LavalinkLoadResponse,
  LavalinkPlaylistResponse,
  LavalinkPlaylistInfo,
  NodeStatsSummary,
  ClientStats,
  AutocompleteChoice,
  MoodSearchOptions,
  PlayOptions,
  JoinOptions,
  FilterPresetEntry,
  StructureExtensions,
  PlayerDestroyReason,
  UnresolvedTrackData,
  URLFilterOptions,
} from './types';

// Utils
export {
  SuwakuError,
  ConnectionError,
  PlaybackError,
  ValidationError,
  PermissionError,
  NodeNotFoundError,
  PlayerNotFoundError,
  TrackLoadError,
  ConfigurationError,
  VoiceConnectionError,
  AutoplayNotFoundError,
  isSuwakuError,
  getErrorCode,
  validateRequired,
  validateString,
  validateNonEmptyString,
  validateNumber,
  validateRange,
  validateBoolean,
  validateArray,
  validateNonEmptyArray,
  validateObject,
  validateFunction,
  validateURL,
  validateSnowflake,
  validateNodeConfig,
  validatePlayerOptions,
  validateSearchOptions,
  validatePlayOptions,
  validateJoinOptions,
  isPlainObject,
  isNonEmptyString,
  isValidNumber,
  formatDuration,
  parseDuration,
  formatBytes,
  formatTimestamp,
  createProgressBar,
  truncate,
  formatNumber,
  formatTime,
  formatQueuePosition,
  formatVolume,
  formatFilters,
  formatEmbedField,
  formatMemoryUsage,
  formatCpuLoad,
  sanitize,
  formatTrackInfo,
  capitalize,
  toTitleCase,
  formatError,
} from './utils';

// Version
export const version = '1.3.0';