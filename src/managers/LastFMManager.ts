/**
 * Manages Last.fm API integration for track search and metadata
 * @module managers/LastFMManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { SuwakuTrack } from '../structures/SuwakuTrack';
import { Requester, TrackData, TrackSource } from '../types';
import { validateNonEmptyString, validateObject } from '../utils/validators';
import { TTLCache } from '../utils/TTLCache';

interface LastFMConfig {
  apiKey?: string;
  apiSecret?: string;
}

interface LastFMTrack {
  name: string;
  artist: { name: string; mbid?: string };
  album?: { title: string; mbid?: string };
  url: string;
  image?: Array<{ '#text': string; size: string }>;
  duration?: number;
  mbid?: string;
}

interface LastFMSearchResult {
  results: {
    trackmatches: {
      track: LastFMTrack[];
    };
  };
}

interface LastFMTrackInfo {
  track: {
    name: string;
    artist: { name: string; mbid?: string };
    album?: { title: string; mbid?: string; artist?: { name: string } };
    url: string;
    image?: Array<{ '#text': string; size: string }>;
    duration?: number;
    mbid?: string;
    toptags?: { tag: Array<{ name: string }> };
    wiki?: { summary: string; content: string };
  };
}

interface LastFMArtistTopTracks {
  toptracks: {
    track: LastFMTrack[];
  };
}

/**
 * Manages Last.fm API integration for track search and metadata
 */
export class LastFMManager extends EventEmitter {
  #client: SuwakuClient;
  #apiKey: string | null;
  #apiSecret: string | null;
  #cache: TTLCache<TrackData[]>;

  constructor(client: SuwakuClient, options: LastFMConfig = {}) {
    super();
    this.#client = client;
    this.#apiKey = options.apiKey ?? process.env.LASTFM_API_KEY ?? null;
    this.#apiSecret = options.apiSecret ?? process.env.LASTFM_API_SECRET ?? null;
    this.#cache = new TTLCache<TrackData[]>(500, 300_000);
  }

  get isConfigured(): boolean {
    return this.#apiKey !== null;
  }

