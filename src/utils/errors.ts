/**
 * Custom error classes for Suwaku
 * @module utils/errors
 */

import { ErrorCode } from '../types';

export { ErrorCode };

/**
 * Base error class for Suwaku
 */
export class SuwakuError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(message: string, code: ErrorCode, details: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }

  /**
   * Create a user-friendly error message
   */
  toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * Error thrown when connection to Lavalink fails
 */
export class ConnectionError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.CONNECTION_FAILED, details);
  }
}

/**
 * Error thrown when playback fails
 */
export class PlaybackError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.TRACK_LOAD_FAILED, details);
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends SuwakuError {
  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_INPUT, details: Record<string, unknown> = {}) {
    super(message, code, details);
  }
}

/**
 * Error thrown when Discord permissions are missing
 */
export class PermissionError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.PERMISSION_DENIED, details);
  }
}

/**
 * Error thrown when a node is not found
 */
export class NodeNotFoundError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.NODE_NOT_FOUND, details);
  }
}

/**
 * Error thrown when a player is not found
 */
export class PlayerNotFoundError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.PLAYER_NOT_FOUND, details);
  }
}

/**
 * Error thrown when a track fails to load
 */
export class TrackLoadError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.TRACK_LOAD_FAILED, details);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.INVALID_CONFIGURATION, details);
  }
}

/**
 * Error thrown when voice connection fails
 */
export class VoiceConnectionError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.VOICE_CONNECTION_FAILED, details);
  }
}

/**
 * Error thrown when autoplay fails to find tracks
 */
export class AutoplayNotFoundError extends SuwakuError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, ErrorCode.AUTOPLAY_NOT_FOUND, details);
  }
}

/**
 * Check if an error is a SuwakuError
 */
export function isSuwakuError(error: unknown): error is SuwakuError {
  return error instanceof SuwakuError;
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): ErrorCode | null {
  if (isSuwakuError(error)) {
    return error.code;
  }
  return null;
}