/**
 * Filter Manager - Manages audio filters for players
 * @module managers/FilterManager
 */

import { validateNumber, validateRange, validateObject } from '../utils/validators.js';

/**
 * Preset filter configurations
 */
const FilterPresets = {
  BASSBOOST_LOW: {
    equalizer: [
      { band: 0, gain: 0.2 },
      { band: 1, gain: 0.15 },
      { band: 2, gain: 0.1 }
    ]
  },
  BASSBOOST_MEDIUM: {
    equalizer: [
      { band: 0, gain: 0.4 },
      { band: 1, gain: 0.3 },
      { band: 2, gain: 0.2 }
    ]
  },
  BASSBOOST_HIGH: {
    equalizer: [
      { band: 0, gain: 0.6 },
      { band: 1, gain: 0.45 },
      { band: 2, gain: 0.3 }
    ]
  },
  NIGHTCORE: {
    timescale: {
      speed: 1.1,
      pitch: 1.2,
      rate: 1.0
    }
  },
  VAPORWAVE: {
    timescale: {
      speed: 0.8,
      pitch: 0.8,
      rate: 1.0
    }
  },
  EIGHTD: {
    rotation: {
      rotationHz: 0.2
    }
  },
  KARAOKE: {
    karaoke: {
      level: 1.0,
      monoLevel: 1.0,
      filterBand: 220.0,
      filterWidth: 100.0
    }
  },
  TREMOLO: {
    tremolo: {
      frequency: 2.0,
      depth: 0.5
    }
  },
  VIBRATO: {
    vibrato: {
      frequency: 2.0,
      depth: 0.5
    }
  },
  SOFT: {
    equalizer: [
      { band: 0, gain: 0 },
      { band: 1, gain: 0 },
      { band: 2, gain: 0 },
      { band: 3, gain: 0 },
      { band: 4, gain: 0 },
      { band: 5, gain: 0 },
      { band: 6, gain: -0.25 },
      { band: 7, gain: -0.25 },
      { band: 8, gain: -0.25 },
      { band: 9, gain: -0.25 },
      { band: 10, gain: -0.25 },
      { band: 11, gain: -0.25 },
      { band: 12, gain: -0.25 },
      { band: 13, gain: -0.25 }
    ]
  },
  POP: {
    equalizer: [
      { band: 0, gain: -0.02 },
      { band: 1, gain: -0.01 },
      { band: 2, gain: 0.08 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0.15 },
      { band: 5, gain: 0.1 },
      { band: 6, gain: 0.03 },
      { band: 7, gain: -0.02 },
      { band: 8, gain: -0.035 },
      { band: 9, gain: -0.05 },
      { band: 10, gain: -0.05 },
      { band: 11, gain: -0.05 },
      { band: 12, gain: -0.05 },
      { band: 13, gain: -0.05 }
    ]
  },
  ROCK: {
    equalizer: [
      { band: 0, gain: 0.3 },
      { band: 1, gain: 0.25 },
      { band: 2, gain: 0.2 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0.05 },
      { band: 5, gain: -0.05 },
      { band: 6, gain: -0.15 },
      { band: 7, gain: -0.2 },
      { band: 8, gain: -0.1 },
      { band: 9, gain: 0.05 },
      { band: 10, gain: 0.15 },
      { band: 11, gain: 0.2 },
      { band: 12, gain: 0.25 },
      { band: 13, gain: 0.3 }
    ]
  },
  ELECTRONIC: {
    equalizer: [
      { band: 0, gain: 0.375 },
      { band: 1, gain: 0.35 },
      { band: 2, gain: 0.125 },
      { band: 3, gain: 0 },
      { band: 4, gain: -0.125 },
      { band: 5, gain: 0.125 },
      { band: 6, gain: -0.125 },
      { band: 7, gain: 0 },
      { band: 8, gain: 0.25 },
      { band: 9, gain: 0.125 },
      { band: 10, gain: 0.15 },
      { band: 11, gain: 0.2 },
      { band: 12, gain: 0.25 },
      { band: 13, gain: 0.35 }
    ]
  },
  CLASSICAL: {
    equalizer: [
      { band: 0, gain: 0.375 },
      { band: 1, gain: 0.35 },
      { band: 2, gain: 0.125 },
      { band: 3, gain: 0 },
      { band: 4, gain: 0 },
      { band: 5, gain: 0.125 },
      { band: 6, gain: 0.15 },
      { band: 7, gain: 0.05 },
      { band: 8, gain: 0.25 },
      { band: 9, gain: 0.2 },
      { band: 10, gain: 0.25 },
      { band: 11, gain: 0.3 },
      { band: 12, gain: 0.25 },
      { band: 13, gain: 0.3 }
    ]
  },
  // --- NOVAS FUNÇÕES INOVADORAS (SUWAKU EXCLUSIVE) ---
  ROBOT: {
    tremolo: { frequency: 50.0, depth: 0.8 },
    vibrato: { frequency: 50.0, depth: 0.8 },
    distortion: { sinOffset: 0.5, sinScale: 1.0, cosOffset: 0.5, cosScale: 1.0, tanOffset: 0.5, tanScale: 1.0, offset: 0.5, scale: 1.0 }
  },
  CHIPMUNK: {
    timescale: { speed: 1.0, pitch: 1.5, rate: 1.0 }
  },
  MONSTER: {
    timescale: { speed: 1.0, pitch: 0.5, rate: 1.0 }
  },
  TELEPHONE: {
    equalizer: [
      { band: 0, gain: -1.0 }, { band: 1, gain: -1.0 }, { band: 2, gain: -1.0 },
      { band: 3, gain: -1.0 }, { band: 4, gain: -1.0 }, { band: 5, gain: 0.5 },
      { band: 6, gain: 0.5 }, { band: 7, gain: 0.5 }, { band: 8, gain: 0.5 },
      { band: 9, gain: -1.0 }, { band: 10, gain: -1.0 }, { band: 11, gain: -1.0 },
      { band: 12, gain: -1.0 }, { band: 13, gain: -1.0 }
    ]
  },
  RADIO: {
    equalizer: [
      { band: 0, gain: -0.5 }, { band: 1, gain: -0.5 }, { band: 2, gain: -0.5 },
      { band: 3, gain: 0.2 }, { band: 4, gain: 0.2 }, { band: 5, gain: 0.2 },
      { band: 6, gain: 0.2 }, { band: 7, gain: 0.2 }, { band: 8, gain: -0.5 },
      { band: 9, gain: -0.5 }, { band: 10, gain: -0.5 }
    ],
    distortion: { sinOffset: 0.2, sinScale: 0.5 }
  }
};

