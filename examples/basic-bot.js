/**
 * Suwaku Bot - Complete Example with Slash Commands
 * 
 * This example demonstrates all features of Suwaku with Discord.js v14 slash commands
 */

// Load environment variables
import 'dotenv/config';

// Verify environment variables
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ ERROR: DISCORD_BOT_TOKEN not found in .env file');
  process.exit(1);
}

import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { SuwakuClient } from '../src/index.js';

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Create Suwaku client
const suwaku = new SuwakuClient(client, {
  nodes: [
    {
      host: process.env.LAVALINK_HOST || 'localhost',
      port: parseInt(process.env.LAVALINK_PORT) || 2333,
      password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: false,
      identifier: 'main-node'
    }
  ],
  searchEngine: 'youtube',
  defaultVolume: 80,
  autoLeave: true,
  autoLeaveDelay: 30000,
  historySize: 50,
  enableFilters: true,
  retryOnStuck: true,
  loadBalancer: true
});

// Slash Commands Definition
const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused song'),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip to the next song'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the music queue'),

  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the current song'),

  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Adjust the volume')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Volume (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set loop mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
    ),

  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue'),

  new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a specific time')
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Time in seconds')
        .setRequired(true)
        .setMinValue(0)
    ),

  new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Apply an audio filter')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Filter type')
        .setRequired(true)
        .addChoices(
          { name: 'Nightcore', value: 'nightcore' },
          { name: 'Vaporwave', value: 'vaporwave' },
          { name: 'Bass Boost', value: 'bassboost' },
          { name: '8D', value: '8d' },
          { name: 'Karaoke', value: 'karaoke' },
          { name: 'Clear Filters', value: 'clear' }
        )
    ),

  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your voice channel'),

  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel'),
];

// Register slash commands
async function registerCommands() {
  try {
    console.log('🔄 Registering slash commands...');

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);

    if (error.rawError?.errors) {
      console.error('Error details:');
      console.error(JSON.stringify(error.rawError.errors, null, 2));
    }
  }
}

