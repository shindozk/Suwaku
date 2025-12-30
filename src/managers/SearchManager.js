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
   * Search for tracks by mood/vibe (Suwaku Exclusive Innovation)
   * Maps abstract moods to specific search keywords and audio profiles
   * @param {string} mood - The mood (e.g., 'happy', 'sad', 'lofi', 'workout')
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

    // Attach suggested preset to results so the bot can apply it
    if (results && moodData.preset) {
      results.suggestedPreset = moodData.preset;
    }

    return results;
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

    const isURL = this._isURL(query);
    const hasPrefix = ['ytsearch:', 'ytmsearch:', 'scsearch:', 'spsearch:', 'dzsearch:', 'amsearch:'].some(p => query.startsWith(p));
    const searchSource = options.source || this.client.options.searchEngine || 'spotify';
    const playbackEngine = options.engine || this.client.options.playbackEngine || 'youtubemusic';
    const limit = options.limit || 10;
    const requester = options.requester;

    this.client.emit('debug', `Search initiating. Mode: ${isURL ? 'URL' : 'Text'}. Search Source: ${searchSource}. Playback Engine: ${playbackEngine}`);

    // PHASE 1: IDENTIFICATION
    // We try to get the track's name and artist first, unless it's a URL or already has a prefix
    let searchName = query;
    let originalResult = null;
    let identified = false;

    if (!isURL && !hasPrefix) {
      try {
        const identifier = this._getSearchIdentifier(query, searchSource);
        const node = this.client.nodes.getLeastUsed();
        if (!node) throw new Error('No nodes available');

        this.client.emit('debug', `Phase 1: Identifying track via ${searchSource} using ${identifier}`);
        const result = await node.rest.loadTracks(identifier);
        
        if (result && result.loadType !== 'empty' && result.loadType !== 'error') {
          const parsed = this._parseSearchResult(result, requester);
          if (parsed.tracks.length > 0) {
            const firstTrack = parsed.tracks[0];
            
            // ADVANCED: Check if identification is reliable
            const identificationScore = this._calculateSimilarity(query, firstTrack.title);
            this.client.emit('debug', `Phase 1: Identification similarity score: ${identificationScore.toFixed(2)}`);

            // If identification is very poor (< 0.3), use raw query instead
            if (identificationScore < 0.3) {
              this.client.emit('debug', `Phase 1 Warning: Identification score too low, using raw query instead`);
            } else {
              searchName = `${firstTrack.title} ${firstTrack.author}`;
              originalResult = parsed;
              identified = true;
              this.client.emit('debug', `Phase 1 Success: Identified as "${searchName}" (Type: ${parsed.type})`);
            }
          }
        }
      } catch (error) {
        this.client.emit('debug', `Phase 1 Warning: Identification failed, falling back to raw query. Error: ${error.message}`);
      }
    } else {
      this.client.emit('debug', `Phase 1: Skipping identification for ${isURL ? 'URL' : 'prefixed query'}`);
    }

    // PHASE 2: RESOLUTION (The actual playback engine search)
    // If we identified a name, or if the input was text/prefixed, we search on the playback engine
    if (identified || !isURL) {
      try {
        const node = this.client.nodes.getLeastUsed();
        
        // AQUAlink Feature: Use ISRC for more precise matching if available
        let playbackIdentifier;
        const firstTrack = originalResult?.tracks[0];
        
        if (firstTrack?.isrc && (playbackEngine === 'youtubemusic' || playbackEngine === 'youtube')) {
          this.client.emit('debug', `Phase 2: Using ISRC "${firstTrack.isrc}" for precise resolution on ${playbackEngine}`);
          playbackIdentifier = firstTrack.isrc; // Some Lavalink sources support searching by ISRC directly
        } else {
          playbackIdentifier = this._getSearchIdentifier(searchName, playbackEngine);
        }
        
        this.client.emit('debug', `Phase 2: Resolving for playback via ${playbackEngine} using "${playbackIdentifier}"`);
        let playbackResult = await node.rest.loadTracks(playbackIdentifier);

        // Fallback if ISRC search failed
        if ((!playbackResult || playbackResult.loadType === 'empty') && firstTrack?.isrc) {
          this.client.emit('debug', `Phase 2 Fallback: ISRC search failed, falling back to name search: "${searchName}"`);
          playbackIdentifier = this._getSearchIdentifier(searchName, playbackEngine);
          playbackResult = await node.rest.loadTracks(playbackIdentifier);
        }

        if (playbackResult && playbackResult.loadType !== 'empty' && playbackResult.loadType !== 'error') {
          const parsed = this._parseSearchResult(playbackResult, requester);
          
          if (parsed.tracks.length > 0) {
            this.client.emit('debug', `Phase 2 Success: Found ${parsed.tracks.length} tracks on ${playbackEngine}`);
            
            // If the original was a playlist, we return the original (Spotify/etc) 
            // because we want the whole playlist metadata, and Lavalink will handle 
            // the mirroring of each track during playback if configured.
            if (originalResult && originalResult.type === 'PLAYLIST') {
               return originalResult;
            }

            // ADVANCED SEARCH: Robust title matching logic
            // We want to ensure the top result is the most relevant to what the user actually typed
            const normalizedQuery = query.toLowerCase().trim();
            const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);

            // Sort results by similarity score to the ORIGINAL user query
            const scoredTracks = parsed.tracks.map(track => {
              const title = (track.title || '').toLowerCase();
              const author = (track.author || '').toLowerCase();
              const fullText = `${title} ${author}`;
              
              let score = 0;
              
              // 1. Exact title match (absolute highest priority)
              if (title === normalizedQuery) score += 500;
              
              // 2. Exact title + author match (very high priority)
              if (fullText === normalizedQuery || `${author} ${title}` === normalizedQuery) score += 400;

              // 3. Title contains the exact query
              if (title.includes(normalizedQuery)) score += 200;
              
              // 4. Title starts with query
              if (title.startsWith(normalizedQuery)) score += 100;
              
              // 5. Word matching (Fuzzy)
              let matchedWords = 0;
              for (const word of queryWords) {
                if (fullText.includes(word)) matchedWords++;
              }
              const wordMatchRatio = matchedWords / Math.max(queryWords.length, 1);
              score += wordMatchRatio * 150;
              
              // 6. Penalty for "karaoke", "instrumental", "cover", "remix" if not in query
              const filters = ['karaoke', 'instrumental', 'cover', 'remix', 'parodia', 'paródia', 'clipe oficial', 'official video'];
              for (const filter of filters) {
                if (fullText.includes(filter) && !normalizedQuery.includes(filter)) {
                  score -= 50;
                }
              }

              // 7. Small bonus for official content if not specified
              if ((fullText.includes('official') || fullText.includes('clipe')) && !normalizedQuery.includes('cover')) {
                score += 10;
              }

              return { track, score };
            });

            // Sort by score descending
            scoredTracks.sort((a, b) => b.score - a.score);
            
            const bestResult = scoredTracks[0];
            this.client.emit('debug', `Advanced Search: Top result score: ${bestResult.score.toFixed(2)} - "${bestResult.track.title}"`);

            // If the best result is still very poor and we have a fallback, maybe we should've tried another engine
            // But for now, we just return the sorted results
            return this._buildSearchResult('SEARCH', scoredTracks.map(st => st.track).slice(0, limit));
          }
        }
      } catch (error) {
        this.client.emit('debug', `Phase 2 Error: Resolution failed. Error: ${error.message}`);
      }
    } else if (isURL) {
      // If it's a URL and we couldn't identify it (Phase 1 failed), 
      // we try to load it directly as a last resort in Phase 2
      try {
        this.client.emit('debug', `Phase 2: Direct load attempt for unidentified URL: ${query}`);
        const node = this.client.nodes.getLeastUsed();
        const directResult = await node.rest.loadTracks(query);
        if (directResult && directResult.loadType !== 'empty' && directResult.loadType !== 'error') {
          return this._parseSearchResult(directResult, requester);
        }
      } catch (error) {
        this.client.emit('debug', `Phase 2 Error: Direct load failed. Error: ${error.message}`);
      }
    }

    // PHASE 3: FINAL FALLBACK
    // If everything failed, try to return the original identification result if it exists
    if (originalResult && originalResult.tracks.length > 0) {
      this.client.emit('debug', `Phase 3: Returning original identification result as last resort`);
      return originalResult;
    }

    this.client.emit('debug', `Search failed: No results found for "${query}"`);
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
   * Autocomplete search for Discord slash commands
   * @param {string} query - The search query from autocomplete interaction
   * @param {Object} [options] - Autocomplete options
   * @param {string} [options.source] - Search source (youtube, spotify, soundcloud, etc)
   * @param {number} [options.limit=10] - Maximum results to return
   * @returns {Promise<Array<{name: string, value: string}>>} Array of choices for Discord autocomplete
   */
  async autocomplete(query, options = {}) {
    if (!query || query.trim().length === 0) return [];

    // Use search engine (Spotify) as default for autocomplete
    const source = options.source || this.client.options.searchEngine || 'spotify';
    const limit = options.limit || 10;

    try {
      const node = this.client.nodes.getLeastUsed();
      if (!node) return [];

      const identifier = this._getSearchIdentifier(query, source);
      this.client.emit('debug', `Autocomplete: Searching via ${source} using ${identifier}`);
      
      const result = await node.rest.loadTracks(identifier);
      if (!result || !result.data) return [];

      let tracks = [];
      if (Array.isArray(result.data)) {
        tracks = result.data;
      } else if (result.data.tracks && Array.isArray(result.data.tracks)) {
        tracks = result.data.tracks;
      } else if (result.data.info) {
        tracks = [result.data];
      }

      if (tracks.length === 0) return [];

      // IMPROVED: Sort results by similarity to ensure the most relevant ones appear first
      const normalizedQuery = query.toLowerCase().trim();
      const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);

      const scoredTracks = tracks
        .map(track => {
          const title = (track.info?.title || '').toLowerCase();
          const author = (track.info?.author || '').toLowerCase();
          const fullText = `${title} ${author}`;
          
          let score = 0;
          
          // 1. Exact title match
          if (title === normalizedQuery) score += 500;
          
          // 2. Exact title + author match
          if (fullText === normalizedQuery || `${author} ${title}` === normalizedQuery) score += 400;

          // 3. Title contains the exact query
          if (title.includes(normalizedQuery)) score += 200;
          
          // 4. Title starts with query
          if (title.startsWith(normalizedQuery)) score += 100;
          
          // 5. Word matching
          let matchedWords = 0;
          for (const word of queryWords) {
            if (fullText.includes(word)) matchedWords++;
          }
          const wordMatchRatio = matchedWords / Math.max(queryWords.length, 1);
          score += wordMatchRatio * 150;
          
          // 6. Penalty for unwanted versions
          const filters = ['karaoke', 'instrumental', 'cover', 'remix', 'parodia', 'paródia', 'clipe oficial', 'official video'];
          for (const filter of filters) {
            if (fullText.includes(filter) && !normalizedQuery.includes(filter)) {
              score -= 50;
            }
          }

          return { track, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(item => item.track);

      // Map tracks to Discord autocomplete choices (name: title, value: name)
      return scoredTracks
        .filter(track => track && track.info)
        .map(track => {
          const name = `${track.info.title} - ${track.info.author}`.slice(0, 100);
          return {
            name,
            value: name // Use name as value so engine searches by name
          };
        })
        .slice(0, 25);
    } catch (error) {
      this.client.emit('debug', `Autocomplete error for "${query}": ${error.message}`);
      return [];
    }
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
    // If the query already has a prefix, return it as-is
    const prefixes = ['ytsearch:', 'ytmsearch:', 'scsearch:', 'spsearch:', 'dzsearch:', 'amsearch:'];
    if (prefixes.some(p => query.startsWith(p))) {
      return query;
    }

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
        prefix = SearchPrefix.YOUTUBE;
        break;
      default:
        // Default to the provided source if it matches a prefix, or use youtube as fallback
        if (SearchPrefix[source.toUpperCase()]) {
          prefix = SearchPrefix[source.toUpperCase()];
        } else {
          prefix = SearchPrefix.YOUTUBE;
        }
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
