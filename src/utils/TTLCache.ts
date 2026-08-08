/**
 * Generic TTL-based LRU cache with size limits
 * @module utils/TTLCache
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class TTLCache<T> {
  #cache: Map<string, CacheEntry<T>> = new Map();
  #maxSize: number;
  #ttl: number;

  constructor(maxSize: number, ttlMs: number) {
    this.#maxSize = maxSize;
    this.#ttl = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.#cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.#ttl) {
      this.#cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.#cache.set(key, { value, timestamp: Date.now() });

    if (this.#cache.size > this.#maxSize) {
      const oldestKey = Array.from(this.#cache.keys()).reduce((a, b) =>
        this.#cache.get(a)!.timestamp < this.#cache.get(b)!.timestamp ? a : b
      );
      this.#cache.delete(oldestKey);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.#cache.delete(key);
  }

  clear(): void {
    this.#cache.clear();
  }

  get size(): number {
    return this.#cache.size;
  }

  get stats(): { size: number; maxSize: number; ttl: number } {
    return { size: this.#cache.size, maxSize: this.#maxSize, ttl: this.#ttl };
  }
}
