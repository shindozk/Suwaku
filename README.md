<div align="center">
  <img src="https://i.imgur.com/dv7FECr.png" alt="Suwaku Banner">
  
  <h1>Suwaku</h1>
  
  <h3>🎵 A powerful Lavalink-based music player for Discord bots</h3>
  <p>Built with Node.js, featuring multi-source support, advanced queue management, and high-performance playlist handling.</p>

  <hr>
  
  <img src="https://img.shields.io/badge/Made_with_♥️_in-Brazil-ED186A?style=for-the-badge"><br>
  
  <a href="https://discord.gg/wV2WamExr5">
    <img src="https://img.shields.io/discord/990369410344701964?color=333&label=Support&logo=discord&style=for-the-badge" alt="Discord">
  </a>
  <a href="https://www.npmjs.com/package/suwaku">
    <img alt="NPM Downloads" src="https://img.shields.io/npm/dm/suwaku?style=for-the-badge&logo=npm&color=333">
  </a>
  <a href="https://www.npmjs.com/package/suwaku">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/suwaku?style=for-the-badge&logo=npm&color=333">
  </a>
  <br>
  <a href="https://github.com/shindozk/Suwaku">
    <img alt="GitHub forks" src="https://img.shields.io/github/forks/shindozk/Suwaku?style=for-the-badge&logo=github&color=333">
  </a>
  <a href="https://github.com/shindozk/Suwaku">
    <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/shindozk/Suwaku?style=for-the-badge&logo=github&color=333">
  </a>
  <a href="https://github.com/shindozk/Suwaku/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/shindozk/Suwaku?style=for-the-badge&logo=github&color=333">
  </a>
  <br>
  <a href="https://nodejs.org">
    <img alt="Node.js Version" src="https://img.shields.io/node/v/suwaku?style=for-the-badge&logo=node.js&color=333">
  </a>
  <a href="https://github.com/shindozk/Suwaku/issues">
    <img alt="GitHub Issues" src="https://img.shields.io/github/issues/shindozk/Suwaku?style=for-the-badge&logo=github&color=333">
  </a>
  <a href="https://github.com/shindozk/Suwaku/pulls">
    <img alt="GitHub Pull Requests" src="https://img.shields.io/github/issues-pr/shindozk/Suwaku?style=for-the-badge&logo=github&color=333">
  </a>
  <br>
</div>

---

## ✨ Features

### 🎯 Core Features
- 🎵 **Lavalink v4 Integration** - Robust client with automatic reconnection and failover
- 🔍 **Multi-Source Support** - YouTube, Spotify, SoundCloud, Deezer, Apple Music, and more
- 🚀 **Auto-Detection** - Automatically detects platform from URLs (works with any source!)
- 💪 **TypeScript Support** - Full TypeScript definitions included
- 🔄 **Smart Fallback** - Automatically tries alternative sources if primary fails
- ⚡ **High Performance** - Optimized batch processing for large playlists (1000+ tracks)

### 🎛️ Advanced Features
- **Audio Filters** - 13+ presets (Bass Boost, Nightcore, 8D, Vaporwave, etc.) + custom filters
- **Advanced Playback** - Replay, seek forward/backward, jump to track, back to previous
- **Queue Management** - 30+ methods including search, sort, filter, remove duplicates
- **Statistics** - Detailed player stats with real-time position tracking
- **History System** - Track playback history with configurable size
- **Loop Modes** - Off, Track, Queue with full control
- **Rich Events** - 25+ events for complete player monitoring
- **Smart Search** - Intelligent search with similarity scoring and Levenshtein distance
- **Playlist Progress** - Real-time progress tracking for large playlists
- **Auto-Retry on Stuck** - Automatically attempts to resume stuck tracks before skipping
- **Ping Monitoring** - Real-time latency monitoring for all nodes (every 30s)
- **Health Checks** - Automatic health monitoring for nodes (CPU, memory, ping)

### 🎨 Player States
- `IDLE` - Player is idle
- `CONNECTING` - Connecting to voice channel
- `CONNECTED` - Connected and ready
- `PLAYING` - Currently playing
- `PAUSED` - Playback paused
- `ENDED` - Track ended
- `ERRORED` - Error occurred
- `STUCK` - Track stuck
- `DESTROYED` - Player destroyed

