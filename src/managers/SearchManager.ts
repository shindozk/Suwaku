/**
 * Manages track searches across multiple sources
 * @module managers/SearchManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { SuwakuTrack } from '../structures/SuwakuTrack';
import {
  SearchEngine,
  SearchOptions,
  SearchResult,
  Requester,
  LavalinkLoadResponse,
  LavalinkTrackResponse
} from '../types';
import { validateNonEmptyString, validateObject } from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';
import { TTLCache } from '../utils/TTLCache';

/**
 * Manages track searches across multiple sources
 */
export class SearchManager extends EventEmitter {
  #client: SuwakuClient;
  #defaultSource: SearchEngine;
  #cache: TTLCache<SearchResult>;

  constructor(client: SuwakuClient, options: { defaultSource?: SearchEngine; cacheTTL?: number } = {}) {
    super();
    validateObject(client, 'Client');

    this.#client = client;
    this.#defaultSource = options.defaultSource ?? SearchEngine.YOUTUBE_MUSIC;
    this.#cache = new TTLCache<SearchResult>(1000, options.cacheTTL ?? 300_000);
  }

  get defaultSource(): SearchEngine {
    return this.#defaultSource;
  }

  set defaultSource(source: SearchEngine) {
    this.#defaultSource = source;
  }