// Discord client ready event
client.once('clientReady', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);

  // Initialize Suwaku
  await suwaku.init();

  // Register slash commands
  await registerCommands();

  console.log('🎵 Suwaku Bot is ready!');
  console.log('📝 Use slash commands to control the music');
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    // Check if user is in a voice channel (except for queue and nowplaying)
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel && commandName !== 'queue' && commandName !== 'nowplaying') {
      return interaction.reply({
        content: '❌ You need to be in a voice channel!',
        ephemeral: true
      });
    }

    const player = suwaku.getPlayer(interaction.guildId);

    // PLAY COMMAND
    if (commandName === 'play') {
      const query = interaction.options.getString('query');

      await interaction.deferReply();

      try {
        // For large playlists, show progress
        let progressMessage = null;
        const existingPlayer = suwaku.getPlayer(interaction.guildId);
        
        if (existingPlayer) {
          existingPlayer.once('playlistProgress', async (progress) => {
            if (!progressMessage && progress.total > 100) {
              progressMessage = await interaction.editReply({
                content: `⏳ Adding playlist... ${progress.percentage}% (${progress.added}/${progress.total})`
              });
            }
          });
        }

        const result = await suwaku.play({
          query,
          voiceChannel,
          textChannel: interaction.channel,
          member: interaction.member
        });

        if (result.isPlaylist) {
          await interaction.editReply({
            content: `✅ Playlist **${result.playlistInfo.name}** added with ${result.tracks.length} songs!`,
            ephemeral: true
          });
        } else {
          await interaction.editReply({
            content: `✅ **${result.title}** added to queue!`,
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Error in play command:', error);
        await interaction.editReply({
          content: `❌ Error: ${error.message}\n\nMake sure Lavalink is running and configured correctly.`
        });
      }
      return;
    }

    // PAUSE COMMAND
    if (commandName === 'pause') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      if (player.paused) {
        return interaction.reply({ content: '⏸️ Already paused!', ephemeral: true });
      }

      await player.pause();
      return interaction.reply('⏸️ Paused!');
    }

    // RESUME COMMAND
    if (commandName === 'resume') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      if (!player.paused) {
        return interaction.reply({ content: '▶️ Already playing!', ephemeral: true });
      }

      await player.resume();
      return interaction.reply('▶️ Resumed!');
    }

    // SKIP COMMAND
    if (commandName === 'skip') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      if (!player.current) {
        return interaction.reply({ content: '❌ No song playing!', ephemeral: true });
      }

      const skipped = player.current;
      await player.skip();
      return interaction.reply(`⏭️ Skipped: **${skipped.title}**`);
    }

    // STOP COMMAND
    if (commandName === 'stop') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      await player.stop();
      player.queue.clear();
      return interaction.reply('⏹️ Stopped and cleared queue!');
    }

    // QUEUE COMMAND
    if (commandName === 'queue') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      if (!player.current && player.queue.isEmpty) {
        return interaction.reply({ content: '📭 Queue is empty!', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎵 Music Queue')
        .setColor('#0099ff');

      if (player.current) {
        embed.addFields({
          name: '▶️ Now Playing',
          value: `**${player.current.title}**\nBy: ${player.current.author}\nDuration: ${player.current.formattedDuration}`
        });
      }

      if (!player.queue.isEmpty) {
        const queue = player.queue.tracks.slice(0, 10);
        const queueText = queue.map((track, i) => 
          `${i + 1}. **${track.title}** - ${track.formattedDuration}`
        ).join('\n');

        embed.addFields({
          name: `📋 Queue (${player.queue.size} songs)`,
          value: queueText + (player.queue.size > 10 ? `\n... and ${player.queue.size - 10} more` : '')
        });
      }

      embed.setFooter({ text: `Loop: ${player.loop} | Volume: ${player.volume}%` });

      return interaction.reply({ embeds: [embed] });
    }

    // NOW PLAYING COMMAND
    if (commandName === 'nowplaying') {
      if (!player || !player.current) {
        return interaction.reply({ content: '❌ No song playing!', ephemeral: true });
      }

      const track = player.current;
      const position = player.getCurrentPosition();
      const duration = track.duration;
      const progress = Math.floor((position / duration) * 20);
      const progressBar = '▬'.repeat(progress) + '🔘' + '▬'.repeat(20 - progress);

      const embed = new EmbedBuilder()
        .setTitle('🎵 Now Playing')
        .setDescription(`**${track.title}**\nBy: ${track.author}`)
        .addFields(
          { name: 'Duration', value: track.formattedDuration, inline: true },
          { name: 'Requested by', value: track.requester?.username || 'Unknown', inline: true },
          { name: 'Progress', value: `${progressBar}\n${formatDuration(position)} / ${track.formattedDuration}` }
        )
        .setColor('#0099ff');

      if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
      }

      return interaction.reply({ embeds: [embed] });
    }

    // VOLUME COMMAND
    if (commandName === 'volume') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      const volume = interaction.options.getInteger('level');
      await player.setVolume(volume);
      return interaction.reply(`🔊 Volume set to ${volume}%`);
    }

    // LOOP COMMAND
    if (commandName === 'loop') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      const mode = interaction.options.getString('mode');
      player.setLoop(mode);
      
      const modeText = {
        'off': 'Off',
        'track': 'Track',
        'queue': 'Queue'
      };

      return interaction.reply(`🔁 Loop mode: ${modeText[mode]}`);
    }

    // SHUFFLE COMMAND
    if (commandName === 'shuffle') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      if (player.queue.isEmpty) {
        return interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
      }

      player.shuffleQueue();
      return interaction.reply(`🔀 Shuffled ${player.queue.size} songs!`);
    }

    // SEEK COMMAND
    if (commandName === 'seek') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      if (!player.current) {
        return interaction.reply({ content: '❌ No song playing!', ephemeral: true });
      }

      const seconds = interaction.options.getInteger('seconds');
      const ms = seconds * 1000;

      if (ms > player.current.duration) {
        return interaction.reply({ content: '❌ Time exceeds song duration!', ephemeral: true });
      }

      await player.seek(ms);
      return interaction.reply(`⏩ Seeked to ${formatDuration(ms)}`);
    }

    // FILTER COMMAND
    if (commandName === 'filter') {
      if (!player) {
        return interaction.reply({ content: '❌ No active player!', ephemeral: true });
      }

      const filterType = interaction.options.getString('type');

      if (filterType === 'clear') {
        await player.filters.clearFilters();
        return interaction.reply('🎚️ Filters cleared!');
      }

      await interaction.deferReply();

      try {
        await player.filters.applyPreset(filterType);
        await interaction.editReply(`🎚️ Filter ${filterType} applied successfully!`);
      } catch (error) {
        await interaction.editReply(`❌ Error applying filter: ${error.message}`);
      }
      return;
    }

    // JOIN COMMAND
    if (commandName === 'join') {
      await interaction.deferReply();

      try {
        await suwaku.join({
          voiceChannel,
          textChannel: interaction.channel,
          deaf: false,
          mute: false
        });

        await interaction.editReply(`✅ Joined voice channel **${voiceChannel.name}**!`);
      } catch (error) {
        await interaction.editReply(`❌ Error joining channel: ${error.message}`);
      }
      return;
    }

    // LEAVE COMMAND
    if (commandName === 'leave') {
      if (!player) {
        return interaction.reply({ content: '❌ Not in any voice channel!', ephemeral: true });
      }

      await interaction.deferReply();

      try {
        await suwaku.leave(interaction.guildId);
        await interaction.editReply('👋 Left the voice channel!');
      } catch (error) {
        await interaction.editReply(`❌ Error leaving channel: ${error.message}`);
      }
      return;
    }

  } catch (error) {
    console.error('Error executing command:', error);

    const reply = { content: `❌ Error: ${error.message}`, ephemeral: true };

    if (interaction.deferred) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Helper function to format duration
function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Suwaku Events
suwaku.on('nodeConnect', node => {
  console.log(`🔗 Node ${node.identifier} connected`);
});

suwaku.on('nodeDisconnect', (node, data) => {
  console.warn(`⚠️  Node ${node.identifier} disconnected`);
});

suwaku.on('nodeError', (node, error) => {
  console.error(`❌ Node ${node.identifier} error:`, error.message);
});

suwaku.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`🎵 Now playing: **${track.title}** by ${track.author}`);
  }
});