---

## 📦 Installation

```bash
npm install suwaku
```

### Requirements
- **Node.js** v16.9.0 or higher (v22+ recommended for full ESM support)
- **Discord.js** v14.x
- **Lavalink** v4 server

### Important Notes
- ✅ **ES Modules (ESM)** - Uses modern ES modules syntax (import/export)
- ✅ **Discord.js v14 Compatible** - Fully compatible with Discord.js v14
- ✅ **Lavalink v4 Compatible** - Uses the standard Lavalink v4 REST API
- ⚠️ **Spotify Support** - Requires Lavalink with LavaSrc plugin for Spotify URLs

---

## 🚀 Quick Start

```javascript
import { Client, GatewayIntentBits } from 'discord.js';
import { SuwakuClient } from 'suwaku';

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Create Suwaku client
const suwaku = new SuwakuClient(client, {
  nodes: [{
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass',
    secure: false,
    identifier: 'main-node'
  }],
  searchEngine: 'youtube',
  defaultVolume: 80,
  autoLeave: true,
  autoLeaveDelay: 30000,
  loadBalancer: true,  // Distribute players across nodes
  trackPlayerMoved: true  // Track when bot moves between channels
});

// Initialize when bot is ready
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await suwaku.init();
});

// Play a track
await suwaku.play({
  query: 'INERTIA - To Be Hero X',
  voiceChannel: member.voice.channel,
  textChannel: interaction.channel,
  member: interaction.member
});

// Join a voice channel
await suwaku.join({
  voiceChannel: member.voice.channel,
  textChannel: interaction.channel
});

// Leave voice channel
await suwaku.leave(guildId);

client.login('YOUR_BOT_TOKEN');
```

---

## 📚 API Documentation

### SuwakuClient

#### Constructor Options

```javascript
new SuwakuClient(discordClient, {
  // Node Configuration
  nodes: [{
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass',
    secure: false,
    identifier: 'main-node',
    region: 'us'  // Optional
  }],
  
  // Playback Settings
  searchEngine: 'youtube',  // Default search engine
  defaultVolume: 80,  // 0-1000
  
  // Auto Behaviors
  autoPlay: false,
  autoLeave: true,
  autoLeaveDelay: 30000,  // 30 seconds
  leaveOnEmpty: false,
  leaveOnEmptyDelay: 60000,
  leaveOnEnd: false,
  
  // Queue Settings
  historySize: 50,
  maxQueueSize: 1000,
  maxPlaylistSize: 500,
  allowDuplicates: true,
  
  // Features
  enableFilters: true,
  enableSourceFallback: true,
  loadBalancer: true,
  trackPlayerMoved: true,
  
  // Connection
  reconnectDelay: 5000,
  reconnectAttempts: 5,
  
  // Stuck Track Handling
  retryOnStuck: true,        // Try to resume stuck tracks before skipping
  stuckThreshold: 10000,     // Threshold for considering track stuck (ms)
  
  // Media
  defaultYoutubeThumbnail: 'maxresdefault'  // Thumbnail quality
});
```

#### Methods

```javascript
// Play a track or playlist
await suwaku.play({
  query: 'song name or URL',
  voiceChannel: voiceChannel,
  textChannel: textChannel,
  member: member,
  source: 'youtube'  // Optional, auto-detected from URL
});

// Join voice channel
await suwaku.join({
  voiceChannel: voiceChannel,
  textChannel: textChannel,
  deaf: false,
  mute: false
});

// Leave voice channel
await suwaku.leave(guildId, destroy = true);

// Search for tracks
const result = await suwaku.search('query', {
  source: 'youtube',
  limit: 10,
  requester: member
});
// Returns: { type: 'SEARCH'|'TRACK'|'PLAYLIST', tracks: [...], playlistName?: '...' }

// Get player
const player = suwaku.getPlayer(guildId);

// Create player
const player = suwaku.createPlayer({
  guildId: guildId,
  voiceChannelId: voiceChannelId,
  textChannelId: textChannelId
});

// Destroy player
await suwaku.destroyPlayer(guildId);
```

### SuwakuPlayer

#### Playback Control

