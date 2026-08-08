/**
 * Manages audio filters and effects for players
 * @module managers/FilterManager
 */

import { EventEmitter } from 'events';
import { SuwakuPlayer } from '../structures/SuwakuPlayer';
import {
  FilterType,
  FilterPreset,
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
  FilterPresetEntry
} from '../types';
import { validateNonEmptyString, validateNumber, validateObject, validateArray } from '../utils/validators';
import { ValidationError, ErrorCode } from '../utils/errors';

/**
 * Manages audio filters and effects for players
 */
export class FilterManager extends EventEmitter {
  #player: SuwakuPlayer;
  #filters: Record<string, unknown> = {};

  constructor(player: SuwakuPlayer) {
    super();
    validateObject(player, 'Player');
    this.#player = player;
  }

  get player(): SuwakuPlayer {
    return this.#player;
  }

  get filters(): Record<string, unknown> {
    return { ...this.#filters };
  }

  /**
   * Filter preset configurations
   */
  static readonly PRESETS: Record<FilterPreset, FilterSettings> = {
    [FilterPreset.BASSBOOST_LOW]: [
      { band: 0, gain: 0.25 },
      { band: 1, gain: 0.20 },
      { band: 2, gain: 0.15 },
      { band: 3, gain: 0.10 },
      { band: 4, gain: 0.05 }
    ] as EqualizerBand[],
    [FilterPreset.BASSBOOST_MEDIUM]: [
      { band: 0, gain: 0.50 },
      { band: 1, gain: 0.40 },
      { band: 2, gain: 0.30 },
      { band: 3, gain: 0.20 },
      { band: 4, gain: 0.10 }
    ] as EqualizerBand[],
    [FilterPreset.BASSBOOST_HIGH]: [
      { band: 0, gain: 0.75 },
      { band: 1, gain: 0.60 },
      { band: 2, gain: 0.45 },
      { band: 3, gain: 0.30 },
      { band: 4, gain: 0.15 }
    ] as EqualizerBand[],
    [FilterPreset.NIGHTCORE]: {
      speed: 1.2,
      pitch: 1.2,
      rate: 1.0
    } as TimescaleSettings,
    [FilterPreset.VAPORWAVE]: {
      speed: 0.75,
      pitch: 0.75,
      rate: 1.0
    } as TimescaleSettings,
    [FilterPreset.EIGHTD]: {
      rotationHz: 0.2
    } as RotationSettings,
    [FilterPreset.KARAOKE]: {
      level: 1.0,
      monoLevel: 1.0,
      filterBand: 220.0,
      filterWidth: 100.0
    } as KaraokeSettings,
    [FilterPreset.TREMOLO]: {
      frequency: 4.0,
      depth: 0.5
    } as TremoloSettings,
    [FilterPreset.VIBRATO]: {
      frequency: 4.0,
      depth: 0.5
    } as VibratoSettings,
    [FilterPreset.SOFT]: [
      { band: 0, gain: 0.1 },
      { band: 1, gain: 0.1 },
      { band: 2, gain: 0.1 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0.1 }
    ] as EqualizerBand[],
    [FilterPreset.POP]: [
      { band: 0, gain: 0.0 },
      { band: 1, gain: 0.0 },
      { band: 2, gain: 0.0 },
      { band: 3, gain: 0.0 },
      { band: 4, gain: 0.0 }
    ] as EqualizerBand[],
    [FilterPreset.ELECTRONIC]: [
      { band: 0, gain: 0.1 },
      { band: 1, gain: 0.2 },
      { band: 2, gain: 0.3 },
      { band: 3, gain: 0.2 },
      { band: 4, gain: 0.1 }
    ] as EqualizerBand[],
    [FilterPreset.CLASSICAL]: [
      { band: 0, gain: 0.05 },
      { band: 1, gain: 0.1 },
      { band: 2, gain: 0.15 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0.05 }
    ] as EqualizerBand[],
    [FilterPreset.ROCK]: [
      { band: 0, gain: 0.15 },
      { band: 1, gain: 0.25 },
      { band: 2, gain: 0.2 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0.05 }
    ] as EqualizerBand[],
    [FilterPreset.ROBOT]: {
      speed: 1.0,
      pitch: 0.8,
      rate: 1.0
    } as TimescaleSettings,
    [FilterPreset.CHIPMUNK]: {
      speed: 1.25,
      pitch: 1.5,
      rate: 1.0
    } as TimescaleSettings,
    [FilterPreset.MONSTER]: {
      speed: 0.75,
      pitch: 0.6,
      rate: 1.0
    } as TimescaleSettings,
    [FilterPreset.TELEPHONE]: {
      highPass: 500,
      lowPass: 2000
    } as Record<string, unknown>,
    [FilterPreset.RADIO]: [
      { band: 0, gain: 0.2 },
      { band: 1, gain: 0.3 },
      { band: 2, gain: 0.2 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0.05 }
    ] as EqualizerBand[]
  };

  /**
   * Apply a filter preset
   * @param preset - Filter preset to apply
   */
  async applyPreset(preset: FilterPreset | string): Promise<void> {
    validateNonEmptyString(preset, 'Preset');

    const presetStr = preset as FilterPreset;
    const settings = FilterManager.PRESETS[presetStr];

    if (!settings) {
      throw new ValidationError(`Unknown filter preset: ${presetStr}`, ErrorCode.INVALID_INPUT);
    }

    // Handle equalizer band arrays by wrapping them in an object
    if (Array.isArray(settings)) {
      await this.setFilters({ equalizer: settings });
    } else {
      await this.setFilters(settings);
    }
  }

  /**
   * Set equalizer bands
   * @param bands - Equalizer bands to set
   */
  async setEqualizer(bands: EqualizerBand[]): Promise<void> {
    validateArray(bands, 'Equalizer bands');

    bands.forEach((band, index) => {
      validateObject(band, `Equalizer band ${index}`);
      validateNumber(band.band, `Equalizer band ${index}.band`);
      validateNumber(band.gain, `Equalizer band ${index}.gain`);

      if (band.band < 0 || band.band > 13) {
        throw new ValidationError('Equalizer band must be between 0 and 13', ErrorCode.INVALID_INPUT);
      }

      if (band.gain < -0.25 || band.gain > 1.0) {
        throw new ValidationError('Equalizer gain must be between -0.25 and 1.0', ErrorCode.INVALID_INPUT);
      }
    });

    await this.setFilters({ equalizer: bands });
  }

  /**
   * Set nightcore effect
   * @param enabled - Whether to enable nightcore
   */
  async setNightcore(enabled = true): Promise<void> {
    if (enabled) {
      await this.setFilters({
        timescale: {
          speed: 1.2,
          pitch: 1.2,
          rate: 1.0
        } as TimescaleSettings
      });
    } else {
      await this.clearFilters();
    }
  }

  /**
   * Set vaporwave effect
   * @param enabled - Whether to enable vaporwave
   */
  async setVaporwave(enabled = true): Promise<void> {
    if (enabled) {
      await this.setFilters({
        timescale: {
          speed: 0.75,
          pitch: 0.75,
          rate: 1.0
        } as TimescaleSettings
      });
    } else {
      await this.clearFilters();
    }
  }

  /**
   * Set 8D effect
   * @param enabled - Whether to enable 8D effect
   */
  async set8D(enabled = true): Promise<void> {
    if (enabled) {
      await this.setFilters({
        rotation: {
          rotationHz: 0.2
        } as RotationSettings
      });
    } else {
      await this.clearFilters();
    }
  }

  /**
   * Set karaoke effect
   * @param settings - Karaoke settings
   */
  async setKaraoke(settings?: KaraokeSettings): Promise<void> {
    const karaokeSettings = settings ?? {
      level: 1.0,
      monoLevel: 1.0,
      filterBand: 220.0,
      filterWidth: 100.0
    };

    validateObject(karaokeSettings, 'Karaoke settings');
    validateNumber(karaokeSettings.level, 'Karaoke level');
    validateNumber(karaokeSettings.monoLevel, 'Karaoke mono level');
    validateNumber(karaokeSettings.filterBand, 'Karaoke filter band');
    validateNumber(karaokeSettings.filterWidth, 'Karaoke filter width');

    if (karaokeSettings.level < 0.0 || karaokeSettings.level > 1.0) {
      throw new ValidationError('Karaoke level must be between 0.0 and 1.0', ErrorCode.INVALID_INPUT);
    }

    if (karaokeSettings.monoLevel < 0.0 || karaokeSettings.monoLevel > 1.0) {
      throw new ValidationError('Karaoke mono level must be between 0.0 and 1.0', ErrorCode.INVALID_INPUT);
    }

    await this.setFilters({ karaoke: karaokeSettings });
  }

  /**
   * Set timescale effect
   * @param settings - Timescale settings
   */
  async setTimescale(settings: TimescaleSettings): Promise<void> {
    validateObject(settings, 'Timescale settings');
    validateNumber(settings.speed, 'Timescale speed');
    validateNumber(settings.pitch, 'Timescale pitch');
    validateNumber(settings.rate, 'Timescale rate');

    if (settings.speed < 0.5 || settings.speed > 2.0) {
      throw new ValidationError('Timescale speed must be between 0.5 and 2.0', ErrorCode.INVALID_INPUT);
    }

    if (settings.pitch < 0.5 || settings.pitch > 2.0) {
      throw new ValidationError('Timescale pitch must be between 0.5 and 2.0', ErrorCode.INVALID_INPUT);
    }

    if (settings.rate < 0.5 || settings.rate > 2.0) {
      throw new ValidationError('Timescale rate must be between 0.5 and 2.0', ErrorCode.INVALID_INPUT);
    }

    await this.setFilters(settings);
  }

  /**
   * Set tremolo effect
   * @param settings - Tremolo settings
   */
  async setTremolo(settings: TremoloSettings): Promise<void> {
    validateObject(settings, 'Tremolo settings');
    validateNumber(settings.frequency, 'Tremolo frequency');
    validateNumber(settings.depth, 'Tremolo depth');

    if (settings.depth < 0.0 || settings.depth > 1.0) {
      throw new ValidationError('Tremolo depth must be between 0.0 and 1.0', ErrorCode.INVALID_INPUT);
    }

    await this.setFilters({ tremolo: settings });
  }

  /**
   * Set vibrato effect
   * @param settings - Vibrato settings
   */
  async setVibrato(settings: VibratoSettings): Promise<void> {
    validateObject(settings, 'Vibrato settings');
    validateNumber(settings.frequency, 'Vibrato frequency');
    validateNumber(settings.depth, 'Vibrato depth');

    if (settings.depth < 0.0 || settings.depth > 1.0) {
      throw new ValidationError('Vibrato depth must be between 0.0 and 1.0', ErrorCode.INVALID_INPUT);
    }

    await this.setFilters({ vibrato: settings });
  }

  /**
   * Set rotation effect
   * @param settings - Rotation settings
   */
  async setRotation(settings: RotationSettings): Promise<void> {
    validateObject(settings, 'Rotation settings');
    validateNumber(settings.rotationHz, 'Rotation rotationHz');

    await this.setFilters(settings);
  }

  /**
   * Set distortion effect
   * @param settings - Distortion settings
   */
  async setDistortion(settings: DistortionSettings): Promise<void> {
    validateObject(settings, 'Distortion settings');
    await this.setFilters(settings);
  }

  /**
   * Set channel mix effect
   * @param settings - Channel mix settings
   */
  async setChannelMix(settings: ChannelMixSettings): Promise<void> {
    validateObject(settings, 'Channel mix settings');
    await this.setFilters(settings);
  }

  /**
   * Set low pass filter
   * @param settings - Low pass settings
   */
  async setLowPass(settings: LowPassSettings): Promise<void> {
    validateObject(settings, 'Low pass settings');
    validateNumber(settings.smoothing, 'Low pass smoothing');

    if (settings.smoothing < 0.0 || settings.smoothing > 1.0) {
      throw new ValidationError('Low pass smoothing must be between 0.0 and 1.0', ErrorCode.INVALID_INPUT);
    }

    await this.setFilters(settings);
  }

  /**
   * Clear all filters
   */
  async clearFilters(): Promise<void> {
    this.#filters = {};
    await this.#updateFilters();
    this.emit('filtersUpdate', this.#filters);
  }

  /**
   * Set multiple filters at once
   * @param filters - Filter settings to apply
   */
  async setFilters(filters: FilterSettings): Promise<void> {
    validateObject(filters, 'Filters');

    Object.assign(this.#filters, filters);

    await this.#updateFilters();

    this.emit('filtersUpdate', this.#filters);
  }

  /**
   * Get active filters
   * @returns Currently active filters
   */
  getActiveFilters(): Record<string, unknown> {
    return { ...this.#filters };
  }

  /**
   * Remove a specific filter
   * @param filterType - Type of filter to remove
   */
  removeFilter(filterType: FilterType | string): void {
    const type = typeof filterType === 'string' ? filterType : filterType;

    switch (type) {
      case FilterType.EQUALIZER:
        delete this.#filters.equalizer;
        break;
      case FilterType.TIMESCALE:
        delete this.#filters.timescale;
        break;
      case FilterType.KARAOKE:
        delete this.#filters.karaoke;
        break;
      case FilterType.TREMOLO:
        delete this.#filters.tremolo;
        break;
      case FilterType.VIBRATO:
        delete this.#filters.vibrato;
        break;
      case FilterType.ROTATION:
        delete this.#filters.rotation;
        break;
      case FilterType.DISTORTION:
        delete this.#filters.distortion;
        break;
      case FilterType.CHANNEL_MIX:
        delete this.#filters.channelMix;
        break;
      case FilterType.LOW_PASS:
        delete this.#filters.lowPass;
        break;
      default:
        delete this.#filters[type];
        break;
    }

    this.#updateFilters();
    this.emit('filtersUpdate', this.#filters);
  }

  /**
   * Check if a specific filter is active
   * @param filterType - Type of filter to check
   * @returns True if filter is active
   */
  hasFilter(filterType: FilterType | string): boolean {
    const type = typeof filterType === 'string' ? filterType : filterType;
    return Object.prototype.hasOwnProperty.call(this.#filters, type);
  }

  /**
   * Get filter settings for Lavalink
   * @returns Filter payload for Lavalink
   */
  getFilterPayload(): Record<string, unknown> {
    return { ...this.#filters };
  }

  /**
   * Private method to update filters on Lavalink node
   * @private
   */
  async #updateFilters(): Promise<void> {
    if (!this.#player.node || !this.#player.node.connected) return;

    try {
      await this.#player.node.send('filters', {
        guildId: this.#player.guildId,
        ...this.#filters
      });
    } catch (error) {
      this.#player.emit('error', error);
    }
  }
}
