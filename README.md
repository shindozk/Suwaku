<div align="center">
  <img src="https://iili.io/3GBqCaj.png" width="470px" alt="Yukufy Logo">
  <h1 style="border: none; margin-top: 0;">Yukufy</h1>
  <p><em>A powerful and elegant music client for Discord bots</em></p>
  
  <a href="https://nodei.co/npm/yukufy/"><img src="https://nodei.co/npm/yukufy.png" alt="NPM Info"></a>
  
  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 15px 0;">
    <img src="https://img.shields.io/badge/Made_with_♥️_in-Brazil-ED186A?style=flat-square" alt="Made in Brazil">
    <a href="https://discord.gg/wV2WamExr5">
      <img src="https://img.shields.io/discord/1168782531097800814?color=5865F2&label=Support&logo=discord&style=flat-square" alt="Discord">
    </a>
    <a href="https://www.npmjs.com/package/yukufy">
      <img alt="NPM Downloads" src="https://img.shields.io/npm/dm/yukufy?style=flat-square&logo=npm&color=CB3837">
    </a>
    <a href="https://www.npmjs.com/package/yukufy">
      <img alt="NPM Version" src="https://img.shields.io/npm/v/yukufy?style=flat-square&logo=npm&color=CB3837">
    </a>
    <a href="https://github.com/shindozk/yukufy">
      <img alt="GitHub Stars" src="https://img.shields.io/github/stars/shindozk/yukufy?style=flat-square&logo=github&color=2F3640">
    </a>
    <a href="https://github.com/sponsors/shindozk">
      <img alt="GitHub Sponsors" src="https://img.shields.io/github/sponsors/shindozk?style=flat-square&logo=github&color=EA4AAA">
    </a>
  </div>
</div>

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 🎵 Introduction

**Yukufy** is a sophisticated Node.js library for music playback in Discord bots. It provides a simple yet powerful API for streaming music from multiple platforms and managing playback with advanced features.

<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
  <div style="flex: 1; min-width: 250px;">
    <h3>🌟 Key Features</h3>
    <ul>
      <li>Multi-platform support (Spotify, SoundCloud)</li>
      <li>Advanced queue management</li>
      <li>Complete playback controls</li>
      <li>Playlist support</li>
      <li>Lyrics integration</li>
      <li>Robust error handling</li>
    </ul>
  </div>
  <div style="flex: 1; min-width: 250px;">
    <h3>📦 Installation</h3>
    
```bash
npm install yukufy
```
  </div>
</div>

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 🚀 Getting Started

### Basic Setup

Script bot example full: ./test.js

Create a new instance of `YukufyClient` with your Spotify API credentials:

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { YukufyClient } = require('yukufy');

// Initialize Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMessages
  ]
});

// Create Yukufy client
const yukufy = new YukufyClient(client, {
  api: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID',
    clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET',
  },
  player: {
    defaultVolume: 75,             // Initial volume level (0-100)
    leaveOnEmptyQueue: true,       // Auto-disconnect when queue is empty
    leaveOnEmptyQueueCooldown: 30000  // Wait time before disconnecting (ms)
  }
});

// Login to Discord
client.login('YOUR_DISCORD_BOT_TOKEN');
```

### Playing Music

The most basic way to play music:

```javascript
// Play a song in a voice channel
const result = await yukufy.play('Artist - Song Title', voiceChannel, 'spotify', {
  member: interaction.member,
  textChannel: interaction.channel,
  guildId: interaction.guild.id
});

console.log(`Now playing: ${result.title} by ${result.artist}`);
```

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 📘 Core API Reference

### Music Search

Search for tracks across multiple platforms:

```javascript
// Search for music on Spotify
const spotifyResults = await yukufy.search('NEFFEX Fight Back', 'spotify');

// Search for music on SoundCloud
const soundcloudResults = await yukufy.search('NEFFEX Fight Back', 'soundcloud');
```

### Playback Control

Complete set of playback control methods:

```javascript
// Basic controls
await yukufy.pause();     // Pause current playback
await yukufy.resume();    // Resume paused playback
await yukufy.skip();      // Skip to next track
await yukufy.stop();      // Stop playback and clear queue
await yukufy.setVolume(50);  // Set volume (0-100)

// Queue management
const queueInfo = await yukufy.getQueue();  // Get queue information
const currentTrack = await yukufy.nowPlaying();  // Get current track details

