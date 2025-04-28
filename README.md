<div align="center">
  <img src="https://iili.io/3GBqCaj.png" width="470px" alt="Yukufy Logo">
  <h1 style="border: none; margin-top: 0;">Yukufy</h1>
  <p><em>A powerful and streamlined music client library for Discord.js bots</em></p>

  <a href="https://nodei.co/npm/yukufy/"><img src="https://nodei.co/npm/yukufy.png" alt="NPM Info"></a>

  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 15px 0;">
    <a href="https://discord.gg/wV2WamExr5"> <img src="https://img.shields.io/discord/1168782531097800814?color=5865F2&label=Support&logo=discord&style=flat-square" alt="Discord">
    </a>
    <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?style=flat-square&logo=discord" alt="Discord.js v14">
     <img src="https://img.shields.io/badge/Node.js-%3E%3D16.9.0-339933?style=flat-square&logo=node.js" alt="Node.js requirement">
    <a href="https://github.com/shindozk/yukufy"> <img alt="GitHub Stars" src="https://img.shields.io/github/stars/shindozk/yukufy?style=flat-square&logo=github&color=2F3640">
    </a>
     <a href="https://github.com/shindozk/yukufy/blob/main/LICENSE">
       <img alt="License" src="https://img.shields.io/github/license/shindozk/yukufy?style=flat-square&color=blue">
     </a>
  </div>
</div>

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 🎵 Introduction

**Yukufy** is a Node.js library designed to simplify the integration of music playback features into your Discord.js v14 bot. It provides a clean API for searching and streaming music from various sources (like Spotify and SoundCloud via YouTube), managing queues, controlling playback, and handling events seamlessly.

This library uses `@discordjs/voice` for audio management and relies on an external streaming solution (defined in `Stream.js`) to fetch audio data. The default implementation might use APIs or direct streaming libraries.

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 🌟 Features

* **Multi-source Search:** Find tracks on Spotify and SoundCloud (playback often utilizes YouTube).
* **Robust Queue Management:** Add, remove, move, shuffle, clear, and view the track queue.
* **Playback Controls:** Play, pause, resume, stop, skip, loop (track/queue/off), set volume.
* **Track Information:** Get details about the currently playing track, including progress.
* **Lyrics Integration:** Fetch lyrics using the Genius API.
* **Event-Driven:** Rich events for tracking player state and actions.
* **Voice Channel Management:** Automatic connection, disconnection, and timeout handling.
* **Configuration:** Customizable options for player behavior (e.g., auto-leave).

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 📦 Installation

Make sure you have **Node.js v16.9.0 or higher**.

You also need `libsodium-wrappers`. If you encounter issues, refer to the [discord.js documentation](https://www.google.com/search?q=https://discord.js.org/%23/docs/discord.js/main/general/welcome) for installation methods.

```bash
# Install libsodium-wrappers
npm install libsodium-wrappers
# or
yarn add libsodium-wrappers
```

**(Optional) FFmpeg:** If your `Stream.js` implementation requires FFmpeg (e.g., for format conversion or specific streaming methods), you need to install it on your system or use a package like `ffmpeg-static`.

```bash
# Example using ffmpeg-static (optional)
npm install ffmpeg-static
# or
yarn add ffmpeg-static
```

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## ⚙️ Configuration

Yukufy requires certain credentials, preferably stored as environment variables:

  * `BOT_TOKEN`: Your Discord Bot Token.
  * `CLIENT_ID`: Your Discord Application/Bot Client ID.
  * `SPOTIFY_CLIENT_ID`: Your Spotify Application Client ID.
  * `SPOTIFY_CLIENT_SECRET`: Your Spotify Application Client Secret.

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 🚀 Getting Started

Initialize `discord.js` and `YukufyClient`:

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const { YukufyClient } = require('yukufy');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers // Often needed for member info
    // Add MessageContent if using message commands or needing message content access
  ]
});

