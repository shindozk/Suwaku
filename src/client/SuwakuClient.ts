/**
 * Suwaku Client - Main client class
 * @module client/SuwakuClient
 */

import { EventEmitter } from 'events';
import { Client } from 'discord.js';
import { NodeManager } from '../lavalink/NodeManager';
import { PlayerManager } from '../managers/PlayerManager';
import { SearchManager } from '../managers/SearchManager';
import { StatsManager } from '../managers/StatsManager';
import { LyricsManager } from '../managers/LyricsManager';
import { VoiceStateManager } from '../lavalink/VoiceStateManager';
import { PersistenceManager } from '../persistence/PersistenceManager';
import { SuwakuTrack } from '../structures/SuwakuTrack';
import { SuwakuPlayer } from '../structures/SuwakuPlayer';
import { SuwakuQueue } from '../structures/SuwakuQueue';
import { LavalinkNode } from '../lavalink/LavalinkNode';
import { Structure } from '../structures/Structure';
import * as Constants from '../utils/constants';
import { validateObject, validateNonEmptyArray } from '../utils/validators';
import { LastFMManager } from '../managers/LastFMManager';
import { play, join, leave, isURLAllowed } from './PlayerActions';
import { setupEventForwarding, setupDiscordListeners } from './EventForwarder';
import type { NodeConfig, SearchEngine, SearchResult, URLFilterOptions, PlayerOptions, SearchOptions, AutocompleteChoice, MoodSearchOptions, ClientStats } from '../types';

// Version will be injected at build time
const version = '1.3.10';

export class SuwakuClient extends EventEmitter {
  #ready = false;
  #clientId: string | null = null;
  #readyTimestamp = 0;

  public discordClient: Client;
  public options: SuwakuClientOptions;
  public version: string;
  public nodes: NodeManager;
  public playerManager: PlayerManager;
  public searchManager: SearchManager;
  public statsManager: StatsManager;
  public lyricsManager: LyricsManager;
  public lastFMManager: LastFMManager;
  public persistence: PersistenceManager;
  public voiceStates: VoiceStateManager;

