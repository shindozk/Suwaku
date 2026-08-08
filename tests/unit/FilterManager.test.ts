import { FilterManager } from '../../src/managers/FilterManager';
import { FilterPreset, FilterSettings, EqualizerBand } from '../../src/types';
import { SuwakuPlayer } from '../../src/structures/SuwakuPlayer';

const createMockPlayer = (): SuwakuPlayer => {
  const mockPlayerManager = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  } as any;

  const mockFilterManager = {
    applyPreset: jest.fn().mockResolvedValue(undefined),
    clearFilters: jest.fn().mockResolvedValue(undefined),
    setFilters: jest.fn().mockResolvedValue(undefined),
    getActiveFilters: jest.fn().mockReturnValue({}),
  } as any;

  return new SuwakuPlayer(
    'guild-123',
    'voice-456',
    'text-789',
    { volume: 80, historySize: 50 },
    { emit: jest.fn(), on: jest.fn(), off: jest.fn(), removeAllListeners: jest.fn() } as any,
    mockFilterManager
  );
};

describe('FilterManager', () => {
  let filterManager: FilterManager;
  let mockPlayer: any;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockPlayer = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
      node: { connected: true, send: jest.fn().mockResolvedValue(undefined) }
    };
    
    filterManager = new FilterManager(mockPlayer);
    emitSpy = jest.spyOn(filterManager, 'emit');
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  describe('presets', () => {
    it('should have all presets defined', () => {
      expect(FilterManager.PRESETS).toBeDefined();
      expect(Object.keys(FilterManager.PRESETS).length).toBeGreaterThan(10);
    });

    it('should apply nightcore preset', async () => {
      await filterManager.applyPreset('nightcore');
      
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate', expect.any(Object));
    });

    it('should apply bassboost presets', async () => {
      await filterManager.applyPreset('bassboost-low');
      await filterManager.applyPreset('bassboost-medium');
      await filterManager.applyPreset('bassboost-high');
      
      expect(emitSpy).toHaveBeenCalledTimes(3);
    });

    it('should throw for unknown preset', async () => {
      await expect(filterManager.applyPreset('unknown' as any))
        .rejects
        .toThrow('Unknown filter preset');
    });
  });

  describe('equalizer', () => {
    it('should set equalizer bands', async () => {
      const bands: EqualizerBand[] = [
        { band: 0, gain: 0.5 },
        { band: 1, gain: 0.3 },
        { band: 2, gain: 0.1 }
      ];
      
      await filterManager.setEqualizer(bands);
      
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate', expect.objectContaining({
        equalizer: bands
      }));
    });

    it('should validate band range', async () => {
      const invalidBands = [{ band: -1, gain: 0.5 }];
      await expect(filterManager.setEqualizer(invalidBands as any))
        .rejects
        .toThrow('Equalizer band must be between 0 and 13');
    });

    it('should validate gain range', async () => {
      const invalidBands = [{ band: 0, gain: 2.0 }];
      await expect(filterManager.setEqualizer(invalidBands as any))
        .rejects
        .toThrow('Equalizer gain must be between -0.25 and 1.0');
    });
  });

  describe('timescale effects', () => {
    it('should set nightcore', async () => {
      await filterManager.setNightcore(true);
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate', 
        expect.objectContaining({
          timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 }
        })
      );
    });

    it('should set vaporwave', async () => {
      await filterManager.setVaporwave(true);
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate',
        expect.objectContaining({
          timescale: { speed: 0.75, pitch: 0.75, rate: 1.0 }
        })
      );
    });

    it('should disable effects', async () => {
      await filterManager.setNightcore(true);
      await filterManager.setNightcore(false);
      
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate', {});
    });
  });

  describe('special effects', () => {
    it('should set 8D effect', async () => {
      await filterManager.set8D(true);
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate',
        expect.objectContaining({ rotation: { rotationHz: 0.2 } })
      );
    });

    it('should set karaoke', async () => {
      await filterManager.setKaraoke();
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate',
        expect.objectContaining({
          karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 }
        })
      );
    });

    it('should set tremolo', async () => {
      await filterManager.setTremolo({ frequency: 5, depth: 0.3 });
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate',
        expect.objectContaining({ tremolo: { frequency: 5, depth: 0.3 } })
      );
    });

    it('should set vibrato', async () => {
      await filterManager.setVibrato({ frequency: 4, depth: 0.5 });
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate',
        expect.objectContaining({ vibrato: { frequency: 4, depth: 0.5 } })
      );
    });

    it('should validate timescale ranges', async () => {
      await expect(filterManager.setTimescale({ speed: 3, pitch: 1, rate: 1 } as any))
        .rejects.toThrow('Timescale speed must be between 0.5 and 2.0');
    });
  });

  describe('filter management', () => {
    it('should clear all filters', async () => {
      await filterManager.setFilters({ equalizer: [{ band: 0, gain: 0.5 }] });
      await filterManager.clearFilters();
      
      expect(filterManager.getActiveFilters()).toEqual({});
    });

    it('should set multiple filters', async () => {
      const filters: any = {
        equalizer: [{ band: 0, gain: 0.5 }],
        timescale: { speed: 1.1, pitch: 1.1, rate: 1.0 }
      };
      
      await filterManager.setFilters(filters);
      
      expect(filterManager.getActiveFilters()).toEqual(filters);
    });

    it('should remove specific filter', async () => {
      await filterManager.setFilters({ 
        equalizer: [{ band: 0, gain: 0.5 }],
        timescale: { speed: 1.1, pitch: 1.1, rate: 1.0 }
      });
      
      filterManager.removeFilter('equalizer');
      
      expect(filterManager.getActiveFilters()).not.toHaveProperty('equalizer');
      expect(filterManager.getActiveFilters()).toHaveProperty('timescale');
    });

    it('should check if filter is active', async () => {
      await filterManager.setFilters({ equalizer: [{ band: 0, gain: 0.5 }] });
      
      expect(filterManager.hasFilter('equalizer')).toBe(true);
      expect(filterManager.hasFilter('timescale')).toBe(false);
    });

    it('should get filter payload for Lavalink', async () => {
      await filterManager.setFilters({ equalizer: [{ band: 0, gain: 0.5 }] });
      
      const payload = filterManager.getFilterPayload();
      expect(payload).toEqual({ equalizer: [{ band: 0, gain: 0.5 }] });
    });
  });

  describe('integration with player', () => {
    it('should emit filtersUpdate when player applies preset', async () => {
      const mockPlayer = {
        emit: jest.fn(),
        node: { connected: true, send: jest.fn().mockResolvedValue(undefined) }
      } as any;
      
      const filterManager = new FilterManager(mockPlayer as any);
      const emitSpy = jest.spyOn(filterManager, 'emit');
      await filterManager.applyPreset('nightcore');
      
      expect(emitSpy).toHaveBeenCalledWith('filtersUpdate', expect.any(Object));
      emitSpy.mockRestore();
    });
  });
});