```javascript
// Play
await player.play(track);

// Pause/Resume
await player.pause();
await player.resume();

// Stop
await player.stop();

// Skip
await player.skip();

// Previous track
await player.previous();

// Seek
await player.seek(30000);  // 30 seconds

// Seek forward/backward
await player.seekForward(10000);  // +10 seconds
await player.seekBackward(10000);  // -10 seconds

// Replay current track
await player.replay();

// Volume (0-1000)
await player.setVolume(80);

// Loop modes
player.setLoop('off');    // No loop
player.setLoop('track');  // Loop current track
player.setLoop('queue');  // Loop entire queue
```

#### Queue Management

```javascript
// Add tracks
player.addTrack(track);
player.addTracks([track1, track2, track3]);

// Add large playlist (optimized)
await player.addTracksBatch(tracks, {
  batchSize: 100,
  playlistInfo: { name: 'My Playlist' }
});

// Remove track
player.removeTrack(position);

// Clear queue
player.queue.clear();

// Shuffle
player.shuffleQueue();

// Remove duplicates
player.removeDuplicates();

// Jump to track
await player.jumpTo(5);  // Jump to 6th track (0-based)

// Move track
player.moveTrack(from, to);

// Get queue info
player.queue.size;
player.queue.duration;
player.queue.isEmpty;
player.current;
player.queue.tracks;
```

#### Audio Filters

```javascript
// Apply preset
await player.filters.applyPreset('nightcore');
await player.filters.applyPreset('bassboost');
await player.filters.applyPreset('8d');
await player.filters.applyPreset('vaporwave');

// Available presets:
// bassboost-low, bassboost-medium, bassboost-high
// nightcore, vaporwave, 8d, karaoke
// soft, pop, treblebass, eightd, earrape

// Custom filters
await player.filters.setEqualizer([
  { band: 0, gain: 0.25 },
  { band: 1, gain: 0.25 }
]);

await player.filters.setTimescale({
  speed: 1.2,
  pitch: 1.2,
  rate: 1.0
});

// Clear filters
await player.filters.clearFilters();
```

#### Player Info

```javascript
// Get player stats
const stats = player.getStats();
// {
//   guildId, state, playing, paused, connected,
//   volume, position, remainingTime, queueSize,
//   queueDuration, totalDuration, historySize,
//   loop, hasFilters, activeFilters, uptime
// }

// Health check
const health = player.healthCheck();
// {
//   healthy: true/false,
//   issues: [...],
//   state, connected, nodeConnected
// }

// Get current position
player.getCurrentPosition();

// Get remaining time
player.getRemainingTime();

// Get total queue duration
player.getTotalQueueDuration();
```

---

## 🎭 Events

### Player Events

```javascript
// Track events
suwaku.on('trackStart', (player, track) => {
  console.log(`Now playing: ${track.title}`);
});

suwaku.on('trackEnd', (player, track, reason) => {
  console.log(`Track ended: ${reason}`);
});

suwaku.on('trackError', (player, track, error) => {
  console.error(`Track error: ${error.message}`);
});

suwaku.on('trackStuck', (player, track, threshold) => {
  console.log(`Track stuck for ${threshold}ms`);
  // Note: Suwaku automatically tries to resume the track before skipping
  // Configure with: retryOnStuck: true (default)
});

// Queue events
suwaku.on('trackAdd', (player, track) => {
  console.log(`Added: ${track.title}`);
});

suwaku.on('tracksAdd', (player, tracks) => {
  console.log(`Added ${tracks.length} tracks`);
});

suwaku.on('trackAddPlaylist', (player, playlistData) => {
  console.log(`Added playlist: ${playlistData.name} (${playlistData.trackCount} tracks)`);
});

suwaku.on('playlistProgress', (player, progress) => {
  console.log(`Loading playlist: ${progress.percentage}% (${progress.added}/${progress.total})`);
});

suwaku.on('queueEnd', (player) => {
  console.log('Queue ended');
});

// Player state events
suwaku.on('playerCreate', (player) => {
  console.log(`Player created for guild ${player.guildId}`);
});

suwaku.on('playerDestroy', (player) => {
  console.log(`Player destroyed for guild ${player.guildId}`);
});

suwaku.on('playerJoin', (player, voiceChannel) => {
  console.log(`Bot joined ${voiceChannel.name}`);
});

suwaku.on('playerLeave', (player) => {
  console.log('Bot left voice channel');
});

suwaku.on('playerMoved', (player, state, channels) => {
  console.log(`Bot ${state}: ${channels.oldChannelId} -> ${channels.newChannelId}`);
  // state: 'JOINED', 'LEFT', 'MOVED'
});
```

