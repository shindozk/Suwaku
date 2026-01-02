/**
 * Lavalink REST API client
 * @module lavalink/LavalinkREST
 */

import axios from 'axios';
import { ConnectionError, PlaybackError } from '../utils/errors.js';
import { validateNonEmptyString, validateObject } from '../utils/validators.js';

/**
 * REST API client for Lavalink
 */
class LavalinkREST {
  /**
   * @param {LavalinkNode} node - The Lavalink node instance
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * Get the base URL for REST requests
   * @returns {string} Base URL
   */
  get baseURL() {
    const protocol = this.node.options.secure ? 'https' : 'http';
    return `${protocol}://${this.node.options.host}:${this.node.options.port}`;
  }

  /**
   * Get default headers for REST requests
   * @returns {Object} Headers
   */
  get headers() {
    return {
      'Authorization': this.node.options.password,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make a REST request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} [options] - Request options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.data] - Request data
   * @param {number} [options.retries=3] - Number of retries
   * @returns {Promise<Object>} Response data
   */
  async doRequest(endpoint, options = {}) {
    const method = options.method || 'GET';
    const data = options.data || null;
    const retries = options.retries ?? 3;

    // Ensure endpoint starts with /v4/ if it doesn't already
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullEndpoint = path.startsWith('/v4') ? path : `/v4${path}`;

    const url = `${this.baseURL}${fullEndpoint}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const config = {
          method,
          url,
          headers: this.headers,
          timeout: 10000
        };

        if (data) {
          config.data = data;
        }

        const response = await axios(config);
        return response.data;
      } catch (error) {
        const isLastAttempt = attempt === retries;

        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          const errorData = error.response.data;

          if (status === 404) {
            throw new PlaybackError(
              `Resource not found: ${endpoint}`,
              { url, status, data: errorData }
            );
          }

          if (status === 429 && !isLastAttempt) {
            // Rate limited, wait and retry
            const retryAfter = parseInt(error.response.headers['retry-after'] || '1', 10);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          if (isLastAttempt) {
            throw new ConnectionError(
              `REST request failed: ${error.message}`,
              { url, status, data: errorData, error }
            );
          }
        } else if (error.request) {
          // Request made but no response
          if (isLastAttempt) {
            throw new ConnectionError(
              `No response from server: ${error.message}`,
              { url, error }
            );
          }
        } else {
          // Error setting up request
          throw new ConnectionError(
            `Request setup failed: ${error.message}`,
            { url, error }
          );
        }

        // Wait before retry (exponential backoff)
        if (!isLastAttempt) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
  }

  /**
   * Load tracks from Lavalink
   * @param {string} identifier - Search query or URL
   * @returns {Promise<Object>} Track load result
   */
  async loadTracks(identifier) {
    validateNonEmptyString(identifier, 'Identifier');

    try {
      const encodedIdentifier = encodeURIComponent(identifier);
      const data = await this.doRequest(`/loadtracks?identifier=${encodedIdentifier}`);

      return data;
    } catch (error) {
      throw new PlaybackError(
        `Failed to load tracks: ${error.message}`,
        { identifier, error }
      );
    }
  }

  /**
   * Update player state
   * @param {string} guildId - Guild ID
   * @param {Object} data - Player update data
   * @param {boolean} [noReplace=false] - Don't replace current track
   * @returns {Promise<Object>} Updated player state
   */
  async updatePlayer(guildId, data, noReplace = false) {
    validateNonEmptyString(guildId, 'Guild ID');
    validateObject(data, 'Update data');

    try {
      const sessionId = this.node.sessionId;
      if (!sessionId) {
        throw new Error('Session ID not available');
      }

      // Build endpoint with session ID (standard Lavalink v4)
      let endpoint = `/v4/sessions/${sessionId}/players/${guildId}`;
      if (noReplace) {
        endpoint += '?noReplace=true';
      }

      const result = await this.doRequest(endpoint, { method: 'PATCH', data });
      return result;
    } catch (error) {
      throw new ConnectionError(
        `Failed to update player: ${error.message}`,
        { guildId, data, error }
      );
    }
  }

  /**
   * Destroy a player
   * @param {string} guildId - Guild ID
   * @returns {Promise<void>}
   */
  async destroyPlayer(guildId) {
    validateNonEmptyString(guildId, 'Guild ID');

    try {
      const sessionId = this.node.sessionId || 'default';
      await this.doRequest(`/sessions/${sessionId}/players/${guildId}`, { method: 'DELETE' });
    } catch (error) {
      // Ignore 404 errors (player already destroyed)
      if (error instanceof PlaybackError) {
        return;
      }
      throw new ConnectionError(
        `Failed to destroy player: ${error.message}`,
        { guildId, error }
      );
    }
  }

  /**
   * Get player information
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Player information
   */
  async getPlayer(guildId) {
    validateNonEmptyString(guildId, 'Guild ID');

    try {
      const sessionId = this.node.sessionId || 'default';
      const data = await this.doRequest(`/sessions/${sessionId}/players/${guildId}`);
      return data;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get player: ${error.message}`,
        { guildId, error }
      );
    }
  }

  /**
   * Get all players
   * @returns {Promise<Array>} List of players
   */
  async getPlayers() {
    try {
      const sessionId = this.node.sessionId || 'default';
      const data = await this.doRequest(`/sessions/${sessionId}/players`);
      return data;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get players: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Update session information
   * @param {Object} data - Session data
   * @returns {Promise<Object>} Updated session
   */
  async updateSession(data) {
    validateObject(data, 'Session data');

    try {
      const sessionId = this.node.sessionId || 'default';
      const result = await this.doRequest(`/sessions/${sessionId}`, { method: 'PATCH', data });
      return result;
    } catch (error) {
      throw new ConnectionError(
        `Failed to update session: ${error.message}`,
        { data, error }
      );
    }
  }

  /**
   * Get Lavalink info
   * @returns {Promise<Object>} Lavalink information
   */
  async getInfo() {
    try {
      const data = await this.doRequest('/info');
      return data;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get info: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Get Lavalink stats
   * @returns {Promise<Object>} Lavalink statistics
   */
  async getStats() {
    try {
      const data = await this.doRequest('/stats');
      return data;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get stats: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Get Lavalink version
   * @returns {Promise<string>} Lavalink version
   */
  async getVersion() {
    try {
      const data = await this.doRequest('/version');
      return data;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get version: ${error.message}`,
        { error }
      );
    }
  }

  /**
   * Decode a track
   * @param {string} track - Encoded track string
   * @returns {Promise<Object>} Decoded track information
   */
  async decodeTrack(track) {
    validateNonEmptyString(track, 'Track');

    try {
      const data = await this.doRequest(`/decodetrack?encodedTrack=${encodeURIComponent(track)}`);
      return data;
    } catch (error) {
      throw new PlaybackError(
        `Failed to decode track: ${error.message}`,
        { track, error }
      );
    }
  }

  /**
   * Decode multiple tracks
   * @param {Array<string>} tracks - Array of encoded track strings
   * @returns {Promise<Array>} Array of decoded tracks
   */
  async decodeTracks(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new PlaybackError('Tracks must be a non-empty array');
    }

    try {
      const data = await this.doRequest('/decodetracks', { method: 'POST', data: tracks });
      return data;
    } catch (error) {
      throw new PlaybackError(
        `Failed to decode tracks: ${error.message}`,
        { tracks, error }
      );
    }
  }

  /**
   * Get lyrics for a track (Lavalink Lyrics Plugin Feature)
   * @param {string} track - Encoded track string or query
   * @returns {Promise<Object>} Lyrics data
   */
  async getLyrics(track) {
    validateNonEmptyString(track, 'Track');
    try {
      // Endpoint standard for Lavalink Lyrics Plugin
      return await this.doRequest(`/sessions/${this.node.sessionId}/players/lyrics?track=${encodeURIComponent(track)}`);
    } catch (error) {
      throw new PlaybackError(`Failed to fetch lyrics from node: ${error.message}`, { track, error });
    }
  }
}

export { LavalinkREST };
