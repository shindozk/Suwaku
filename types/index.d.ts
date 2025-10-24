// Type definitions for Suwaku
// Project: https://github.com/shindozk/suwaku
// Definitions by: shindozk

import { EventEmitter } from 'events';
import { Client, VoiceChannel, TextChannel, GuildMember } from 'discord.js';

export const version: string;

// ===== Main Client =====

export interface SuwakuOptions {
    nodes: NodeOptions[];
    defaultVolume?: number;
    defaultSearchSource?: string;
    autoPlay?: boolean;
    autoLeave?: boolean;
    autoLeaveDelay?: number;
    idleTimeout?: number;
    historySize?: number;
}

export interface NodeOptions {
    host: string;
    port: number;
    password: string;
    secure?: boolean;
    identifier?: string;
    retryAmount?: number;
    retryDelay?: number;
}

export interface PlayOptions {
    query: string;
    voiceChannel: VoiceChannel;
    textChannel?: TextChannel;
    member: GuildMember;
    source?: string;
}

export class SuwakuClient extends EventEmitter {
    constructor(discordClient: Client, options: SuwakuOptions);

    public readonly discordClient: Client;
    public readonly options: SuwakuOptions;
    public readonly version: string;
    public clientId: string | null;
    public ready: boolean;
    public nodes: NodeManager;
    public playerManager: PlayerManager;
    public searchManager: SearchManager;
    public voiceStates: VoiceStateManager;
    public players: Map<string, SuwakuPlayer>;

    public init(): Promise<void>;
    public play(options: PlayOptions): Promise<SuwakuTrack>;
    public search(query: string, options?: SearchOptions): Promise<SuwakuTrack[]>;
    public getPlayer(guildId: string): SuwakuPlayer | undefined;
    public createPlayer(options: PlayerOptions): SuwakuPlayer;
    public destroyPlayer(guildId: string): Promise<boolean>;
    public getStats(): ClientStats;
    public destroy(): Promise<void>;

    // Events
    public on(event: 'ready', listener: () => void): this;
    public on(event: 'nodeConnect', listener: (node: LavalinkNode) => void): this;
    public on(event: 'nodeDisconnect', listener: (node: LavalinkNode, data: any) => void): this;
    public on(event: 'trackStart', listener: (player: SuwakuPlayer, track: SuwakuTrack) => void): this;
    public on(event: 'trackEnd', listener: (player: SuwakuPlayer, track: SuwakuTrack, reason: string) => void): this;
    public on(event: 'queueEnd', listener: (player: SuwakuPlayer) => void): this;
    public on(event: 'error', listener: (error: Error) => void): this;
}

// ===== Player =====

export interface PlayerOptions {
    guildId: string;
    voiceChannelId: string;
    textChannelId?: string;
    node?: LavalinkNode;
}

export class SuwakuPlayer extends EventEmitter {
    constructor(client: SuwakuClient, options: PlayerOptions);

    public readonly client: SuwakuClient;
    public readonly guildId: string;
    public voiceChannelId: string;
    public textChannelId: string | null;
    public node: LavalinkNode;
    public queue: SuwakuQueue;
    public filters: FilterManager;
    public state: string;
    public connected: boolean;
    public paused: boolean;
    public volume: number;
    public position: number;
    public autoplay: boolean;
    public readonly playing: boolean;
    public readonly current: SuwakuTrack | null;
    public readonly loop: string;

    // Basic playback control
    public connect(): Promise<void>;
    public disconnect(): void;
    public play(track?: SuwakuTrack, options?: PlayTrackOptions): Promise<boolean>;
    public pause(): Promise<boolean>;
    public resume(): Promise<boolean>;
    public stop(): Promise<boolean>;
    public skip(amount?: number): Promise<boolean>;
    public seek(position: number): Promise<boolean>;
    public setVolume(volume: number): Promise<boolean>;
    public setLoop(mode: 'off' | 'track' | 'queue'): void;
    public setVoiceChannel(channelId: string): void;
    public setTextChannel(channelId: string): void;
    
    // Advanced playback control
    public replay(): Promise<boolean>;
    public seekForward(amount?: number): Promise<boolean>;
    public seekBackward(amount?: number): Promise<boolean>;
    public back(): Promise<boolean>;
    public jumpTo(position: number): Promise<boolean>;
    public getCurrentPosition(): number;
    public getRemainingTime(): number;
    public getTotalQueueDuration(): number;
    