/**
 * Manages audio filters for a player
 */
class FilterManager {
  /**
   * @param {SuwakuPlayer} player - The player instance
   */
  constructor(player) {
    this.player = player;

    /**
     * Active filters
     * @type {Object}
     */
    this.filters = {};
  }

  /**
   * Apply a preset filter
   * @param {string} preset - Preset name
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async applyPreset(preset) {
    const presetLower = preset.toLowerCase().replace(/[-\s]/g, '');
    
    // Map common names to preset keys
    const presetMap = {
      'bassboost': 'BASSBOOST_HIGH',
      'bassboostlow': 'BASSBOOST_LOW',
      'bassboostmedium': 'BASSBOOST_MEDIUM',
      'bassboosthigh': 'BASSBOOST_HIGH',
      'nightcore': 'NIGHTCORE',
      'vaporwave': 'VAPORWAVE',
      '8d': 'EIGHTD',
      'eightd': 'EIGHTD',
      'karaoke': 'KARAOKE',
      'tremolo': 'TREMOLO',
      'vibrato': 'VIBRATO',
      'soft': 'SOFT',
      'pop': 'POP',
      'rock': 'ROCK',
      'electronic': 'ELECTRONIC',
      'classical': 'CLASSICAL',
      'robot': 'ROBOT',
      'chipmunk': 'CHIPMUNK',
      'monster': 'MONSTER',
      'telephone': 'TELEPHONE',
      'radio': 'RADIO'
    };
    
    const presetKey = presetMap[presetLower];
    
    if (!presetKey || !FilterPresets[presetKey]) {
      throw new Error(`Unknown preset: ${preset}. Available: ${Object.keys(presetMap).join(', ')}`);
    }

    return await this.setFilters(FilterPresets[presetKey]);
  }

  /**
   * Set bass boost level
   * @param {number} level - Level (0-100)
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setBassBoost(level) {
    validateNumber(level, 'Bass boost level');
    validateRange(level, 'Bass boost level', 0, 100);

    let preset;
    if (level === 0) {
      return await this.removeFilter('equalizer');
    } else if (level <= 33) {
      preset = FilterPresets.BASSBOOST_LOW;
    } else if (level <= 66) {
      preset = FilterPresets.BASSBOOST_MEDIUM;
    } else {
      preset = FilterPresets.BASSBOOST_HIGH;
    }

    return await this.setFilters(preset);
  }

  /**
   * Set nightcore filter
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setNightcore() {
    return await this.setFilters(FilterPresets.NIGHTCORE);
  }

  /**
   * Set vaporwave filter
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setVaporwave() {
    return await this.setFilters(FilterPresets.VAPORWAVE);
  }

  /**
   * Set 8D audio filter
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async set8D() {
    return await this.setFilters(FilterPresets.EIGHTD);
  }

  /**
   * Set karaoke filter
   * @param {Object} [options] - Karaoke options
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setKaraoke(options = {}) {
    const karaoke = {
      level: options.level ?? 1.0,
      monoLevel: options.monoLevel ?? 1.0,
      filterBand: options.filterBand ?? 220.0,
      filterWidth: options.filterWidth ?? 100.0
    };

    return await this.setFilters({ karaoke });
  }

  /**
   * Set tremolo filter
   * @param {Object} [options] - Tremolo options
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setTremolo(options = {}) {
    const tremolo = {
      frequency: options.frequency ?? 2.0,
      depth: options.depth ?? 0.5
    };

    return await this.setFilters({ tremolo });
  }

  /**
   * Set vibrato filter
   * @param {Object} [options] - Vibrato options
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setVibrato(options = {}) {
    const vibrato = {
      frequency: options.frequency ?? 2.0,
      depth: options.depth ?? 0.5
    };

    return await this.setFilters({ vibrato });
  }

  /**
   * Set rotation filter (8D effect)
   * @param {number} [rotationHz=0.2] - Rotation speed in Hz
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setRotation(rotationHz = 0.2) {
    return await this.setFilters({
      rotation: { rotationHz }
    });
  }

  /**
   * Set custom equalizer
   * @param {Array<Object>} bands - Equalizer bands
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setEqualizer(bands) {
    if (!Array.isArray(bands)) {
      throw new Error('Equalizer bands must be an array');
    }

    return await this.setFilters({ equalizer: bands });
  }

  /**
   * Set timescale filter
   * @param {Object} options - Timescale options
   * @param {number} [options.speed=1.0] - Playback speed
   * @param {number} [options.pitch=1.0] - Pitch adjustment
   * @param {number} [options.rate=1.0] - Rate adjustment
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setTimescale(options = {}) {
    const timescale = {
      speed: options.speed ?? 1.0,
      pitch: options.pitch ?? 1.0,
      rate: options.rate ?? 1.0
    };

    return await this.setFilters({ timescale });
  }

  /**
   * Set distortion filter
   * @param {Object} [options] - Distortion options
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setDistortion(options = {}) {
    const distortion = {
      sinOffset: options.sinOffset ?? 0,
      sinScale: options.sinScale ?? 1,
      cosOffset: options.cosOffset ?? 0,
      cosScale: options.cosScale ?? 1,
      tanOffset: options.tanOffset ?? 0,
      tanScale: options.tanScale ?? 1,
      offset: options.offset ?? 0,
      scale: options.scale ?? 1
    };

    return await this.setFilters({ distortion });
  }

  /**
   * Set channel mix filter
   * @param {Object} [options] - Channel mix options
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setChannelMix(options = {}) {
    const channelMix = {
      leftToLeft: options.leftToLeft ?? 1,
      leftToRight: options.leftToRight ?? 0,
      rightToLeft: options.rightToLeft ?? 0,
      rightToRight: options.rightToRight ?? 1
    };

    return await this.setFilters({ channelMix });
  }

  /**
   * Set low pass filter
   * @param {number} [smoothing=20] - Smoothing value
   * @returns {Promise<boolean>} Whether filter was applied
   */
  async setLowPass(smoothing = 20) {
    return await this.setFilters({
      lowPass: { smoothing }
    });
  }

