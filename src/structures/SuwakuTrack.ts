/**
 * Represents a track in the Suwaku system
 * @module structures/SuwakuTrack
 */

import {
  TrackSource,
  Requester,
  TrackData,
  PluginInfo,
  LavalinkTrackResponse,
  LavalinkTrackInfo
} from '../types';
import { validateNonEmptyString, validateNumber, validateObject } from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';
import { formatDuration } from '../utils/formatters';

/**
 * Represents a track in the Suwaku system with full Lavalink integration
 */
export class SuwakuTrack {
  #id: string;
  #title: string;
  #author: string;
  #url: string | null;
  #duration: number;
  #thumbnail: string | null;
  #source: TrackSource | null;
  #requester: Requester | null;
  #isStream: boolean;
  #isSeekable: boolean;
  #position: number;
  #encoded: string | null;
  #info: Record<string, unknown>;
  #artworkUrl: string | null;
  #isrc: string | null;
  #album: string | null;
  #playlistName: string | null;
  #playlistUrl: string | null;
  #playlistId: string | null;
  #pluginInfo: PluginInfo;
  #identifier: string | null;
  #isUnavailable: boolean;
  #sourceName: string | null;

  /**
   * Create a new SuwakuTrack
   * @param data - Track data from Lavalink or search results
   * @param requester - Optional requester information
   */
  constructor(data: TrackData | LavalinkTrackResponse, requester?: Requester) {
    // Handle both Lavalink track response and plain track data
    const isLavalinkResponse = 'info' in data;
    
    if (isLavalinkResponse) {
      const lavalinkData = data as LavalinkTrackResponse;
      const info = lavalinkData.info as import('../types').LavalinkTrackInfo;
      
      validateObject(info, 'Track data');
      validateNonEmptyString(info.title, 'Track title');
      validateNonEmptyString(info.author, 'Track author');
      validateNumber(info.length, 'Track duration');

      this.#id = info.identifier ?? Math.random().toString(36).substring(2, 11);
      this.#title = info.title;
      this.#author = info.author;
      this.#url = info.uri;
      this.#duration = info.length;
      this.#thumbnail = info.artworkUrl;
      this.#source = info.sourceName ? this.#parseSource(info.sourceName) : null;
      this.#requester = requester ?? null;
      this.#isStream = info.isStream;
      this.#isSeekable = info.isSeekable;
      this.#position = info.position;
      this.#encoded = lavalinkData.encoded ?? null;
      this.#info = info.pluginInfo ?? {};
      this.#artworkUrl = info.artworkUrl;
      this.#isrc = info.isrc;
      this.#album = null;
      this.#playlistName = null;
      this.#playlistUrl = null;
      this.#playlistId = null;
      this.#pluginInfo = info.pluginInfo ?? {};
      this.#identifier = info.identifier;
      this.#isUnavailable = false;
      this.#sourceName = info.sourceName;
    } else {
      const trackData = data as TrackData;
      
      validateObject(trackData, 'Track data');
      validateNonEmptyString(trackData.title, 'Track title');
      validateNonEmptyString(trackData.author, 'Track author');
      
      const duration = trackData.duration ?? trackData.length ?? 0;
      validateNumber(duration, 'Track duration');

      const identifier = trackData.identifier ?? trackData.id;
      const sourceName = trackData.sourceName ?? trackData.source;

      const dataId = 'id' in trackData ? trackData.id : undefined;
      this.#id = dataId ?? identifier ?? Math.random().toString(36).substring(2, 11);
      this.#title = trackData.title;
      this.#author = trackData.author;
      this.#url = trackData.url ?? trackData.uri ?? null;
      this.#duration = duration;
      this.#thumbnail = trackData.thumbnail ?? trackData.artworkUrl ?? null;
      
      const sourceValue = trackData.source ?? trackData.sourceName;
      this.#source = sourceValue ? this.#parseSource(sourceValue) : (sourceName ? this.#parseSource(sourceName) : null);
      
      this.#requester = requester ?? trackData.requester ?? null;
      this.#isStream = trackData.isStream ?? false;
      this.#isSeekable = trackData.isSeekable ?? !this.#isStream;
      this.#position = trackData.position ?? 0;
      this.#encoded = trackData.encoded ?? null;
      this.#info = trackData.info ?? trackData.pluginInfo ?? {};
      this.#artworkUrl = trackData.artworkUrl ?? this.#thumbnail;
      this.#isrc = trackData.isrc ?? null;
      this.#album = trackData.album ?? null;
      this.#playlistName = trackData.playlistName ?? null;
      this.#playlistUrl = trackData.playlistUrl ?? null;
      this.#playlistId = trackData.playlistId ?? null;
      this.#pluginInfo = trackData.pluginInfo ?? {};
      this.#identifier = identifier ?? null;
      this.#isUnavailable = trackData.isUnavailable ?? false;
      this.#sourceName = sourceName ?? null;
    }
  }

