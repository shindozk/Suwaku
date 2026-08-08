/**
 * Input validation utilities with TypeScript assertion functions
 * @module utils/validators
 */

import { ErrorCode } from '../types';
import { ValidationError } from './errors';

/**
 * Validate that a value is not null or undefined
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is null or undefined
 */
export function validateRequired<T>(value: T | null | undefined, name: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${name} is required`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a string
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not a string
 */
export function validateString(value: unknown, name: string): asserts value is string {
  validateRequired(value, name);
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a non-empty string
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not a non-empty string
 */
export function validateNonEmptyString(value: unknown, name: string): asserts value is string {
  validateString(value, name);
  if (value.trim().length === 0) {
    throw new ValidationError(`${name} cannot be empty`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a number
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not a number
 */
export function validateNumber(value: unknown, name: string): asserts value is number {
  validateRequired(value, name);
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${name} must be a valid number`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a number is within a range
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @throws {ValidationError} If value is out of range
 */
export function validateRange(value: unknown, name: string, min: number, max: number): asserts value is number {
  validateNumber(value, name);
  if (value < min || value > max) {
    throw new ValidationError(
      `${name} must be between ${min} and ${max}`,
      ErrorCode.INVALID_INPUT
    );
  }
}

/**
 * Validate that a value is a boolean
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not a boolean
 */
export function validateBoolean(value: unknown, name: string): asserts value is boolean {
  validateRequired(value, name);
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${name} must be a boolean`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is an array
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not an array
 */
export function validateArray<T>(value: unknown, name: string): asserts value is T[] {
  validateRequired(value, name);
  if (!Array.isArray(value)) {
    throw new ValidationError(`${name} must be an array`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a non-empty array
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not a non-empty array
 */
export function validateNonEmptyArray<T>(value: unknown, name: string): asserts value is T[] {
  validateArray(value, name);
  if (value.length === 0) {
    throw new ValidationError(`${name} cannot be empty`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is an object (not array, not null)
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not an object
 */
export function validateObject<T extends Record<string, unknown>>(value: unknown, name: string): asserts value is T {
  validateRequired(value, name);
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a function
 * @param value - Value to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If value is not a function
 */
export function validateFunction(value: unknown, name: string): asserts value is Function {
  validateRequired(value, name);
  if (typeof value !== 'function') {
    throw new ValidationError(`${name} must be a function`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate a URL
 * @param url - URL to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If URL is invalid
 */
export function validateURL(value: unknown, name: string): asserts value is string {
  validateNonEmptyString(value, name);
  try {
    new URL(value);
  } catch {
    throw new ValidationError(`${name} must be a valid URL`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate Discord snowflake ID
 * @param id - ID to validate
 * @param name - Name of the parameter
 * @throws {ValidationError} If ID is invalid
 */
export function validateSnowflake(value: unknown, name: string): asserts value is string {
  validateNonEmptyString(value, name);
  if (!/^\d{17,19}$/.test(value)) {
    throw new ValidationError(
      `${name} must be a valid Discord snowflake ID`,
      ErrorCode.INVALID_INPUT
    );
  }
}

/**
 * Validate node configuration
 * @param config - Node configuration
 * @throws {ValidationError} If configuration is invalid
 */
export function validateNodeConfig(config: unknown): asserts config is {
  host: string;
  port: number;
  password: string;
  secure?: boolean;
  identifier?: string;
  region?: string;
} {
  validateObject(config, 'Node configuration');
  validateNonEmptyString(config.host, 'Node host');
  validateNumber(config.port, 'Node port');
  validateRange(config.port, 'Node port', 1, 65535);
  validateNonEmptyString(config.password, 'Node password');

  if (config.secure !== undefined) {
    validateBoolean(config.secure, 'Node secure');
  }

  if (config.identifier !== undefined) {
    validateNonEmptyString(config.identifier, 'Node identifier');
  }

  if (config.region !== undefined) {
    validateString(config.region, 'Node region');
  }
}

/**
 * Validate player options
 * @param options - Player options
 * @throws {ValidationError} If options are invalid
 */
export function validatePlayerOptions(options: unknown): asserts options is Record<string, unknown> {
  validateObject(options, 'Player options');
  
  if (options.volume !== undefined) {
    validateRange(options.volume, 'Volume', 0, 1000);
  }
  
  if (options.historySize !== undefined) {
    validateRange(options.historySize, 'History size', 0, 1000);
  }
  
  if (options.maxQueueSize !== undefined) {
    validateRange(options.maxQueueSize, 'Max queue size', 1, 10000);
  }
  
  if (options.maxPlaylistSize !== undefined) {
    validateRange(options.maxPlaylistSize, 'Max playlist size', 1, 5000);
  }
  
  if (options.autoLeaveDelay !== undefined) {
    validateRange(options.autoLeaveDelay, 'Auto leave delay', 0, 3600000);
  }
  
  if (options.leaveOnEmptyDelay !== undefined) {
    validateRange(options.leaveOnEmptyDelay, 'Leave on empty delay', 0, 3600000);
  }
  
  if (options.idleTimeout !== undefined) {
    validateRange(options.idleTimeout, 'Idle timeout', 0, 3600000);
  }
  
  if (options.reconnectDelay !== undefined) {
    validateRange(options.reconnectDelay, 'Reconnect delay', 1000, 60000);
  }
  
  if (options.reconnectAttempts !== undefined) {
    validateRange(options.reconnectAttempts, 'Reconnect attempts', 0, 100);
  }
  
  if (options.healthCheckInterval !== undefined) {
    validateRange(options.healthCheckInterval, 'Health check interval', 5000, 300000);
  }
  
  if (options.stuckThreshold !== undefined) {
    validateRange(options.stuckThreshold, 'Stuck threshold', 1000, 60000);
  }
  
  if (options.maxStuckRetries !== undefined) {
    validateRange(options.maxStuckRetries, 'Max stuck retries', 0, 10);
  }
  
  if (options.healthMonitorInterval !== undefined) {
    validateRange(options.healthMonitorInterval, 'Health monitor interval', 5000, 300000);
  }
}

/**
 * Validate search options
 * @param options - Search options
 * @throws {ValidationError} If options are invalid
 */
export function validateSearchOptions(options: unknown): asserts options is {
  source?: string;
  requester?: Record<string, unknown>;
  limit?: number;
  fallbackSources?: string[];
} {
  validateObject(options, 'Search options');
  
  if (options.limit !== undefined) {
    validateRange(options.limit, 'Limit', 1, 100);
  }
  
  if (options.fallbackSources !== undefined) {
    validateArray(options.fallbackSources, 'Fallback sources');
  }
}

/**
 * Validate play options
 * @param options - Play options
 * @throws {ValidationError} If options are invalid
 */
export function validatePlayOptions(options: unknown): asserts options is {
  query?: string;
  track?: unknown;
  voiceChannel: unknown;
  textChannel?: unknown;
  member?: unknown;
  source?: string;
  engine?: string;
  fallbackSources?: string[];
  volume?: number;
  paused?: boolean;
  startTime?: number;
  endTime?: number;
  noReplace?: boolean;
  addAllResults?: boolean;
} {
  validateObject(options, 'Play options');
  validateRequired(options.voiceChannel, 'Voice channel');
  
  if (options.volume !== undefined) {
    validateRange(options.volume, 'Volume', 0, 1000);
  }
  
  if (options.startTime !== undefined) {
    validateRange(options.startTime, 'Start time', 0, Number.MAX_SAFE_INTEGER);
  }
  
  if (options.endTime !== undefined) {
    validateRange(options.endTime, 'End time', 0, Number.MAX_SAFE_INTEGER);
  }
  
  if (options.fallbackSources !== undefined) {
    validateArray(options.fallbackSources, 'Fallback sources');
  }
}

/**
 * Validate join options
 * @param options - Join options
 * @throws {ValidationError} If options are invalid
 */
export function validateJoinOptions(options: unknown): asserts options is {
  voiceChannel: unknown;
  textChannel?: unknown;
  deaf?: boolean;
  mute?: boolean;
} {
  validateObject(options, 'Join options');
  validateRequired(options.voiceChannel, 'Voice channel');
}

/**
 * Type guard to check if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}