<div align="center">
  <img src="https://i.imgur.com/qLR3jEa.png" alt="Suwaku Banner" width="100%">
  
  <h1>Suwaku</h1>
  
  <h3>💎 The Lavalink Client for Discord.js</h3>
  <p>A professional, highly extensible, and elite-grade Lavalink wrapper designed for developers who demand absolute stability and advanced features.</p>

  <hr>
  
  <a href="https://suwaku.vercel.app/">
    <img src="https://img.shields.io/badge/Documentation-Online-blue?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation">
  </a>
  <a href="https://discord.gg/wV2WamExr5">
    <img src="https://img.shields.io/discord/990369410344701964?color=5865F2&label=Discord&logo=discord&logoColor=white&style=for-the-badge" alt="Discord">
  </a>
  <a href="https://www.npmjs.com/package/suwaku">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/suwaku?style=for-the-badge&logo=npm&color=CB3837">
  </a>

  <br>
  
  <img src="https://img.shields.io/badge/Lavalink-v4_Ready-3eaf7c?style=flat-square">
  <img src="https://img.shields.io/badge/SponsorBlock-Integrated-ff4500?style=flat-square">
  <img src="https://img.shields.io/badge/LavaSearch-Supported-9b59b6?style=flat-square">
  <img src="https://img.shields.io/badge/Node_Failover-Proactive-00ff00?style=flat-square">
</div>

---

## 🚀 Why Suwaku?

Suwaku goes beyond simple playback. It implements features previously only seen in internal professional-grade bots.

> [!IMPORTANT]
> **Suwaku is built for scale.** Whether you have 10 or 10,000 guilds, our proactive monitoring ensures your users never miss a beat.

### 🌟 Advanced Features

*   🛡️ **Integrated SponsorBlock** - Automatically skip sponsors, intros, and non-music segments on YouTube. No extra integration needed.
*   💾 **Queue Persistence** - Save and auto-resume music sessions even after bot restarts.
*   🧬 **Structure Extensibility** - Modify the behavior of `Player`, `Queue`, `Node`, or `Track` without touching the library's core.
*   📡 **Proactive Node Failover** - The system monitors CPU load and Lag. If a node becomes unstable, players are migrated **before** the music stops.
*   🔍 **LavaSearch (Global Search)** - Go beyond songs. Search for full **Albums** and **Artists** with native support for the Lavalink v4 plugin.
*   📻 **Intelligent Autoplay** - A Spotify-like recommendation algorithm that picks the next best song across multiple platforms (YouTube, Spotify, etc.).
*   📜 **Advanced Lyrics System** - High-precision synchronized lyrics with network jitter compensation (Calibrator), RichSync support (word-by-word), and ISRC fallback for maximum accuracy across providers (LRCLIB, Musixmatch, Netease).

---

## 📦 Installation

```bash
npm install suwaku
```

---

## 🛠️ Quick Start

### 1. Basic Setup (with SponsorBlock)

```javascript
import { Client } from 'discord.js';
import { SuwakuClient } from 'suwaku';

const suwaku = new SuwakuClient(client, {
    nodes: [{ host: 'localhost', port: 2333, password: 'youshallnotpass' }],
    // Global SponsorBlock categories to skip
    sponsorBlockCategories: ['sponsor', 'intro', 'selfpromo']
});

await suwaku.init();
```

### 🧬 2. Extending Structures (Like a Pro)

Don't like our Queue? Need a `.isFull` property? Just extend it!

```javascript
import { Structure } from 'suwaku';

Structure.extend('Queue', (SuwakuQueue) => {
    return class MyCustomQueue extends SuwakuQueue {
        get isFull() {
            return this.size >= 100;
        }
    };
});
```

### 🔍 3. Global Search (Albums & Artists)

```javascript
const result = await suwaku.search('Imagine Dragons');

if (result.loadType === 'search') {
    console.log(result.albums);  // List of albums
    console.log(result.artists); // List of artists
}
```

---

## 📡 Proactive Failover System

Suwaku continuously monitors your Lavalink nodes. If a node's system load exceeds 80% or ping spikes above 500ms, Suwaku will:
1.  **Identify** a healthier node.
2.  **Migrate** the player state (current track, position, volume, filters).
3.  **Resume** playback seamlessly.

> [!TIP]
> You can configure monitoring intervals using `healthMonitorInterval` in the client options.

---

## 🎛️ Audio Processing (DSP)

Suwaku comes with **13+ Professional Presets**:
*   `BassBoost`, `Nightcore`, `Vaporwave`, `8D`, `Pop`, `Rock`, `Lofi`, and more.
*   **Dynamic Rhythm**: A Suwaku exclusive that dynamically shifts filters based on playback state for a unique listening experience.

---

---

## 🚀 Official Examples & Templates

Looking for a production-ready implementation? Check out our official example bot:

*   **[Suwaku-Bot-Example](https://github.com/lNazuna/Suwaku-Bot-Example)** — A complete, feature-rich music bot built with Suwaku and Discord.js v14.
*   *Created by [lNazuna](https://github.com/lNazuna)*

---

## 🤝 Community & Support

*   **Discord Server**: [Join our community](https://discord.gg/wV2WamExr5)
*   **Issues**: [Report a bug](https://github.com/shindozk/Suwaku/issues)
*   **Wiki**: [Full API Reference](https://suwaku.vercel.app/)

---

<div align="center">
  <p>Maintained with ♥️ by <a href="https://github.com/shindozk">ShindoZk</a> from Brazil 🇧🇷</p>
  <br>
</div>