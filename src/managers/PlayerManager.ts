/**
 * Manages player lifecycle and events
 * @module managers/PlayerManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { SuwakuPlayer } from '../structures/SuwakuPlayer';
import { SuwakuTrack } from '../structures/SuwakuTrack';
import { PlayerEvent, PlayerState, PlayerOptions, PlayerDestroyReason, LoopMode } from '../types';
import { validateNonEmptyString, validateObject } from '../utils/validators';
import { FilterManager } from './FilterManager';


export interface PlayerManagerStats {
  total: number;
  playing: number;
  paused: number;
}

/**
 * Manages player lifecycle and events
 */
export class PlayerManager extends EventEmitter {
  #client: SuwakuClient;
  #players: Map<string, SuwakuPlayer> = new Map();

  constructor(client: SuwakuClient) {
    super();
    this.#client = client;
  }

  get client(): SuwakuClient {
    return this.#client;
  }

  get players(): Map<string, SuwakuPlayer> {
    return new Map(this.#players);
  }

  get size(): number {
    return this.#players.size;
  }

  get playingCount(): number {
    let count = 0;
    for (const player of this.#players.values()) {
      if (player.playing) count++;
    }
    return count;
  }

  /**
   * Create a new player
   * @param options - Player options
   * @returns Created player
   */
  create(options: {
    guildId: string;
    voiceChannelId: string;
    textChannelId?: string;
    deaf?: boolean;
    mute?: boolean;
    volume?: number;
  }): SuwakuPlayer {
    validateObject(options, 'Player options');
    validateNonEmptyString(options.guildId, 'Guild ID');
    validateNonEmptyString(options.voiceChannelId, 'Voice channel ID');

    if (this.#players.has(options.guildId)) {
      return this.#players.get(options.guildId)!;
    }

    const playerOptions: PlayerOptions = {
      deaf: options.deaf,
      mute: options.mute,
      volume: options.volume,
      historySize: this.#client.options.historySize
    };

    const player = new SuwakuPlayer(
      options.guildId,
      options.voiceChannelId,
      options.textChannelId ?? null,
      playerOptions,
      this,
      null as any // temporary — set below
    );

    const filterManager = new FilterManager(player);
    player.filterManager = filterManager;

    this.#players.set(options.guildId, player);
    this.emit('playerCreate', player);

    return player;
  }

  /**
   * Get a player by guild ID
   * @param guildId - Guild ID
   * @returns Player or undefined
   */
  get(guildId: string): SuwakuPlayer | undefined {
    validateNonEmptyString(guildId, 'Guild ID');
    return this.#players.get(guildId);
  }

  /**
   * Check if a player exists for a guild
   * @param guildId - Guild ID
   * @returns True if player exists
   */
  has(guildId: string): boolean {
    validateNonEmptyString(guildId, 'Guild ID');
    return this.#players.has(guildId);
  }

  /**
   * Destroy a player
   * @param guildId - Guild ID
   * @returns True if player was destroyed
   */
  async destroy(guildId: string): Promise<boolean> {
    validateNonEmptyString(guildId, 'Guild ID');

    const player = this.#players.get(guildId);
    if (!player) return false;

    await player.destroy();
    this.#players.delete(guildId);
    this.emit('playerDestroy', player);

    return true;
  }

  /**
   * Destroy all players
   */
  async destroyAll(): Promise<void> {
    const guildIds = Array.from(this.#players.keys());
    for (const guildId of guildIds) {
      await this.destroy(guildId);
    }
  }

  /**
   * Get player statistics
   * @returns Player statistics
   */
  getStats(): PlayerManagerStats {
    let playing = 0;
    let paused = 0;

    for (const player of this.#players.values()) {
      if (player.playing) playing++;
      else if (player.paused) paused++;
    }

    return {
      total: this.#players.size,
      playing,
      paused
    };
  }

  /**
   * Handle voice state update for a player
   * @param guildId - Guild ID
   */
  handleVoiceStateUpdate(guildId: string): void {
    const player = this.#players.get(guildId);
    if (player) {
      player.handleVoiceStateUpdate();
    }
  }

  /**
   * Handle player moved event
   * @param guildId - Guild ID
   * @param state - Movement state
   * @param channels - Channel information
   */
  handlePlayerMoved(guildId: string, state: string, channels: { oldChannelId: string | null; newChannelId: string | null }): void {
    const player = this.#players.get(guildId);
    if (player) {
      if (state === 'MOVED') {
        player.setVoiceChannelId(channels.newChannelId!);
      }
      this.emit('playerMoved', player, state, channels);
    }
  }

  /**
   * Update player node
   * @param guildId - Guild ID
   * @param node - Lavalink node
   */
  setPlayerNode(guildId: string, node: import('../lavalink/LavalinkNode').LavalinkNode): void {
    const player = this.#players.get(guildId);
    if (player) {
      player.node = node;
    }
  }

  /**
   * Handle track start event
   * @param guildId - Guild ID
   * @param track - Track data
   */
  handleTrackStart(guildId: string, track: import('../types').LavalinkTrackResponse): void {
    const player = this.#players.get(guildId);
    if (player) {
      // Find the matching track in queue
      const queuedTrack = player.queue.tracks.find(t => t.encoded === track.encoded);
      if (queuedTrack) {
        player.currentTrack = queuedTrack;
        player.setPlaying(true);
        player.setPosition(track.info?.position ?? 0);
        this.emit('trackStart', player, queuedTrack);
      }
    }
  }

  /**
   * Handle track end event
   * @param guildId - Guild ID
   * @param track - Track data
   * @param reason - End reason (finished, loadFailed, stopped, replaced, cleanup)
   */
  handleTrackEnd(guildId: string, track: import('../types').LavalinkTrackResponse, reason: string): void {
    const player = this.#players.get(guildId);
    if (!player) return;

    const endedTrack = player.currentTrack;
    player.setPlaying(false);
    player.currentTrack = null;
    player.setPosition(0);
    this.emit('trackEnd', player, endedTrack, reason);

    // Only auto-advance on natural track end or load failure
    if (reason !== 'finished' && reason !== 'loadFailed') return;

    // Handle loop mode
    const loopMode = player.queue.loopMode;

    if (loopMode === LoopMode.TRACK && endedTrack) {
      // Replay the same track
      player.play(endedTrack).catch((error) => {
        this.emit('debug', `Failed to replay track in guild ${guildId}: ${error.message}`);
      });
      return;
    }

    if (loopMode === LoopMode.QUEUE && endedTrack) {
      // Re-add the ended track to the end of the queue
      player.queue.add(endedTrack);
    }

    // Try to play the next track
    const nextTrack = player.queue.dequeue();
    if (nextTrack) {
      player.play(nextTrack).catch((error) => {
        this.emit('debug', `Failed to play next track in guild ${guildId}: ${error.message}`);
      });
    } else {
      this.handleQueueEnd(guildId);
    }
  }

  /**
   * Handle track exception event
   * @param guildId - Guild ID
   * @param track - Track data
   * @param error - Error message
   */
  handleTrackException(guildId: string, track: import('../types').LavalinkTrackResponse, error: string): void {
    const player = this.#players.get(guildId);
    if (player && player.currentTrack) {
      this.emit('trackError', player, player.currentTrack, new Error(error));
    }
  }

  /**
   * Handle track stuck event
   * @param guildId - Guild ID
   * @param track - Track data
   * @param threshold - Stuck threshold
   */
  handleTrackStuck(guildId: string, track: import('../types').LavalinkTrackResponse, threshold: number): void {
    const player = this.#players.get(guildId);
    if (player && player.currentTrack) {
      this.emit('trackStuck', player, player.currentTrack, threshold);
    }
  }

  /**
   * Handle queue end event
   * @param guildId - Guild ID
   */
  handleQueueEnd(guildId: string): void {
    const player = this.#players.get(guildId);
    if (player) {
      this.emit('queueEnd', player);

      const onEmptyQueue = player.options.onEmptyQueue as string | undefined;
      if (onEmptyQueue && onEmptyQueue !== 'none') {
        const delay = (player.options.onEmptyQueueDelay as number) ?? 60_000;
        setTimeout(() => {
          if (player.queue.isEmpty && !player.playing) {
            if (onEmptyQueue === 'destroy') {
              player.destroy(PlayerDestroyReason.QUEUE_EMPTY).catch((error) => {
                this.emit('debug', `Failed to destroy player on empty queue in guild ${guildId}: ${error.message}`);
              });
            } else if (onEmptyQueue === 'idle') {
              player.stop().catch((error) => {
                this.emit('debug', `Failed to stop player on empty queue in guild ${guildId}: ${error.message}`);
              });
            }
          }
        }, delay);
      }
    }
  }

  /**
   * Handle player update from Lavalink
   * @param data - Player update data
   */
  handlePlayerUpdate(data: { guildId: string; position?: number; state?: string }): void {
    const player = this.#players.get(data.guildId);
    if (player) {
      if (data.position !== undefined) {
        player.setPosition(data.position);
      }
      
      if (data.state) {
        switch (data.state) {
          case 'playing':
            player.setPlaying(true);
            break;
          case 'paused':
            player.setPaused(true);
            break;
          default:
            player.setState(data.state as PlayerState);
        }
      }
    }
  }
}