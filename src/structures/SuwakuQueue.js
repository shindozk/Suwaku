/**
 * Suwaku Queue - Manages track queue
 * @module structures/SuwakuQueue
 */

import { LoopMode } from '../utils/constants.js';
import { validateNumber, validateRange } from '../utils/validators.js';
import { formatDuration } from '../utils/formatters.js';

/**
 * Represents a music queue
 */
class SuwakuQueue {
  /**
   * @param {SuwakuPlayer} player - The player instance
   */
  constructor(player) {
    this.player = player;

    /**
     * Array of tracks in the queue
     * @type {Array<SuwakuTrack>}
     */
    this.tracks = [];

    /**
     * Array of previously played tracks
     * @type {Array<SuwakuTrack>}
     */
    this.previous = [];

    /**
     * Currently playing track
     * @type {SuwakuTrack|null}
     */
    this.current = null;

    /**
     * Loop mode
     * @type {string}
     */
    this.loop = LoopMode.OFF;

    /**
     * Maximum history size
     * @type {number}
     */
    this.maxHistorySize = 50;
  }

  /**
   * Get the number of tracks in queue
   * @returns {number} Queue size
   */
  get size() {
    return this.tracks.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} Whether queue is empty
   */
  get isEmpty() {
    return this.tracks.length === 0;
  }

  /**
   * Clear the entire queue and history
   * @returns {void}
   */
  destroy() {
    this.tracks = [];
    this.previous = [];
    this.current = null;
    this.player = null;
  }

  /**
   * Get total duration of all tracks in queue
   * @returns {number} Total duration in milliseconds
   */
  get duration() {
    return this.tracks.reduce((total, track) => total + track.duration, 0);
  }

  /**
   * Add a track to the queue
   * @param {SuwakuTrack} track - Track to add
   * @returns {number} New queue size
   */
  add(track) {
    this.tracks.push(track);
    return this.tracks.length;
  }

  /**
   * Add multiple tracks to the queue
   * @param {Array<SuwakuTrack>} tracks - Tracks to add
   * @returns {number} New queue size
   */
  addMultiple(tracks) {
    this.tracks.push(...tracks);
    return this.tracks.length;
  }

  /**
   * Remove a track from the queue
   * @param {number} position - Position in queue (0-based)
   * @returns {SuwakuTrack} Removed track
   */
  remove(position) {
    validateNumber(position, 'Position');
    validateRange(position, 'Position', 0, this.tracks.length - 1);

    const [removed] = this.tracks.splice(position, 1);
    return removed;
  }

  /**
   * Get a track from the queue
   * @param {number} position - Position in queue (0-based)
   * @returns {SuwakuTrack|undefined} Track at position
   */
  get(position) {
    return this.tracks[position];
  }

  /**
   * Clear the entire queue
   * @returns {Array<SuwakuTrack>} Cleared tracks
   */
  clear() {
    const cleared = this.tracks.splice(0);
    return cleared;
  }

  /**
   * Shuffle the queue
   * @returns {Array<SuwakuTrack>} Shuffled queue
   */
  shuffle() {
    // Fisher-Yates shuffle algorithm
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    return this.tracks;
  }

  /**
   * Move a track to a different position
   * @param {number} from - Current position
   * @param {number} to - Target position
   * @returns {Array<SuwakuTrack>} Updated queue
   */
  move(from, to) {
    validateNumber(from, 'From position');
    validateNumber(to, 'To position');
    validateRange(from, 'From position', 0, this.tracks.length - 1);
    validateRange(to, 'To position', 0, this.tracks.length - 1);

    const [track] = this.tracks.splice(from, 1);
    this.tracks.splice(to, 0, track);
    return this.tracks;
  }

  /**
   * Get the next track without removing it
   * @returns {SuwakuTrack|null} Next track
   */
  peek() {
    return this.tracks[0] || null;
  }