### Node Events

```javascript
suwaku.on('nodeConnect', (node) => {
  console.log(`Node ${node.identifier} connected`);
});

suwaku.on('nodeDisconnect', (node, data) => {
  console.log(`Node ${node.identifier} disconnected`);
});

suwaku.on('nodeError', (node, error) => {
  console.error(`Node ${node.identifier} error:`, error);
});

suwaku.on('nodeReady', (node, data) => {
  console.log(`Node ${node.identifier} ready`);
});

suwaku.on('nodeStats', (node, stats) => {
  console.log(`Node ${node.identifier} stats:`, stats);
});
```

### Debug Events

```javascript
suwaku.on('debug', (message) => {
  console.log(`[DEBUG] ${message}`);
});

suwaku.on('warn', (message) => {
  console.warn(`[WARN] ${message}`);
});

suwaku.on('error', (error) => {
  console.error(`[ERROR]`, error);
});
```

---

## 🌐 Multi-Platform Support

Suwaku **automatically detects** the platform from URLs, regardless of your default search engine!

### Supported Platforms

| Platform | Tracks | Playlists | Albums | Auto-Detect |
|---|---|---|---|---|
| YouTube | ✅ | ✅ | ❌ | ✅ |
| YouTube Music | ✅ | ✅ | ✅ | ✅ |
| Spotify* | ✅ | ✅ | ✅ | ✅ |
| SoundCloud | ✅ | ✅ | ❌ | ✅ |
| Deezer | ✅ | ✅ | ✅ | ✅ |
| Apple Music | ✅ | ✅ | ✅ | ✅ |
| Bandcamp | ✅ | ✅ | ✅ | ✅ |
| Twitch | ✅ | ❌ | ❌ | ✅ |
| HTTP/Direct | ✅ | ❌ | ❌ | ✅ |

*Spotify requires Lavalink with LavaSrc plugin

### Examples

```javascript
// YouTube playlist (auto-detected)
await suwaku.play({
  query: 'https://youtube.com/playlist?list=...',
  voiceChannel, textChannel, member
});

// Spotify playlist (auto-detected)
await suwaku.play({
  query: 'https://open.spotify.com/playlist/...',
  voiceChannel, textChannel, member
});

// SoundCloud set (auto-detected)
await suwaku.play({
  query: 'https://soundcloud.com/user/sets/...',
  voiceChannel, textChannel, member
});

// Search (uses default engine)
await suwaku.play({
  query: 'imagine dragons',
  voiceChannel, textChannel, member
});
```

---

## ⚡ Performance

### Optimized for Large Playlists

Suwaku uses **batch processing** for large playlists:

- **50-100 tracks**: ~100ms
- **200 tracks**: ~200ms (6x faster than v1.0)
- **500 tracks**: ~500ms (7x faster than v1.0)
- **1000+ tracks**: Automatic chunking with progress events

### Features

- ✅ Non-blocking event loop
- ✅ Automatic batch size optimization
- ✅ Real-time progress tracking
- ✅ Memory efficient
- ✅ Load balancing across nodes
- ✅ Automatic ping monitoring (every 30s)
- ✅ Auto-retry on stuck tracks

---

## 📊 Node Monitoring

### Automatic Ping Monitoring

Suwaku automatically monitors node latency every 30 seconds:

```javascript
// Access node ping
const node = suwaku.nodes.get('main-node');
console.log(`Ping: ${node.ping}ms`);

// Get node health
const health = node.getHealth();
// {
//   healthy: true/false,
//   issues: ['High ping: 520ms', 'High CPU load: 85%'],
//   ping: 520,
//   connected: true,
//   stats: {...}
// }

// Monitor ping changes
suwaku.on('debug', (message) => {
  if (message.includes('Ping:')) {
    console.log(message);  // "Node main-node Ping: 45ms"
  }
});

// High ping warnings
suwaku.on('warn', (message) => {
  if (message.includes('High ping')) {
    console.warn(message);  // "Node main-node High ping: 520ms"
  }
});
```

