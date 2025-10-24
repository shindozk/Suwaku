/**
 * Custom error classes for Suwaku
 * @module utils/errors
 */

import { ErrorCode } from './constants.js';

/**
 * Base error class for Suwaku
 */
export class SuwakuError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} [details] - Additional error details
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when connection to Lavalink fails
 */
export class ConnectionError extends SuwakuError {
  constructor(message, details = {}) {
    super(message, ErrorCode.CONNECTION_FAILED, details);
  }
}

/**
 * Error thrown when playback fails
 */
export class PlaybackError extends SuwakuError {
  constructor(message, details = {}) {
    super(message, ErrorCode.TRACK_LOAD_FAILED, details);
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends SuwakuError {
  constructor(message, code = ErrorCode.INVALID_INPUT, details = {}) {
    super(message, code, details);
  }
}

/**
 * Error thrown when Discord permissions are missing
 */
export class PermissionError extends SuwakuError {
  constructor(message, details = {}) {
    super(message, ErrorCode.PERMISSION_DENIED, details);
  }
}

/**
 * Error thrown when a node is not found
 */
export class NodeNotFoundError extends SuwakuError {
  constructor(message, details = {}) {
    super(message, ErrorCode.NODE_NOT_FOUND, details);
  }
}

/**
 * Error thrown when a player is not found
 */
export class PlayerNotFoundError extends SuwakuError {
  constructor(message, details = {}) {
    super(message, ErrorCode.PLAYER_NOT_FOUND, details);
  }
}