  /**
   * Get and remove the next track
   * @returns {SuwakuTrack|null} Next track
   */
  shift() {
    // Handle loop mode
    if (this.loop === LoopMode.TRACK && this.current) {
      return this.current;
    }

    if (this.loop === LoopMode.QUEUE && this.current) {
      this.tracks.push(this.current);
    }

    // Move current to previous
    if (this.current) {
      this.previous.push(this.current);
      
      // Limit history size
      if (this.previous.length > this.maxHistorySize) {
        this.previous.shift();
      }
    }

    // Get next track
    this.current = this.tracks.shift() || null;
    return this.current;
  }

  /**
   * Go back to previous track
   * @returns {SuwakuTrack|null} Previous track
   */
  back() {
    if (this.previous.length === 0) return null;

    // Put current track back at the front of queue
    if (this.current) {
      this.tracks.unshift(this.current);
    }

    // Get previous track
    this.current = this.previous.pop();
    return this.current;
  }

  /**
   * Set loop mode
   * @param {string} mode - Loop mode ('off', 'track', 'queue')
   */
  setLoop(mode) {
    if (!Object.values(LoopMode).includes(mode)) {
      throw new Error(`Invalid loop mode: ${mode}`);
    }
    this.loop = mode;
  }

  /**
   * Filter tracks by predicate
   * @param {Function} predicate - Filter function
   * @returns {Array<SuwakuTrack>} Filtered tracks
   */
  filter(predicate) {
    return this.tracks.filter(predicate);
  }

  /**
   * Find a track by predicate
   * @param {Function} predicate - Search function
   * @returns {SuwakuTrack|undefined} Found track
   */
  find(predicate) {
    return this.tracks.find(predicate);
  }

  /**
   * Get a slice of the queue
   * @param {number} [start=0] - Start index
   * @param {number} [end] - End index
   * @returns {Array<SuwakuTrack>} Sliced tracks
   */
  slice(start = 0, end) {
    return this.tracks.slice(start, end);
  }

  /**
   * Reverse the queue
   * @returns {Array<SuwakuTrack>} Reversed queue
   */
  reverse() {
    this.tracks.reverse();
    return this.tracks;
  }

  /**
   * Iterate over tracks
   * @param {Function} callback - Callback function
   */
  forEach(callback) {
    this.tracks.forEach(callback);
  }

  /**
   * Map tracks to new array
   * @param {Function} callback - Map function
   * @returns {Array} Mapped array
   */
  map(callback) {
    return this.tracks.map(callback);
  }

  /**
   * Make queue iterable
   * @returns {Iterator} Iterator
   */
  [Symbol.iterator]() {
    return this.tracks[Symbol.iterator]();
  }

