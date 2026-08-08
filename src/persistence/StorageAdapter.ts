/**
 * Storage adapter interface for persistence
 * @module persistence/StorageAdapter
 */

/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  /**
   * Get a value by key
   */
  get(key: string): Promise<any>;

  /**
   * Set a value by key
   */
  set(key: string, value: any): Promise<void>;

  /**
   * Delete a value by key
   */
  delete(key: string): Promise<void>;

  /**
   * Get all values
   */
  all(): Promise<Record<string, any>>;

  /**
   * Clear all values
   */
  clear(): Promise<void>;
}