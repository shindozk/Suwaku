/**
 * JSON file storage adapter for persistence
 * @module persistence/JSONStorageAdapter
 */

import { StorageAdapter } from './StorageAdapter';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface JSONStorageAdapterOptions {
  filePath: string;
  autoSave?: boolean;
  saveInterval?: number;
}

/**
 * JSON file storage adapter
 */
export class JSONStorageAdapter implements StorageAdapter {
  #filePath: string;
  #autoSave: boolean;
  #saveInterval: number;
  #saveTimer: NodeJS.Timeout | null = null;
  #data: Record<string, any> = {};
  #loaded: boolean = false;

  constructor(options: JSONStorageAdapterOptions) {
    this.#filePath = options.filePath;
    this.#autoSave = options.autoSave ?? true;
    this.#saveInterval = options.saveInterval ?? 30_000;
  }

  /**
   * Load data from file
   */
  async #load(): Promise<void> {
    if (this.#loaded) return;

    try {
      const content = await fs.readFile(this.#filePath, 'utf-8');
      this.#data = JSON.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.#data = {};
    }

    this.#loaded = true;

    if (this.#autoSave) {
      this.#startAutoSave();
    }
  }

  /**
   * Start auto-save timer
   */
  #startAutoSave(): void {
    this.#saveTimer = setInterval(() => {
      this.save().catch(error => {
        console.error('[Suwaku] Failed to auto-save persistence:', error);
      });
    }, this.#saveInterval);
  }

  /**
   * Save data to file
   */
  async save(): Promise<void> {
    const dir = dirname(this.#filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.#filePath, JSON.stringify(this.#data, null, 2), 'utf-8');
  }

  async get(key: string): Promise<any> {
    await this.#load();
    return this.#data[key] ?? null;
  }

  async set(key: string, value: any): Promise<void> {
    await this.#load();
    this.#data[key] = value;
  }

  async delete(key: string): Promise<void> {
    await this.#load();
    delete this.#data[key];
  }

  async all(): Promise<Record<string, any>> {
    await this.#load();
    return { ...this.#data };
  }

  async clear(): Promise<void> {
    await this.#load();
    this.#data = {};
    await this.save();
  }

  /**
   * Stop auto-save and save final data
   */
  async destroy(): Promise<void> {
    if (this.#saveTimer) {
      clearInterval(this.#saveTimer);
      this.#saveTimer = null;
    }
    await this.save();
  }
}