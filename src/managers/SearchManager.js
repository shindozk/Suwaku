/**
 * Search Manager - Handles multi-source music search
 * @module managers/SearchManager
 */

import { SuwakuTrack } from '../structures/SuwakuTrack.js';
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
   * Search for tracks with fallback support
   * @param {string} query - Search query or URL
   * @param {Object} [options] - Search options
   * @param {string} [options.source] - Primary search source (youtube, soundcloud, spotify, etc)
   * @param {string} [options.engine] - Search engine (youtube, youtube_music, soundcloud)
   * @param {string} [options.node] - Preferred node identifier
   * @param {Array<string>} [options.fallbackSources] - Fallback sources to try if primary fails
   * @param {number} [options.limit=10] - Maximum results
   * @param {Object} [options.requester] - User who requested
   * @returns {Promise<Object>} Search result object with type, tracks, and optional playlistName
   */
  async search(query, options = {}) {
    validateNonEmptyString(query, 'Search query');

    // Detect if query is a URL
    const isURL = this._isURL(query);

    // Auto-detect source from URL if it's a URL and no source is specified
    let source = options.source || options.engine;
    if (isURL && !source) {
      const detectedSource = this._detectSourceFromURL(query);
      if (detectedSource) {
        source = detectedSource;

        // Detect if it's a playlist
        const playlistInfo = this.detectPlaylistInfo(query);
        if (playlistInfo && playlistInfo.isPlaylist) {
          this.client.emit('debug', `Auto-detected ${playlistInfo.source} ${playlistInfo.type}: ${query}`);
        } else {
          this.client.emit('debug', `Auto-detected source from URL: ${source}`);
        }
      }
    }

    // Use detected source, provided source, or fall back to client's default search engine
    const initialSource = source || this.client.options.searchEngine || 'youtube';
    const limit = options.limit || 10;

    // Build sources to try
    const enableFallback = this.client.options.enableSourceFallback !== false;
    const fallbackSources = options.fallbackSources || ['youtubemusic', 'soundcloud', 'spotify'];
    const sourcesToTry = enableFallback ? [initialSource, ...fallbackSources.filter(s => s !== initialSource)] : [initialSource];

    this.client.emit('debug', `Searching "${query}" with sources: ${sourcesToTry.join(', ')}`);

    // Try each source
    for (const currentSource of sourcesToTry) {
      try {
        // Check cache
        const cacheKey = `${currentSource}:${query}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) {
          this.client.emit('debug', `Cache hit for ${currentSource}: ${query}`);
          return this._buildSearchResult('SEARCH', cached.slice(0, limit));
        }

        let identifier = query;

        // Add search prefix if not a URL
        if (!isURL) {
          identifier = this._getSearchIdentifier(query, currentSource);
        }

        // Get node - prefer specified node, otherwise use least used
        let node;
        if (options.node) {
          node = this.client.nodes.get(options.node);
          if (!node || !node.connected) {
            this.client.emit('debug', `Specified node ${options.node} not available, using least used`);
            node = this.client.nodes.getLeastUsed();
          }
        } else {
          node = this.client.nodes.getLeastUsed();
        }

        if (!node) {
          this.client.emit('debug', `No available nodes for ${currentSource}`);
          continue;
        }

        this.client.emit('debug', `Using node ${node.identifier} for search`);

        // Load tracks from Lavalink
        const result = await node.rest.loadTracks(identifier);

        // Parse results
        const parsed = this._parseSearchResult(result, options.requester);

        // Check if we got valid results
        if (parsed.tracks && parsed.tracks.length > 0) {
          this.client.emit('debug', `Found ${parsed.tracks.length} tracks from ${currentSource} (type: ${parsed.type})`);

          // Handle playlist vs regular results
          if (parsed.type === 'PLAYLIST') {
            // For playlists, respect maxPlaylistSize option
            const maxSize = this.client.options.maxPlaylistSize || 500;
            const limitedTracks = parsed.tracks.slice(0, maxSize);

            // Cache playlist
            this._addToCache(cacheKey, limitedTracks);

            return this._buildSearchResult('PLAYLIST', limitedTracks, parsed.playlistName);
          }

          // Regular search results
          const tracks = parsed.tracks.slice(0, limit);

          // Cache results
          this._addToCache(cacheKey, tracks);

          return this._buildSearchResult(parsed.type, tracks);
        }

        this.client.emit('debug', `No results from ${currentSource}, trying next source`);

      } catch (error) {
        this.client.emit('debug', `Error searching ${currentSource}: ${error.message}`);
        continue;
      }
    }

    // No results from any source
    this.client.emit('debug', `No results found for query: ${query}`);
    return this._buildSearchResult('SEARCH', []);
  }

  /**
   * Smart search with fallback across multiple platforms
   * Searches for the best matching track across different sources
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @param {Object} [options.requester] - User who requested
   * @param {Array<string>} [options.sources] - Sources to try (in order)
   * @param {number} [options.similarityThreshold=0.6] - Minimum similarity score (0-1)
   * @returns {Promise<SuwakuTrack|null>} Best matching track or null
   */
  async smartSearch(query, options = {}) {
    validateNonEmptyString(query, 'Search query');

    // Default sources to try in order
    const sources = options.sources || ['youtube', 'youtubemusic', 'soundcloud', 'spotify'];
    const similarityThreshold = options.similarityThreshold || 0.6;
    const requester = options.requester;

    this.client.emit('debug', `Smart search for: "${query}" across ${sources.length} sources`);

    let bestMatch = null;
    let bestScore = 0;

    // Try each source
    for (const source of sources) {
      try {
        this.client.emit('debug', `Trying source: ${source}`);

        // Search with limit of 10
        const result = await this.search(query, {
          source,
          limit: 10,
          requester
        });

        if (!result || !result.tracks || result.tracks.length === 0) {
          this.client.emit('debug', `No results from ${source}`);
          continue;
        }

        // Find best match in results
        for (const track of result.tracks) {
          const score = this._calculateSimilarity(query, track.title);

          this.client.emit('debug', `Track: "${track.title}" - Score: ${score.toFixed(2)}`);

          if (score > bestScore && score >= similarityThreshold) {
            bestScore = score;
            bestMatch = track;
          }
        }

        // If we found a very good match (>0.8), stop searching
        if (bestScore > 0.8) {
          this.client.emit('debug', `Found excellent match (${bestScore.toFixed(2)}): "${bestMatch.title}"`);
          break;
        }

      } catch (error) {
        this.client.emit('debug', `Error searching ${source}: ${error.message}`);
        continue;
      }
    }

    if (bestMatch) {
      this.client.emit('debug', `Best match found: "${bestMatch.title}" with score ${bestScore.toFixed(2)}`);
    } else {
      this.client.emit('debug', `No suitable match found for: "${query}"`);
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between query and title
   * Uses Levenshtein distance and other heuristics
   * @param {string} query - Search query
   * @param {string} title - Track title
   * @returns {number} Similarity score (0-1)
   * @private
   */
  _calculateSimilarity(query, title) {
    if (!query || !title) return 0;

    // Normalize strings
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedTitle = title.toLowerCase().trim();

    // Exact match
    if (normalizedQuery === normalizedTitle) {
      return 1.0;
    }

    // Check if title contains query
    if (normalizedTitle.includes(normalizedQuery)) {
      return 0.9;
    }

    // Check if query contains title
    if (normalizedQuery.includes(normalizedTitle)) {
      return 0.85;
    }

    // Calculate Levenshtein distance
    const distance = this._levenshteinDistance(normalizedQuery, normalizedTitle);
    const maxLength = Math.max(normalizedQuery.length, normalizedTitle.length);
    const similarity = 1 - (distance / maxLength);

    // Bonus for matching words
    const queryWords = normalizedQuery.split(/\s+/);
    const titleWords = normalizedTitle.split(/\s+/);
    let matchingWords = 0;

    for (const qWord of queryWords) {
      if (qWord.length < 3) continue; // Skip short words
      for (const tWord of titleWords) {
        if (tWord.includes(qWord) || qWord.includes(tWord)) {
          matchingWords++;
          break;
        }
      }
    }

    const wordBonus = (matchingWords / Math.max(queryWords.length, 1)) * 0.2;

    return Math.min(similarity + wordBonus, 1.0);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   * @private
   */
  _levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Search YouTube
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @returns {Promise<Array<SuwakuTrack>>} Search results
   */
  async searchYouTube(query, options = {}) {
    return this.search(query, { ...options, source: 'youtube' });
  }

  /**
   * Search SoundCloud
   * @param {string} query - Search query
   * @param {Object} [options] - Search options
   * @returns {Promise<Array<SuwakuTrack>>} Search results
   */
  async searchSoundCloud(query, options = {}) {
    return this.search(query, { ...options, source: 'soundcloud' });
  }

  /**
   * Load a playlist
   * @param {string} url - Playlist URL
   * @param {Object} [options] - Load options
   * @returns {Promise<Object>} Playlist data with tracks
   */
  async loadPlaylist(url, options = {}) {
    validateNonEmptyString(url, 'Playlist URL');

    const node = this.client.nodes.getLeastUsed();
    if (!node) {
      throw new Error('No available nodes for playlist loading');
    }

    const result = await node.rest.loadTracks(url);

    if (result.loadType !== 'playlist') {
      throw new Error('URL is not a playlist');
    }

    const tracks = this._parseSearchResult(result, options.requester);

    return {
      name: result.data?.info?.name || 'Unknown Playlist',
      tracks,
      selectedTrack: result.data?.info?.selectedTrack || 0
    };
  }

  /**
   * Detect source from URL
   * @param {string} url - URL to check
   * @returns {string|null} Detected source or null
   */
  detectSource(url) {
    if (!this._isURL(url)) return null;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return TrackSource.YOUTUBE;
      }
      if (hostname.includes('soundcloud.com')) {
        return TrackSource.SOUNDCLOUD;
      }
      if (hostname.includes('spotify.com')) {
        return TrackSource.SPOTIFY;
      }

      return TrackSource.HTTP;
    } catch {
      return null;
    }
  }

  /**
   * Get search identifier with prefix
   * @param {string} query - Search query
   * @param {string} source - Search source
   * @returns {string} Search identifier
   * @private
   */
  _getSearchIdentifier(query, source) {
    let prefix = SearchPrefix.YOUTUBE;

    switch (source.toLowerCase()) {
      case 'soundcloud':
      case 'sc':
        prefix = SearchPrefix.SOUNDCLOUD;
        break;
      case 'youtubemusic':
      case 'ytmusic':
      case 'ytm':
        prefix = SearchPrefix.YOUTUBE_MUSIC;
        break;
      case 'spotify':
      case 'sp':
        prefix = SearchPrefix.SPOTIFY;
        break;
      case 'deezer':
      case 'dz':
        prefix = SearchPrefix.DEEZER;
        break;
      case 'applemusic':
      case 'apple':
      case 'am':
        prefix = SearchPrefix.APPLE_MUSIC;
        break;
      case 'youtube':
      case 'yt':
      default:
        prefix = SearchPrefix.YOUTUBE;
        break;
    }

    return `${prefix}:${query}`;
  }

  /**
   * Check if string is a URL
   * @param {string} str - String to check
   * @returns {boolean} Whether string is a URL
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
   * Detect source from URL
   * @param {string} url - URL to check
   * @returns {string|null} Detected source name
   * @private
   */
  _detectSourceFromURL(url) {
    try {
      const lowerUrl = url.toLowerCase();

      // YouTube (including playlists)
      if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.startsWith('yt:')) {
        // Check if it's YouTube Music
        if (lowerUrl.includes('music.youtube.com')) {
          return 'youtubemusic';
        }
        return 'youtube';
      }

      // SoundCloud (including playlists and sets)
      if (lowerUrl.includes('soundcloud.com') || lowerUrl.startsWith('sc:') || lowerUrl.startsWith('scsearch:')) {
        return 'soundcloud';
      }

      // Spotify (tracks, albums, playlists)
      if (lowerUrl.includes('spotify.com') || lowerUrl.startsWith('spotify:') || lowerUrl.startsWith('spsearch:')) {
        return 'spotify';
      }

      // Deezer (tracks, albums, playlists)
      if (lowerUrl.includes('deezer.com') || lowerUrl.startsWith('dz:') || lowerUrl.startsWith('dzsearch:')) {
        return 'deezer';
      }

      // Apple Music (tracks, albums, playlists)
      if (lowerUrl.includes('music.apple.com') || lowerUrl.startsWith('am:') || lowerUrl.startsWith('amsearch:')) {
        return 'applemusic';
      }

      // Tidal
      if (lowerUrl.includes('tidal.com')) {
        return 'tidal';
      }

      // Bandcamp
      if (lowerUrl.includes('bandcamp.com')) {
        return 'bandcamp';
      }

      // Twitch
      if (lowerUrl.includes('twitch.tv')) {
        return 'twitch';
      }

      // Vimeo
      if (lowerUrl.includes('vimeo.com')) {
        return 'vimeo';
      }

      // For direct URLs (mp3, ogg, etc), return null to use URL as-is
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parse Lavalink search result
   * @param {Object} result - Lavalink result
   * @param {Object} [requester] - User who requested
   * @returns {Object} Parsed result with type, tracks, and optional playlistName
   * @private
   */
  _parseSearchResult(result, requester) {
    if (!result || result.loadType === 'empty' || result.loadType === 'error') {
      this.client.emit('debug', `Search returned no results: ${result?.loadType || 'no result'}`);
      return { type: 'SEARCH', tracks: [] };
    }

    let tracks = [];
    let type = 'SEARCH';
    let playlistName = undefined;

    this.client.emit('debug', `Parsing search result with loadType: ${result.loadType}`);

    switch (result.loadType) {
      case 'track':
        type = 'TRACK';
        tracks = [result.data];
        break;
      case 'search':
        type = 'SEARCH';
        tracks = result.data || [];
        break;
      case 'playlist':
        type = 'PLAYLIST';
        tracks = result.data?.tracks || [];
        playlistName = result.data?.info?.name || 'Unknown Playlist';
        break;
      default:
        this.client.emit('debug', `Unknown loadType: ${result.loadType}`);
        type = 'SEARCH';
        tracks = [];
    }

    const parsedTracks = tracks
      .filter(track => track && track.info) // Filter out null/invalid tracks
      .map(track => new SuwakuTrack(track, requester));

    return {
      type,
      tracks: parsedTracks,
      playlistName
    };
  }

  /**
   * Build search result object
   * @param {string} type - Result type (TRACK, PLAYLIST, SEARCH)
   * @param {Array<SuwakuTrack>} tracks - Tracks array
   * @param {string} [playlistName] - Playlist name (if applicable)
   * @returns {Object} Search result object
   * @private
   */
  _buildSearchResult(type, tracks, playlistName) {
    return {
      type,
      tracks,
      playlistName
    };
  }

  /**
   * Get result from cache
   * @param {string} key - Cache key
   * @returns {Array<SuwakuTrack>|null} Cached result or null
   * @private
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.tracks;
  }

  /**
   * Add result to cache
   * @param {string} key - Cache key
   * @param {Array<SuwakuTrack>} tracks - Tracks to cache
   * @private
   */
  _addToCache(key, tracks) {
    this.cache.set(key, {
      tracks,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get best node for a specific source
   * @param {string} source - Source name
   * @returns {LavalinkNode|null} Best node or null
   */
  getBestNodeForSource(source) {
    const nodes = this.client.nodes.getConnected();
    if (nodes.length === 0) return null;

    // For now, just return least used
    // In the future, could check node capabilities
    return this.client.nodes.getLeastUsed();
  }

  /**
   * Check if a source is supported by any node
   * @param {string} source - Source name
   * @returns {boolean} Whether source is supported
   */
  isSourceSupported(source) {
    const nodes = this.client.nodes.getConnected();
    if (nodes.length === 0) return false;

    // All Lavalink nodes support basic sources
    const basicSources = ['youtube', 'youtubemusic', 'soundcloud'];
    if (basicSources.includes(source.toLowerCase())) {
      return true;
    }

    // For other sources, assume supported if any node is connected
    // In the future, could check node info/capabilities
    return nodes.length > 0;
  }

  /**
   * Get supported sources
   * @returns {Array<string>} List of supported sources
   */
  getSupportedSources() {
    return [
      'youtube',
      'youtubemusic',
      'soundcloud',
      'spotify',
      'deezer',
      'applemusic',
      'http'
    ];
  }

  /**
   * Check if URL is a Spotify URL
   * @param {string} url - URL to check
   * @returns {boolean} Whether URL is from Spotify
   */
  isSpotifyUrl(url) {
    return url.includes('spotify.com') || url.startsWith('spotify:');
  }

  /**
   * Check if URL is a playlist URL
   * @param {string} url - URL to check
   * @returns {boolean} Whether URL is a playlist
   */
  isPlaylistUrl(url) {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('/playlist') ||
      lowerUrl.includes('list=') ||
      lowerUrl.includes('/sets/') ||  // SoundCloud sets
      lowerUrl.includes('/album/') ||  // Albums
      lowerUrl.includes('spotify:playlist:') ||
      lowerUrl.includes('spotify:album:')
    );
  }

  /**
   * Detect playlist info from URL
   * @param {string} url - URL to check
   * @returns {Object|null} Playlist info or null
   */
  detectPlaylistInfo(url) {
    const lowerUrl = url.toLowerCase();
    const source = this._detectSourceFromURL(url);

    if (!source) return null;

    const info = {
      source,
      isPlaylist: false,
      type: 'track'
    };

    // YouTube playlist
    if (source === 'youtube' && lowerUrl.includes('list=')) {
      info.isPlaylist = true;
      info.type = 'playlist';
    }

    // Spotify
    if (source === 'spotify') {
      if (lowerUrl.includes('/playlist/') || lowerUrl.includes('spotify:playlist:')) {
        info.isPlaylist = true;
        info.type = 'playlist';
      } else if (lowerUrl.includes('/album/') || lowerUrl.includes('spotify:album:')) {
        info.isPlaylist = true;
        info.type = 'album';
      }
    }

    // SoundCloud sets
    if (source === 'soundcloud' && lowerUrl.includes('/sets/')) {
      info.isPlaylist = true;
      info.type = 'playlist';
    }

    // Deezer
    if (source === 'deezer') {
      if (lowerUrl.includes('/playlist/')) {
        info.isPlaylist = true;
        info.type = 'playlist';
      } else if (lowerUrl.includes('/album/')) {
        info.isPlaylist = true;
        info.type = 'album';
      }
    }

    // Apple Music
    if (source === 'applemusic') {
      if (lowerUrl.includes('/playlist/')) {
        info.isPlaylist = true;
        info.type = 'playlist';
      } else if (lowerUrl.includes('/album/')) {
        info.isPlaylist = true;
        info.type = 'album';
      }
    }

    return info;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Get search statistics
   * @returns {Object} Search statistics
   */
  getStats() {
    return {
      cache: this.getCacheStats(),
      supportedSources: this.getSupportedSources(),
      availableNodes: this.client.nodes.getConnected().length
    };
  }
}

export { SearchManager };