  /**
   * Search for tracks
   * @param query - Search query or URL
   * @param options - Search options
   * @returns Promise resolving to search results
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    validateNonEmptyString(query, 'Query');
    validateObject(options, 'Search options');

    const opts = options as SearchOptions;
    const cacheKey = `${query}:${opts.source ?? this.#defaultSource}`;
    const cached = this.#getFromCache(cacheKey);
    if (cached) {
      // Clone tracks to avoid sharing requester instances between users
      return {
        ...cached,
        tracks: cached.tracks.map(t => t.clone({ requester: opts.requester }))
      };
    }

    try {
      const source = opts.source ?? this.#defaultSource;
      let result: SearchResult;

      // Check if query is a URL
      if (this.#isUrl(query)) {
        result = await this.#loadTrack(query, opts);
      } else {
        result = await this.#performSearch(query, source, opts);
      }

      // Apply fallback sources if no results
      if (result.loadType === 'empty' && opts.fallbackSources?.length) {
        for (const fallbackSource of opts.fallbackSources) {
          const fallbackResult = await this.#performSearch(query, fallbackSource, opts);
          if (fallbackResult.loadType !== 'empty') {
            result = fallbackResult;
            break;
          }
        }
      }

      // Try ISRC fallback if still no results and query looks like an ISRC
      if (result.loadType === 'empty' && this.#isISRC(query)) {
        const isrcResult = await this.#searchByISRC(query, opts);
        if (isrcResult.loadType !== 'empty') {
          result = isrcResult;
        }
      }

      this.#saveToCache(cacheKey, result);
      this.emit('searchComplete', { query, options: opts, result });

      return result;
    } catch (error) {
      this.emit('searchError', { query, options: opts, error });
      throw error;
    }
  }

  /**
   * Get autocomplete suggestions for a query
   * @param query - Search query
   * @param options - Autocomplete options
   * @returns Promise resolving to autocomplete choices
   */
  async autocomplete(query: string, options: { source?: SearchEngine; limit?: number } = {}): Promise<Array<{ name: string; value: string }>> {
    if (!query || query.trim().length === 0) return [];

    try {
      const source = options.source ?? this.#defaultSource;
      const prefix = this.#getSearchPrefix(source as SearchEngine);
      const node = this.#client.nodes.getBest();
      if (!node) return [];

      const response = await node.rest.loadTrack(`${prefix}:${query}`);
      const parsed = this.#parseLavalinkResponse(response, {});

      return parsed.tracks.slice(0, options.limit ?? 10).map(t => ({
        name: `${t.title} - ${t.author}`.substring(0, 100),
        value: t.title.substring(0, 100),
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Search by mood (exclusive feature)
   * @param mood - Mood to search for
   * @param options - Search options
   * @returns Promise resolving to search results
   */
  async searchByMood(mood: string, options: { requester?: Requester } = {}): Promise<SearchResult> {
    validateNonEmptyString(mood, 'Mood');
    validateObject(options, 'Search options');

    const moodQueries: Record<string, string> = {
      happy: 'happy upbeat music',
      sad: 'sad melancholic music',
      lofi: 'lofi hip hop beats',
      workout: 'workout gym motivation music',
      party: 'party dance music',
      focus: 'focus concentration music',
      dark: 'dark atmospheric music',
      romantic: 'romantic love music'
    };

    const query = moodQueries[mood.toLowerCase()] || mood;
    const result = await this.search(query, { requester: options.requester });

    // Add suggested preset based on mood
    const moodPresets: Record<string, string> = {
      happy: 'pop',
      sad: 'soft',
      lofi: 'vaporwave',
      workout: 'electronic',
      party: 'bassboost-high',
      focus: 'classical',
      dark: 'bassboost-low',
      romantic: 'soft'
    };

    if (result.tracks.length > 0 && moodPresets[mood.toLowerCase()]) {
      (result as any).suggestedPreset = moodPresets[mood.toLowerCase()];
    }

    return result;
  }

  /**
   * Load a track directly from URL
   * @param url - Track URL
   * @param options - Search options
   * @returns Search result
   */
  async #loadTrack(url: string, options: SearchOptions): Promise<SearchResult> {
    const node = this.#client.nodes.getBest();
    if (!node) {
      throw new ValidationError('No available Lavalink node', ErrorCode.NODE_NOT_FOUND);
    }

    try {
      const response = await node.rest.loadTrack(url);
      return this.#parseLavalinkResponse(response, options);
    } catch (error) {
      return {
        loadType: 'error',
        tracks: [],
        exception: {
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'COMMON'
        }
      };
    }
  }

  /**
   * Perform search using Lavalink
   * @param query - Search query
   * @param source - Search source
   * @param options - Search options
   * @returns Search result
   */
  async #performSearch(query: string, source: SearchEngine, options: SearchOptions): Promise<SearchResult> {
    const node = this.#client.nodes.getBest();
    if (!node) {
      throw new ValidationError('No available Lavalink node', ErrorCode.NODE_NOT_FOUND);
    }

    const prefix = this.#getSearchPrefix(source);
    const searchQuery = `${prefix}:${query}`;

    try {
      const response = await node.rest.loadTrack(searchQuery);
      return this.#parseLavalinkResponse(response, options);
    } catch (error) {
      return {
        loadType: 'error',
        tracks: [],
        exception: {
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'COMMON'
        }
      };
    }
  }

  /**
   * Parse Lavalink response to SearchResult
   * @param response - Lavalink response
   * @param options - Search options
   * @returns Parsed search result
   */
  #parseLavalinkResponse(response: LavalinkLoadResponse, opts: SearchOptions): SearchResult {
    const { loadType, data, playlistInfo, exception } = response;

    if (loadType === 'error' || exception) {
      return {
        loadType: 'error',
        tracks: [],
        exception: exception ?? { message: 'Unknown error', severity: 'COMMON' }
      };
    }

    if (loadType === 'empty' || !data) {
      return {
        loadType: 'empty',
        tracks: []
      };
    }

    let tracks: SuwakuTrack[] = [];
    let resultLoadType: SearchResult['loadType'] = 'search';
    let resultPlaylistInfo: SearchResult['playlistInfo'] = undefined;

    if (loadType === 'track') {
      const trackResponse = data as unknown as LavalinkTrackResponse;
      const track = SuwakuTrack.fromLavalink(trackResponse, opts.requester);
      tracks = [track];
      resultLoadType = 'track';
    } else if (loadType === 'playlist') {
      const playlistResponse = data as unknown as { tracks?: LavalinkTrackResponse[]; info?: { name: string; selectedTrack: number; duration: number; artworkUrl?: string } };
      if (playlistResponse.tracks) {
        tracks = playlistResponse.tracks.map((t: LavalinkTrackResponse) =>
          SuwakuTrack.fromLavalink(t, opts.requester)
        );
      }
      resultLoadType = 'playlist';
      resultPlaylistInfo = {
        name: playlistInfo?.name ?? 'Unknown Playlist',
        url: playlistInfo?.artworkUrl,
        duration: playlistInfo?.duration,
        artworkUrl: playlistInfo?.artworkUrl,
        selectedTrack: playlistInfo?.selectedTrack
      };
    } else if (loadType === 'search') {
      const trackResponses = data as unknown as LavalinkTrackResponse[];
      tracks = trackResponses.map(t => SuwakuTrack.fromLavalink(t, opts.requester));
      resultLoadType = 'search';
    }

    // Apply limit if specified
    if (opts.limit && tracks.length > opts.limit) {
      tracks = tracks.slice(0, opts.limit);
    }

    return {
      loadType: resultLoadType,
      tracks,
      playlistInfo: resultPlaylistInfo
    };
  }

  /**
   * Check if string is a URL
   * @param str - String to check
   * @returns True if URL
   */
  #isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if string is an ISRC code
   * @param str - String to check
   * @returns True if ISRC format (e.g., USRC12345678)
   */
  #isISRC(str: string): boolean {
    return /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/i.test(str.replace(/\s/g, ''));
  }

  /**
   * Search by ISRC code
   * @param isrc - ISRC code
   * @param options - Search options
   * @returns Search result
   */
  async #searchByISRC(isrc: string, options: SearchOptions): Promise<SearchResult> {
    const node = this.#client.nodes.getBest();
    if (!node) {
      return { loadType: 'empty', tracks: [] };
    }

    try {
      // Lavalink supports ISRC search with isrc: prefix
      const response = await node.rest.loadTrack(`isrc:${isrc}`);
      return this.#parseLavalinkResponse(response, options);
    } catch (error) {
      return {
        loadType: 'error',
        tracks: [],
        exception: {
          message: error instanceof Error ? error.message : 'ISRC search failed',
          severity: 'COMMON'
        }
      };
    }
  }

  /**
   * Get search prefix for source
   * @param source - Search source
   * @returns Search prefix
   */
  #getSearchPrefix(source: SearchEngine): string {
    const prefixes: Record<SearchEngine, string> = {
      [SearchEngine.YOUTUBE]: 'ytsearch',
      [SearchEngine.YOUTUBE_MUSIC]: 'ytmsearch',
      [SearchEngine.SOUNDCLOUD]: 'scsearch',
      [SearchEngine.SPOTIFY]: 'spsearch',
      [SearchEngine.LASTFM]: 'lastfm',
      [SearchEngine.DEEZER]: 'dzsearch',
      [SearchEngine.APPLE_MUSIC]: 'amsearch'
    };
    return prefixes[source] ?? 'ytsearch';
  }

  // ==================== Cache Management ====================

  #getFromCache(key: string): SearchResult | null {
    return this.#cache.get(key);
  }

  #saveToCache(key: string, result: SearchResult): void {
    this.#cache.set(key, result);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.#cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return this.#cache.stats;
  }
}
