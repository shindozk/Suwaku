/**
 * Search Manager - Handles multi-source music search
 * @module managers/SearchManager
 */

import axios from 'axios';
import Structure from '../structures/Structure.js';
import { SearchPrefix, TrackSource } from '../utils/constants.js';
import { validateNonEmptyString } from '../utils/validators.js';

/**
 * Manages music search across multiple sources
 */
class SearchManager {
  /**
   * @param {SuwakuClient} client - The Suwaku client instance
   */
  constructor(client) {
    this.client = client;

    /**
     * Search result cache
     * @type {Map<string, Object>}
     */
    this.cache = new Map();

    /**
     * Cache TTL in milliseconds
     * @type {number}
     */
    this.cacheTTL = 300000; // 5 minutes
  }

  /**
   * Search for tracks by mood/vibe (Suwaku Exclusive Innovation)
   * @param {string} mood - The mood (e.g., 'happy', 'sad', 'lofi')
   * @param {Object} [options] - Search options
   * @returns {Promise<Object>} Search result
   */
  async searchByMood(mood, options = {}) {
    validateNonEmptyString(mood, 'Mood');

    const moodMap = {
      'happy': { keywords: 'happy upbeat pop energy', preset: 'pop' },
      'sad': { keywords: 'sad emotional acoustic slow', preset: 'soft' },
      'lofi': { keywords: 'lofi hip hop chill beats relax', preset: 'vaporwave' },
      'workout': { keywords: 'phonk workout gym hardstyle motivation', preset: 'bassboost' },
      'party': { keywords: 'dance party club hits house music', preset: 'electronic' },
      'focus': { keywords: 'deep focus ambient binaural beats study', preset: 'classical' },
      'dark': { keywords: 'dark ambient mysterious cinematic', preset: 'distortion' },
      'romantic': { keywords: 'romantic love songs acoustic ballads', preset: 'soft' }
    };

    const moodData = moodMap[mood.toLowerCase()] || { keywords: mood, preset: null };
    this.client.emit('debug', `Mood search for: ${mood} using keywords: ${moodData.keywords}`);

    const results = await this.search(moodData.keywords, options);
    if (results && moodData.preset) {
      results.suggestedPreset = moodData.preset;
    }

    return results;
  }