    // Queue management
    public shuffleQueue(): SuwakuTrack[];
    public removeDuplicates(): number;
    public moveTrack(from: number, to: number): SuwakuTrack[];
    public removeTrack(position: number): SuwakuTrack;
    public clearQueue(): SuwakuTrack[];
    public addTrack(track: SuwakuTrack): number;
    public addTracks(tracks: SuwakuTrack[]): number;
    
    // History
    public getHistory(limit?: number): SuwakuTrack[];
    public clearHistory(): void;
    
    // Statistics
    public getStats(): PlayerDetailedStats;
    
    // Autoplay
    public setAutoplay(enabled: boolean): void;
    
    // Lifecycle
    public destroy(): Promise<void>;
    public getInfo(): PlayerInfo;
}

export interface PlayTrackOptions {
    startTime?: number;
    endTime?: number;
    noReplace?: boolean;
}

export interface PlayerInfo {
    guildId: string;
    voiceChannelId: string;
    textChannelId: string | null;
    state: string;
    connected: boolean;
    playing: boolean;
    paused: boolean;
    volume: number;
    position: number;
    loop: string;
    current: any;
    queue: any;
    node: string;
    createdAt: number;
}

// ===== Queue =====

export class SuwakuQueue {
    constructor(player: SuwakuPlayer);

    public readonly player: SuwakuPlayer;
    public tracks: SuwakuTrack[];
    public previous: SuwakuTrack[];
    public current: SuwakuTrack | null;
    public loop: string;
    public maxHistorySize: number;
    public readonly size: number;
    public readonly isEmpty: boolean;
    public readonly duration: number;
    public readonly formattedDuration: string;

    // Basic operations
    public add(track: SuwakuTrack): number;
    public addMultiple(tracks: SuwakuTrack[]): number;
    public remove(position: number): SuwakuTrack;
    public get(position: number): SuwakuTrack | undefined;
    public clear(): SuwakuTrack[];
    public shuffle(): SuwakuTrack[];
    public move(from: number, to: number): SuwakuTrack[];
    public peek(): SuwakuTrack | null;
    public shift(): SuwakuTrack | null;
    public back(): SuwakuTrack | null;
    public setLoop(mode: 'off' | 'track' | 'queue'): void;
    
    // Advanced operations
    public removeDuplicates(): number;
    public removeBy(predicate: (track: SuwakuTrack) => boolean): SuwakuTrack[];
    public getByRequester(userId: string): SuwakuTrack[];
    public removeByRequester(userId: string): SuwakuTrack[];
    public getBySource(source: string): SuwakuTrack[];
    public getByDuration(min: number, max: number): SuwakuTrack[];
    public search(query: string): SuwakuTrack[];
    public random(): SuwakuTrack | null;
    public first(count?: number): SuwakuTrack[];
    public last(count?: number): SuwakuTrack[];
    public has(predicate: ((track: SuwakuTrack) => boolean) | string): boolean;
    public indexOf(predicate: ((track: SuwakuTrack) => boolean) | string): number;
    public swap(index1: number, index2: number): SuwakuTrack[];
    public sort(property: 'title' | 'author' | 'duration' | 'addedAt', ascending?: boolean): SuwakuTrack[];
    
    // Iteration
    public filter(predicate: (track: SuwakuTrack) => boolean): SuwakuTrack[];
    public find(predicate: (track: SuwakuTrack) => boolean): SuwakuTrack | undefined;
    public slice(start?: number, end?: number): SuwakuTrack[];
    public reverse(): SuwakuTrack[];
    public forEach(callback: (track: SuwakuTrack, index: number) => void): void;
    public map<T>(callback: (track: SuwakuTrack, index: number) => T): T[];
    public toJSON(): any;
}

// ===== Track =====

export class SuwakuTrack {
    constructor(data: any, requester?: any);

    public readonly id: string;
    public encoded: string;
    public title: string;
    public author: string;
    public url: string;
    public identifier: string;
    public duration: number;
    public position: number;
    public source: string;
    public thumbnail: string | null;
    public isSeekable: boolean;
    public isStream: boolean;
    public isrc: string | null;
    public requester: any;
    public addedAt: number;
    public raw: any;
    public readonly formattedDuration: string;
    public readonly formattedPosition: string;
    public readonly progress: number;

    public getThumbnail(quality?: string): string | null;
    public setPosition(position: number): void;
    public setRequester(requester: any): void;
    public toJSON(): any;

    public static from(data: any, requester?: any): SuwakuTrack;
    public static fromEncoded(encoded: string, requester?: any): SuwakuTrack;
}

// ===== Managers =====

