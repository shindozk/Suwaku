// Test setup file
import { jest } from '@jest/globals';

// Mock timers
jest.useFakeTimers();

// Global test timeout
jest.setTimeout(10000);

// Suppress console.log during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Mock WebSocket for Lavalink tests
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((code: number, reason: Buffer) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  
  constructor(url: string, options?: any) {
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data: string) {}
  
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose(1000, Buffer.from('test'));
  }
}

global.WebSocket = MockWebSocket as any;

// Mock fetch for REST API tests
global.fetch = jest.fn<typeof fetch>().mockImplementation(async (url: string | URL | Request, options?: RequestInit) => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => {
      if (url.toString().includes('/v4/loadtracks')) {
        return {
          loadType: 'track',
          data: [{
            encoded: 'test-encoded',
            info: {
              identifier: 'test-id',
              isSeekable: true,
              author: 'Test Artist',
              length: 180000,
              isStream: false,
              position: 0,
              title: 'Test Track',
              uri: 'https://example.com/track',
              artworkUrl: null,
              isrc: null,
              sourceName: 'youtube',
              pluginInfo: {}
            }
          }]
        };
      }
      
      if (url.toString().includes('/v4/stats')) {
        return {
          players: 0,
          playingPlayers: 0,
          uptime: 1000000,
          memory: { free: 1000000, used: 500000, allocated: 2000000, reservable: 3000000 },
          cpu: { cores: 4, systemLoad: 0.1, lavalinkLoad: 0.05 }
        };
      }
      
      if (url.toString().includes('/v4/version')) {
        return {
          version: '3.7.7',
          semver: '3.7.7',
          major: 3,
          minor: 7,
          patch: 7,
          prerelease: '',
          build: '123',
          available: true
        };
      }
      
      return {};
    }
  } as unknown as Response;
  
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
});

// Mock Discord.js - use string keys to avoid TypeScript issues
const mockDiscord: any = {
  'Client': jest.fn().mockImplementation(() => ({
    ws: { on: jest.fn(), once: jest.fn() },
    on: jest.fn(),
    once: jest.fn(),
    user: { id: 'bot-id', username: 'TestBot' },
    guilds: { cache: new Map() }
  })),
  'GatewayIntentBits': { Guilds: 1, GuildVoiceStates: 2, GuildMessages: 4, MessageContent: 8 },
  'EmbedBuilder': jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis()
  })),
  'SlashCommandBuilder': jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
    addUserOption: jest.fn().mockReturnThis()
  })),
  'REST': jest.fn().mockImplementation(() => ({ put: (jest.fn() as any).mockResolvedValue(undefined) })),
  'Routes': { applicationCommands: jest.fn(), applicationGuildCommands: jest.fn() }
};

jest.mock('discord.js', () => mockDiscord);

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  }
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}