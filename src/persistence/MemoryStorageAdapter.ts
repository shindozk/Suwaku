/**
 * In-memory storage adapter for persistence
 * @module persistence/MemoryStorageAdapter
 */

import { StorageAdapter } from './StorageAdapter';

/**
 * In-memory storage adapter
 */
export class MemoryStorageAdapter implements StorageAdapter {
  #store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    return this.#store.get(key) ?? null;
  }

  async set(key: string, value: any): Promise<void> {
    this.#store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.#store.delete(key);
  }

  async all(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    this.#store.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  async clear(): Promise<void> {
    this.#store.clear();
  }
}