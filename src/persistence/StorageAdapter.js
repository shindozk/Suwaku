/**
 * Base class for storage adapters
 */
export class StorageAdapter {
    /**
     * Get value from storage
     * @param {string} key 
     * @returns {Promise<any>}
     */
    async get(key) {
        throw new Error('Method not implemented');
    }

    /**
     * Set value in storage
     * @param {string} key 
     * @param {any} value 
     * @returns {Promise<void>}
     */
    async set(key, value) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete value from storage
     * @param {string} key 
     * @returns {Promise<void>}
     */
    async delete(key) {
        throw new Error('Method not implemented');
    }

    /**
     * Get all values from storage
     * @returns {Promise<Record<string, any>>}
     */
    async all() {
        throw new Error('Method not implemented');
    }

    /**
     * Clear all values from storage
     * @returns {Promise<void>}
     */
    async clear() {
        throw new Error('Method not implemented');
    }
}