export class PlayerManager extends EventEmitter {
    constructor(client: SuwakuClient);

    public readonly client: SuwakuClient;
    public players: Map<string, SuwakuPlayer>;

    public create(options: PlayerOptions): SuwakuPlayer;
    public get(guildId: string): SuwakuPlayer | undefined;
    public has(guildId: string): boolean;
    public destroy(guildId: string): Promise<boolean>;
    public getAll(): SuwakuPlayer[];
    public getPlaying(): SuwakuPlayer[];
    public getIdle(): SuwakuPlayer[];
    public destroyAll(): Promise<number>;
    public getStats(): PlayerStats;
    public readonly size: number;
}

export interface SearchOptions {
    source?: string;
    limit?: number;
    requester?: any;
}

export class SearchManager {
    constructor(client: SuwakuClient);

    public readonly client: SuwakuClient;
    public cache: Map<string, any>;
    public cacheTTL: number;

    public search(query: string, options?: SearchOptions): Promise<SuwakuTrack[]>;
    public searchYouTube(query: string, options?: SearchOptions): Promise<SuwakuTrack[]>;
    public searchSoundCloud(query: string, options?: SearchOptions): Promise<SuwakuTrack[]>;
    public loadPlaylist(url: string, options?: any): Promise<PlaylistData>;
    public detectSource(url: string): string | null;
    public clearCache(): void;
    public getCacheStats(): CacheStats;
}

export class FilterManager {
    constructor(player: SuwakuPlayer);

    public readonly player: SuwakuPlayer;
    public filters: FilterData;

    // Preset filters
    public applyPreset(preset: string): Promise<boolean>;
    public setBassBoost(level: number): Promise<boolean>;
    public setNightcore(): Promise<boolean>;
    public setVaporwave(): Promise<boolean>;
    public set8D(): Promise<boolean>;
    public setKaraoke(options?: KaraokeOptions): Promise<boolean>;
    public setTremolo(options?: TremoloOptions): Promise<boolean>;
    public setVibrato(options?: VibratoOptions): Promise<boolean>;
    public setRotation(rotationHz?: number): Promise<boolean>;
    
    // Custom filters
    public setEqualizer(bands: EqualizerBand[]): Promise<boolean>;
    public setTimescale(options: TimescaleOptions): Promise<boolean>;
    public setDistortion(options?: DistortionOptions): Promise<boolean>;
    public setChannelMix(options?: ChannelMixOptions): Promise<boolean>;
    public setLowPass(smoothing?: number): Promise<boolean>;
    
    // Filter management
    public setFilters(filters: FilterData): Promise<boolean>;
    public removeFilter(filterName: string): Promise<boolean>;
    public clearFilters(): Promise<boolean>;
    public getActiveFilters(): FilterData;
    public hasFilter(filterName: string): boolean;
    
    // Static
    public static getPresets(): string[];
}

export const FilterPresets: {
    BASSBOOST_LOW: any;
    BASSBOOST_MEDIUM: any;
    BASSBOOST_HIGH: any;
    NIGHTCORE: any;
    VAPORWAVE: any;
    EIGHTD: any;
    KARAOKE: any;
    TREMOLO: any;
    VIBRATO: any;
    SOFT: any;
    POP: any;
    ROCK: any;
    ELECTRONIC: any;
    CLASSICAL: any;
};

export class NodeManager extends EventEmitter {
    constructor(client: SuwakuClient);

    public readonly client: SuwakuClient;
    public nodes: Map<string, LavalinkNode>;
    public initialized: boolean;

    public init(nodeConfigs: NodeOptions[]): void;
    public add(config: NodeOptions): LavalinkNode;
    public remove(identifier: string): boolean;
    public get(identifier: string): LavalinkNode | undefined;
    public has(identifier: string): boolean;
    public getAll(): LavalinkNode[];
    public getConnected(): LavalinkNode[];
    public getLeastUsed(): LavalinkNode | null;
    public getRandom(): LavalinkNode | null;
    public getBest(): LavalinkNode | null;
    public getByRegion(region: string): LavalinkNode | null;
    public connectAll(): void;
    public disconnectAll(): void;
    public getStats(): NodeStats[];
    public getNodeForPlayer(region?: string): LavalinkNode;
    public healthCheck(): Promise<HealthCheckResult>;
    public readonly size: number;
    public readonly connectedCount: number;
}

// ===== Lavalink =====

export class LavalinkNode extends EventEmitter {
    constructor(manager: any, options: NodeOptions);

