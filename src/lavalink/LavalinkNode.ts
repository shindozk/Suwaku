/**
 * Represents a Lavalink node connection
 * @module lavalink/LavalinkNode
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { SuwakuClient } from '../client/SuwakuClient';
import { LavalinkREST } from './LavalinkREST';
import {
  LavalinkOpcode,
  PlayerState,
  LavalinkTrackResponse,
  LavalinkLoadResponse,
  NodeStats,
  NodePlayer,
  NodeConfig
} from '../types';
import { validateNonEmptyString, validateNumber, validateObject, validateBoolean, validateRange } from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';

export class LavalinkNode extends EventEmitter {
  #id: string;
  #host: string;
  #port: number;
  #password: string;
  #secure: boolean;
  #ws: WebSocket | null = null;
  #ready: boolean = false;
  #reconnectAttempts: number = 0;
  #reconnectTimeout: NodeJS.Timeout | null = null;
  #heartbeatInterval: NodeJS.Timeout | null = null;
  #sessionId: string | null = null;
  #players: Map<string, NodePlayer> = new Map();
  #stats: NodeStats | null = null;
  #volume: number = 100;
  #client: SuwakuClient;
  #rest: LavalinkREST;
  #lastPingTimestamp: number = 0;
  #lastPongTimestamp: number = 0;

  constructor(config: NodeConfig, client: SuwakuClient) {
    super();
    validateObject(config, 'Node config');
    validateNonEmptyString(config.host, 'Node host');
    validateNumber(config.port, 'Node port');
    validateRange(config.port, 'Node port', 1, 65535);
    validateNonEmptyString(config.password, 'Node password');
    validateBoolean(config.secure ?? false, 'Node secure');
    validateObject(client, 'Client');

    this.#id = config.identifier ?? `${config.host}:${config.port}`;
    this.#host = config.host;
    this.#port = config.port;
    this.#password = config.password;
    this.#secure = config.secure ?? false;
    this.#client = client;
    this.#rest = new LavalinkREST(this);
  }

  // Expose private properties for LavalinkREST
  get client(): SuwakuClient { return this.#client; }
  get password(): string { return this.#password; }
  get secure(): boolean { return this.#secure; }
  get host(): string { return this.#host; }
  get port(): number { return this.#port; }

  get id(): string { return this.#id; }
  get connected(): boolean { return this.#ws?.readyState === WebSocket.OPEN; }
  get ready(): boolean { return this.#ready; }
  get sessionId(): string | null { return this.#sessionId; }
  get players(): Map<string, NodePlayer> { return new Map(this.#players); }
  get stats(): NodeStats | null { return this.#stats; }
  get volume(): number { return this.#volume; }
  get ping(): number {
    if (!this.#lastPongTimestamp || !this.#lastPingTimestamp) return 0;
    return this.#lastPongTimestamp - this.#lastPingTimestamp;
  }

  get reconnectAttempts(): number { return this.#reconnectAttempts; }

  get rest(): LavalinkREST { return this.#rest; }

  async connect(): Promise<void> {
    if (this.connected) { this.emit('debug', 'Node ' + this.#id + ' already connected'); return; }
    try {
      this.emit('debug', 'Connecting to node ' + this.#id + ' at ' + this.#host + ':' + this.#port);
      if (this.#reconnectTimeout) { clearTimeout(this.#reconnectTimeout); this.#reconnectTimeout = null; }
      const wsUrl = (this.#secure ? 'wss' : 'ws') + '://' + this.#host + ':' + this.#port + '/v4/websocket';
      this.#ws = new WebSocket(wsUrl, { headers: { Authorization: this.#password, 'User-Id': this.#client.clientId ?? this.#client.discordClient.user?.id ?? 'suwaku', 'Client-Name': 'Suwaku/1.3.0' } });
      this.#ws.on('open', () => this.#onOpen());
      this.#ws.on('message', (data) => this.#onMessage(data));
      this.#ws.on('close', (code, reason) => this.#onClose(code, reason));
      this.#ws.on('error', (error) => this.#onError(error));
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { reject(new Error('Connection timeout for node ' + this.#id)); }, 10000);
        this.once('nodeReady', () => { clearTimeout(timeout); resolve(); });
        this.once('nodeError', (error) => { clearTimeout(timeout); reject(error); });
      });
    } catch (error) { this.emit('error', error); throw error; }
  }

  async disconnect(): Promise<void> {
    this.emit('debug', 'Disconnecting from node ' + this.#id);
    if (this.#heartbeatInterval) { clearInterval(this.#heartbeatInterval); this.#heartbeatInterval = null; }
    if (this.#reconnectTimeout) { clearTimeout(this.#reconnectTimeout); this.#reconnectTimeout = null; }
    if (this.#ws) { this.#ws.close(); this.#ws = null; }
    this.#ready = false; this.#sessionId = null; this.#players.clear(); this.#stats = null;
    this.emit('nodeDisconnect', this, { reason: 'Manual disconnect' });
  }

  async destroy(): Promise<void> { await this.disconnect(); this.removeAllListeners(); }

  async send(op: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.connected || !this.#ws) { throw new Error('Not connected to node ' + this.#id); }
    const message = { op, ...payload };
    this.#ws.send(JSON.stringify(message));
    this.emit('debug', '[Node ' + this.#id + '] Sent: ' + JSON.stringify(message));
  }

  async voiceStateUpdate(guildId: string, event: Record<string, unknown>): Promise<void> {
    await this.send('voiceUpdate', { guildId, ...event });
  }

  async fetchStats(): Promise<import('../types').NodeStats | null> {
    try { return await this.#rest.getStats(); } catch (error) { this.emit('error', error); return null; }
  }

  async loadTrack(identifier: string): Promise<import('../types').LavalinkLoadResponse> {
    return this.#rest.loadTrack(identifier);
  }

  getHealth(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!this.connected) issues.push('Disconnected from Lavalink server');
    if (!this.ready) issues.push('Node not ready');
    if (this.#stats) {
      const cpuLoad = this.#stats.cpu.systemLoad;
      if (cpuLoad > 0.8) issues.push('High CPU load: ' + (cpuLoad * 100).toFixed(1) + '%');
      const memoryUsed = this.#stats.memory.used; const memoryAlloc = this.#stats.memory.allocated; const memoryUsage = memoryUsed / memoryAlloc;
      if (memoryUsage > 0.9) issues.push('High memory usage: ' + (memoryUsage * 100).toFixed(1) + '%');
    }
    return { healthy: issues.length === 0, issues };
  }

  #onOpen(): void { this.emit('debug', 'WebSocket connected for node ' + this.#id); this.#reconnectAttempts = 0; }

  #onMessage(data: WebSocket.Data): void {
    let message: Record<string, unknown>;
    try { message = JSON.parse(data.toString()); } catch (error) { this.emit('error', new Error('Failed to parse Lavalink message: ' + error)); return; }
    this.emit('debug', '[Node ' + this.#id + '] Received: ' + JSON.stringify(message));
    const op = message.op as string;
    switch (op) {
      case 'ready': this.#handleReady(message); break;
      case 'playerUpdate': this.#handlePlayerUpdate(message); break;
      case 'stats': this.#handleStats(message); break;
      case 'event': this.#handleEvent(message); break;
      case 'pong': this.#handlePong(message); break;
      default: this.emit('debug', '[Node ' + this.#id + '] Unhandled opcode: ' + op);
    }
  }

  #onClose(code: number, reason: Buffer): void {
    this.emit('debug', 'WebSocket closed for node ' + this.#id + ': ' + code + ' - ' + reason.toString());
    this.#ready = false; this.#ws = null;
    this.emit('nodeDisconnect', this, { code, reason: reason.toString() });
    this.#scheduleReconnect();
  }

  #onError(error: Error): void {
    this.emit('error', new Error('WebSocket error for node ' + this.#id + ': ' + error.message));
    this.#ready = false; if (this.#ws) { this.#ws.close(); this.#ws = null; }
  }

  #handleReady(message: Record<string, unknown>): void {
    this.#ready = true; this.#sessionId = message.sessionId as string ?? null;
    if (this.#heartbeatInterval) clearInterval(this.#heartbeatInterval);
    this.#heartbeatInterval = setInterval(() => {
      this.#lastPingTimestamp = Date.now();
      this.send('ping', { payload: this.#lastPingTimestamp });
    }, 30000);
    this.emit('nodeReady', this, message);
  }

  #handlePong(data: Record<string, unknown>): void {
    const sentAt = data.payload as number;
    if (sentAt) {
      this.#lastPongTimestamp = Date.now();
      this.#lastPingTimestamp = sentAt;
    }
  }

  #handlePlayerUpdate(message: Record<string, unknown>): void {
    const guildId = message.guildId as string; 
    const state = message.state as PlayerState;
    const existingPlayer = this.#players.get(guildId) || { guildId, state: PlayerState.IDLE, volume: 100, track: null, identifiers: [], position: 0, connected: false, ping: 0 };
    const updatedPlayer: NodePlayer = { 
      ...existingPlayer, 
      state, 
      volume: (message.volume as number) ?? existingPlayer.volume, 
      track: (message.track as string | null) ?? null, 
      position: (message.position as number) ?? existingPlayer.position, 
      connected: (message.connected as boolean) ?? existingPlayer.connected 
    };
    this.#players.set(guildId, updatedPlayer);
    this.emit('playerUpdate', updatedPlayer);
  }

  #handleStats(message: Record<string, unknown>): void {
    this.#stats = {
      players: message.players as number,
      playingPlayers: message.playingPlayers as number,
      uptime: message.uptime as number,
      memory: message.memory as NodeStats['memory'],
      cpu: message.cpu as NodeStats['cpu'],
      frameStats: message.frameStats as NodeStats['frameStats'],
      version: message.version as NodeStats['version']
    } as NodeStats;
    this.emit('nodeStats', this, this.#stats);
  }

  #handleEvent(message: Record<string, unknown>): void {
    const eventType = message.type as string; const guildId = message.guildId as string;
    switch (eventType) {
      case 'TrackStartEvent': this.emit('trackStart', { guildId, track: message.track }); break;
      case 'TrackEndEvent': this.emit('trackEnd', { guildId, track: message.track, reason: message.reason }); break;
      case 'TrackExceptionEvent': this.emit('trackException', { guildId, track: message.track, error: message.error }); break;
      case 'TrackStuckEvent': this.emit('trackStuck', { guildId, track: message.track, threshold: message.threshold }); break;
      case 'WebSocketClosedEvent': this.emit('websocketClosed', { guildId, code: message.code, reason: message.reason, byRemote: message.byRemote }); break;
      default: this.emit('debug', '[Node ' + this.#id + '] Unhandled event: ' + eventType);
    }
  }

  #scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts), 30000);
    if (this.#reconnectTimeout) clearTimeout(this.#reconnectTimeout);
    this.#reconnectTimeout = setTimeout(() => { this.connect().catch((error: Error) => { this.emit('error', new Error('Failed to reconnect to node ' + this.#id + ': ' + error)); }); }, delay);
    this.#reconnectAttempts++;
  }
}