  /**
   * Search for tracks on Last.fm
   * @param query - Search query
   * @param limit - Maximum number of results
   * @returns Array of track data
   */
  async search(query: string, limit: number = 10): Promise<TrackData[]> {
    if (!this.isConfigured) {
      this.emit('debug', 'Last.fm API key not configured');
      return [];
    }

    validateNonEmptyString(query, 'Query');

    const cacheKey = `search:${query}:${limit}`;
    const cached = this.#getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        method: 'track.search',
        track: query,
        api_key: this.#apiKey!,
        format: 'json',
        limit: String(limit)
      });

      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Last.fm API error: ${response.status}`);
      }

      const data = await response.json() as LastFMSearchResult;
      const tracks = (data.results?.trackmatches?.track ?? []).map(t => this.#parseTrack(t));

      this.#saveToCache(cacheKey, tracks);
      this.emit('searchComplete', { query, results: tracks.length });

      return tracks;
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Get track info from Last.fm
   * @param artist - Artist name
   * @param track - Track name
   * @returns Track data or null
   */
  async getTrackInfo(artist: string, track: string): Promise<TrackData | null> {
    if (!this.isConfigured) return null;

    validateNonEmptyString(artist, 'Artist');
    validateNonEmptyString(track, 'Track');

    const cacheKey = `track:${artist}:${track}`;
    const cached = this.#getFromCache(cacheKey);
    if (cached.length > 0) return cached[0];

    try {
      const params = new URLSearchParams({
        method: 'track.getInfo',
        artist,
        track,
        api_key: this.#apiKey!,
        format: 'json'
      });

      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Last.fm API error: ${response.status}`);
      }

      const data = await response.json() as LastFMTrackInfo;

      if (!data.track) return null;

      const trackData = this.#parseTrackInfo(data.track);
      this.#saveToCache(cacheKey, [trackData]);

      return trackData;
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Get top tracks by an artist
   * @param artist - Artist name
   * @param limit - Maximum number of results
   * @returns Array of track data
   */
  async getArtistTopTracks(artist: string, limit: number = 10): Promise<TrackData[]> {
    if (!this.isConfigured) return [];

    validateNonEmptyString(artist, 'Artist');

    const cacheKey = `artist:${artist}:${limit}`;
    const cached = this.#getFromCache(cacheKey);
    if (cached.length > 0) return cached;

    try {
      const params = new URLSearchParams({
        method: 'artist.gettoptracks',
        artist,
        api_key: this.#apiKey!,
        format: 'json',
        limit: String(limit)
      });

      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Last.fm API error: ${response.status}`);
      }

      const data = await response.json() as LastFMArtistTopTracks;
      const tracks = (data.toptracks?.track ?? []).map(t => this.#parseTrack(t));

      this.#saveToCache(cacheKey, tracks);
      return tracks;
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Get similar tracks
   * @param artist - Artist name
   * @param track - Track name
   * @param limit - Maximum number of results
   * @returns Array of track data
   */
  async getSimilarTracks(artist: string, track: string, limit: number = 5): Promise<TrackData[]> {
    if (!this.isConfigured) return [];

    try {
      const params = new URLSearchParams({
        method: 'track.getsimilar',
        artist,
        track,
        api_key: this.#apiKey!,
        format: 'json',
        limit: String(limit)
      });

      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);

      if (!response.ok) return [];

      const data = await response.json() as { similartracks?: { track: LastFMTrack[] } };
      return (data.similartracks?.track ?? []).map(t => this.#parseTrack(t));
    } catch (error) {
      return [];
    }
  }

  /**
   * Search and convert to SuwakuTrack format
   * @param query - Search query
   * @param requester - Requester information
   * @param limit - Maximum number of results
   * @returns Array of SuwakuTrack instances
   */
  async searchAsTracks(
    query: string,
    requester?: Requester,
    limit: number = 5
  ): Promise<SuwakuTrack[]> {
    const tracks = await this.search(query, limit);
    return tracks.map(t => {
      const trackData: TrackData = {
        ...t,
        requester
      };
      return new SuwakuTrack(trackData);
    });
  }

  /**
   * Parse a Last.fm track to TrackData
   */
  #parseTrack(track: LastFMTrack): TrackData {
    const images = track.image ?? [];
    const thumbnail = images.find(i => i.size === 'large')?.['#text']
      ?? images.find(i => i.size === 'medium')?.['#text']
      ?? images[0]?.['#text']
      ?? null;

    return {
      title: track.name,
      author: track.artist?.name ?? 'Unknown',
      url: track.url,
      duration: track.duration ?? 0,
      thumbnail: thumbnail ?? undefined,
      identifier: track.mbid ?? undefined,
      source: TrackSource.LASTFM,
      sourceName: 'lastfm'
    };
  }

  /**
   * Parse a Last.fm track info to TrackData
   */
  #parseTrackInfo(track: LastFMTrackInfo['track']): TrackData {
    const images = track.image ?? [];
    const thumbnail = images.find(i => i.size === 'extralarge')?.['#text']
      ?? images.find(i => i.size === 'large')?.['#text']
      ?? images[0]?.['#text']
      ?? null;

    return {
      title: track.name,
      author: track.artist?.name ?? 'Unknown',
      url: track.url,
      duration: track.duration ?? 0,
      thumbnail: thumbnail ?? undefined,
      album: track.album?.title ?? undefined,
      identifier: track.mbid ?? undefined,
      source: TrackSource.LASTFM,
      sourceName: 'lastfm'
    };
  }

  // ==================== Cache Management ====================

  #getFromCache(key: string): TrackData[] {
    return this.#cache.get(key) ?? [];
  }

  #saveToCache(key: string, result: TrackData[]): void {
    this.#cache.set(key, result);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.#cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.#cache.size,
      ttl: this.#cache.stats.ttl
    };
  }
}
