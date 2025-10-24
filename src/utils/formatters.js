/**
 * Utility functions for formatting data
 * @module utils/formatters
 */

/**
 * Convert milliseconds to MM:SS or HH:MM:SS format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (isNaN(ms) || ms < 0) return '0:00';

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  const pad = num => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Parse duration string (MM:SS or HH:MM:SS) to milliseconds
 * @param {string} duration - Duration string
 * @returns {number} Duration in milliseconds
 */
function parseDuration(duration) {
  if (!duration || typeof duration !== 'string') return 0;

  const parts = duration.split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    // MM:SS
    return (parts[0] * 60 + parts[1]) * 1000;
  } else if (parts.length === 3) {
    // HH:MM:SS
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }

  return 0;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format timestamp to readable date/time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date/time
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Create a progress bar string
 * @param {number} current - Current position in milliseconds
 * @param {number} total - Total duration in milliseconds
 * @param {number} length - Length of the progress bar (default: 20)
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, length = 20) {
  if (total === 0) return '─'.repeat(length);

  const progress = Math.min(current / total, 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;

  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export {
  formatDuration,
  parseDuration,
  formatBytes,
  formatTimestamp,
  createProgressBar,
  truncate,
  formatNumber
};
