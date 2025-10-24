/**
 * Input validation utilities
 * @module utils/validators
 */

import { ErrorCode } from './constants.js';
import { ValidationError } from './errors.js';

/**
 * Validate that a value is not null or undefined
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is null or undefined
 */
function validateRequired(value, name) {
  if (value === null || value === undefined) {
    throw new ValidationError(`${name} is required`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a string
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not a string
 */
function validateString(value, name) {
  validateRequired(value, name);
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not a non-empty string
 */
function validateNonEmptyString(value, name) {
  validateString(value, name);
  if (value.trim().length === 0) {
    throw new ValidationError(`${name} cannot be empty`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a number
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not a number
 */
function validateNumber(value, name) {
  validateRequired(value, name);
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${name} must be a valid number`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a number is within a range
 * @param {number} value - Value to validate
 * @param {string} name - Name of the parameter
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @throws {ValidationError} If value is out of range
 */
function validateRange(value, name, min, max) {
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
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not a boolean
 */
function validateBoolean(value, name) {
  validateRequired(value, name);
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${name} must be a boolean`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is an array
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not an array
 */
function validateArray(value, name) {
  validateRequired(value, name);
  if (!Array.isArray(value)) {
    throw new ValidationError(`${name} must be an array`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a non-empty array
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not a non-empty array
 */
function validateNonEmptyArray(value, name) {
  validateArray(value, name);
  if (value.length === 0) {
    throw new ValidationError(`${name} cannot be empty`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is an object
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not an object
 */
function validateObject(value, name) {
  validateRequired(value, name);
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate that a value is a function
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If value is not a function
 */
function validateFunction(value, name) {
  validateRequired(value, name);
  if (typeof value !== 'function') {
    throw new ValidationError(`${name} must be a function`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate a URL
 * @param {string} url - URL to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If URL is invalid
 */
function validateURL(url, name) {
  validateNonEmptyString(url, name);
  try {
    new URL(url);
  } catch {
    throw new ValidationError(`${name} must be a valid URL`, ErrorCode.INVALID_INPUT);
  }
}

/**
 * Validate Discord snowflake ID
 * @param {string} id - ID to validate
 * @param {string} name - Name of the parameter
 * @throws {ValidationError} If ID is invalid
 */
function validateSnowflake(id, name) {
  validateNonEmptyString(id, name);
  if (!/^\d{17,19}$/.test(id)) {
    throw new ValidationError(
      `${name} must be a valid Discord snowflake ID`,
      ErrorCode.INVALID_INPUT
    );
  }
}

/**
 * Validate node configuration
 * @param {Object} config - Node configuration
 * @throws {ValidationError} If configuration is invalid
 */
function validateNodeConfig(config) {
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
}

export {
  validateRequired,
  validateString,
  validateNonEmptyString,
  validateNumber,
  validateRange,
  validateBoolean,
  validateArray,
  validateNonEmptyArray,
  validateObject,
  validateFunction,
  validateURL,
  validateSnowflake,
  validateNodeConfig
};