// Create Yukufy client instance
const yukufy = new YukufyClient(client, {
  api: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },
  player: {
    defaultVolume: 75,             // Initial volume (0-100+)
    leaveOnEmptyQueue: true,       // Auto-disconnect when queue is empty?
    leaveOnEmptyQueueCooldown: 30000  // Wait time before disconnecting (ms)
  }
});

// Login to Discord
client.login(process.env.BOT_TOKEN);

// --- Add command and event handling below ---
```

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 📘 Core API Reference (`YukufyClient` Methods)

Here are the main methods provided by the `YukufyClient` instance (`yukufy` in the examples).

**Playback & Queue:**

  * `play(options)`: Adds a track to the queue and starts playback if idle.
      * `options`: `{ query: string, voiceChannel: VoiceChannel, textChannel: TextChannel, member: GuildMember, source?: 'spotify' | 'soundcloud' }`
      * Returns: `Promise<TrackInfo>` - Information about the added track.
  * `search(query, source?)`: Searches for a track.
      * `query`: `string` - Search term or URL.
      * `source?`: `'spotify' | 'soundcloud'` - Platform to search (defaults to 'spotify').
      * Returns: `Promise<TrackInfo[]>` - An array of found tracks (usually just one).
  * `skip(guildId)`: Skips the current track.
      * Returns: `boolean` - True if skip was attempted, false otherwise.
  * `stop(guildId)`: Stops playback and clears the queue for the guild.
      * Returns: `boolean` - True if stop was successful.
  * `pause(guildId)`: Pauses playback for the guild.
      * Returns: `boolean` - True if pause was successful.
  * `resume(guildId)`: Resumes playback for the guild.
      * Returns: `boolean` - True if resume was successful.
  * `seek(guildId, positionInSeconds)`: Seeks to a specific position in the current track.
      * **Note:** Reliability depends heavily on the `Stream.js` implementation. May not work with API-based streams.
  * `clearQueue(guildId)`: Clears the queue for the guild.
  * `shuffle(guildId)`: Shuffles the queue for the guild.
      * Returns: `TrackInfo[]` - The shuffled queue.
  * `removeFromQueue(guildId, identifier)`: Removes a track by its 0-based index or track ID.
      * `identifier`: `number | string`
      * Returns: `TrackInfo` - The removed track.
      * Throws: Error if identifier is invalid.
  * `moveInQueue(guildId, fromIndex, toIndex)`: Moves a track from one 0-based index to another.
      * Returns: `TrackInfo[]` - The reordered queue.
      * Throws: Error if indices are invalid.

**Information:**

  * `getQueue(guildId)`: Gets the current queue (array of `TrackInfo`).
      * Returns: `TrackInfo[]`
  * `getNowPlaying(guildId)`: Gets details of the currently playing track, including progress.
      * Returns: `TrackInfo | null` (includes `elapsedTimeFormatted`, `durationFormatted`, `progress`, etc.)
  * `getStatus(guildId)`: Gets the player status for the guild (playing, paused, volume, etc.).
      * Returns: `object` - See `/status` command example for properties.
  * `getLyrics(guildId)`: Fetches lyrics for the currently playing track.
      * Returns: `Promise<{ title, artist, lyrics, sourceURL }>`
      * Throws: Error if not playing or lyrics not found.

**Settings & Connection:**

  * `setLoopMode(guildId, mode)`: Sets the loop mode.
      * `mode`: `0` (Off), `1` (Track), `2` (Queue)
      * Returns: `number` - The new loop mode.
  * `setVolume(level)`: Sets the global playback volume.
      * `level`: `number` (0-100+ recommended)
  * `leave(guildId)`: Disconnects the bot from the voice channel in the guild.
      * Returns: `boolean` - True if disconnection was successful.
  * `setFilter(guildId, filterName)` / `removeFilter(guildId, filterName)`: (Placeholder) Methods to manage audio filters (requires implementation in `_createAudioResource`).

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 📡 Events (`YukufyClient` Emitter)

Listen to events emitted by the `YukufyClient` instance.

```javascript
yukufy.on('eventName', (data) => {
  console.log(`Event received: eventName`, data);
});
```

**Main Events:**

| Event Name      | Description                                   | Data Provided (`object`)                     |
| :-------------- | :-------------------------------------------- | :------------------------------------------- |
| `trackAdd`      | Triggered when a track is added to the queue. | `{ track: TrackInfo, queue: TrackInfo[], guildId: string }` |
| `trackStart`    | Triggered when a track begins playing.        | `TrackInfo`                                  |
| `trackEnd`      | Triggered when a track finishes playing.      | `TrackInfo`                                  |
| `queueEnd`      | Triggered when the queue is empty and playback stops. | `guildId: string`                          |
| `disconnect`    | Triggered when the bot disconnects from VC.   | `{ guildId: string }`                        |
| `connect`       | Triggered when the bot connects to VC.        | `guildId: string`                          |
| `error`         | Triggered on player or processing errors.     | `{ guildId?: string, track?: TrackInfo, error: string | Error }` |
| `warn`          | Triggered for non-critical warnings.          | `message: string`                          |
| `debug`         | Triggered for detailed debugging information. | `message: string`                          |
| `info`          | Triggered for general information logs.       | `object`                                     |

**Other Events:**

  * `seek`: `{ guildId, position, track }` - Triggered after a successful seek operation.
  * `pause`: `{ guildId }` - Triggered when playback is paused.
  * `resume`: `{ guildId }` - Triggered when playback is resumed.
  * `volumeChange`: `{ volume, guildId? }` - Triggered when volume is changed.
  * `loopModeChange`: `{ guildId, mode }` - Triggered when loop mode changes.
  * `trackRemove`: `{ track, queue, guildId }` - Triggered when a track is removed.
  * `queueClear`: `{ guildId }` - Triggered when the queue is cleared.
  * `queueShuffle`: `{ guildId, queue }` - Triggered when the queue is shuffled.
  * `queueReorder`: `{ guildId, queue }` - Triggered when the queue is reordered (e.g., by `/move`).
  * `searchNoResult`: `{ query, source, guildId, textChannelId }` - Triggered when a search yields no results.
  * `lyricsNotFound`: `{ track, guildId }` - Triggered when lyrics search fails.
  * `filterAdd` / `filterRemove`: `{ guildId, filter }` - (If filters are implemented)
  * `playlistCreate`: `{ guildId, playlist }` - (If playlist saving is implemented)

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 🤖 Full Bot Example (`bot.js`)

This example demonstrates setting up the client, registering slash commands, handling commands, and listening to basic player events.

```javascript
// bot.js - Yukufy Music Bot Implementation
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    EmbedBuilder,
    SlashCommandBuilder,
    Routes
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { getVoiceConnection } = require('@discordjs/voice'); // Import necessary function
const { YukufyClient } = require('yukufy');

