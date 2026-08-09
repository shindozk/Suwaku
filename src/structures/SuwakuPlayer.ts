/**
 * Represents a player for a guild with full Lavalink integration
 * @module structures/SuwakuPlayer
 */

import {
  PlayerState,
  LoopMode,
  FilterType,
  PlayerMovedState,
  PlayerEvent,
  SearchEngine,
  TrackSource,
  SponsorBlockCategory,
  DefaultPlayerOptions,
  Defaults,
  PlayerData,
  PlayerOptions,
  FilterSettings,
  EqualizerBand,
  TimescaleSettings,
  KaraokeSettings,
  TremoloSettings,
  VibratoSettings,
  RotationSettings,
  DistortionSettings,
  ChannelMixSettings,
  LowPassSettings,
  TrackData,
  LavalinkOpcode,
  PlayerDestroyReason
} from '../types';
import { SuwakuTrack } from './SuwakuTrack';
import { SuwakuQueue } from './SuwakuQueue';
import { FilterManager } from '../managers/FilterManager';
import { PlayerManager } from '../managers/PlayerManager';
import { validateNonEmptyString, validateNumber, validateObject, validateRange } from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';
import { LavalinkNode } from '../lavalink/LavalinkNode';

/**
 * Represents a player for a guild with full Lavalink integration
 */
