import { StorageAdapter } from './StorageAdapter.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * JSON file storage adapter
 * @extends StorageAdapter
 */
export class JSONStorageAdapter extends StorageAdapter {
    /**
     * @param {Object} options 
     * @param {string} options.filePath - Path to the JSON file
     */
    constructor(options = {}) {
        super();
        this.filePath = options.filePath || path.join(process.cwd(), 'suwaku-persistence.json');
        this.data = null;
    }

    /**
     * Initialize storage and load data from file
     * @private
     */
    async _init() {
        if (this.data) return;

        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            this.data = JSON.parse(content, (key, value) => {
                if (typeof value === 'string' && value.startsWith('BIGINT::')) {
                    return BigInt(value.substring(8));
                }
                return value;
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.data = {};
                await this._save();
            } else {
                throw error;
            }
        }
    }

    /**
     * Save current data to file
     * @private
     */
    async _save() {
        const cache = new WeakSet();
        const json = JSON.stringify(this.data, (key, value) => {
            if (typeof value === 'bigint') {
                return `BIGINT::${value.toString()}`;
            }
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) {
                    return; // Discard circular reference
                }
                cache.add(value);
            }
            return value;
        }, 2);
        await fs.writeFile(this.filePath, json);
    }

    async get(key) {
        await this._init();
        return this.data[key];
    }

    async set(key, value) {
        await this._init();
        this.data[key] = value;
        await this._save();
    }

    async delete(key) {
        await this._init();
        delete this.data[key];
        await this._save();
    }

    async all() {
        await this._init();
        return { ...this.data };
    }

    async clear() {
        this.data = {};
        await this._save();
    }
}
