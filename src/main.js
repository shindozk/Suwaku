/**
 * Suwaku - A powerful Lavalink-based music player for Discord bots
 * @module suwaku
 */

import { SuwakuClient } from './client/SuwakuClient.js';
import { SuwakuPlayer } from './structures/SuwakuPlayer.js';
import { SuwakuQueue } from './structures/SuwakuQueue.js';
import { SuwakuTrack } from './structures/SuwakuTrack.js';
import { PlayerManager } from './managers/PlayerManager.js';
import { SearchManager } from './managers/SearchManager.js';
import { FilterManager, FilterPresets } from './managers/FilterManager.js';
import { NodeManager } from './lavalink/NodeManager.js';
import { LavalinkNode } from './lavalink/LavalinkNode.js';
import Structure from './structures/Structure.js';
import { LavalinkREST } from './lavalink/LavalinkREST.js';
import { PersistenceManager } from './persistence/PersistenceManager.js';
import { StorageAdapter } from './persistence/StorageAdapter.js';
import { MemoryStorageAdapter } from './persistence/MemoryStorageAdapter.js';
import { JSONStorageAdapter } from './persistence/JSONStorageAdapter.js';
import { YoutubeThumbnailSize, PlayerMovedState } from './utils/constants.js';
import packageJson from '../package.json' with { type: 'json' };
const { version } = packageJson;

// Register default structures globally
Structure.structures.Player = SuwakuPlayer;
Structure.structures.Queue = SuwakuQueue;
Structure.structures.Track = SuwakuTrack;
Structure.structures.Node = LavalinkNode;

// Export main classes
export {
    // Main client
    SuwakuClient,

    // Structures
    SuwakuPlayer,
    SuwakuQueue,
    SuwakuTrack,
    Structure,

    // Managers
    PlayerManager,
    SearchManager,
    FilterManager,
    NodeManager,

    // Lavalink
    LavalinkNode,
    LavalinkREST,

    // Constants
    FilterPresets,
    YoutubeThumbnailSize,
    PlayerMovedState,

    // Persistence
    PersistenceManager,
    StorageAdapter,
    MemoryStorageAdapter,
    JSONStorageAdapter,

    // Version
    version
};

// Default export
export default SuwakuClient;
