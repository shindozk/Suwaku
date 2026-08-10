/**
 * Manages Discord voice state updates for Lavalink
 * @module lavalink/VoiceStateManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { LavalinkNode } from './LavalinkNode';
import { VoiceStateUpdate, VoiceServerUpdate } from '../types';

interface PendingVoiceUpdate {
  voiceState: VoiceStateUpdate | null;
  voiceServer: VoiceServerUpdate | null;
  resolve: (value: void) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Manages Discord voice state updates for Lavalink
 */
export class VoiceStateManager extends EventEmitter {
  #client: SuwakuClient;
  #pendingUpdates: Map<string, PendingVoiceUpdate> = new Map();
  #completedGuilds: Set<string> = new Set();
  #waiters: Map<string, { resolve: () => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  #timeout: number;

  constructor(client: SuwakuClient, timeout = 10_000) {
    super();
    this.#client = client;
    this.#timeout = timeout;
  }

  /**
   * Handle incoming voice state update packet
   * Maps Discord raw gateway packets (snake_case) to internal types (camelCase)
   */
  handlePacket(packet: { t: string; d: any }): void {
    if (packet.t === 'VOICE_STATE_UPDATE') {
      const d = packet.d;
      this.#handleVoiceStateUpdate({
        guildId: d.guild_id ?? d.guildId,
        channelId: d.channel_id ?? d.channelId ?? null,
        userId: d.user_id ?? d.userId,
        sessionId: d.session_id ?? d.sessionId,
        deaf: d.deaf ?? false,
        mute: d.mute ?? false,
        selfDeaf: d.self_deaf ?? d.selfDeaf ?? false,
        selfMute: d.self_mute ?? d.selfMute ?? false,
        selfVideo: d.self_video ?? d.selfVideo ?? false,
        suppress: d.suppress ?? false,
      });
    } else if (packet.t === 'VOICE_SERVER_UPDATE') {
      const d = packet.d;
      this.#handleVoiceServerUpdate({
        guildId: d.guild_id ?? d.guildId,
        endpoint: d.endpoint,
        token: d.token,
      });
    }
  }

  /**
   * Handle voice state update from Discord
   */
  #handleVoiceStateUpdate(data: VoiceStateUpdate): void {
    const guildId = data.guildId;
    if (!guildId) return;

    // If clientId is not set yet, we still process the update
    // This can happen if voice state arrives before init() completes
    // We only filter by userId if clientId is available
    if (this.#client.clientId && data.userId !== this.#client.clientId) return;

    let pending = this.#pendingUpdates.get(guildId);

    if (!pending) {
      pending = {
        voiceState: data,
        voiceServer: null,
        resolve: () => {},
        reject: () => {},
        timeout: setTimeout(() => {
          this.#pendingUpdates.delete(guildId);
        }, this.#timeout)
      };

      this.#pendingUpdates.set(guildId, pending);

      // Create promise for waiting
      const promise = new Promise<void>((resolve, reject) => {
        pending!.resolve = resolve;
        pending!.reject = reject;
      });

      // Store promise handlers
      (pending as any).promise = promise;
    } else {
      pending.voiceState = data;
      clearTimeout(pending.timeout);
      pending.timeout = setTimeout(() => {
        this.#pendingUpdates.delete(guildId);
      }, this.#timeout);
    }

    // If we have both voice state and voice server, connect
    if (pending.voiceState && pending.voiceServer) {
      this.#completeConnection(guildId);
    }
  }

  /**
   * Handle voice server update from Discord
   */
  #handleVoiceServerUpdate(data: VoiceServerUpdate): void {
    const guildId = data.guildId;
    if (!guildId) return;

    let pending = this.#pendingUpdates.get(guildId);

    if (!pending) {
      pending = {
        voiceState: null,
        voiceServer: data,
        resolve: () => {},
        reject: () => {},
        timeout: setTimeout(() => {
          this.#pendingUpdates.delete(guildId);
        }, this.#timeout)
      };

      this.#pendingUpdates.set(guildId, pending);

      const promise = new Promise<void>((resolve, reject) => {
        pending!.resolve = resolve;
        pending!.reject = reject;
      });

      (pending as any).promise = promise;
    } else {
      pending.voiceServer = data;
      clearTimeout(pending.timeout);
      pending.timeout = setTimeout(() => {
        this.#pendingUpdates.delete(guildId);
      }, this.#timeout);
    }

    // If we have both voice state and voice server, connect
    if (pending.voiceState && pending.voiceServer) {
      this.#completeConnection(guildId);
    }
  }

  /**
   * Complete the voice connection
   */
  async #completeConnection(guildId: string): Promise<void> {
    const pending = this.#pendingUpdates.get(guildId);
    if (!pending || !pending.voiceState || !pending.voiceServer) return;

    const node = this.#client.nodes.getBest();
    if (!node) {
      pending.reject(new Error('No available Lavalink node'));
      this.#pendingUpdates.delete(guildId);
      return;
    }

    try {
      await node.voiceStateUpdate(guildId, {
        sessionId: pending.voiceState.sessionId,
        event: {
          token: pending.voiceServer.token,
          endpoint: pending.voiceServer.endpoint,
          guildId: guildId
        }
      });

      pending.resolve();
      this.emit('voiceConnectionComplete', guildId, node);
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
      this.emit('voiceConnectionError', guildId, error);
    } finally {
      this.#pendingUpdates.delete(guildId);
    }

    // Mark as completed so future waitForConnection calls return immediately
    this.#completedGuilds.add(guildId);
    setTimeout(() => this.#completedGuilds.delete(guildId), 30_000);

    // Resolve any waiters
    const waiter = this.#waiters.get(guildId);
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve();
      this.#waiters.delete(guildId);
    }
  }

  /**
   * Wait for the voiceUpdate to be sent to Lavalink for a guild.
   * Blocks until the voiceUpdate is sent, or rejects if timeout expires.
   */
  async waitForConnection(guildId: string, timeoutMs?: number): Promise<void> {
    // Already completed — return immediately
    if (this.#completedGuilds.has(guildId)) {
      return;
    }

    // Pending update exists — wait for it
    const pending = this.#pendingUpdates.get(guildId);
    if (pending) {
      await (pending as any).promise;
      return;
    }

    // No pending and not completed — raw events haven't arrived yet.
    // Wait for them with a timeout.
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiters.delete(guildId);
        reject(new Error(`Voice connection timeout for guild ${guildId} after ${timeoutMs ?? this.#timeout}ms`));
      }, timeoutMs ?? this.#timeout);

      this.#waiters.set(guildId, { resolve, timer });
    });
  }

  /**
   * Clear pending update for a guild
   */
  clear(guildId: string): void {
    const pending = this.#pendingUpdates.get(guildId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Voice connection cleared'));
      this.#pendingUpdates.delete(guildId);
    }

    const waiter = this.#waiters.get(guildId);
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve();
      this.#waiters.delete(guildId);
    }
  }

  /**
   * Clear all pending updates
   */
  clearAll(): void {
    this.#pendingUpdates.forEach((pending, guildId) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Voice connection cleared'));
    });
    this.#pendingUpdates.clear();

    this.#waiters.forEach((waiter) => {
      clearTimeout(waiter.timer);
      waiter.resolve();
    });
    this.#waiters.clear();
  }
}
