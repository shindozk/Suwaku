/**
 * Test file to verify TypeScript definitions work correctly
 */

import { SuwakuClient, SuwakuPlayer, FilterManager, FilterPresets } from '../types/index';
import { Client } from 'discord.js';

// Test type checking
const client = new Client({ intents: [] });

const suwaku = new SuwakuClient(client, {
    nodes: [{
        host: 'localhost',
        port: 2333,
        password: 'test',
        secure: false
    }],
    defaultVolume: 80,
    searchEngine: 'youtube'
});

// Test player types
async function testPlayer(player: SuwakuPlayer) {
    // Basic controls
    await player.pause();
    await player.resume();
    await player.stop();
    await player.skip();
    
    // Advanced controls
    await player.replay();
    await player.seekForward(10000);
    await player.seekBackward(5000);
    await player.back();
    await player.jumpTo(5);
    
    // Position info
    const position: number = player.getCurrentPosition();
    const remaining: number = player.getRemainingTime();
    const total: number = player.getTotalQueueDuration();
    
    // Queue operations
    const removed: number = player.removeDuplicates();
    player.shuffleQueue();
    player.clearQueue();
    
    // History
    const history = player.getHistory(10);
    player.clearHistory();
    
    // Stats
    const stats = player.getStats();
    console.log(stats.queueSize);
    console.log(stats.activeFilters);
}

// Test filter types
async function testFilters(filters: FilterManager) {
    // Presets
    await filters.applyPreset('nightcore');
    await filters.setBassBoost(75);
    await filters.setNightcore();
    await filters.setVaporwave();
    await filters.set8D();
    
    // Custom filters
    await filters.setEqualizer([
        { band: 0, gain: 0.25 },
        { band: 1, gain: 0.15 }
    ]);
    
    await filters.setTimescale({
        speed: 1.2,
        pitch: 1.1,
        rate: 1.0
    });
    
    await filters.setKaraoke({
        level: 1.0,
        monoLevel: 1.0
    });
    
    // Management
    await filters.clearFilters();
    const active = filters.getActiveFilters();
    const hasNightcore: boolean = filters.hasFilter('nightcore');
}

// Test queue types
function testQueue(player: SuwakuPlayer) {
    const queue = player.queue;
    
    // Basic operations
    queue.shuffle();
    queue.clear();
    queue.reverse();
    
    // Advanced operations
    const duplicates: number = queue.removeDuplicates();
    const results = queue.search('query');
    const userTracks = queue.getByRequester('123');
    const sourceTracks = queue.getBySource('youtube');
    const durationTracks = queue.getByDuration(0, 300000);
    
    // Utilities
    const random = queue.random();
    const first = queue.first(5);
    const last = queue.last(5);
    const hasTrack: boolean = queue.has('trackId');
    const index: number = queue.indexOf('trackId');
    
    // Sorting
    queue.sort('duration', true);
    queue.sort('title');
    queue.sort('author');
}

// Test events
suwaku.on('trackStart', (player, track) => {
    console.log(track.title);
});

suwaku.on('filtersUpdate', (player, filters) => {
    console.log(filters);
});

suwaku.on('queueShuffle', (player) => {
    console.log(player.guildId);
});

console.log('✅ TypeScript types are valid!');