// Advanced features
await yukufy.toggleLoop();  // Toggle loop mode
const lyrics = await yukufy.lyrics('NEFFEX Fight Back');  // Get lyrics
```

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 🎧 Implementation Examples

### Slash Command Setup

Create slash commands with Discord.js:

```javascript
const { REST, Routes } = require('discord.js');

// Define commands
const commands = [
  {
    name: 'play',
    description: 'Play a song in the voice channel',
    options: [
      {
        name: 'query',
        type: 3, // STRING
        description: 'Song name or URL',
        required: true
      }
    ]
  },
  // Add more commands (skip, pause, etc.)
];

// Register commands
const rest = new REST({ version: '10' }).setToken('YOUR_TOKEN');
rest.put(Routes.applicationCommands('YOUR_CLIENT_ID'), { body: commands });
```

### Handling Commands

Handle slash commands in your bot:

```javascript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName, options } = interaction;

  // Handle play command
  if (commandName === 'play') {
    const query = options.getString('query');
    const source = options.getString('source');
    const voiceChannel = interaction.member.voice.channel;
    
    if (!voiceChannel) {
      return interaction.reply('You need to be in a voice channel!');
    }
    
    try {
      await interaction.deferReply();
        
        const query = interaction.options.getString('query');
        const source = interaction.options.getString('source') || 'spotify';
        const voiceChannel = interaction.member.voice.channel;
        
        const result = await yukufy.play({
          query,
          voiceChannel,
          textChannel: interaction.channel,
          member: interaction.member,
          source
        });
      
      interaction.editReply(`🎵 Now playing: **${result.title}** by **${result.artist}**`);
    } catch (error) {
      interaction.editReply(`❌ Error: ${error.message}`);
    }
  }
  
  // Handle other commands...
});
```

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 📡 Events

Yukufy emits various events you can listen to:

```javascript
// When a song starts playing
yukufy.on('playSong', ({ track }) => {
  console.log(`Now playing: ${track.title} by ${track.artist}`);
});

// When a song is added to the queue
yukufy.on('addSong', ({ track, queue }) => {
  console.log(`Added to queue: ${track.title}`);
  console.log(`Queue length: ${queue.length}`);
});

// When the queue finishes
yukufy.on('finishQueue', ({ client }) => {
  console.log('Queue finished!');
});

// When errors occur
yukufy.on('playerError', (error) => {
  console.error('Player error:', error);
});
```

### Available Events

| Event Name | Description | Data Provided |
|------------|-------------|---------------|
| `playSong` | Triggered when a song starts playing | `{ track, queue, client }` |
| `addSong` | Triggered when a song is added to the queue | `{ track, queue, client }` |
| `finishQueue` | Triggered when the queue finishes | `{ client, track }` |
| `emptyQueue` | Triggered when the queue becomes empty | `{ client, track }` |
| `clientDisconnect` | Triggered when disconnected from voice channel | `{ client, track }` |
| `playerError` | Triggered when a player error occurs | `{ client, error, track }` |

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 🧩 Advanced Features

### Complete Player Controls

```javascript
// Get the currently playing track with progress information
const nowPlaying = await yukufy.nowPlaying();
console.log(`Progress: ${nowPlaying.elapsedTime}`);

// Adjust volume
await yukufy.setVolume(75);

// Toggle loop mode
const loopEnabled = await yukufy.toggleLoop();
```

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 🤝 Community & Support

<div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; margin: 20px 0;">
  <div style="flex: 1; min-width: 250px;">
    <h3>📱 Connect With Us</h3>
    <ul>
      <li><a href="https://discord.gg/wV2WamExr5">Join our Discord community</a></li>
      <li><a href="https://github.com/shindozk/yukufy">Star us on GitHub</a></li>
      <li><a href="https://github.com/shindozk/yukufy/issues">Report issues</a></li>
    </ul>
  </div>
  <div style="flex: 1; min-width: 250px;">
    <h3>🛠️ Projects Using Yukufy</h3>
    <ul>
      <li><a href="https://github.com/lNazuna/Yukufy-Bot-Example">Yukufy Bot Example</a> by lNazuna</li>
      <li><a href="#">Yoruka</a> by shindozk</li>
    </ul>
  </div>
</div>

<hr style="border: 1px solid #f0f0f0; margin: 30px 0">

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/shindozk">shindozk</a></p>
  <p>© 2025 Yukufy Contributors</p>
</div>