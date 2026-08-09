/**
 * Lavalink REST API client
 * @module lavalink/LavalinkREST
 */

import { SuwakuClient } from '../client/SuwakuClient';
import { LavalinkNode } from './LavalinkNode';
import {
  LavalinkTrackResponse,
  LavalinkLoadResponse,
  NodeStats,
  NodePlayer
} from '../types';

/**
 * Lavalink REST API client for HTTP requests
 */
export class LavalinkREST {
  #node: LavalinkNode;
  #client: SuwakuClient;
  #baseUrl: string;

  constructor(node: LavalinkNode) {
    this.#node = node;
    this.#client = node.client;
    const protocol = node.secure ? 'https' : 'http';
    this.#baseUrl = `${protocol}://${node.host}:${node.port}`;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  /**
   * Make an HTTP request to Lavalink
   */
  async #request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.#baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.#node.password,
      'Content-Type': 'application/json',
      'User-Agent': 'Suwaku/1.3.0'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Lavalink REST error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
  }

  /**
   * Load a track from URL or search query
   */
  async loadTrack(identifier: string): Promise<LavalinkLoadResponse> {
    const encoded = encodeURIComponent(identifier);
    return this.#request<LavalinkLoadResponse>('GET', `/v4/loadtracks?identifier=${encoded}`);
  }

  /**
   * Get node statistics
   */
  async getStats(): Promise<NodeStats> {
    return this.#request<NodeStats>('GET', '/v4/stats');
  }

  /**
   * Get node version info
   */
  async getVersion(): Promise<any> {
    return this.#request<any>('GET', '/v4/version');
  }

  /**
   * Get player info
   */
  async getPlayer(guildId: string): Promise<NodePlayer | null> {
    try {
      return await this.#request<NodePlayer>('GET', `/v4/sessions/${this.#client.options.sessionId}/players/${guildId}`);
    } catch {
      return null;
    }
  }

  /**
   * Update player state
   */
  async updatePlayer(guildId: string, data: Record<string, unknown>): Promise<void> {
    await this.#request('PATCH', `/v4/sessions/${this.#client.options.sessionId}/players/${guildId}`, data);
  }

  /**
   * Destroy player
   */
  async destroyPlayer(guildId: string): Promise<void> {
    await this.#request('DELETE', `/v4/sessions/${this.#client.options.sessionId}/players/${guildId}`);
  }
}