    public readonly manager: any;
    public readonly options: NodeOptions;
    public readonly identifier: string;
    public ws: any;
    public connected: boolean;
    public reconnectAttempts: number;
    public calls: number;
    public stats: any;
    public reconnectTimeout: any;
    public rest: LavalinkREST;
    public sessionId: string | null;
    public readonly url: string;

    public connect(): void;
    public disconnect(code?: number, reason?: string): void;
    public send(payload: any): boolean;
    public getInfo(): NodeInfo;
}

export class LavalinkREST {
    constructor(node: LavalinkNode);

    public readonly node: LavalinkNode;
    public readonly baseURL: string;
    public readonly headers: any;

    public loadTracks(identifier: string): Promise<any>;
    public updatePlayer(guildId: string, data: any, noReplace?: boolean): Promise<any>;
    public destroyPlayer(guildId: string): Promise<void>;
    public getPlayer(guildId: string): Promise<any>;
    public getPlayers(): Promise<any[]>;
    public updateSession(data: any): Promise<any>;
    public getInfo(): Promise<any>;
    public getStats(): Promise<any>;
    public getVersion(): Promise<string>;
    public decodeTrack(track: string): Promise<any>;
    public decodeTracks(tracks: string[]): Promise<any[]>;
}

export class VoiceStateManager extends EventEmitter {
    constructor(client: SuwakuClient);

    public readonly client: SuwakuClient;
    public states: Map<string, any>;

    public handlePacket(packet: any): void;
    public get(guildId: string): any;
    public set(guildId: string, state: any): void;
    public delete(guildId: string): boolean;
    public clear(): void;
}

// ===== Interfaces =====

export interface ClientStats {
    version: string;
    ready: boolean;
    nodes: NodeStats[];
    players: PlayerStats;
    uptime: number;
}

export interface PlayerStats {
    total: number;
    playing: number;
    paused: number;
    idle: number;
    connected: number;
}

export interface NodeStats {
    identifier: string;
    connected: boolean;
    calls: number;
    reconnectAttempts: number;
    stats: any;
}

export interface NodeInfo {
    identifier: string;
    host: string;
    port: number;
    secure: boolean;
    connected: boolean;
    calls: number;
    stats: any;
    reconnectAttempts: number;
}

export interface PlaylistData {
    name: string;
    tracks: SuwakuTrack[];
    selectedTrack: number;
}

export interface CacheStats {
    size: number;
    ttl: number;
}

export interface HealthCheckResult {
    total: number;
    connected: number;
    disconnected: number;
    nodes: NodeHealthCheck[];
}

export interface NodeHealthCheck {
    identifier: string;
    connected: boolean;
    healthy: boolean;
    latency: number | null;
    error: string | null;
}

// ===== Filter Interfaces =====

export interface FilterData {
    equalizer?: EqualizerBand[];
    karaoke?: KaraokeOptions;
    timescale?: TimescaleOptions;
    tremolo?: TremoloOptions;
    vibrato?: VibratoOptions;
    rotation?: RotationOptions;
    distortion?: DistortionOptions;
    channelMix?: ChannelMixOptions;
    lowPass?: LowPassOptions;
    [key: string]: any;
}

export interface EqualizerBand {
    band: number;
    gain: number;
}

export interface KaraokeOptions {
    level?: number;
    monoLevel?: number;
    filterBand?: number;
    filterWidth?: number;
}

export interface TimescaleOptions {
    speed?: number;
    pitch?: number;
    rate?: number;
}

export interface TremoloOptions {
    frequency?: number;
    depth?: number;
}

export interface VibratoOptions {
    frequency?: number;
    depth?: number;
}

export interface RotationOptions {
    rotationHz?: number;
}

export interface DistortionOptions {
    sinOffset?: number;
    sinScale?: number;
    cosOffset?: number;
    cosScale?: number;
    tanOffset?: number;
    tanScale?: number;
    offset?: number;
    scale?: number;
}

export interface ChannelMixOptions {
    leftToLeft?: number;
    leftToRight?: number;
    rightToLeft?: number;
    rightToRight?: number;
}

export interface LowPassOptions {
    smoothing?: number;
}

// ===== Player Statistics =====

export interface PlayerDetailedStats {
    guildId: string;
    state: string;
    playing: boolean;
    paused: boolean;
    connected: boolean;
    volume: number;
    position: number;
    remainingTime: number;
    queueSize: number;
    queueDuration: number;
    totalDuration: number;
    historySize: number;
    loop: string;
    hasFilters: boolean;
    activeFilters: string[];
    uptime: number;
}

export default SuwakuClient;