  /**
   * Remove duplicate tracks based on title and author
   * @returns {number} Number of duplicates removed
   */
  removeDuplicates() {
    const seen = new Set();
    const originalSize = this.tracks.length;
    
    this.tracks = this.tracks.filter(track => {
      const key = `${track.title.toLowerCase()}-${track.author.toLowerCase()}`.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const removed = originalSize - this.tracks.length;
    if (removed > 0) {
      this.player.emit("queueUpdate", this);
    }
    return removed;
  }

  /**
   * Swap two tracks in the queue
   * @param {number} pos1 - First position
   * @param {number} pos2 - Second position
   * @returns {boolean} Whether swap was successful
   */
  swap(pos1, pos2) {
    validateNumber(pos1, 'Position 1');
    validateNumber(pos2, 'Position 2');
    validateRange(pos1, 'Position 1', 0, this.tracks.length - 1);
    validateRange(pos2, 'Position 2', 0, this.tracks.length - 1);

    if (pos1 === pos2) return true;

    [this.tracks[pos1], this.tracks[pos2]] = [this.tracks[pos2], this.tracks[pos1]];
    this.player.emit("queueUpdate", this);
    return true;
  }

  /**
   * Remove tracks by a filter function
   * @param {Function} predicate - Filter function
   * @returns {Array<SuwakuTrack>} Removed tracks
   */
  removeBy(predicate) {
    const removed = [];
    this.tracks = this.tracks.filter(track => {
      if (predicate(track)) {
        removed.push(track);
        return false;
      }
      return true;
    });
    return removed;
  }

  /**
   * Get tracks by requester
   * @param {string} userId - User ID
   * @returns {Array<SuwakuTrack>} Tracks requested by user
   */
  getByRequester(userId) {
    return this.tracks.filter(track => track.requester?.id === userId);
  }

  /**
   * Remove tracks by requester
   * @param {string} userId - User ID
   * @returns {Array<SuwakuTrack>} Removed tracks
   */
  removeByRequester(userId) {
    return this.removeBy(track => track.requester?.id === userId);
  }

  /**
   * Get tracks by source
   * @param {string} source - Track source (youtube, spotify, etc.)
   * @returns {Array<SuwakuTrack>} Tracks from source
   */
  getBySource(source) {
    return this.tracks.filter(track => track.source === source);
  }

  /**
   * Get tracks by duration range
   * @param {number} min - Minimum duration in milliseconds
   * @param {number} max - Maximum duration in milliseconds
   * @returns {Array<SuwakuTrack>} Tracks within duration range
   */
  getByDuration(min, max) {
    return this.tracks.filter(track => track.duration >= min && track.duration <= max);
  }

  /**
   * Search tracks by title or author
   * @param {string} query - Search query
   * @returns {Array<SuwakuTrack>} Matching tracks
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.tracks.filter(track => 
      track.title.toLowerCase().includes(lowerQuery) ||
      track.author.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get a random track from the queue
   * @returns {SuwakuTrack|null} Random track
   */
  random() {
    if (this.isEmpty) return null;
    const index = Math.floor(Math.random() * this.tracks.length);
    return this.tracks[index];
  }

  /**
   * Get first N tracks
   * @param {number} count - Number of tracks
   * @returns {Array<SuwakuTrack>} First N tracks
   */
  first(count = 1) {
    return this.tracks.slice(0, count);
  }

  /**
   * Get last N tracks
   * @param {number} count - Number of tracks
   * @returns {Array<SuwakuTrack>} Last N tracks
   */
  last(count = 1) {
    return this.tracks.slice(-count);
  }

  /**
   * Check if queue contains a track
   * @param {Function|string} predicate - Search function or track ID
   * @returns {boolean} Whether track exists
   */
  has(predicate) {
    if (typeof predicate === 'string') {
      return this.tracks.some(track => track.id === predicate);
    }
    return this.tracks.some(predicate);
  }

  /**
   * Get index of a track
   * @param {Function|string} predicate - Search function or track ID
   * @returns {number} Track index or -1
   */
  indexOf(predicate) {
    if (typeof predicate === 'string') {
      return this.tracks.findIndex(track => track.id === predicate);
    }
    return this.tracks.findIndex(predicate);
  }

  /**
   * Swap two tracks
   * @param {number} index1 - First track index
   * @param {number} index2 - Second track index
   * @returns {Array<SuwakuTrack>} Updated queue
   */
  swap(index1, index2) {
    validateNumber(index1, 'Index 1');
    validateNumber(index2, 'Index 2');
    validateRange(index1, 'Index 1', 0, this.tracks.length - 1);
    validateRange(index2, 'Index 2', 0, this.tracks.length - 1);

    [this.tracks[index1], this.tracks[index2]] = [this.tracks[index2], this.tracks[index1]];
    return this.tracks;
  }

  /**
   * Sort queue by property
   * @param {string} property - Property to sort by (duration, title, author)
   * @param {boolean} [ascending=true] - Sort order
   * @returns {Array<SuwakuTrack>} Sorted queue
   */
  sort(property, ascending = true) {
    this.tracks.sort((a, b) => {
      let aVal = a[property];
      let bVal = b[property];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (ascending) {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return this.tracks;
  }

  /**
   * Get formatted queue duration
   * @returns {string} Formatted duration
   */
  get formattedDuration() {
    return formatDuration(this.duration);
  }

  /**
   * Convert queue to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      size: this.size,
      duration: this.duration,
      formattedDuration: this.formattedDuration,
      loop: this.loop,
      current: this.current?.toJSON() || null,
      tracks: this.tracks.map(t => t.toJSON()),
      previous: this.previous.map(t => t.toJSON())
    };
  }
}

export { SuwakuQueue };
