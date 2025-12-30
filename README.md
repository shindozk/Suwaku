<div align="center">
  <img src="https://i.imgur.com/1brCdKc.png" width="150" height="150" alt="Suwaku Logo" style="border-radius: 20%">
  
  <h1>Suwaku</h1>
  
  <h3>🎵 The Most Complete Lavalink Client for Discord.js</h3>
  <p>An intelligent, high-performance, and feature-rich Lavalink client designed for modern Discord bots.</p>

  <hr>
  
  <a href="https://suwaku.vercel.app/">
    <img src="https://img.shields.io/badge/Documentation-Click_Here-blue?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation">
  </a>
  <a href="https://discord.gg/wV2WamExr5">
    <img src="https://img.shields.io/discord/990369410344701964?color=5865F2&label=Discord&logo=discord&logoColor=white&style=for-the-badge" alt="Discord">
  </a>
  <a href="https://www.npmjs.com/package/suwaku">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/suwaku?style=for-the-badge&logo=npm&color=CB3837">
  </a>

  <br>
  
  <img src="https://img.shields.io/badge/Made_with_♥️_in-Brazil-ED186A?style=flat-square">
  <img alt="NPM Downloads" src="https://img.shields.io/npm/dm/suwaku?style=flat-square&logo=npm&color=333">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/shindozk/Suwaku?style=flat-square&logo=github&color=333">
  
  <br>
</div>

---

## 📖 Complete Documentation

The full documentation for Suwaku, including detailed API reference, guides, and examples, is available at:

### 👉 [https://suwaku.vercel.app/](https://suwaku.vercel.app/)

---

## ✨ Why Suwaku?

Suwaku is not just another Lavalink client. It's a complete ecosystem built for stability and performance.

- 🚀 **Intelligent Cache System** - Reduces Lavalink requests by up to 75%.
- 📡 **Automatic Health Monitoring** - Real-time node monitoring with auto-failover.
- ⚡ **Optimized Batch Loading** - Load 1000+ track playlists in milliseconds.
- 🎛️ **Advanced Audio Filters** - 13+ built-in presets and full custom DSP support.
- 💪 **Built-in Stabilization** - Auto-retry and correction for unstable connections.
- 🔍 **Universal Search** - Multi-source support (Spotify, YT, SoundCloud, etc.) with auto-detection.

---

## 📦 Installation

```bash
npm install suwaku
```

### Quick Start

```javascript
import { Client } from 'discord.js';
import { SuwakuClient } from 'suwaku';

const client = new Client({ intents: [...] });
const suwaku = new SuwakuClient(client, {
  nodes: [{ host: 'localhost', port: 2333, password: 'youshallnotpass' }]
});

// Start playing!
await suwaku.play({
  query: 'https://open.spotify.com/track/...',
  voiceChannel: member.voice.channel,
  textChannel: interaction.channel,
  member: interaction.member
});
```

---

## 🛠️ Key Modules

Suwaku is divided into powerful, easy-to-use modules. Learn more about them in our docs:

- **[SuwakuClient](https://suwaku.vercel.app/docs/api/client)** - The main entry point for your bot.
- **[SuwakuPlayer](https://suwaku.vercel.app/docs/api/player)** - Advanced playback and filter control.
- **[SuwakuQueue](https://suwaku.vercel.app/docs/api/queue)** - Powerful queue management with 30+ methods.
- **[Filters](https://suwaku.vercel.app/docs/guides/filters)** - Professional audio processing system.

---

## 🤝 Community & Support

- **Discord Server**: [Join our community](https://discord.gg/wV2WamExr5) for help and updates.
- **GitHub Issues**: Found a bug? [Report it here](https://github.com/shindozk/Suwaku/issues).
- **Contributing**: Check our [Contributing Guide](https://github.com/shindozk/Suwaku/blob/main/CONTRIBUTING.md).

---

<div align="center">
  <p>Maintained with ♥️ by <a href="https://github.com/shindozk">ShindoZk from Brazil</a></p>
  <br>
  <img src="https://i.imgur.com/qLR3jEa.png" alt="Suwaku Banner" width="100%">
</div>