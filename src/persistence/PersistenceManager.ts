/**
 * Manages player state persistence
 * @module persistence/PersistenceManager
 */

import { EventEmitter } from 'events';
import { SuwakuClient } from '../client/SuwakuClient';
import { SuwakuPlayer } from '../structures/SuwakuPlayer';
import { SuwakuTrack } from '../structures/SuwakuTrack';
import { SuwakuQueue } from '../structures/SuwakuQueue';
import { StorageAdapter } from './StorageAdapter';
import { MemoryStorageAdapter } from './MemoryStorageAdapter';
import { PlayerData, PlayerOptions, TrackData, PlayerState } from '../types';
import { validateObject, validateNonEmptyString } from '../utils/validators';

export interface PersistenceManagerOptions {
  storage?: StorageAdapter;
  prefix?: string;
}

/**
 * Manages player state persistence
 */
export class PersistenceManager extends EventEmitter {
  #client: SuwakuClient;
  #storage: StorageAdapter;
  #prefix: string;

  constructor(client: SuwakuClient, options: PersistenceManagerOptions = {}) {
    super();
    validateObject(client, 'Client');

    this.#client = client;
    this.#storage = options.storage ?? new MemoryStorageAdapter();
    this.#prefix = options.prefix ?? 'suwaku:player:';

    this.#setupListeners();
  }

  /**
   * Setup event listeners to track player changes
   */
  #setupListeners(): void {
    this.#client.on('playerCreate', (player: SuwakuPlayer) => {
      this.save(player).catch(error => {
        this.#client.emit('error', new Error(`Failed to save player: ${error.message}`));
      });

      player.on('trackStart', () => this.save(player));
      player.on('queueUpdate', () => this.save(player));
      player.on('filtersUpdate', () => this.save(player));
      player.on('volumeChange', () => this.save(player));
      player.on('loopChange', () => this.save(player));
      player.on('pause', () => this.save(player));
      player.on('resume', () => this.save(player));
    });

    this.#client.on('playerDestroy', (player: SuwakuPlayer) => {
      this.delete(player.guildId).catch(error => {
        this.#client.emit('error', new Error(`Failed to delete player: ${error.message}`));
      });
    });
  }

  /**
   * Save player state to storage
   */
  async save(player: SuwakuPlayer): Promise<void> {
    validateObject(player, 'Player');

    if (player.state === PlayerState.DESTROYED) return;

    const data = player.toJSON();
    
    // Sanitize options to remove non-serializable data
    if (data.options) {
      const sanitizedOptions: Record<string, unknown> = {};
      const options = data.options as Record<string, unknown>;
      
      // Only keep serializable primitive values
      for (const [key, value] of Object.entries(options)) {
        if (
          value === null ||
          value === undefined ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          sanitizedOptions[key] = value;
        }
      }
      
      (data as any).options = sanitizedOptions;
    }
    
    // Sanitize requester data in tracks
    if (data.tracks) {
      data.tracks = data.tracks.map(track => {
        if (track.requester) {
          return {
            ...track,
            requester: {
              id: track.requester.id,
              username: track.requester.username,
              displayName: track.requester.displayName
            }
          };
        }
        return track;
      });
    }
    
    // Sanitize currentTrack requester data
    if (data.currentTrack?.requester) {
      data.currentTrack = {
        ...data.currentTrack,
        requester: {
          id: data.currentTrack.requester.id,
          username: data.currentTrack.requester.username,
          displayName: data.currentTrack.requester.displayName
        }
      };
    }

    const key = `${this.#prefix}${player.guildId}`;

    await this.#storage.set(key, data);

    this.#client.emit('debug', `Saved player state for guild ${player.guildId}`);
  }

  /**
   * Delete player state from storage
   */
  async delete(guildId: string): Promise<void> {
    validateNonEmptyString(guildId, 'Guild ID');
    const key = `${this.#prefix}${guildId}`;

    await this.#storage.delete(key);

    this.#client.emit('debug', `Deleted player state for guild ${guildId}`);
  }

  /**
   * Get all saved players
   */
  async getAll(): Promise<PlayerData[]> {
    const all = await this.#storage.all();
    const filtered = Object.entries(all)
      .filter(([key]) => key.startsWith(this.#prefix))
      .map(([_, value]) => value);

    return filtered;
  }

  /**
   * Restore all players from storage
   */
  async restore(): Promise<number> {
    const playersData = await this.getAll();
    if (playersData.length === 0) return 0;

    this.#client.emit('debug', `Restoring ${playersData.length} players...`);

    let restoredCount = 0;

    for (const data of playersData) {
      try {
        const guild = this.#client.discordClient.guilds.cache.get(data.guildId);
        if (!guild) continue;

        const voiceChannel = guild.channels.cache.get(data.voiceChannelId) as import('discord.js').VoiceChannel | undefined;
        if (!voiceChannel) continue;

        const textChannel = data.textChannelId ? guild.channels.cache.get(data.textChannelId) as import('discord.js').TextChannel | undefined : undefined;

        // Create/reconnect player
        const player = await this.#client.join({
          voiceChannel,
          textChannel,
          deaf: data.options?.deaf || false,
          mute: data.options?.mute || false
        });

        if (!player) continue;

        // Restore volume
        if (data.volume) player.setVolume(data.volume);

        // Restore queue
        if (data.tracks && data.tracks.length > 0) {
          const tracks = data.tracks.map((t: TrackData) => SuwakuTrack.from(t));
          player.queue.addMultiple(tracks);
        }

        // Restore current track
        if (data.currentTrack) {
          const currentTrack = SuwakuTrack.from(data.currentTrack);
          player.currentTrack = currentTrack;

          if (!player.playing) {
            await player.play(currentTrack, {
              startTime: data.position || 0
            });
          }
        }

        // Restore filters
        if (data.filters) {
          await player.filterManager.setFilters(data.filters as any);
        }

        // Restore loop mode
        if (data.loopMode) {
          player.setLoopMode(data.loopMode);
        }

        restoredCount++;
      } catch (error) {
        this.#client.emit('debug', `Failed to restore player for guild ${data.guildId}: ${error}`);
      }
    }

    return restoredCount;
  }
}