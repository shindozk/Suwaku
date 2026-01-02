import { StorageAdapter } from './StorageAdapter.js';

/**
 * In-memory storage adapter
 * @extends StorageAdapter
 */
export class MemoryStorageAdapter extends StorageAdapter {
    constructor() {
        super();
        this.storage = new Map();
    }

    async get(key) {
        return this.storage.get(key);
    }

    async set(key, value) {
        this.storage.set(key, value);
    }

    async delete(key) {
        this.storage.delete(key);
    }

    async all() {
        return Object.fromEntries(this.storage);
    }

    async clear() {
        this.storage.clear();
    }
}
