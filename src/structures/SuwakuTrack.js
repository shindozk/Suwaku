/**
 * Suwaku Track - Represents a music track
 * @module structures/SuwakuTrack
 */

import { formatDuration } from '../utils/formatters.js';
import { TrackSource } from '../utils/constants.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique ID using uuid
 * @returns {string} Unique ID
 */
function generateId() {
  return uuidv4();
}

/**
 * Represents a music track
 */
class SuwakuTrack {
    /**
     * @param {Object} data - Track data
     * @param {Object} [requester] - User who requested the track
     */
    constructor(data, requester = null) {
        /**
         * Unique ID for this track instance
         * @type {string}
         */
        this.id = generateId();

        /**
         * Encoded track string from Lavalink
         * @type {string}
         */
        this.encoded = data.encoded || data.track;

        /**
         * Track title
         * @type {string}
         */
        this.title = data.info?.title || data.title || 'Unknown Title';

        /**
         * Track author/artist
         * @type {string}
         */
        this.author = data.info?.author || data.author || 'Unknown Artist';

        /**
         * Track URL
         * @type {string}
         */
        this.url = data.info?.uri || data.url || null;

        /**
         * Track identifier (e.g., YouTube video ID)
         * @type {string}
         */
        this.identifier = data.info?.identifier || data.identifier || null;

        /**
         * Track duration in milliseconds
         * @type {number}
         */
        this.duration = data.info?.length || data.duration || 0;

        /**
         * Current position in milliseconds
         * @type {number}
         */
        this.position = data.info?.position || data.position || 0;

        /**
         * Track source (youtube, spotify, soundcloud, etc.)
         * @type {string}
         */
        this.source = data.info?.sourceName || data.source || TrackSource.YOUTUBE;

        /**
         * Artwork/thumbnail URL
         * @type {string|null}
         */
        this.thumbnail = data.info?.artworkUrl || data.thumbnail || null;

        /**
         * Whether the track is seekable
         * @type {boolean}
         */
        this.isSeekable = data.info?.isSeekable ?? true;

        /**
         * Whether the track is a stream
         * @type {boolean}
         */
        this.isStream = data.info?.isStream ?? false;

        /**
         * ISRC code
         * @type {string|null}
         */
        this.isrc = data.info?.isrc || null;

        /**
         * User who requested this track
         * @type {Object|null}
         */
        this.requester = requester;

        /**
         * Timestamp when track was added
         * @type {number}
         */
        this.addedAt = Date.now();

        /**
         * Raw track data
         * @type {Object}
         */
        this.raw = data;
    }

    /**
     * Get formatted duration (MM:SS or HH:MM:SS)
     * @returns {string} Formatted duration
     */
    get formattedDuration() {
        return formatDuration(this.duration);
    }

    /**
     * Get formatted position (MM:SS or HH:MM:SS)
     * @returns {string} Formatted position
     */
    get formattedPosition() {
        return formatDuration(this.position);
    }

    /**
     * Get playback progress percentage
     * @returns {number} Progress (0-100)
     */
    get progress() {
        if (this.duration === 0) return 0;
        return Math.min((this.position / this.duration) * 100, 100);
    }

    /**
     * Get thumbnail URL with quality
     * @param {string} [quality] - Thumbnail quality (default, mqdefault, hqdefault, sddefault, maxresdefault)
     * @returns {string|null} Thumbnail URL
     */
    getThumbnail(quality) {
        if (this.thumbnail) return this.thumbnail;

        // Generate YouTube thumbnail if we have an identifier
        if (this.source === TrackSource.YOUTUBE && this.identifier) {
            const qualities = ['default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault'];
            // Use provided quality or default to maxresdefault
            const q = quality && qualities.includes(quality) ? quality : 'maxresdefault';
            return `https://img.youtube.com/vi/${this.identifier}/${q}.jpg`;
        }

        return null;
    }

    /**
     * Set the current position
     * @param {number} position - Position in milliseconds
     */
    setPosition(position) {
        this.position = Math.max(0, Math.min(position, this.duration));
    }

    /**
     * Set the requester
     * @param {Object} requester - User object
     */
    setRequester(requester) {
        this.requester = requester;
    }

    /**
     * Convert track to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            encoded: this.encoded,
            title: this.title,
            author: this.author,
            url: this.url,
            identifier: this.identifier,
            duration: this.duration,
            position: this.position,
            source: this.source,
            thumbnail: this.getThumbnail(),
            isSeekable: this.isSeekable,
            isStream: this.isStream,
            isrc: this.isrc,
            requester: this.requester && typeof this.requester === 'object' ? {
                id: this.requester.id,
                username: this.requester.username || this.requester.user?.username,
                displayName: this.requester.displayName || this.requester.user?.displayName,
                avatar: this.requester.displayAvatarURL?.() || this.requester.user?.displayAvatarURL?.()
            } : this.requester,
            addedAt: this.addedAt,
            formattedDuration: this.formattedDuration,
            formattedPosition: this.formattedPosition,
            progress: this.progress
        };
    }

    /**
     * Create a track from Lavalink track data
     * @param {Object} data - Lavalink track data
     * @param {Object} [requester] - User who requested the track
     * @returns {SuwakuTrack} Track instance
     */
    static from(data, requester = null) {
        return new SuwakuTrack(data, requester);
    }

    /**
     * Create a track from encoded string
     * @param {string} encoded - Encoded track string
     * @param {Object} [requester] - User who requested the track
     * @returns {SuwakuTrack} Track instance
     */
    static fromEncoded(encoded, requester = null) {
        return new SuwakuTrack({ encoded }, requester);
    }
}

export { SuwakuTrack };