  /**
   * Set multiple filters at once
   * @param {Object} filters - Filters to apply
   * @returns {Promise<boolean>} Whether filters were applied
   */
  async setFilters(filters) {
    validateObject(filters, 'Filters');

    try {
      // Merge with existing filters
      Object.assign(this.filters, filters);

      this.player.client.emit('debug', `Applying filters: ${Object.keys(filters).join(', ')}`);

      // Send to Lavalink
      await this.player.node.rest.updatePlayer(this.player.guildId, {
        filters: this.filters
      });

      this.player.client.emit('debug', 'Filters applied successfully');
      this.player.emit('filtersUpdate', this.filters);
      return true;
    } catch (error) {
      this.player.client.emit('debug', `Error applying filters: ${error.message}`);
      this.player.emit('error', error);
      return false;
    }
  }

  /**
   * Remove a specific filter
   * @param {string} filterName - Filter name to remove
   * @returns {Promise<boolean>} Whether filter was removed
   */
  async removeFilter(filterName) {
    if (!this.filters[filterName]) return false;

    delete this.filters[filterName];

    try {
      await this.player.node.rest.updatePlayer(this.player.guildId, {
        filters: this.filters
      });

      this.player.emit('filtersUpdate', this.filters);
      return true;
    } catch (error) {
      this.player.emit('error', error);
      return false;
    }
  }

  /**
   * Clear all filters
   * @returns {Promise<boolean>} Whether filters were cleared
   */
  async clearFilters() {
    this.filters = {};

    try {
      await this.player.node.rest.updatePlayer(this.player.guildId, {
        filters: {}
      });

      this.player.emit('filtersUpdate', {});
      return true;
    } catch (error) {
      this.player.emit('error', error);
      return false;
    }
  }

  /**
   * Get active filters
   * @returns {Object} Active filters
   */
  getActiveFilters() {
    return { ...this.filters };
  }

  /**
   * Check if a filter is active
   * @param {string} filterName - Filter name
   * @returns {boolean} Whether filter is active
   */
  hasFilter(filterName) {
    return !!this.filters[filterName];
  }

  /**
   * Get available presets
   * @returns {Array<string>} Available preset names
   */
  static getPresets() {
    return Object.keys(FilterPresets);
  }
}

export { FilterManager, FilterPresets };