### Health Checks

```javascript
// Check all nodes health
const nodes = suwaku.nodes.getConnected();
nodes.forEach(node => {
  const health = node.getHealth();
  
  if (!health.healthy) {
    console.error(`❌ ${node.identifier} unhealthy:`, health.issues);
  } else {
    console.log(`✅ ${node.identifier} healthy (${node.ping}ms)`);
  }
});

// Choose best node by ping
function getBestNode() {
  const nodes = suwaku.nodes.getConnected();
  return nodes.reduce((best, node) => 
    node.ping < best.ping ? node : best
  );
}
```

### Node Statistics

```javascript
// Get detailed node info
const info = node.getInfo();
// {
//   identifier: 'main-node',
//   host: 'localhost',
//   port: 2333,
//   connected: true,
//   ping: 45,
//   lastPing: 1234567890,
//   stats: {
//     players: { playing: 5, total: 10 },
//     cpu: { systemLoad: 0.35 },
//     memory: { used: 512000000, reservable: 2048000000 }
//   }
// }

// Monitor node stats
suwaku.on('nodeStats', (node, stats) => {
  console.log(`${node.identifier} Stats:`, {
    players: stats.players?.playing,
    cpu: (stats.cpu?.systemLoad * 100).toFixed(1) + '%',
    memory: (stats.memory?.used / 1024 / 1024).toFixed(0) + 'MB',
    ping: node.ping + 'ms'
  });
});
```

---

## 🔧 Configuration Examples

### Basic Setup

```javascript
const suwaku = new SuwakuClient(client, {
  nodes: [{
    host: 'localhost',
    port: 2333,
    password: 'youshallnotpass'
  }],
  searchEngine: 'youtube'
});
```

### Advanced Setup

```javascript
const suwaku = new SuwakuClient(client, {
  nodes: [
    {
      host: 'node1.example.com',
      port: 2333,
      password: 'password1',
      secure: true,
      identifier: 'node-1',
      region: 'us'
    },
    {
      host: 'node2.example.com',
      port: 2333,
      password: 'password2',
      secure: true,
      identifier: 'node-2',
      region: 'eu'
    }
  ],
  searchEngine: 'youtube',
  defaultVolume: 80,
  autoLeave: true,
  autoLeaveDelay: 60000,
  leaveOnEmpty: true,
  leaveOnEmptyDelay: 30000,
  historySize: 100,
  maxQueueSize: 2000,
  maxPlaylistSize: 1000,
  enableFilters: true,
  enableSourceFallback: true,
  loadBalancer: true,
  trackPlayerMoved: true,
  reconnectDelay: 3000,
  reconnectAttempts: 10,
  defaultYoutubeThumbnail: 'maxresdefault'
});
```

---

## 📝 Examples

Check the `examples/` folder for complete bot examples:

- `basic-bot.js` - Complete bot with slash commands
- Includes all features: play, pause, skip, queue, filters, etc.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## � LTroubleshooting

### Music Stuttering/Buffering?

Suwaku has built-in mechanisms to handle stuttering:

1. **Auto-Retry** - Automatically tries to resume stuck tracks
2. **Ping Monitoring** - Detects high latency nodes
3. **Health Checks** - Monitors node CPU and memory

**Quick Fixes:**

```javascript
// Increase stuck threshold for unstable connections
const suwaku = new SuwakuClient(client, {
  retryOnStuck: true,
  stuckThreshold: 15000,  // 15 seconds (more tolerant)
  reconnectAttempts: 10
});

// Monitor for issues
suwaku.on('trackStuck', (player, track) => {
  console.warn(`⚠️ Track stuck: ${track.title}`);
});

suwaku.on('warn', (message) => {
  if (message.includes('High ping')) {
    console.warn(`⚠️ ${message}`);
  }
});
```

**Best Solution:** Run your own Lavalink server for best performance!

---

## 📄 License

ISC License - see LICENSE file for details

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/shindozk/Suwaku/issues)
- **Documentation**: [GitHub Wiki](https://github.com/shindozk/Suwaku/wiki)

---

<div align="center">
  <p>Made with ❤️ by ShindoZk from Brazil</p>
  <p>⭐ Star this repo if you find it useful!</p>
</div>