export class SuwakuPlayer {
  #guildId: string;
  #voiceChannelId: string;
  #textChannelId: string | null;
  #state: PlayerState;
  #volume: number;
  #loopMode: LoopMode;
  #position: number;
  #playing: boolean;
  #paused: boolean;
  #filters: Record<string, unknown> = {};
  #options: PlayerOptions;
  #currentTrack: SuwakuTrack | null = null;
  #queue: SuwakuQueue;
  #node: LavalinkNode | null = null;
  #playerManager: PlayerManager;
  #filterManager: FilterManager;
  #destroyReason: PlayerDestroyReason | null = null;
  #idleTimeout: ReturnType<typeof setTimeout> | null = null;
  #discordVoiceConnected: boolean = false;
  #listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
    options: PlayerOptions = {},
    playerManager: PlayerManager,
    filterManager: FilterManager
  ) {
    validateNonEmptyString(guildId, 'Guild ID');
    validateNonEmptyString(voiceChannelId, 'Voice channel ID');
    if (textChannelId !== null) {
      validateNonEmptyString(textChannelId, 'Text channel ID');
    }
    validateObject(options, 'Player options');

    this.#guildId = guildId;
    this.#voiceChannelId = voiceChannelId;
    this.#textChannelId = textChannelId;
    this.#state = PlayerState.IDLE;
    this.#volume = (options.volume as number) ?? DefaultPlayerOptions.volume;
    this.#loopMode = LoopMode.OFF;
    this.#position = 0;
    this.#playing = false;
    this.#paused = false;
    this.#options = {
      deaf: (options.deaf as boolean) ?? false,
      mute: (options.mute as boolean) ?? false,
      volume: (options.volume as number) ?? DefaultPlayerOptions.volume
    };

    this.#playerManager = playerManager;
    this.#filterManager = filterManager;
    this.#queue = new SuwakuQueue({ maxHistorySize: (options.historySize as number) ?? Defaults.HISTORY_SIZE, maxQueueSize: (options.maxQueueSize as number) ?? 1000 });
  }

  // ==================== Getters ====================

  get guildId(): string {
    return this.#guildId;
  }

  get voiceChannelId(): string {
    return this.#voiceChannelId;
  }

  get textChannelId(): string | null {
    return this.#textChannelId;
  }

  get state(): PlayerState {
    return this.#state;
  }

  get volume(): number {
    return this.#volume;
  }

  get loopMode(): LoopMode {
    return this.#loopMode;
  }

  get tracks(): SuwakuTrack[] {
    return this.#queue.tracks;
  }

  get position(): number {
    return this.#position;
  }

  get playing(): boolean {
    return this.#playing;
  }

  get paused(): boolean {
    return this.#paused;
  }

  get filters(): Record<string, unknown> {
    return { ...this.#filters };
  }

  get filterManager(): FilterManager {
    return this.#filterManager;
  }

  set filterManager(fm: FilterManager) {
    this.#filterManager = fm;
  }

  get options(): PlayerOptions {
    return { ...this.#options };
  }

  get currentTrack(): SuwakuTrack | null {
    return this.#currentTrack;
  }

  set currentTrack(track: SuwakuTrack | null) {
    this.#currentTrack = track;
  }

  get queue(): SuwakuQueue {
    return this.#queue;
  }

  get connected(): boolean {
    return this.#node !== null && this.#state !== PlayerState.DESTROYED && this.#discordVoiceConnected;
  }

  get node(): LavalinkNode | null {
    return this.#node;
  }

  set node(node: LavalinkNode | null) {
    this.#node = node;
  }

  get destroyReason(): PlayerDestroyReason | null {
    return this.#destroyReason;
  }

  setDiscordVoiceConnected(connected: boolean): void {
    this.#discordVoiceConnected = connected;
  }

  // ==================== State Management ====================

  setState(state: PlayerState): void {
    validateObject(state, 'State');
    this.#state = state;
  }

  setVolume(volume: number): void {
    validateNumber(volume, 'Volume');
    validateRange(volume, 'Volume', 0, 1000);
    this.#volume = volume;
    this.#sendToNode(LavalinkOpcode.VOLUME, { volume });
  }

  setPlaying(playing: boolean): void {
    this.#playing = playing;
    if (playing) {
      this.#paused = false;
      this.#state = PlayerState.PLAYING;
    } else {
      this.#state = PlayerState.IDLE;
    }
  }

  setPaused(paused: boolean): void {
    this.#paused = paused;
    if (paused) {
      this.#playing = false;
      this.#state = PlayerState.PAUSED;
    } else {
      this.#playing = true;
      this.#state = PlayerState.PLAYING;
    }
  }

  setPosition(position: number): void {
    validateNumber(position, 'Position');
    this.#position = Math.max(0, position);
  }

  setLoopMode(mode: LoopMode): void {
    if (!Object.values(LoopMode).includes(mode)) {
      throw new ValidationError('Invalid loop mode', ErrorCode.INVALID_INPUT);
    }
    this.#loopMode = mode;
    this.emit(PlayerEvent.LOOP_CHANGE, mode);
  }

  setTextChannelId(textChannelId: string | null): void {
    if (textChannelId !== null) {
      validateNonEmptyString(textChannelId, 'Text channel ID');
    }
    this.#textChannelId = textChannelId;
  }

  setVoiceChannelId(voiceChannelId: string): void {
    validateNonEmptyString(voiceChannelId, 'Voice channel ID');
    this.#voiceChannelId = voiceChannelId;
  }

  // ==================== Queue Delegation ====================

  addTrack(track: SuwakuTrack, index?: number): SuwakuTrack {
    return this.#queue.add(track, index);
  }

  addTracks(tracks: SuwakuTrack[], index?: number): SuwakuTrack[] {
    return this.#queue.addMultiple(tracks, index);
  }

  async addTracksBatch(tracks: SuwakuTrack[], playlistInfo?: any): Promise<void> {
    // Process tracks in batches to avoid blocking the event loop
    const batchSize = 50;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      this.addTracks(batch);
      // Small delay to prevent blocking
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  handleVoiceStateUpdate(voiceChannelEmpty: boolean = false): void {
    if (voiceChannelEmpty && this.#node) {
      const onDisconnect = this.#options.onDisconnect as string | undefined;
      if (onDisconnect && onDisconnect !== 'manual') {
        this.destroy(onDisconnect as PlayerDestroyReason).catch((error) => {
          this.emit('debug', `Failed to destroy player on disconnect: ${error.message}`);
        });
        return;
      }
    }

    if (this.#options.leaveOnEmpty && this.#queue.isEmpty && !this.#playing) {
      if (this.#idleTimeout) clearTimeout(this.#idleTimeout);
      const delay = (this.#options.leaveOnEmptyDelay as number) ?? 60_000;
      this.#idleTimeout = setTimeout(() => {
        if (this.#queue.isEmpty && !this.#playing && this.#node) {
          this.destroy(PlayerDestroyReason.VOICE_CHANNEL_EMPTY).catch((error) => {
            this.emit('debug', `Failed to destroy player on empty channel: ${error.message}`);
          });
        }
      }, delay);
    }
  }

  // ==================== Player Controls ====================

  async play(track: SuwakuTrack, options?: { startTime?: number; endTime?: number; noReplace?: boolean }): Promise<void> {
    validateObject(track, 'Track');

    this.#currentTrack = track;
    this.#playing = true;
    this.#paused = false;
    this.#state = PlayerState.PLAYING;
    this.#position = options?.startTime ?? 0;

    const payload: Record<string, unknown> = {
      encoded: track.encoded,
      position: this.#position
    };

    if (options?.endTime) {
      payload.endTime = options.endTime;
    }

    if (options?.noReplace) {
      payload.noReplace = true;
    }

    await this.#sendToNode(LavalinkOpcode.PLAY, payload);
  }

  async pause(): Promise<void> {
    if (!this.#playing || this.#paused) return;
    await this.#sendToNode(LavalinkOpcode.PAUSE, { pause: true });
    this.setPaused(true);
    this.emit(PlayerEvent.PAUSE);
  }

  async resume(): Promise<void> {
    if (!this.#playing || !this.#paused) return;
    await this.#sendToNode(LavalinkOpcode.PAUSE, { pause: false });
    this.setPaused(false);
    this.emit(PlayerEvent.RESUME);
  }

  async stop(): Promise<void> {
    await this.#sendToNode(LavalinkOpcode.STOP);
    this.#playing = false;
    this.#paused = false;
    this.#state = PlayerState.IDLE;
    this.#currentTrack = null;
    this.#position = 0;
    this.emit(PlayerEvent.STOP);
  }

  async skip(): Promise<void> {
    if (this.#queue.isEmpty) {
      await this.stop();
      return;
    }

    const nextTrack = this.#queue.dequeue();
    if (nextTrack) {
      await this.play(nextTrack);
    }
  }

  async seek(position: number): Promise<void> {
    validateNumber(position, 'Position');
    validateRange(position, 'Position', 0, this.#currentTrack?.duration ?? Number.MAX_SAFE_INTEGER);
    await this.#sendToNode(LavalinkOpcode.SEEK, { position });
    this.#position = position;
    this.emit(PlayerEvent.SEEK, position);
  }

  async seekForward(milliseconds: number): Promise<void> {
    validateNumber(milliseconds, 'Milliseconds');
    await this.seek(this.#position + milliseconds);
  }

  async seekBackward(milliseconds: number): Promise<void> {
    validateNumber(milliseconds, 'Milliseconds');
    await this.seek(Math.max(0, this.#position - milliseconds));
  }

  async restart(): Promise<void> {
    if (!this.#currentTrack) return;
    await this.seek(0);
  }

  async replay(): Promise<void> {
    if (!this.#currentTrack) return;
    await this.play(this.#currentTrack);
  }

  setLeaveOnEmpty(leaveOnEmpty: boolean): void {
    this.#options.leaveOnEmpty = leaveOnEmpty;
  }

  toggleAutoplay(): void {
    this.#options.autoPlay = !this.#options.autoPlay;
    this.emit(PlayerEvent.AUTOPLAY_CHANGE, this.#options.autoPlay);
  }

  setAutoplay(enabled: boolean): void {
    this.#options.autoPlay = enabled;
    this.emit(PlayerEvent.AUTOPLAY_CHANGE, enabled);
  }

  // ==================== Convenience Methods ====================

  /**
   * Get the current playback position
   * @returns Current position in milliseconds
   */
  getCurrentPosition(): number {
    return this.#position;
  }

  /**
   * Set loop mode (alias for setLoopMode)
   * @param mode - Loop mode to set
   */
  setLoop(mode: LoopMode): void {
    this.setLoopMode(mode);
  }

  /**
   * Shuffle the queue
   */
  shuffleQueue(): void {
    this.#queue.shuffle();
    this.emit(PlayerEvent.QUEUE_SHUFFLE);
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.#queue.clear();
    this.emit(PlayerEvent.QUEUE_UPDATE);
  }

  /**
   * Remove a track from the queue by position
   * @param position - Position in the queue
   * @returns Removed track or undefined
   */
  removeTrack(position: number): SuwakuTrack | undefined {
    return this.#queue.remove(position);
  }

  /**
   * Jump to a specific position in the queue
   * @param position - Position to jump to
   */
  jumpTo(position: number): void {
    this.#queue.skipTo(position);
  }

  /**
   * Go back to the previous track
   */
  async back(): Promise<void> {
    const previousTrack = this.#queue.back();
    if (previousTrack) {
      await this.play(previousTrack);
    }
  }

  // ==================== SponsorBlock ====================

  /**
   * Set SponsorBlock segments to skip
   * @param categories - Categories to skip (sponsor, intro, outro, interaction, selfpromo, music_offtopic)
   */
  async setSponsorBlock(categories: SponsorBlockCategory[]): Promise<void> {
    if (!Array.isArray(categories)) {
      throw new ValidationError('Categories must be an array', ErrorCode.INVALID_INPUT);
    }
    this.#options.sponsorBlockCategories = categories;
    this.emit('sponsorBlockSet', categories);
  }

  // ==================== Dynamic Rhythm ====================

  /**
   * Toggle dynamic rhythm effect (automatically applies subtle effects based on track BPM)
   */
  toggleDynamicRhythm(): void {
    this.#options.dynamicRhythm = !this.#options.dynamicRhythm;
    this.emit('dynamicRhythmToggle', this.#options.dynamicRhythm);
  }

  /**
   * Set dynamic rhythm effect
   * @param enabled - Whether to enable dynamic rhythm
   */
  setDynamicRhythm(enabled: boolean): void {
    this.#options.dynamicRhythm = enabled;
    this.emit('dynamicRhythmToggle', enabled);
  }

  // ==================== Filter Methods ====================

  async applyFilterPreset(preset: string): Promise<void> {
    validateNonEmptyString(preset, 'Preset');
    await this.#filterManager.applyPreset(preset);
    this.#filters = this.#filterManager.getActiveFilters();
    await this.#updateFilters();
    this.emit(PlayerEvent.FILTERS_UPDATE, this.#filters);
  }

  async clearFilters(): Promise<void> {
    await this.#filterManager.clearFilters();
    this.#filters = {};
    await this.#updateFilters();
    this.emit(PlayerEvent.FILTERS_UPDATE, this.#filters);
  }

  async setFilters(filters: FilterSettings): Promise<void> {
    validateObject(filters, 'Filters');
    await this.#filterManager.setFilters(filters);
    this.#filters = this.#filterManager.getActiveFilters();
    await this.#updateFilters();
    this.emit(PlayerEvent.FILTERS_UPDATE, this.#filters);
  }

  // ==================== Connection Methods ====================

  async connect(): Promise<void> {
    if (!this.#node) {
      throw new Error('No node assigned to player');
    }
    this.#state = PlayerState.IDLE;
    this.emit(PlayerEvent.CONNECTING);
    // Connection to Lavalink is handled by VoiceStateManager
    // This method ensures the player is in a ready state
  }

  async disconnect(reason: PlayerDestroyReason = PlayerDestroyReason.MANUAL): Promise<void> {
    this.#destroyReason = reason;
    await this.stop();
    if (this.#node) {
      await this.#sendToNode(LavalinkOpcode.DESTROY);
    }
    this.#state = PlayerState.DESTROYED;
    this.emit(PlayerEvent.DISCONNECT, { reason });
  }

  async destroy(reason: PlayerDestroyReason = PlayerDestroyReason.MANUAL): Promise<void> {
    this.#destroyReason = reason;
    await this.disconnect(reason);
    if (this.#idleTimeout) {
      clearTimeout(this.#idleTimeout);
      this.#idleTimeout = null;
    }
    this.#queue.clear();
    this.removeAllListeners();
    this.emit(PlayerEvent.DESTROY, { reason });
  }

  async moveNode(node: LavalinkNode): Promise<void> {
    validateObject(node, 'Node');
    this.#node = node;
  }

  // ==================== Event Methods ====================

  emit(event: PlayerEvent | string, data?: unknown): void {
    this.#playerManager.emit(event, this, data);
  }

  on(event: PlayerEvent | string, listener: (...args: any[]) => void): void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event)!.add(listener);
    this.#playerManager.on(event, listener);
  }

  off(event: PlayerEvent | string, listener: (...args: any[]) => void): void {
    const eventListeners = this.#listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.#listeners.delete(event);
      }
    }
    this.#playerManager.off(event, listener);
  }

  removeAllListeners(): void {
    for (const [event, listeners] of this.#listeners) {
      for (const listener of listeners) {
        this.#playerManager.off(event, listener);
      }
    }
    this.#listeners.clear();
  }

  /**
   * Set a mock node for testing purposes
   * @param node - Mock node to use
   */
  setMockNode(node: { connected: boolean; send: (op: string, payload: Record<string, unknown>) => Promise<void> }): void {
    this.#node = node as unknown as LavalinkNode;
  }

  // ==================== Private Methods ====================

  async #sendToNode(op: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.#node || !this.#node.connected) {
      throw new Error('Node not connected');
    }
    await this.#node.send(op, { guildId: this.#guildId, ...payload });
  }

  async #updateFilters(): Promise<void> {
    if (!this.#node || !this.#node.connected) return;
    await this.#sendToNode(LavalinkOpcode.FILTERS, this.#filters);
  }

  // ==================== Serialization ====================

  toJSON(): PlayerData {
    return {
      guildId: this.#guildId,
      voiceChannelId: this.#voiceChannelId,
      textChannelId: this.#textChannelId,
      state: this.#state,
      volume: this.#volume,
      loopMode: this.#loopMode,
      tracks: this.#queue.tracks.map(track => track.toJSON()),
      position: this.#position,
      playing: this.#playing,
      paused: this.#paused,
      filters: this.#filters,
      options: this.#options,
      currentTrack: this.#currentTrack?.toJSON() ?? null
    };
  }

  static from(
    data: PlayerData,
    playerManager: PlayerManager,
    filterManager: FilterManager
  ): SuwakuPlayer {
    const player = new SuwakuPlayer(
      data.guildId,
      data.voiceChannelId,
      data.textChannelId,
      data.options,
      playerManager,
      filterManager
    );

    player.#state = data.state;
    player.#volume = data.volume;
    player.#loopMode = data.loopMode;
    player.#queue = SuwakuQueue.from({
      tracks: data.tracks,
      previous: [],
      loopMode: data.loopMode,
      maxHistorySize: 50
    });
    player.#position = data.position;
    player.#playing = data.playing;
    player.#paused = data.paused;
    player.#filters = data.filters;
    player.#options = data.options;
    player.#currentTrack = data.currentTrack ? SuwakuTrack.from(data.currentTrack) : null;

    return player;
  }
}