suwaku.on('trackAdd', (player, track) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`✅ Added: **${track.title}** (Position: #${player.queue.size})`);
  }
});

suwaku.on('trackAddPlaylist', (player, playlistData) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`📋 Added playlist: **${playlistData.name}** with ${playlistData.trackCount} songs!`);
  }
});

suwaku.on('queueEnd', player => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send('📭 Queue ended!');
  }
});

suwaku.on('trackStuck', (player, track, threshold) => {
  console.warn(`⚠️  Track stuck: ${track.title} (${threshold}ms)`);
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`⚠️ Track stuck, attempting to resume...`);
  }
});

suwaku.on('trackError', (player, track, error) => {
  console.error(`❌ Track error: ${track.title}`, error);
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`❌ Error playing: **${track.title}**`);
  }
});

suwaku.on('error', (error) => {
  if (!error) {
    console.error('❌ Suwaku error: Unknown error (no error object provided)');
    return;
  }

  const errorMessage = error.message || error.toString() || 'Unknown error';
  console.error('❌ Suwaku error:', errorMessage);

  // Provide helpful hints based on error type
  if (errorMessage.includes('502') || errorMessage.includes('503')) {
    console.log('💡 Tip: Lavalink server may be offline or restarting. Try again in a few seconds.');
  } else if (errorMessage.includes('404')) {
    console.log('💡 Tip: Check if Lavalink server supports API v4 (/v4/websocket)');
  } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Authentication')) {
    console.log('💡 Tip: Check Lavalink password in .env file (LAVALINK_PASSWORD)');
  } else if (errorMessage.includes('ECONNREFUSED')) {
    console.log('💡 Tip: Check if Lavalink is running and host/port are correct in .env');
  } else if (errorMessage.includes('ENOTFOUND')) {
    console.log('💡 Tip: Check LAVALINK_HOST in .env file');
  }
});

suwaku.on('debug', (message) => {
  // Uncomment to see debug messages
  // console.log(`[DEBUG] ${message}`);
});

// Login to Discord
console.log('🔐 Logging in to Discord...');
client.login(process.env.DISCORD_BOT_TOKEN);