// --- Configuration ---
const config = {
    // Use environment variables for sensitive data
    token: process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
    clientId: process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    guildId: process.env.GUILD_ID, // Optional: For testing commands in one guild
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_ID_HERE',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_SECRET_HERE',
};

// Basic validation
if (!config.token || config.token === 'YOUR_BOT_TOKEN_HERE') {
    console.error("FATAL ERROR: Bot token not configured!"); process.exit(1);
}
if (!config.clientId || config.clientId === 'YOUR_CLIENT_ID_HERE') {
    console.error("FATAL ERROR: Client ID not configured!"); process.exit(1);
}
if (!config.spotifyClientId || config.spotifyClientId === 'YOUR_SPOTIFY_ID_HERE') {
    console.error("FATAL ERROR: Spotify Client ID not configured!"); process.exit(1);
}
if (!config.spotifyClientSecret || config.spotifyClientSecret === 'YOUR_SPOTIFY_SECRET_HERE') {
    console.error("FATAL ERROR: Spotify Client Secret not configured!"); process.exit(1);
}


// --- Discord Client Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent // Required for message content access if needed
    ],
    partials: [ // Recommended for reliable event handling
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

// --- Yukufy Client Setup ---
const yukufy = new YukufyClient(client, {
    api: {
        clientId: config.spotifyClientId,
        clientSecret: config.spotifyClientSecret
    },
    player: {
        defaultVolume: 75,
        leaveOnEmptyQueue: true,
        leaveOnEmptyQueueCooldown: 30000 // 30 seconds
    }
});

// --- Command Collection ---
client.commands = new Collection();

// --- Helper Functions ---

function createProgressBar(progress) {
    const barLength = 15;
    const validProgress = Math.max(0, Math.min(100, progress || 0));
    const filledLength = Math.round(barLength * (validProgress / 100));
    const emptyLength = barLength - filledLength;
    const bar = '▓'.repeat(filledLength) + '░'.repeat(emptyLength);
    return `[${bar}] ${validProgress.toFixed(1)}%`;
}

function formatDuration(queue) {
    let totalSeconds = 0;
    for (const track of queue) {
        const parts = track.duration?.split(':').map(Number);
        if (parts?.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            totalSeconds += parts[0] * 60 + parts[1];
        }
    }
    if (totalSeconds === 0) return '0m 0s';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`.trim();
}

function splitLyrics(lyrics) {
    const maxLength = 4000;
    const chunks = [];
    if (!lyrics) return chunks;
    let currentChunk = '';
    const lines = lyrics.split('\n');
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 <= maxLength) {
            currentChunk += line + '\n';
        } else {
            if (line.length > maxLength) {
                if (currentChunk) chunks.push(currentChunk.trim());
                for (let i = 0; i < line.length; i += maxLength) {
                    chunks.push(line.substring(i, i + maxLength));
                }
                currentChunk = '';
            } else {
                 if (currentChunk) chunks.push(currentChunk.trim());
                 currentChunk = line + '\n';
            }
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

async function getTextChannel(guildId, channelInfo) {
    // Fetches channel and checks permissions
    if (!channelInfo?.id) return null;
    try {
        const channel = await client.channels.fetch(channelInfo.id);
        if (channel?.isTextBased() && channel.guild?.members?.me?.permissionsIn(channel).has('SendMessages')) {
            return channel;
        }
    } catch (error) {
        if (error.code !== 10003 && error.code !== 50001) {
             console.error(`[Error] Could not fetch text channel ${channelInfo.id} for guild ${guildId}: ${error.message}`);
        }
    }
    return null;
}

function checkVoiceChannel(interaction, requireBotConnected = false, requireSameChannel = false) {
    // Consolidated voice channel checks
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
        return null;
    }
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
        interaction.reply({ content: 'I need permissions to join and speak in your voice channel!', ephemeral: true });
        return null;
    }
    const connection = getVoiceConnection(interaction.guildId);
    if (requireBotConnected && !connection) {
        interaction.reply({ content: 'I\'m not connected to a voice channel!', ephemeral: true });
        return null;
    }
    if (connection && requireSameChannel && connection.joinConfig.channelId !== voiceChannel.id) {
        interaction.reply({ content: 'You need to be in the same voice channel as me!', ephemeral: true });
        return null;
    }
     if (connection && !requireBotConnected && connection.joinConfig.channelId !== voiceChannel.id) {
        // Special case for play command if bot is already elsewhere
         interaction.reply({ content: 'I\'m already playing music in another voice channel!', ephemeral: true });
         return null; // Prevent joining a different channel while playing
     }
    return voiceChannel;
}


// --- Define Slash Commands ---
const commandFiles = [ // Simulate loading commands - replace with actual file loading if needed
    // Play
     { data: new SlashCommandBuilder().setName('play').setDescription('Plays a song from Spotify or SoundCloud').addStringOption(o=>o.setName('query').setDescription('Song name or URL').setRequired(true)).addStringOption(o=>o.setName('source').setDescription('Platform').addChoices({name:'Spotify',value:'spotify'},{name:'SoundCloud',value:'soundcloud'})),
        async execute(interaction) {
            const voiceChannel = checkVoiceChannel(interaction);
            if (!voiceChannel) return;
            await interaction.deferReply();
            const query = interaction.options.getString('query');
            const source = interaction.options.getString('source') || 'spotify';
            try {
                await yukufy.play({ query, voiceChannel, textChannel: interaction.channel, member: interaction.member, source });
                await interaction.editReply(`🔍 Searching for \`${query}\`...`);
            } catch (e) { await interaction.editReply(`❌ Error: ${e.message}`).catch(()=>{}); }
        }
    },
    // Skip
     { data: new SlashCommandBuilder().setName('skip').setDescription('Skips the current song'),
        async execute(interaction) {
            if (!checkVoiceChannel(interaction, true, true)) return; // Require bot connected and user in same channel
            const current = yukufy.current[interaction.guildId];
            if (!current) return interaction.reply({content: 'Nothing is playing!', ephemeral: true});
            try {
                yukufy.skip(interaction.guildId);
                await interaction.reply(`⏭️ Skipped **${current.title}**.`);
            } catch (e) { await interaction.reply({content: `❌ Error: ${e.message}`, ephemeral: true}); }
        }
    },
    // Stop
     { data: new SlashCommandBuilder().setName('stop').setDescription('Stops playback and clears the queue'),
        async execute(interaction) {
             if (!checkVoiceChannel(interaction, true, true)) return;
            try {
                yukufy.stop(interaction.guildId);
                await interaction.reply('⏹️ Stopped playback and cleared queue.');
            } catch (e) { await interaction.reply({content: `❌ Error: ${e.message}`, ephemeral: true}); }
        }
    },
    // Queue
    { data: new SlashCommandBuilder().setName('queue').setDescription('Shows the music queue').addIntegerOption(o=>o.setName('page').setDescription('Page number').setMinValue(1)),
        async execute(interaction) {
            const guildId = interaction.guildId;
            const queue = yukufy.getQueue(guildId);
            const current = yukufy.getNowPlaying(guildId);
            if (!current && queue.length === 0) return interaction.reply({ content: 'Queue is empty.', ephemeral: true });

            const itemsPerPage = 10;
            const totalItems = queue.length;
            const pageCount = Math.max(1, Math.ceil(totalItems / itemsPerPage));
            let page = interaction.options.getInteger('page') || 1;
            page = Math.max(1, Math.min(page, pageCount));
            const startIdx = (page - 1) * itemsPerPage;
            const currentItems = queue.slice(startIdx, startIdx + itemsPerPage);

            const embed = new EmbedBuilder().setTitle('🎵 Music Queue').setColor('#1ED760').setTimestamp();
            if (current) {
                const time = current.elapsedTimeFormatted ? `${current.elapsedTimeFormatted}/${current.durationFormatted}` : current.durationFormatted;
                embed.addFields({ name: '▶️ Now Playing', value: `[${current.title}](${current.url}) | ${time}\nRequested by: ${current.member?.displayName}` });
                embed.addFields({ name: 'Progress', value: createProgressBar(current.progress) });
            }
            if (currentItems.length > 0) {
                const list = currentItems.map((t, i) => `**${startIdx + i + 1}.** [${t.title}](${t.url}) \`${t.duration}\`\n Requested by: ${t.member?.displayName}`).join('\n');
                embed.addFields({ name: `📄 Queue (Page ${page}/${pageCount})`, value: list.substring(0, 1020) + (list.length > 1020 ? '...' : '') });
            }
            embed.addFields({ name: '📊 Stats', value: `**Songs:** ${totalItems} | **Duration:** ${formatDuration(queue)}` });
            embed.setFooter({ text: `Use /queue <page> | ${client.user.username}` });
            await interaction.reply({ embeds: [embed] });
        }
    },
    // Add other commands similarly (Pause, Resume, Leave, Loop, Shuffle, Remove, Move, NowPlaying, Volume, Lyrics, Clear, Status, Help)
    // Example: Pause
    { data: new SlashCommandBuilder().setName('pause').setDescription('Pauses playback'),
        async execute(interaction) {
             if (!checkVoiceChannel(interaction, true, true)) return;
             const status = yukufy.getStatus(interaction.guildId);
             if (!status.playing) return interaction.reply({content: 'Not playing anything.', ephemeral: true});
             if (yukufy.pause(interaction.guildId)) await interaction.reply('⏸️ Paused.');
             else await interaction.reply({content: 'Could not pause.', ephemeral: true});
        }
    },
    // Example: Resume
    { data: new SlashCommandBuilder().setName('resume').setDescription('Resumes playback'),
        async execute(interaction) {
             if (!checkVoiceChannel(interaction, true, true)) return;
             const status = yukufy.getStatus(interaction.guildId);
             if (!status.paused) return interaction.reply({content: 'Not paused.', ephemeral: true});
             if (yukufy.resume(interaction.guildId)) await interaction.reply('▶️ Resumed.');
             else await interaction.reply({content: 'Could not resume.', ephemeral: true});
        }
    },
     // Example: Help
    { data: new SlashCommandBuilder().setName('help').setDescription('Shows available commands'),
        async execute(interaction) {
            const cmdList = client.commands.map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Commands')
                .setColor('#5865F2')
                .setDescription(cmdList || 'No commands found.')
                .setFooter({ text: `${client.user.username}` });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
    // ... (Add all other commands here following the pattern)
];

// --- Register Commands ---
commandFiles.forEach(cmd => client.commands.set(cmd.data.name, cmd));
const rest = new REST({ version: '10' }).setToken(config.token);

// --- Event Handlers ---

// Yukufy Events
yukufy.on('trackStart', async (track) => {
    const channel = await getTextChannel(track.guildId, track.textChannel);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor('#1ED760').setTitle('▶️ Now Playing')
        .setDescription(`**[${track.title}](${track.url})**\nBy: ${track.artist}`)
        .setThumbnail(track.thumbnail).setTimestamp()
        .addFields(
            { name: 'Duration', value: `\`${track.duration}\``, inline: true },
            { name: 'Requested by', value: `${track.member?.displayName}`, inline: true },
            { name: 'Source', value: `${track.source}`, inline: true }
        ).setFooter({ text: `Volume: ${yukufy.volume}%` });
    channel.send({ embeds: [embed] }).catch(console.error);
});

yukufy.on('trackAdd', async ({ track, queue, guildId }) => {
    const channel = await getTextChannel(guildId, track.textChannel);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor('#A8DADC').setTitle('➕ Added to Queue')
        .setDescription(`**[${track.title}](${track.url})**\nBy: ${track.artist}`)
        .setThumbnail(track.thumbnail).setTimestamp()
        .addFields(
            { name: 'Duration', value: `\`${track.duration}\``, inline: true },
            { name: 'Position', value: `#${queue.length}`, inline: true },
            { name: 'Requested by', value: `${track.member?.displayName}`, inline: true }
        );
    channel.send({ embeds: [embed] }).catch(console.error);
});

yukufy.on('queueEnd', async (guildId) => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    // Try to find a reasonable channel to post to
    const anyTextChannel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
    if (anyTextChannel) {
        anyTextChannel.send({ embeds: [new EmbedBuilder().setColor('#FF6B6B').setTitle('🏁 Queue Ended').setDescription('Add more songs or I\'ll leave soon!').setTimestamp()] }).catch(console.error);
    }
});