  /**
   * Search for tracks (Standard Shoukaku/Kazagumo Style)
   * @param {string} query - Search query or URL
   * @param {Object} [options] - Search options
   * @param {string} [options.source] - Search source (youtube, spotify, etc)
   * @param {string} [options.node] - Preferred node identifier
   * @param {Object} [options.requester] - User who requested
   * @returns {Promise<Object>} Search result object
   */
  async search(query, options = {}) {
    validateNonEmptyString(query, 'Search query');

    // 1. Cache Check
    const cacheKey = `${query}:${options.source || 'default'}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        this.client.emit('debug', `Search Cache Hit: ${query}`);
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    // 2. Identification & Universal Resolver
    const isURL = this._isURL(query);
    let identifier = isURL ? query : this._getSearchIdentifier(query, options.source);

    // YouTube Mix & Playlist normalization
    if (isURL && query.includes('youtube.com')) {
      const url = new URL(query);
      const list = url.searchParams.get('list');
      const videoId = url.searchParams.get('v');

      // If it's a mix or playlist, prioritize the list identifier for Lavalink
      if (list) {
        this.client.emit('debug', `YouTube Playlist/Mix detected, cleaning URL...`);
        identifier = `https://www.youtube.com/playlist?list=${list}`;
      }
    }

    this.client.emit('debug', `Search initiating: "${identifier}"`);

    try {
      const node = options.node ? this.client.nodes.get(options.node) : this.client.nodes.getLeastUsed();
      if (!node) throw new Error('No available nodes for search');

      let result = await node.rest.loadTracks(identifier);
      let parsedResult = this._parseSearchResult(result, options.requester);

      // --- Universal Smart Resolve Fallback (Suwaku Exclusive) ---
      // If Lavalink fails to resolve high-tier sources (Spotify/Apple/YT Playlists), Suwaku takes over.
      if ((parsedResult.loadType === 'empty' || parsedResult.loadType === 'error' || parsedResult.tracks.length === 0) && isURL) {
        const resolved = await this._smartResolve(query, options.requester);
        if (resolved) parsedResult = resolved;
      }

      // Handle result limit
      if (options.limit && parsedResult.tracks.length > options.limit) {
        parsedResult.tracks = parsedResult.tracks.slice(0, options.limit);
      }

      // 3. Cache and Return
      this.cache.set(cacheKey, { data: parsedResult, timestamp: Date.now() });
      return parsedResult;
    } catch (error) {
      this.client.emit('debug', `Search failure for "${query}": ${error.message}`);
      return this._buildErrorResult(error);
    }
  }

  /**
   * Search YouTube specifically
   * @param {string} query - Query
   * @param {Object} [options] - Options
   * @returns {Promise<Object>} Search result
   */
  async searchYouTube(query, options = {}) {
    return this.search(query, { ...options, source: 'youtube' });
  }

  /**
   * Search Spotify specifically
   * @param {string} query - Query
   * @param {Object} [options] - Options
   * @returns {Promise<Object>} Search result
   */
  async searchSpotify(query, options = {}) {
    return this.search(query, { ...options, source: 'spotify' });
  }

  /**
   * Search SoundCloud specifically
   * @param {string} query - Query
   * @param {Object} [options] - Options
   * @returns {Promise<Object>} Search result
   */
  async searchSoundCloud(query, options = {}) {
    return this.search(query, { ...options, source: 'soundcloud' });
  }

  /**
   * Parse Lavalink v4 result into Suwaku format
   * @private
   */
  _parseSearchResult(result, requester) {
    const { loadType, data } = result;

    let tracks = [];
    let playlistInfo = null;
    let exception = null;

    const Track = Structure.get('Track');

    switch (loadType) {
      case 'track':
      case 'short':
        tracks = [new Track(data, requester)];
        break;
      case 'playlist':
        tracks = (data.tracks || []).map(t => new Track(t, requester));
        playlistInfo = {
          name: data.info?.name || 'Unknown Playlist',
          selectedTrack: data.info?.selectedTrack || 0,
          url: tracks[0]?.url || null,
          trackCount: tracks.length,
          duration: tracks.reduce((acc, track) => acc + (track.duration || 0), 0)
        };
        break;
      case 'search':
        // LavaSearch Support
        if (result.albums || result.artists || result.playlists || result.texts) {
          return {
            loadType: 'search',
            tracks: (result.tracks || []).map(t => new Track(t, requester)),
            albums: result.albums || [],
            artists: result.artists || [],
            playlists: result.playlists || [],
            texts: result.texts || [],
            pluginInfo: result.plugin || {}
          };
        }
        tracks = (data || []).map(t => new Track(t, requester));
        break;
      case 'error':
        exception = data;
        break;
      case 'empty':
      default:
        break;
    }

    return {
      loadType,
      tracks,
      playlistInfo,
      exception
    };
  }

  /**
   * Build an error result object
   * @private
   */
  _buildErrorResult(error) {
    return {
      loadType: 'error',
      tracks: [],
      playlistInfo: null,
      exception: {
        message: error.message,
        severity: 'COMMON',
        cause: error.stack
      }
    };
  }

  /**
   * Helper to detect URLs
   * @private
   */
  _isURL(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get search identifier with appropriate prefix
   * @private
   */
  _getSearchIdentifier(query, source) {
    const prefixes = ['ytsearch:', 'ytmsearch:', 'scsearch:', 'spsearch:', 'dzsearch:', 'amsearch:'];
    if (prefixes.some(p => query.startsWith(p))) return query;

    const sourceEngine = source || this.client.options.searchEngine || 'youtube';
    let prefix = SearchPrefix.YOUTUBE;

    switch (sourceEngine.toLowerCase()) {
      case 'youtube': case 'yt': prefix = SearchPrefix.YOUTUBE; break;
      case 'youtubemusic': case 'ytm': prefix = SearchPrefix.YOUTUBE_MUSIC; break;
      case 'soundcloud': case 'sc': prefix = SearchPrefix.SOUNDCLOUD; break;
      case 'spotify': case 'sp': prefix = SearchPrefix.SPOTIFY; break;
      case 'deezer': case 'dz': prefix = SearchPrefix.DEEZER; break;
      case 'applemusic': case 'am': prefix = SearchPrefix.APPLE_MUSIC; break;
    }

    return `${prefix}:${query}`;
  }

  /**
   * Autocomplete search for Discord (simplified)
   */
  async autocomplete(query, options = {}) {
    if (!query || query.trim().length === 0) return [];

    const results = await this.search(query, { ...options, limit: 10 });
    if (!results || !results.tracks) return [];

    return results.tracks.map(track => ({
      name: `${track.title} - ${track.author}`.slice(0, 100),
      value: track.url || track.title
    })).slice(0, 25);
  }

  /**
   * Check if a URL should trigger Smart Resolve
   * @private
   */
  _needsSmartResolve(url) {
    return /spotify\.com|apple\.com|deezer\.com|soundcloud\.com|youtube\.com\/playlist|tidal\.com/.test(url);
  }

  /**
   * Universal Smart Resolve (Suwaku Exclusive)
   * Converts restricted/plugin-only links into SuwakuTracks via external metadata
   * @private
   */
  async _smartResolve(url, requester) {
    if (url.includes('spotify.com')) return this._resolveSpotify(url, requester);
    if (url.includes('soundcloud.com')) return this._resolveSoundCloud(url, requester);
    if (url.includes('youtube.com/playlist')) return this._resolveYouTubePlaylist(url, requester);
    if (url.includes('deezer.com')) return this._resolveDeezer(url, requester);
    if (url.includes('apple.com')) return this._resolveAppleMusic(url, requester);
    if (url.includes('tidal.com')) return this._resolveTidal(url, requester);
    return null;
  }

  /**
   * Resolve YouTube Playlists (Force Playlist loading)
   * @private
   */
  async _resolveYouTubePlaylist(url, requester) {
    try {
      this.client.emit('debug', `Smart Resolve: Re-attempting YouTube Playlist load for: ${url}`);
      // If direct load failed, try to simplify the URL to just the list ID
      const listId = url.includes('list=') ? url.split('list=')[1].split('&')[0] : null;
      if (!listId) return null;

      const cleanUrl = `https://www.youtube.com/playlist?list=${listId}`;
      const node = this.client.nodes.getLeastUsed();
      const result = await node.rest.loadTracks(cleanUrl);

      const parsed = this._parseSearchResult(result, requester);
      if (parsed.tracks.length > 0) return parsed;

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve SoundCloud Sets (Smart Resolution)
   * @private
   */
  async _resolveSoundCloud(url, requester) {
    try {
      this.client.emit('debug', `Smart Resolve: SoundCloud extraction for: ${url}`);
      const node = this.client.nodes.getLeastUsed();

      // Lavalink handles SoundCloud naturally if configured, but let's check
      const result = await node.rest.loadTracks(url);
      const parsed = this._parseSearchResult(result, requester);

      if (parsed.loadType === 'playlist' || (parsed.tracks && parsed.tracks.length > 0)) {
        return parsed;
      }

      // If Lavalink fails (e.g. rate limit or geo-block), use oEmbed to get the title
      this.client.emit('debug', `Smart Resolve: Lavalink failed for SoundCloud, trying oEmbed fallback...`);
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const { data: metadata } = await axios.get(oembedUrl);

      if (metadata.title) {
        this.client.emit('debug', `Smart Resolve: Found SoundCloud title "${metadata.title}", searching...`);
        // If it's a playlist (set), oEmbed title might contain "Sets" or similar
        // We search it on YouTube Music as the ultimate fallback
        return this.search(metadata.title, { requester, source: 'youtubemusic' });
      }

      return this._resolveGenericMetadata(url, requester);
    } catch (error) {
      this.client.emit('debug', `Smart Resolve SoundCloud Warning: ${error.message}`);
      return this._resolveGenericMetadata(url, requester);
    }
  }

  /**
   * Resolve Deezer Playlists/Albums (Smart Resolution)
   * @private
   */
  async _resolveDeezer(url, requester) {
    try {
      const type = url.includes('/playlist/') ? 'playlist' : url.includes('/album/') ? 'album' : 'track';
      const id = url.split('/').pop()?.split('?')[0];

      this.client.emit('debug', `Smart Resolve: Fetching Deezer ${type} data for ID: ${id}`);

      const apiUrl = `https://api.deezer.com/${type}/${id}`;
      const { data: result } = await axios.get(apiUrl);

      if (!result || (type !== 'track' && !result.tracks)) return null;

      const playlistName = result.title || result.name || 'Deezer Content';
      const rawTracks = type === 'track' ? [result] : result.tracks.data;

      this.client.emit('debug', `Smart Resolve: Found ${rawTracks.length} tracks in Deezer ${type}`);

      const tracks = [];
      const batchSize = 10;

      for (let i = 0; i < rawTracks.length; i += batchSize) {
        const chunk = rawTracks.slice(i, i + batchSize);
        const resolvedChunk = await Promise.all(chunk.map(async (t) => {
          const query = `${t.title} ${t.artist?.name || ''}`;
          const res = await this.search(query, { source: 'youtubemusic', limit: 1 });
          return res.tracks?.[0] || null;
        }));
        tracks.push(...resolvedChunk.filter(t => t !== null));

        if (i + batchSize < rawTracks.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      return {
        loadType: type === 'track' ? 'track' : 'playlist',
        tracks,
        playlistInfo: type === 'track' ? null : {
          name: playlistName,
          selectedTrack: 0,
          url: url
        },
        exception: null
      };
    } catch (error) {
      this.client.emit('debug', `Smart Resolve Deezer Error: ${error.message}`);
      return this._resolveGenericMetadata(url, requester);
    }
  }

  /**
   * Resolve Apple Music Playlists/Albums (Smart Resolution)
   * @private
   */
  async _resolveAppleMusic(url, requester) {
    try {
      this.client.emit('debug', `Smart Resolve: Fetching Apple Music metadata for: ${url}`);

      // Apple Music is best resolved via oEmbed for initial metadata
      const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
      const { data: metadata } = await axios.get(oembedUrl);

      if (!metadata.title) return this._resolveGenericMetadata(url, requester);

      const playlistName = metadata.title;
      this.client.emit('debug', `Smart Resolve: Found Apple Music title "${playlistName}", attempting scraper...`);

      // We scrape the page for track names if it looks like a playlist/album
      const { data: html } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Simple regex to find song titles in scripts or meta
      const trackMatches = [...html.matchAll(/"name":"([^"]+)"/g)];
      let trackNames = [...new Set(trackMatches.map(m => m[1]))].slice(0, 100);

      // Filter out common UI strings if we accidentally caught them
      trackNames = trackNames.filter(name =>
        name.length > 2 &&
        !['Apple Music', 'iTunes', 'Playlist', 'Album'].includes(name)
      );

      if (trackNames.length === 0) {
        return this.search(playlistName, { requester });
      }

      this.client.emit('debug', `Smart Resolve: Scraped ${trackNames.length} tracks from Apple Music`);

      const tracks = [];
      const batchSize = 10;

      for (let i = 0; i < trackNames.length; i += batchSize) {
        const chunk = trackNames.slice(i, i + batchSize);
        const resolvedChunk = await Promise.all(chunk.map(async (name) => {
          const res = await this.search(name, { source: 'youtubemusic', limit: 1 });
          return res.tracks?.[0] || null;
        }));
        tracks.push(...resolvedChunk.filter(t => t !== null));

        if (i + batchSize < trackNames.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      return {
        loadType: trackNames.length === 1 ? 'track' : 'playlist',
        tracks,
        playlistInfo: trackNames.length === 1 ? null : {
          name: playlistName,
          selectedTrack: 0,
          url: url
        },
        exception: null
      };

    } catch (error) {
      this.client.emit('debug', `Smart Resolve Apple Music Error: ${error.message}`);
      return this._resolveGenericMetadata(url, requester);
    }
  }

  /**
   * Resolve Apple Music/Deezer/Global (Smart Metadata)
   * @private
   */
  async _resolveGenericMetadata(url, requester) {
    try {
      this.client.emit('debug', `Smart Resolve: Fetching Global metadata for: ${url}`);
      // Most services support oEmbed for metadata extraction
      const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
      const { data: metadata } = await axios.get(oembedUrl);

      if (metadata.title) {
        this.client.emit('debug', `Smart Resolve: Found title "${metadata.title}", searching...`);
        return this.search(`${metadata.title} ${metadata.author_name || ''}`, { requester });
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Resolve Tidal Playlists/Albums (Smart Resolution)
   * @private
   */
  async _resolveTidal(url, requester) {
    try {
      this.client.emit('debug', `Smart Resolve: Fetching Tidal metadata for: ${url}`);
      
      const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
      const { data: metadata } = await axios.get(oembedUrl);

      if (!metadata.title) return this._resolveGenericMetadata(url, requester);

      const playlistName = metadata.title;
      this.client.emit('debug', `Smart Resolve: Found Tidal title "${playlistName}", attempting scraper...`);

      const { data: html } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Regex for Tidal track names in their modern structure
      const trackMatches = [...html.matchAll(/"name":"([^"]+)"/g)];
      let trackNames = [...new Set(trackMatches.map(m => m[1]))].slice(0, 100);

      // Filter out common Tidal UI/Marketing strings
      trackNames = trackNames.filter(name => 
        name.length > 2 && 
        !['TIDAL', 'Playlist', 'Album', 'High Fidelity Music'].includes(name)
      );

      if (trackNames.length === 0) {
        return this.search(playlistName, { requester });
      }

      this.client.emit('debug', `Smart Resolve: Scraped ${trackNames.length} tracks from Tidal`);

      const tracks = [];
      const batchSize = 10;

      for (let i = 0; i < trackNames.length; i += batchSize) {
        const chunk = trackNames.slice(i, i + batchSize);
        const resolvedChunk = await Promise.all(chunk.map(async (name) => {
          const res = await this.search(name, { source: 'youtubemusic', limit: 1 });
          return res.tracks?.[0] || null;
        }));
        tracks.push(...resolvedChunk.filter(t => t !== null));

        if (i + batchSize < trackNames.length) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      return {
        loadType: trackNames.length === 1 ? 'track' : 'playlist',
        tracks,
        playlistInfo: trackNames.length === 1 ? null : {
          name: playlistName,
          selectedTrack: 0,
          url: url
        },
        exception: null
      };

    } catch (error) {
      this.client.emit('debug', `Smart Resolve Tidal Error: ${error.message}`);
      return this._resolveGenericMetadata(url, requester);
    }
  }

  /**
   * Resolve Spotify metadata and tracks (Smart Resolution - Scraper Engine)
   * @private
   */
  async _resolveSpotify(url, requester) {
    try {
      const type = url.split('/')[3];
      const id = url.split('/')[4]?.split('?')[0];

      this.client.emit('debug', `Smart Resolve: Fetching Spotify ${type} data for ID: ${id}`);

      // Use oEmbed to get basic info
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
      const { data: metadata } = await axios.get(oembedUrl);

      const playlistName = metadata.title || 'Spotify Content';

      // For single tracks, we can easily resolve by searching the title
      if (type === 'track') {
        const searchResult = await this.search(`${metadata.title} ${metadata.author_name}`, { requester });
        return searchResult;
      }

      // For playlists/albums, we need to scrape the embed page to get track list without API keys
      // This is the "Suwaku Secret Sauce" for plugin-less nodes
      const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      const { data: html } = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Look for the metadata JSON in different possible script tags
      const match = html.match(/<script id="(resourceConfig|initial-state|session)" type="text\/json">(.+?)<\/script>/) ||
        html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);

      if (!match) {
        this.client.emit('debug', `Smart Resolve: Could not find data script tag in embed for ${id}`);
        return null;
      }

      const jsonContent = match[2] || match[1];
      const state = JSON.parse(jsonContent);

      // Try multiple common paths in Spotify's internal state structure
      let trackEntries = [];
      if (state.entities?.items?.[id]?.content?.items) {
        trackEntries = state.entities.items[id].content.items;
      } else if (state.data?.entity?.items) {
        trackEntries = state.data.entity.items;
      } else if (state.props?.pageProps?.state?.data?.entity?.items) {
        trackEntries = state.props.pageProps.state.data.entity.items;
      } else if (state.items) {
        trackEntries = state.items;
      }

      const trackData = trackEntries.map(i => i.track || i).filter(t => t && t.name);

      if (trackData.length === 0) {
        // Last ditch effort: try to find track names in the HTML itself via regex
        const trackMatches = [...html.matchAll(/"name":"([^"]+)"/g)];
        if (trackMatches.length > 5) {
          const uniqueNames = [...new Set(trackMatches.map(m => m[1]))].slice(0, 100);
          trackData.push(...uniqueNames.map(name => ({ name })));
        } else {
          this.client.emit('debug', `Smart Resolve: Failed to extract tracks from script tag for ${id}`);
          return null;
        }
      }

      this.client.emit('debug', `Smart Resolve: Found ${trackData.length} potential tracks in Spotify ${type}`);

      // Convert Spotify tracks to search promises
      // Track resolution in chunks to avoid rate limits and too many parallel requests
      const tracks = [];
      const batchSize = 10; // Increased batch size for elite performance

      this.client.emit('debug', `Smart Resolve: Beginning resolution of ${trackData.length} tracks...`);

      for (let i = 0; i < trackData.length; i += batchSize) {
        const chunk = trackData.slice(i, i + batchSize);
        const resolvedChunk = await Promise.all(chunk.map(async (track) => {
          const name = track.name;
          const artist = track.artists?.[0]?.name || '';

          // Optimization: skip search if track already has enough info or try a fast search
          const res = await this.search(`${name} ${artist}`, {
            source: 'youtubemusic',
            limit: 1,
            node: options.node // Reuse node if provided
          });
          return res.tracks?.[0] || null;
        }));

        tracks.push(...resolvedChunk.filter(t => t !== null));

        // Progress update for large playlists
        if (trackData.length > 20 && (i + batchSize) % 20 === 0) {
          this.client.emit('debug', `Smart Resolve: Processed ${i + batchSize}/${trackData.length} tracks...`);
        }

        // Brief pause to avoid overwhelming Lavalink REST/YouTube Music
        if (i + batchSize < trackData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        loadType: 'playlist',
        tracks,
        playlistInfo: {
          name: playlistName,
          selectedTrack: 0,
          url: url
        },
        exception: null
      };

    } catch (error) {
      this.client.emit('debug', `Smart Resolve Error: ${error.message}`);
      return null;
    }
  }
}

export { SearchManager };