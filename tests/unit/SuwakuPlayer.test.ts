import { SuwakuPlayer } from '../../src/structures/SuwakuPlayer';
import { SuwakuQueue } from '../../src/structures/SuwakuQueue';
import { FilterManager } from '../../src/managers/FilterManager';
import { PlayerManager } from '../../src/managers/PlayerManager';
import { PlayerState, LoopMode, FilterPreset } from '../../src/types';
import { SuwakuTrack } from '../../src/structures/SuwakuTrack';
import { TrackData } from '../../src/types';

const createMockTrack = (overrides: Partial<any> = {}): SuwakuTrack => {
  const trackData = {
    id: `track-${Date.now()}-${Math.random()}`,
    title: 'Test Track',
    author: 'Test Artist',
    duration: 180000,
    ...overrides
  };
  return new SuwakuTrack(trackData);
};

const createMockPlayer = (): SuwakuPlayer => {
  const mockPlayerManager = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    players: new Map()
  } as any;

  const mockFilterManager = {
    applyPreset: jest.fn().mockResolvedValue(undefined),
    clearFilters: jest.fn().mockResolvedValue(undefined),
    setFilters: jest.fn().mockResolvedValue(undefined),
    getActiveFilters: jest.fn().mockReturnValue({}),
  } as any;

  const mockNode = {
    connected: true,
    send: jest.fn().mockResolvedValue(undefined)
  };

  const player = new SuwakuPlayer(
    'guild-123',
    'voice-456',
    'text-789',
    { volume: 80, historySize: 50 },
    mockPlayerManager,
    mockFilterManager
  );
  
  // Set a mock connected node for testing
  player.setMockNode(mockNode);
  
  return player;
};

describe('SuwakuPlayer', () => {
  let player: SuwakuPlayer;
  let track: any;

  beforeEach(() => {
    player = createMockPlayer();
    track = createMockTrack({ id: 'track-1', title: 'Test Track', duration: 180000 });
  });

  describe('initialization', () => {
    it('should initialize with correct defaults', () => {
      expect(player.guildId).toBe('guild-123');
      expect(player.voiceChannelId).toBe('voice-456');
      expect(player.textChannelId).toBe('text-789');
      expect(player.state).toBe('idle');
      expect(player.volume).toBe(80);
      expect(player.loopMode).toBe('off');
      expect(player.playing).toBe(false);
      expect(player.paused).toBe(false);
      expect(player.position).toBe(0);
      expect(player.queue).toBeInstanceOf(SuwakuQueue);
    });

    it('should use provided options', () => {
      const customPlayer = new (require('../../src/structures/SuwakuPlayer').SuwakuPlayer)(
        'guild-1',
        'voice-1',
        'text-1',
        { volume: 50, deaf: true, mute: false, historySize: 100 },
        { emit: jest.fn(), on: jest.fn(), off: jest.fn(), removeAllListeners: jest.fn() } as any,
        { applyPreset: jest.fn(), clearFilters: jest.fn(), setFilters: jest.fn(), getActiveFilters: jest.fn() } as any
      );

      expect(customPlayer.volume).toBe(50);
      expect(customPlayer.options.deaf).toBe(true);
      expect(customPlayer.queue.maxHistorySize).toBe(100);
    });
  });

  describe('state management', () => {
    it('should set playing state', () => {
      player.setPlaying(true);
      expect(player.playing).toBe(true);
      expect(player.state).toBe('playing');
      expect(player.paused).toBe(false);
    });

    it('should set paused state', () => {
      player.setPlaying(true);
      player.setPaused(true);
      
      expect(player.paused).toBe(true);
      expect(player.playing).toBe(false);
      expect(player.state).toBe('paused');
    });

    it('should resume from paused', () => {
      player.setPlaying(true);
      player.setPaused(true);
      player.setPaused(false);
      
      expect(player.paused).toBe(false);
      expect(player.playing).toBe(true);
      expect(player.state).toBe('playing');
    });

    it('should set position with bounds', () => {
      player.setPosition(50000);
      expect(player.position).toBe(50000);

      player.setPosition(-1000);
      expect(player.position).toBe(0);

      player.setPosition(200000);
      expect(player.position).toBe(200000);
    });

    it('should set loop mode', () => {
      player.setLoopMode(LoopMode.TRACK);
      expect(player.loopMode).toBe(LoopMode.TRACK);

      player.setLoopMode(LoopMode.QUEUE);
      expect(player.loopMode).toBe(LoopMode.QUEUE);
    });

    it('should set channel IDs', () => {
      player.setTextChannelId('new-text');
      expect(player.textChannelId).toBe('new-text');

      player.setVoiceChannelId('new-voice');
      expect(player.voiceChannelId).toBe('new-voice');
    });
  });

  describe('queue delegation', () => {
    it('should add track to queue', () => {
      const track = createMockTrack({ id: 't1' });
      const added = player.addTrack(track);
      
      expect(player.queue.size).toBe(1);
      expect(added.id).toBe(track.id);
    });

    it('should add multiple tracks', () => {
      const tracks = [
        createMockTrack({ id: '1' }),
        createMockTrack({ id: '2' }),
        createMockTrack({ id: '3' })
      ];
      
      player.addTracks(tracks);
      expect(player.queue.size).toBe(3);
    });
  });

  describe('filter management', () => {
    it('should apply filter preset', async () => {
      await player.applyFilterPreset(FilterPreset.NIGHTCORE);
      
      expect(player.filterManager.applyPreset).toHaveBeenCalledWith(FilterPreset.NIGHTCORE);
    });

    it('should clear filters', async () => {
      await player.clearFilters();
      
      expect(player.filterManager.clearFilters).toHaveBeenCalled();
    });

    it('should set custom filters', async () => {
      const filters = { equalizer: [{ band: 0, gain: 0.5 }] };
      await player.setFilters(filters);
      
      expect(player.filterManager.setFilters).toHaveBeenCalledWith(filters);
    });
  });

  describe('voice state handling', () => {
    it('should handle voice state update', () => {
      player.handleVoiceStateUpdate();
      // Should not throw and handle internal logic
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const track = createMockTrack({ id: 'track-1' });
      player.addTrack(track);
      player.setVolume(50);
      player.setLoopMode(LoopMode.TRACK);
      
      const json = player.toJSON();
      
      expect(json.guildId).toBe('guild-123');
      expect(json.volume).toBe(50);
      expect(json.loopMode).toBe(LoopMode.TRACK);
      expect(json.tracks.length).toBe(1);
    });

    it('should deserialize from JSON', () => {
      const track = createMockTrack({ id: 'track-1' });
      const player2 = createMockPlayer();
      player2.addTrack(track);
      player2.setVolume(60);
      player2.setLoopMode(LoopMode.QUEUE);
      
      const json = player2.toJSON();
      const restored = SuwakuPlayer.from(json, 
        { emit: jest.fn(), on: jest.fn(), off: jest.fn(), removeAllListeners: jest.fn() } as any,
        { applyPreset: jest.fn(), clearFilters: jest.fn(), setFilters: jest.fn(), getActiveFilters: jest.fn() } as any
      );
      
      expect(restored.guildId).toBe('guild-123');
      expect(restored.volume).toBe(60);
      expect(restored.loopMode).toBe(LoopMode.QUEUE);
      expect(restored.queue.size).toBe(1);
    });
  });
});