yukufy.on('disconnect', async ({ guildId }) => {
     const guild = client.guilds.cache.get(guildId);
     if (!guild) return;
     const anyTextChannel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
     if (anyTextChannel) {
         anyTextChannel.send({ embeds: [new EmbedBuilder().setColor('#AAAAAA').setTitle('🔌 Disconnected').setDescription('Left the voice channel.').setTimestamp()] }).catch(console.error);
     }
});

yukufy.on('error', async ({ guildId, track, error }) => {
    console.error(`[Yukufy Error] Guild: ${guildId || 'Global'} | Track: ${track?.title || 'N/A'} | Error:`, error);
    const channel = track ? await getTextChannel(guildId, track.textChannel) : null;
    if (channel) {
        channel.send(`⚠️ Error processing "${track?.title || 'track'}":\n\`${error.message || error}\``).catch(console.error);
    }
});

// Discord Client Events
client.on('ready', async () => {
    console.log(`--- Logged in as ${client.user.tag} ---`);
    console.log(`Node: ${process.version} | Discord.js: ${require('discord.js').version}`);
    try {
        const commandData = commandFiles.map(cmd => cmd.data.toJSON());
        const route = config.guildId
            ? Routes.applicationGuildCommands(client.user.id, config.guildId)
            : Routes.applicationCommands(client.user.id);
        await rest.put(route, { body: commandData });
        console.log(`[Commands] Successfully registered ${commandData.length} commands ${config.guildId ? `for guild ${config.guildId}` : 'globally'}.`);
    } catch (error) {
        console.error('[Commands] Error registering commands:', error);
    }
    client.user.setPresence({ activities: [{ name: 'Music | /help', type: 3 }], status: 'online' }); // Type 3 = Watching
    console.log(`--- ${client.user.username} is ready! ---`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    // console.log(`[Interaction] Command '${interaction.commandName}' received from ${interaction.user.tag}`);
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[Interaction Error] Command: ${interaction.commandName} | User: ${interaction.user.tag} | Error:`, error);
        const errMsg = '😥 Oops! An error occurred executing this command.';
        try {
            if (interaction.replied || interaction.deferred) await interaction.followUp({ content: errMsg, ephemeral: true });
            else await interaction.reply({ content: errMsg, ephemeral: true });
        } catch (replyError) { console.error(`[Interaction Error] Failed to send error reply:`, replyError); }
    }
});

// --- Process Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('----- Unhandled Rejection -----');
    console.error('Reason:', reason instanceof Error ? reason.stack : reason);
    console.error('-------------------------------');
});
process.on('uncaughtException', (error, origin) => {
    console.error('----- Uncaught Exception -----');
    console.error('Error:', error.stack || error);
    console.error('Origin:', origin);
    console.error('------------------------------');
});

// --- Start the Bot ---
client.login(config.token).catch(err => {
    console.error("[Login Error]", err);
    process.exit(1);
});
```

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## ⚠️ Notes & Limitations

  * **Seek Command:** The reliability of the `/seek` command depends *heavily* on the implementation in your `Stream.js` file. If using external APIs that process the entire file first, seeking during playback is generally **not supported**. Direct streaming methods (like `ytdl-core` + `ffmpeg`) offer better seeking capabilities.
  * **Dependencies:** Ensure all required dependencies (like `axios` or `ffmpeg`) for your chosen `Stream.js` implementation are installed.

<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 🤝 Community & Support

  * **Discord:** [Join our Support Server](https://www.google.com/url?sa=E&source=gmail&q=https://discord.gg/wV2WamExr5) * **GitHub:** [Report Issues](https://www.google.com/search?q=https://github.com/shindozk/yukufy/issues) | [Star the Repo](https://www.google.com/url?sa=E&source=gmail&q=https://github.com/shindozk/yukufy)<hr style="border: 1px solid #e0e0e0; margin: 30px 0">

## 📜 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

<div align="center">
<p>Maintained with ❤️</p>
</div>