  constructor(discordClient: Client, options: SuwakuClientOptions) {
    super();

    validateObject(discordClient, 'Discord client');
    validateObject(options, 'Options');
    validateNonEmptyArray(options.nodes, 'Nodes');

    const nodeConfigs = options.nodes;

    this.discordClient = discordClient;
    this.options = {
      defaultVolume: options.defaultVolume ?? Constants.Defaults.VOLUME,
      searchEngine: options.searchEngine ?? Constants.Defaults.SEARCH_SOURCE,
      playbackEngine: options.playbackEngine ?? Constants.Defaults.PLAYBACK_ENGINE,
      autoPlay: options.autoPlay ?? false,
      autoLeave: options.autoLeave ?? true,
      autoLeaveDelay: options.autoLeaveDelay ?? Constants.Defaults.AUTO_LEAVE_DELAY,
      leaveOnEmpty: options.leaveOnEmpty ?? false,
      leaveOnEmptyDelay: options.leaveOnEmptyDelay ?? 60_000,
      leaveOnEnd: options.leaveOnEnd ?? false,
      idleTimeout: options.idleTimeout ?? Constants.Defaults.IDLE_TIMEOUT,
      historySize: options.historySize ?? Constants.Defaults.HISTORY_SIZE,
      maxQueueSize: options.maxQueueSize ?? 1000,
      maxPlaylistSize: options.maxPlaylistSize ?? 500,
      allowDuplicates: options.allowDuplicates ?? true,
      persistencePrefix: options.persistencePrefix ?? 'suwaku:player:',
      storageAdapter: options.storageAdapter ?? null,
      enableFilters: options.enableFilters ?? true,
      enableLyrics: options.enableLyrics ?? false,
      enableSourceFallback: options.enableSourceFallback ?? true,
      sortByRegion: options.sortByRegion ?? false,
      resumeOnReconnect: options.resumeOnReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? Constants.Defaults.RECONNECT_DELAY,
      reconnectAttempts: options.reconnectAttempts ?? Constants.Defaults.RECONNECT_ATTEMPTS,
      loadBalancer: options.loadBalancer ?? true,
      enableHealthCheck: options.enableHealthCheck ?? true,
      defaultYoutubeThumbnail: options.defaultYoutubeThumbnail ?? 'maxresdefault',
      trackPlayerMoved: options.trackPlayerMoved ?? true,
      healthCheckInterval: options.healthCheckInterval ?? 30_000,
      retryOnStuck: options.retryOnStuck ?? true,
      stuckThreshold: options.stuckThreshold ?? 10_000,
      maxStuckRetries: options.maxStuckRetries ?? 3,
      enableHealthMonitor: options.enableHealthMonitor ?? true,
      healthMonitorInterval: options.healthMonitorInterval ?? 15_000,
      urlFilter: options.urlFilter ?? { whitelist: [], blacklist: [] },
      onDisconnect: options.onDisconnect ?? 'manual',
      onEmptyQueue: options.onEmptyQueue ?? 'idle',
      onEmptyQueueDelay: options.onEmptyQueueDelay ?? 60_000,
      volumeDecrementer: options.volumeDecrementer ?? 1.0,
      instaFixFilter: options.instaFixFilter ?? false,
      lastFMApiKey: options.lastFMApiKey,
      lastFMApiSecret: options.lastFMApiSecret,
      ...options
    };

    Structure.structures.Track = Structure.structures.Track || SuwakuTrack;
    Structure.structures.Player = Structure.structures.Player || SuwakuPlayer;
    Structure.structures.Queue = Structure.structures.Queue || SuwakuQueue;
    Structure.structures.Node = Structure.structures.Node || LavalinkNode;

    this.version = version;
    this.nodes = new NodeManager(this);
    this.playerManager = new PlayerManager(this);
    this.searchManager = new SearchManager(this);
    this.statsManager = new StatsManager(this);
    this.lyricsManager = new LyricsManager(this);
    this.lastFMManager = new LastFMManager(this, {
      apiKey: this.options.lastFMApiKey,
      apiSecret: this.options.lastFMApiSecret
    });
    this.persistence = new PersistenceManager(this, {
      storage: this.options.storageAdapter ?? undefined,
      prefix: this.options.persistencePrefix
    });
    this.voiceStates = new VoiceStateManager(this);

    setupEventForwarding(this);
    setupDiscordListeners(this, () => this.#clientId);
    this.nodes.init(nodeConfigs);
  }

  public get players(): Map<string, SuwakuPlayer> {
    return this.playerManager.players;
  }

  public get ready(): boolean {
    return this.#ready;
  }

  public get clientId(): string | null {
    return this.#clientId;
  }

  public async init(): Promise<void> {
    if (this.#ready) return;

    if (!this.discordClient.isReady?.()) {
      await new Promise((resolve) => {
        this.discordClient.once('clientReady', resolve);
      });
    }

    this.#clientId = this.discordClient.user?.id ?? '';
    this.#ready = true;
    this.#readyTimestamp = Date.now();

    this.nodes.connectAll();

    this.emit('ready');
    this.emit('debug', 'Suwaku client initialized');
  }

  public async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    return this.searchManager.search(query, options);
  }

  public async autocomplete(query: string, options?: { source?: SearchEngine; limit?: number }): Promise<Array<AutocompleteChoice>> {
    return this.searchManager.autocomplete(query, options);
  }

  public async searchByMood(mood: string, options?: MoodSearchOptions): Promise<SearchResult> {
    return this.searchManager.searchByMood(mood, options);
  }

  public isURLAllowed(url: string): boolean {
    return isURLAllowed(this, url);
  }

  public async play(options: Parameters<typeof play>[1]): Promise<any> {
    return play(this, options);
  }

  public async join(options: Parameters<typeof join>[1]): Promise<SuwakuPlayer> {
    return join(this, options);
  }

  public async leave(guildId: string, destroy = true): Promise<boolean> {
    return leave(this, guildId, destroy);
  }

  public getPlayer(guildId: string): SuwakuPlayer | undefined {
    return this.playerManager.get(guildId);
  }

  public createPlayer(options: { guildId: string; voiceChannelId: string; textChannelId?: string }): SuwakuPlayer {
    return this.playerManager.create(options);
  }

  public async destroyPlayer(guildId: string): Promise<boolean> {
    return this.playerManager.destroy(guildId);
  }

  public async restorePlayers(): Promise<number> {
    return this.persistence.restore();
  }

  public getStats(): ClientStats {
    return {
      version: this.version,
      ready: this.#ready,
      nodes: this.nodes.getStats(),
      players: this.playerManager.getStats(),
      uptime: this.#ready ? Date.now() - this.#readyTimestamp : 0
    };
  }

  public async destroy(): Promise<void> {
    this.emit('debug', 'Destroying Suwaku client');

    await this.playerManager.destroyAll();
    this.nodes.disconnectAll();
    this.voiceStates.clearAll();
    this.removeAllListeners();
    this.nodes.removeAllListeners();
    this.playerManager.removeAllListeners();
    this.voiceStates.removeAllListeners();

    this.#ready = false;
    this.emit('destroy');
  }
}

/**
 * Suwaku client options
 */
export interface SuwakuClientOptions {
  nodes: NodeConfig[];
  defaultVolume?: number;
  searchEngine?: SearchEngine;
  playbackEngine?: SearchEngine;
  autoPlay?: boolean;
  autoLeave?: boolean;
  autoLeaveDelay?: number;
  leaveOnEmpty?: boolean;
  leaveOnEmptyDelay?: number;
  leaveOnEnd?: boolean;
  idleTimeout?: number;
  historySize?: number;
  maxQueueSize?: number;
  maxPlaylistSize?: number;
  allowDuplicates?: boolean;
  persistencePrefix?: string;
  storageAdapter?: import('../persistence/StorageAdapter').StorageAdapter | null;
  enableFilters?: boolean;
  enableLyrics?: boolean;
  enableSourceFallback?: boolean;
  sortByRegion?: boolean;
  resumeOnReconnect?: boolean;
  reconnectDelay?: number;
  reconnectAttempts?: number;
  loadBalancer?: boolean;
  enableHealthCheck?: boolean;
  defaultYoutubeThumbnail?: string;
  trackPlayerMoved?: boolean;
  healthCheckInterval?: number;
  retryOnStuck?: boolean;
  stuckThreshold?: number;
  maxStuckRetries?: number;
  enableHealthMonitor?: boolean;
  healthMonitorInterval?: number;
  urlFilter?: URLFilterOptions;
  onDisconnect?: string;
  onEmptyQueue?: string;
  onEmptyQueueDelay?: number;
  volumeDecrementer?: number;
  instaFixFilter?: boolean;
  lastFMApiKey?: string;
  lastFMApiSecret?: string;
  batchThreshold?: number;
  sessionId?: string;
  [key: string]: unknown;
}
