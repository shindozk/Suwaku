/**
 * Manages lyrics fetching and synchronization
 * @module managers/LyricsManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { SuwakuTrack } from '../structures/SuwakuTrack';
import { SuwakuPlayer } from '../structures/SuwakuPlayer';
import { LyricsResult, LyricsLine, Requester } from '../types';
import { validateNonEmptyString, validateObject } from '../utils/validators';
import { TTLCache } from '../utils/TTLCache';

interface LyricsOptions {
  player?: SuwakuPlayer;
  romanized?: boolean;
  preferSynced?: boolean;
}

/**
 * Manages lyrics fetching and synchronization
 */
export class LyricsManager extends EventEmitter {
  #client: SuwakuClient;
  #cache: TTLCache<LyricsResult>;
  #geniusToken: string | null;

  constructor(client: SuwakuClient, options: { cacheTTL?: number; geniusToken?: string } = {}) {
    super();
    this.#client = client;
    this.#cache = new TTLCache<LyricsResult>(500, options.cacheTTL ?? 3_600_000);
    this.#geniusToken = options.geniusToken ?? null;
  }

  /**
   * Get lyrics for a track or query
   * @param track - Track to get lyrics for, or search query
   * @param options - Lyrics options
   * @returns Lyrics result
   */
  async get(track: SuwakuTrack | string, options: LyricsOptions = {}): Promise<LyricsResult | null> {
    const query = typeof track === 'string' ? track : `${track.title} ${track.author}`;
    validateNonEmptyString(query, 'Query');
    validateObject(options, 'Options');

    // Check cache first
    const cacheKey = `${query}:${options.romanized ?? false}:${options.preferSynced ?? false}`;
    const cached = this.#getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let result: LyricsResult | null = null;

      if (this.#geniusToken) {
        result = await this.#fetchFromGenius(query, options);
      } else {
        // Try to get from Lavalink plugin if available
        result = await this.#fetchFromLavalink(query, options);
      }

      if (result) {
        this.#saveToCache(cacheKey, result);
      }

      return result;
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Fetch lyrics from Genius API
   * @private
   */
  async #fetchFromGenius(query: string, options: LyricsOptions): Promise<LyricsResult | null> {
    if (!this.#geniusToken) return null;

    try {
      const searchResponse = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${this.#geniusToken}`,
            'User-Agent': 'Suwaku/1.0'
          }
        }
      );

      if (!searchResponse.ok) return null;

      const searchData = await searchResponse.json() as { response?: { hits?: Array<{ result: { id: number } }> } };
      const hit = searchData.response?.hits?.[0];

      if (!hit) return null;

      const songId = hit.result.id;
      const songResponse = await fetch(
        `https://api.genius.com/songs/${songId}`,
        {
          headers: {
            Authorization: `Bearer ${this.#geniusToken}`,
            'User-Agent': 'Suwaku/1.0'
          }
        }
      );

      if (!songResponse.ok) return null;

      const songData = await songResponse.json() as { response?: { song?: { title: string; primary_artist?: { name: string }; lyrics?: { plain?: string; html?: string }; header_image_thumbnail_url?: string } } };
      const song = songData.response?.song;

      if (!song) return null;

      // Get lyrics from Genius (requires scraping or using lyrics endpoint)
      // This is a simplified version - in production you'd use a proper lyrics scraper
      const lyrics = song.lyrics?.plain || song.lyrics?.html || '';

      return {
        title: song.title,
        author: song.primary_artist?.name || 'Unknown',
        lyrics: lyrics || 'Lyrics not available',
        lines: [],
        isSynced: false,
        source: 'Genius',
        provider: 'Genius',
        artworkUrl: song.header_image_thumbnail_url
      };
    } catch (error) {
      this.emit('debug', `Genius lyrics fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Fetch lyrics from Lavalink plugin
   * @private
   */
  async #fetchFromLavalink(query: string, options: LyricsOptions): Promise<LyricsResult | null> {
    try {
      // Try to get lyrics from Lavalink plugin (if available)
      const node = this.#client.nodes.getBest();
      if (!node || !node.connected) return null;

      // This would require a Lavalink plugin that provides lyrics
      // For now, try LRCLIB as fallback
      return await this.#fetchFromLRCLIB(query, options);
    } catch (error) {
      this.emit('debug', `Lavalink lyrics fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Fetch lyrics from LRCLIB (free, open-source lyrics provider)
   * @private
   */
  async #fetchFromLRCLIB(query: string, options: LyricsOptions): Promise<LyricsResult | null> {
    try {
      const searchParams = new URLSearchParams({ q: query });
      const response = await fetch(
        `https://lrclib.net/api/search?${searchParams.toString()}`,
        {
          headers: {
            'User-Agent': 'Suwaku/1.3.0 (https://github.com/shindozk/Suwaku)'
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json() as Array<{
        trackName: string;
        artistName: string;
        albumName?: string;
        duration?: number;
        syncedLyrics?: string;
        plainLyrics?: string;
        instrumental?: boolean;
        artworkUrl?: string;
      }>;

      if (!data.length) return null;

      const match = data[0];
      const lyrics = match.syncedLyrics || match.plainLyrics || '';

      if (!lyrics) return null;

      // Parse synced lyrics if available
      const lines: LyricsLine[] = [];
      if (match.syncedLyrics && options.preferSynced !== false) {
        const syncedLines = match.syncedLyrics.split('\n');
        for (const line of syncedLines) {
          const timeMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
          if (timeMatch) {
            const minutes = parseInt(timeMatch[1], 10);
            const seconds = parseInt(timeMatch[2], 10);
            const ms = parseInt(timeMatch[3].padEnd(3, '0'), 10);
            const time = minutes * 60 * 1000 + seconds * 1000 + ms;
            const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/, '').trim();
            if (text) {
              lines.push({ time, text });
            }
          }
        }
      }

      return {
        title: match.trackName,
        author: match.artistName,
        lyrics: lyrics,
        lines: lines,
        isSynced: lines.length > 0,
        source: 'LRCLIB',
        provider: 'LRCLIB',
        artworkUrl: match.artworkUrl
      };
    } catch (error) {
      this.emit('debug', `LRCLIB lyrics fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Get nearby lyrics lines for synchronization
   * @param lines - Lyrics lines
   * @param player - Player for timing
   * @returns Previous, current, and next lines
   */
  getNearbyLines(
    lines: LyricsLine[],
    player: SuwakuPlayer
  ): { previous: LyricsLine | null; current: LyricsLine | null; next: LyricsLine | null } {
    if (!lines.length || !player.playing) {
      return { previous: null, current: null, next: null };
    }

    const position = player.position;

    // Find current line index
    let currentIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= position) {
        currentIndex = i;
      } else {
        break;
      }
    }

    return {
      previous: currentIndex > 0 ? lines[currentIndex - 1] : null,
      current: currentIndex >= 0 ? lines[currentIndex] : null,
      next: currentIndex + 1 < lines.length ? lines[currentIndex + 1] : null
    };
  }

  /**
   * Search lyrics by query
   * @param query - Search query
   * @param options - Search options
   * @returns Array of lyrics results
   */
  async search(query: string, options: { limit?: number } = {}): Promise<LyricsResult[]> {
    validateNonEmptyString(query, 'Query');

    if (!this.#geniusToken) return [];

    try {
      const response = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${this.#geniusToken}`,
            'User-Agent': 'Suwaku/1.0'
          }
        }
      );

      if (!response.ok) return [];

      const data = await response.json() as { response?: { hits?: Array<{ result: { title: string; primary_artist?: { name: string }; header_image_thumbnail_url?: string } }> } };
      const hits = data.response?.hits || [];

      return hits.slice(0, options.limit ?? 10).map((hit: { result: { title: string; primary_artist?: { name: string }; header_image_thumbnail_url?: string } }) => ({
        title: hit.result.title,
        author: hit.result.primary_artist?.name || 'Unknown',
        lyrics: '',
        lines: [],
        isSynced: false,
        source: 'Genius',
        provider: 'Genius',
        artworkUrl: hit.result.header_image_thumbnail_url
      }));
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Clear lyrics cache
   */
  clearCache(): void {
    this.#cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.#cache.size,
      ttl: this.#cache.stats.ttl
    };
  }

  // ==================== Cache Management ====================

  #getFromCache(key: string): LyricsResult | null {
    return this.#cache.get(key);
  }

  #saveToCache(key: string, result: LyricsResult): void {
    this.#cache.set(key, result);
  }
}