  /**
   * Parse source string to TrackSource enum
   */
  #parseSource(source: string): TrackSource | null {
    const normalized = source.toLowerCase().replace(/[^a-z]/g, '');
    const sourceMap: Record<string, TrackSource> = {
      youtube: TrackSource.YOUTUBE,
      youtubemusic: TrackSource.YOUTUBE_MUSIC,
      lastfm: TrackSource.LASTFM,
      soundcloud: TrackSource.SOUNDCLOUD,
      spotify: TrackSource.SPOTIFY,
      deezer: TrackSource.DEEZER,
      applemusic: TrackSource.APPLE_MUSIC,
      http: TrackSource.HTTP,
      local: TrackSource.LOCAL
    };
    return sourceMap[normalized] ?? null;
  }

  // ==================== Getters ====================

  get id(): string {
    return this.#id;
  }

  get title(): string {
    return this.#title;
  }

  get author(): string {
    return this.#author;
  }

  get url(): string | null {
    return this.#url;
  }

  get duration(): number {
    return this.#duration;
  }

  get thumbnail(): string | null {
    return this.#thumbnail;
  }

  get source(): TrackSource | null {
    return this.#source;
  }

  get requester(): Requester | null {
    return this.#requester;
  }

  get isStream(): boolean {
    return this.#isStream;
  }

  get isSeekable(): boolean {
    return this.#isSeekable;
  }

  get position(): number {
    return this.#position;
  }

  set position(value: number) {
    this.#position = Math.max(0, Math.min(value, this.#duration));
  }

  get encoded(): string | null {
    return this.#encoded;
  }

  set encoded(value: string | null) {
    this.#encoded = value;
  }

  /**
   * Get plugin-specific info for this track
   * Note: This returns plugin info, not the full Lavalink track info
   * @returns Plugin info object
   */
  get pluginInfo(): PluginInfo {
    return { ...this.#pluginInfo };
  }

  /**
   * Get full track info including all Lavalink metadata
   * @returns Full track info object
   */
  get info(): Record<string, unknown> {
    return {
      identifier: this.#identifier,
      isSeekable: this.#isSeekable,
      author: this.#author,
      length: this.#duration,
      isStream: this.#isStream,
      position: this.#position,
      title: this.#title,
      uri: this.#url,
      artworkUrl: this.#artworkUrl,
      isrc: this.#isrc,
      sourceName: this.#sourceName,
      pluginInfo: this.#pluginInfo
    };
  }

  get artworkUrl(): string | null {
    return this.#artworkUrl;
  }

  get isrc(): string | null {
    return this.#isrc;
  }

  get album(): string | null {
    return this.#album;
  }

  get playlistName(): string | null {
    return this.#playlistName;
  }

  get playlistUrl(): string | null {
    return this.#playlistUrl;
  }

  get playlistId(): string | null {
    return this.#playlistId;
  }

  get identifier(): string | null {
    return this.#identifier;
  }

  get isUnavailable(): boolean {
    return this.#isUnavailable;
  }

  get sourceName(): string | null {
    return this.#sourceName;
  }

  // ==================== Computed Properties ====================

  /**
   * Formatted duration string (MM:SS or HH:MM:SS)
   */
  get formattedDuration(): string {
    return formatDuration(this.#duration);
  }

  /**
   * Progress as percentage (0-100)
   */
  get progress(): number {
    return this.#duration > 0 ? (this.#position / this.#duration) * 100 : 0;
  }

  /**
   * Check if track has valid artwork
   */
  get hasArtwork(): boolean {
    return !!this.#artworkUrl;
  }

  /**
   * Get best available thumbnail URL
   */
  get bestThumbnail(): string | null {
    return this.#artworkUrl ?? this.#thumbnail;
  }

  // ==================== Methods ====================

  /**
   * Set requester for the track
   * @param requester - Requester information
   */
  setRequester(requester: Requester): void {
    this.#requester = requester;
  }

  /**
   * Update track position
   * @param position - New position in milliseconds
   */
  updatePosition(position: number): void {
    this.#position = Math.max(0, Math.min(position, this.#duration));
  }

  /**
   * Convert track to JSON-serializable object
   * @returns JSON representation of the track
   */
  toJSON(): TrackData {
    const json: TrackData = {
      id: this.#id,
      title: this.#title,
      author: this.#author,
      url: this.#url ?? undefined,
      duration: this.#duration,
      thumbnail: this.#thumbnail ?? undefined,
      source: this.#source ?? undefined,
      requester: this.#requester ?? undefined,
      isStream: this.#isStream,
      isSeekable: this.#isSeekable,
      position: this.#position,
      encoded: this.#encoded ?? undefined,
      artworkUrl: this.#artworkUrl ?? undefined,
      isrc: this.#isrc ?? undefined,
      album: this.#album ?? undefined,
      playlistName: this.#playlistName ?? undefined,
      playlistUrl: this.#playlistUrl ?? undefined,
      playlistId: this.#playlistId ?? undefined,
      pluginInfo: this.#pluginInfo,
      identifier: this.#identifier ?? undefined,
      isUnavailable: this.#isUnavailable,
      sourceName: this.#sourceName ?? undefined
    };
    
    // Only include info if it has properties to avoid being treated as Lavalink response
    if (this.#info && Object.keys(this.#info).length > 0) {
      json.info = this.#info;
    }
    
    return json;
  }

  /**
   * Create a track from JSON data
   * @param data - JSON data
   * @returns New SuwakuTrack instance
   */
  static from(data: TrackData): SuwakuTrack {
    return new SuwakuTrack(data);
  }

  /**
   * Create a track from Lavalink track response
   * @param response - Lavalink track response
   * @param requester - Optional requester information
   * @returns New SuwakuTrack instance
   */
  static fromLavalink(response: LavalinkTrackResponse, requester?: Requester): SuwakuTrack {
    return new SuwakuTrack(response, requester);
  }

  /**
   * Create multiple tracks from Lavalink response array
   * @param responses - Array of Lavalink track responses
   * @param requester - Optional requester information
   * @returns Array of SuwakuTrack instances
   */
  static fromLavalinkArray(responses: LavalinkTrackResponse[], requester?: Requester): SuwakuTrack[] {
    return responses.map(response => new SuwakuTrack(response, requester));
  }

  /**
   * Create a copy of the track with optional modifications
   * @param overrides - Properties to override
   * @returns Copy of the track
   */
  clone(overrides: Partial<TrackData> = {}): SuwakuTrack {
    const data = this.toJSON();
    // Remove info and id to avoid being treated as Lavalink response and to generate new ID
    const { info, id, ...dataWithoutInfo } = data;
    return new SuwakuTrack({ ...dataWithoutInfo, ...overrides }, this.#requester ?? undefined);
  }

  /**
   * Check if track equals another track (by ID)
   * @param other - Track to compare with
   * @returns True if tracks are equal
   */
  equals(other: SuwakuTrack): boolean {
    return this.#id === other.#id;
  }

  /**
   * Get track display string for embeds/messages
   * @returns Formatted track string
   */
  toString(): string {
    const requester = this.#requester?.displayName || this.#requester?.username || 'Unknown';
    return `**${this.#title}** by *${this.#author}* \`[${this.formattedDuration}]\`\nRequested by: ${requester}`;
  }

  /**
   * Get markdown link for the track
   * @returns Markdown link or title if no URL
   */
  toMarkdownLink(): string {
    return this.#url ? `[${this.#title}](${this.#url})` : this.#title;
  }
}