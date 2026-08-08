/**
 * Represents a queue of tracks for a player
 * @module structures/SuwakuQueue
 */

import {
  LoopMode,
  QueueSortProperty,
  QueueData,
  TrackData,
  QueueOptions
} from '../types';
import { SuwakuTrack } from './SuwakuTrack';
import {
  validateNonEmptyString,
  validateNumber,
  validateObject,
  validateRange,
  validateArray
} from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';

/**
 * Represents a queue of tracks for a player with full management capabilities
 */
export class SuwakuQueue {
  #tracks: SuwakuTrack[] = [];
  #previous: SuwakuTrack[] = [];
  #loopMode: LoopMode = LoopMode.OFF;
  #maxHistorySize: number;
  #maxQueueSize: number;

  constructor(options: QueueOptions = {}) {
    this.#maxHistorySize = options.maxHistorySize ?? 50;
    this.#maxQueueSize = options.maxQueueSize ?? 1000;
  }

  // ==================== Getters ====================

  get tracks(): SuwakuTrack[] {
    return [...this.#tracks];
  }

  get previous(): SuwakuTrack[] {
    return [...this.#previous];
  }

  get size(): number {
    return this.#tracks.length;
  }

  get duration(): number {
    return this.#tracks.reduce((sum, track) => sum + track.duration, 0);
  }

  get isEmpty(): boolean {
    return this.#tracks.length === 0;
  }

  get loopMode(): LoopMode {
    return this.#loopMode;
  }

  get maxHistorySize(): number {
    return this.#maxHistorySize;
  }

  set maxHistorySize(value: number) {
    validateRange(value, 'Max history size', 0, 1000);
    this.#maxHistorySize = value;
  }

  get maxQueueSize(): number {
    return this.#maxQueueSize;
  }

  set maxQueueSize(value: number) {
    validateRange(value, 'Max queue size', 1, 10000);
    this.#maxQueueSize = value;
  }

  // ==================== Queue Management ====================

  /**
   * Add a single track to the queue
   * @param track - Track to add
   * @param index - Optional index to insert at (default: end)
   * @returns Added track
   */
  add(track: SuwakuTrack, index?: number): SuwakuTrack {
    validateObject(track, 'Track');

    if (this.#tracks.length >= this.#maxQueueSize) {
      throw new ValidationError('Queue is full', ErrorCode.QUEUE_FULL);
    }

    if (index !== undefined) {
      validateNumber(index, 'Index');
      validateRange(index, 'Index', 0, this.#tracks.length);
      this.#tracks.splice(index, 0, track);
    } else {
      this.#tracks.push(track);
    }

    return track;
  }

  /**
   * Add multiple tracks to the queue
   * @param tracks - Tracks to add
   * @param index - Optional index to insert at (default: end)
   * @returns Added tracks
   */
  addMultiple(tracks: SuwakuTrack[], index?: number): SuwakuTrack[] {
    validateArray(tracks, 'Tracks');

    if (tracks.length === 0) return [];

    tracks.forEach(track => validateObject(track, 'Track'));

    if (index !== undefined) {
      validateNumber(index, 'Index');
      validateRange(index, 'Index', 0, this.#tracks.length);
      this.#tracks.splice(index, 0, ...tracks);
    } else {
      this.#tracks.push(...tracks);
    }

    return tracks;
  }

  /**
   * Insert a track at the beginning of the queue
   * @param track - Track to insert
   * @returns Inserted track
   */
  insertAtStart(track: SuwakuTrack): SuwakuTrack {
    return this.add(track, 0);
  }

  /**
   * Remove a track at the specified index
   * @param index - Index of track to remove
   * @returns Removed track
   */
  remove(index: number): SuwakuTrack {
    validateNumber(index, 'Index');

    if (index < 0 || index >= this.#tracks.length) {
      throw new ValidationError('Index out of range', ErrorCode.INVALID_INPUT);
    }

    return this.#tracks.splice(index, 1)[0];
  }

  /**
   * Remove a track by reference
   * @param track - Track to remove
   * @returns True if track was found and removed
   */
  removeByReference(track: SuwakuTrack): boolean {
    validateObject(track, 'Track');

    const index = this.#tracks.indexOf(track);
    if (index === -1) return false;

    this.#tracks.splice(index, 1);
    return true;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.#tracks = [];
  }

  /**
   * Get a track at the specified index
   * @param index - Index of track to get
   * @returns Track at index or undefined
   */
  get(index: number): SuwakuTrack | undefined {
    validateNumber(index, 'Index');

    if (index < 0 || index >= this.#tracks.length) {
      return undefined;
    }

    return this.#tracks[index];
  }

  /**
   * Get the first track in the queue
   * @returns First track or undefined
   */
  peek(): SuwakuTrack | undefined {
    return this.#tracks[0];
  }

  /**
   * Remove and return the first track in the queue (dequeue)
   * @returns Removed track or undefined if empty
   */
  dequeue(): SuwakuTrack | undefined {
    return this.#tracks.shift();
  }

  /**
   * Shuffle the queue using Fisher-Yates algorithm
   */
  shuffle(): void {
    for (let i = this.#tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.#tracks[i], this.#tracks[j]] = [this.#tracks[j], this.#tracks[i]];
    }
  }

  /**
   * Reverse the queue
   */
  reverse(): void {
    this.#tracks.reverse();
  }

  /**
   * Set the loop mode
   * @param mode - Loop mode to set
   */
  setLoopMode(mode: LoopMode): void {
    if (!Object.values(LoopMode).includes(mode)) {
      throw new ValidationError('Invalid loop mode', ErrorCode.INVALID_INPUT);
    }
    this.#loopMode = mode;
  }

  /**
   * Skip to a specific track in the queue
   * @param index - Index of track to skip to
   * @returns Track that was skipped to
   */
  skipTo(index: number): SuwakuTrack {
    validateNumber(index, 'Index');

    if (index < 0 || index >= this.#tracks.length) {
      throw new ValidationError('Index out of range', ErrorCode.INVALID_INPUT);
    }

    const skippedTracks = this.#tracks.splice(0, index);
    this.#previous.unshift(...skippedTracks.reverse());

    if (this.#previous.length > this.#maxHistorySize) {
      this.#previous = this.#previous.slice(0, this.#maxHistorySize);
    }

    return this.#tracks[0];
  }

  /**
   * Skip to the previous track in history
   * @returns Previous track or undefined if none
   */
  back(): SuwakuTrack | undefined {
    if (this.#previous.length === 0) return undefined;

    const previousTrack = this.#previous.shift();
    if (!previousTrack) return undefined;

    this.#tracks.unshift(previousTrack);

    if (this.#previous.length > this.#maxHistorySize) {
      this.#previous = this.#previous.slice(0, this.#maxHistorySize);
    }

    return previousTrack;
  }

  /**
   * Remove duplicate tracks from the queue (by ID)
   * @returns Number of duplicates removed
   */
  removeDuplicates(): number {
    const seen = new Set<string>();
    let removed = 0;

    for (let i = this.#tracks.length - 1; i >= 0; i--) {
      const track = this.#tracks[i];
      if (seen.has(track.id)) {
        this.#tracks.splice(i, 1);
        removed++;
      } else {
        seen.add(track.id);
      }
    }

    return removed;
  }

  /**
   * Remove tracks by requester ID
   * @param requesterId - ID of requester whose tracks to remove
   * @returns Array of removed tracks
   */
  removeByRequester(requesterId: string): SuwakuTrack[] {
    validateNonEmptyString(requesterId, 'Requester ID');

    const removed: SuwakuTrack[] = [];
    this.#tracks = this.#tracks.filter(track => {
      if (track.requester?.id === requesterId) {
        removed.push(track);
        return false;
      }
      return true;
    });

    return removed;
  }

  /**
   * Get tracks by requester ID
   * @param requesterId - ID of requester
   * @returns Array of tracks by requester
   */
  getByRequester(requesterId: string): SuwakuTrack[] {
    validateNonEmptyString(requesterId, 'Requester ID');

    return this.#tracks.filter(track => track.requester?.id === requesterId);
  }

  /**
   * Get tracks by source
   * @param source - Source to filter by
   * @returns Array of tracks by source
   */
  getBySource(source: string): SuwakuTrack[] {
    validateNonEmptyString(source, 'Source');

    return this.#tracks.filter(track => track.source?.toString() === source);
  }

  /**
   * Get tracks by duration range
   * @param min - Minimum duration in milliseconds
   * @param max - Maximum duration in milliseconds
   * @returns Array of tracks within duration range
   */
  getByDuration(min: number, max: number): SuwakuTrack[] {
    validateNumber(min, 'Min duration');
    validateNumber(max, 'Max duration');
    validateRange(min, 'Min duration', 0, max);

    return this.#tracks.filter(track => track.duration >= min && track.duration <= max);
  }

  /**
   * Search for tracks in the queue
   * @param query - Search query
   * @returns Array of matching tracks
   */
  search(query: string): SuwakuTrack[] {
    validateNonEmptyString(query, 'Query');

    const lowerQuery = query.toLowerCase();
    return this.#tracks.filter(track =>
      track.title.toLowerCase().includes(lowerQuery) ||
      track.author.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Sort the queue
   * @param property - Property to sort by
   * @param ascending - Whether to sort in ascending order (default: true)
   */
  sort(property: QueueSortProperty, ascending = true): void {
    if (!Object.values(QueueSortProperty).includes(property)) {
      throw new ValidationError('Invalid sort property', ErrorCode.INVALID_INPUT);
    }

    this.#tracks.sort((a, b) => {
      let valueA: string | number = 0;
      let valueB: string | number = 0;

      switch (property) {
        case QueueSortProperty.TITLE:
          valueA = a.title;
          valueB = b.title;
          break;
        case QueueSortProperty.AUTHOR:
          valueA = a.author;
          valueB = b.author;
          break;
        case QueueSortProperty.DURATION:
          valueA = a.duration;
          valueB = b.duration;
          break;
        case QueueSortProperty.ADDED_AT:
          valueA = a.position;
          valueB = b.position;
          break;
        default:
          valueA = 0;
          valueB = 0;
      }

      if (valueA < valueB) return ascending ? -1 : 1;
      if (valueA > valueB) return ascending ? 1 : -1;
      return 0;
    });
  }

  /**
   * Move a track from one position to another
   * @param from - Source index
   * @param to - Destination index
   * @returns True if moved successfully
   */
  move(from: number, to: number): boolean {
    validateNumber(from, 'From index');
    validateNumber(to, 'To index');

    if (from < 0 || from >= this.#tracks.length) return false;
    if (to < 0 || to >= this.#tracks.length) return false;
    if (from === to) return true;

    const [track] = this.#tracks.splice(from, 1);
    this.#tracks.splice(to, 0, track);
    return true;
  }

  /**
   * Swap two tracks in the queue
   * @param index1 - First track index
   * @param index2 - Second track index
   * @returns True if swapped successfully
   */
  swap(index1: number, index2: number): boolean {
    validateNumber(index1, 'First index');
    validateNumber(index2, 'Second index');

    if (index1 < 0 || index1 >= this.#tracks.length) return false;
    if (index2 < 0 || index2 >= this.#tracks.length) return false;
    if (index1 === index2) return true;

    [this.#tracks[index1], this.#tracks[index2]] = [this.#tracks[index2], this.#tracks[index1]];
    return true;
  }

  /**
   * Get the first N tracks
   * @param count - Number of tracks to get
   * @returns Array of first N tracks
   */
  first(count: number): SuwakuTrack[] {
    validateNumber(count, 'Count');
    if (count < 0) return [];
    return this.#tracks.slice(0, count);
  }

  /**
   * Get the last N tracks
   * @param count - Number of tracks to get
   * @returns Array of last N tracks
   */
  last(count: number): SuwakuTrack[] {
    validateNumber(count, 'Count');
    if (count < 0) return [];
    return this.#tracks.slice(Math.max(0, this.#tracks.length - count));
  }

  /**
   * Check if queue contains a track
   * @param track - Track to check for
   * @returns True if track is in queue
   */
  has(track: SuwakuTrack): boolean {
    validateObject(track, 'Track');
    return this.#tracks.some(t => t.id === track.id);
  }

  /**
   * Get the index of a track in the queue
   * @param track - Track to find
   * @returns Index of track or -1 if not found
   */
  indexOf(track: SuwakuTrack): number {
    validateObject(track, 'Track');
    return this.#tracks.indexOf(track);
  }

  /**
   * Get queue snapshot for pagination
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page
   * @returns Page of tracks
   */
  getPage(page: number, pageSize: number): SuwakuTrack[] {
    validateNumber(page, 'Page');
    validateNumber(pageSize, 'Page size');
    validateRange(page, 'Page', 1, Number.MAX_SAFE_INTEGER);
    validateRange(pageSize, 'Page size', 1, 100);

    const start = (page - 1) * pageSize;
    return this.#tracks.slice(start, start + pageSize);
  }

  /**
   * Get total number of pages
   * @param pageSize - Items per page
   * @returns Total pages
   */
  getTotalPages(pageSize: number): number {
    validateNumber(pageSize, 'Page size');
    validateRange(pageSize, 'Page size', 1, 100);
    return Math.ceil(this.#tracks.length / pageSize);
  }

  // ==================== Serialization ====================

  /**
   * Convert queue to JSON-serializable object
   * @returns JSON representation of the queue
   */
  toJSON(): QueueData {
    return {
      tracks: this.#tracks.map(track => track.toJSON()),
      previous: this.#previous.map(track => track.toJSON()),
      loopMode: this.#loopMode,
      maxHistorySize: this.#maxHistorySize
    };
  }

  /**
   * Create a queue from JSON data
   * @param data - JSON data
   * @returns New SuwakuQueue instance
   */
  static from(data: QueueData): SuwakuQueue {
    const queue = new SuwakuQueue({ maxHistorySize: data.maxHistorySize, maxQueueSize: (data as any).maxQueueSize });
    queue.#tracks = data.tracks.map(track => SuwakuTrack.from(track));
    queue.#previous = data.previous.map(track => SuwakuTrack.from(track));
    queue.#loopMode = data.loopMode;
    return queue;
  }
}