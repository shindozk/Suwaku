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
  
  // Make sure the path to Player.js is correct
  const { YukufyClient } = require('yukufy');
  
  // Create a new client instance
  const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
  });
  
  const config = {
    // It is HIGHLY RECOMMENDED to use environment variables for tokens and secrets
    // Keep your actual tokens secure and preferably in environment variables
    token: process.env.BOT_TOKEN || '', // Replace with your actual token
    clientId: process.env.CLIENT_ID || '', // Replace with your bot's application ID
    guildId: process.env.GUILD_ID, // Optional: For registering commands in a specific guild for testing
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '', // Default fallback
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '' // Default fallback
  };
  
  // Initialize the Yukufy client
  const yukufy = new YukufyClient(client, {
    api: {
        clientId: config.spotifyClientId,
        clientSecret: config.spotifyClientSecret
    },
    player: {
        defaultVolume: 75,
        leaveOnEmptyQueue: true,
        leaveOnEmptyQueueCooldown: 30000 // 30 seconds cooldown
    }
  });
  
  // Initialize commands collection
  client.commands = new Collection();
  
  // --- Helper functions ---
  function createProgressBar(progress) {
    const barLength = 15;
    const validProgress = Math.max(0, Math.min(100, progress || 0)); // Ensure progress is between 0-100
    const filledLength = Math.round(barLength * (validProgress / 100));
    const emptyLength = barLength - filledLength;
    const bar = '▓'.repeat(filledLength) + '░'.repeat(emptyLength);
    return `[${bar}] ${validProgress.toFixed(1)}%`;
  }
  
  function formatDuration(queue) {
    let totalSeconds = 0;
    for (const track of queue) {
        const parts = track.duration?.split(':').map(Number);
        if (parts && parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            totalSeconds += parts[0] * 60 + parts[1];
        }
    }
  
    if (totalSeconds === 0) return '0m 0s';
  
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
  
    let formatted = '';
    if (hours > 0) formatted += `${hours}h `;
    formatted += `${minutes}m ${seconds}s`;
    return formatted.trim(); // Trim potential trailing space
  }
  
  function splitLyrics(lyrics) {
    const maxLength = 4000; // Embed description character limit
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
  
  // Helper to get TextChannel and check permissions
  async function getTextChannel(guildId, channelInfo) {
    if (!channelInfo || !channelInfo.id) return null;
    try {
        // Use client from the outer scope
        const channel = await client.channels.fetch(channelInfo.id);
        // Check if channel exists, is text-based, and bot has send permissions
        if (channel?.isTextBased() && channel.guild?.members?.me?.permissionsIn(channel).has('SendMessages')) {
            return channel;
        }
    } catch (error) {
        // Log only if fetching fails, not if permissions are missing
        if (error.code !== 10003 && error.code !== 50001) { // 10003: Unknown Channel, 50001: Missing Access
             console.error(`[Error] Could not fetch text channel ${channelInfo.id} for guild ${guildId}: ${error.message}`);
        }
    }
    return null;
  }
  
  // Function to check voice channel state and permissions
  function checkVoiceChannel(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        interaction.reply({
            content: 'You need to be in a voice channel to use this command!',
            ephemeral: true
        });
        return null;
    }
  
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions?.has('Connect') || !permissions?.has('Speak')) {
        interaction.reply({
            content: 'I need permissions to join and speak in your voice channel!',
            ephemeral: true
        });
        return null;
    }
  
    // Check if bot is already connected elsewhere in the same guild
    if (!voiceChannel.id) {
        interaction.reply({
            content: 'I\'m already playing music in another voice channel!',
            ephemeral: true
        });
        return null; // Or maybe return the voiceChannel and handle joining later? For now, prevent action.
    }
  
  
    return voiceChannel;
  }
  
  // --- Define commands ---
  const commands = [
    // Play command
    {
        data: new SlashCommandBuilder()
            .setName('play')
            .setDescription('Plays a song from Spotify or SoundCloud (URL or name)')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('The song name or URL')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('source')
                    .setDescription('Optional: Force search on Spotify or SoundCloud')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Spotify', value: 'spotify' },
                        { name: 'SoundCloud', value: 'soundcloud' },
                    )),
        async execute(interaction) {
            const voiceChannel = checkVoiceChannel(interaction); // Use helper for checks
            if (!voiceChannel) return; // Stop if checks fail
  
            await interaction.deferReply();
  
            const query = interaction.options.getString('query');
            const source = interaction.options.getString('source') || 'spotify'; // Default to Spotify
  
            try {
                // Pass necessary objects to Yukufy
                await yukufy.play({
                    query,
                    voiceChannel,
                    textChannel: interaction.channel, // Channel where command was used
                    member: interaction.member, // Member who used the command
                    source
                });
  
                // Initial reply will be updated by trackAdd/trackStart events
                // Confirming search started
                await interaction.editReply(`🔍 Searching for \`${query}\` on ${source}...`);
  
            } catch (error) {
                console.error(`[Command Error: play] ${error.stack || error}`);
                // Provide a more user-friendly error message
                const displayError = error.message.includes("No track found")
                    ? `❌ No track found for query "${query}" on ${source}.`
                    : `❌ Error playing music: ${error.message}`;
                await interaction.editReply({ content: displayError }).catch(() => {}); // Avoid crashing if interaction expired
            }
        }
    },
  
    // Queue command
    {
        data: new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Shows the current music queue')
            .addIntegerOption(option =>
                option.setName('page')
                    .setDescription('Queue page number')
                    .setMinValue(1)
                    .setRequired(false)),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const queue = yukufy.getQueue(guildId); // Gets queue (array of TrackInfo)
            const currentTrack = yukufy.getNowPlaying(guildId); // Gets current track with progress
  
            if (!currentTrack && queue.length === 0) {
                return interaction.reply({
                    content: 'The queue is empty and nothing is playing.',
                    ephemeral: true
                });
            }
  
            const itemsPerPage = 10;
            const totalItems = queue.length;
            const pageCount = Math.max(1, Math.ceil(totalItems / itemsPerPage));
            let page = interaction.options.getInteger('page') || 1;
            page = Math.max(1, Math.min(page, pageCount)); // Clamp page number
  
            const startIdx = (page - 1) * itemsPerPage;
            const endIdx = startIdx + itemsPerPage;
            const currentItems = queue.slice(startIdx, endIdx);
  
            const embed = new EmbedBuilder()
                .setTitle('🎵 Music Queue')
                .setColor('#1ED760') // Spotify Brand Green
                .setTimestamp();
  
            if (currentTrack) {
                // Use formatted time info from getNowPlaying
                const timeInfo = currentTrack.elapsedTimeFormatted
                               ? `${currentTrack.elapsedTimeFormatted} / ${currentTrack.durationFormatted}`
                               : currentTrack.durationFormatted || 'N/A';
                embed.addFields({
                    name: '▶️ Now Playing',
                    value: `[${currentTrack.title}](${currentTrack.url})\n` +
                           `**By:** ${currentTrack.artist}\n` +
                           `**Duration:** ${timeInfo}\n` +
                           `**Requested by:** ${currentTrack.member?.displayName || 'Unknown'}` // Access member object
                });
                const progressBar = createProgressBar(currentTrack.progress);
                embed.addFields({ name: 'Progress', value: progressBar });
            } else {
                embed.addFields({ name: '▶️ Now Playing', value: 'Nothing is currently playing.' });
            }
  
            if (currentItems.length > 0) {
                const queueString = currentItems.map((track, index) =>
                    `**${startIdx + index + 1}.** [${track.title}](${track.url})\n` +
                    `   **By:** ${track.artist} | **Duration:** \`${track.duration || 'N/A'}\`\n` +
                    `   **Requested by:** ${track.member?.displayName || 'Unknown'}` // Access member object
                ).join('\n\n');
  
                embed.addFields({
                    name: `📄 Queue (Page ${page}/${pageCount})`,
                    // Limit field value to avoid Discord errors
                    value: queueString.substring(0, 1020) + (queueString.length > 1020 ? '...' : '')
                });
            } else if (page > 1) {
                 embed.addFields({ name: `📄 Queue (Page ${page}/${pageCount})`, value: 'There are no songs on this page.' });
            } else if (queue.length > 0) {
                // This case shouldn't normally happen with correct pagination, but as a fallback:
                embed.addFields({ name: '📄 Queue', value: 'No more songs in the queue.' });
            }
  
  
            const totalDuration = formatDuration(queue);
            embed.addFields({
                name: '📊 Statistics',
                value: `**Total songs in queue:** ${totalItems}\n` +
                       `**Total duration:** ${totalDuration}`
            });
  
            embed.setFooter({
                text: `Use /queue <page> to view other pages | ${client.user.username}`
            });
  
            await interaction.reply({ embeds: [embed] });
        }
    },
  
    // Skip command
    {
        data: new SlashCommandBuilder()
            .setName('skip')
            .setDescription('Skips the current song'),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
            // Check if bot is connected and playing in this guild
            const currentTrack = yukufy.current[guildId]; // Check internal state directly
  
            if (!currentTrack) {
                return interaction.reply({ content: 'Nothing is playing to skip!', ephemeral: true });
            }
  
             // Optional: Check if user is in the same channel as the bot
            if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot to skip!', ephemeral: true });
            }
  
            try {
                const success = yukufy.skip(guildId);
                if (success) {
                    // The 'trackStart' event will announce the next song if there is one.
                    await interaction.reply(`⏭️ Skipped: **${currentTrack.title}**!`);
                } else {
                    // This case might occur if skip was called between track end and next track start.
                    await interaction.reply({ content: 'Could not skip the track. Is it already ending?', ephemeral: true });
                }
            } catch (error) {
                console.error(`[Command Error: skip] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error skipping track: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Stop command
    {
        data: new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stops playback and clears the queue'),
        async execute(interaction) {
             const guildId = interaction.guildId;
             if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
             const voiceChannel = interaction.member?.voice?.channel;
             if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
             // Optional: Check if user is in the same channel as the bot
             if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
             }
  
             try {
                yukufy.stop(guildId); // stop method clears queue and stops player
                await interaction.reply('⏹️ Playback stopped and queue cleared.');
            } catch (error) {
                console.error(`[Command Error: stop] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error stopping playback: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Pause command
    {
        data: new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Pauses the current song'),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
            // Check if bot is connected and playing
            const status = yukufy.getStatus(guildId); // Use getStatus for checks
            if (!status.playing) {
                 return interaction.reply({ content: 'Nothing is currently playing to pause!', ephemeral: true });
            }
  
            // Optional: Check if user is in the same channel as the bot
            if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
            }
  
            try {
                const success = yukufy.pause(guildId);
                if (success) {
                    await interaction.reply('⏸️ Playback paused. Use `/resume` to continue.');
                } else {
                     await interaction.reply({ content: 'Could not pause playback. Is it already paused?', ephemeral: true });
                }
            } catch (error) {
                console.error(`[Command Error: pause] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error pausing: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Resume command
    {
        data: new SlashCommandBuilder()
            .setName('resume')
            .setDescription('Resumes paused playback'),
        async execute(interaction) {
             const guildId = interaction.guildId;
             if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
             const voiceChannel = interaction.member?.voice?.channel;
             if (!voiceChannel) {
                 return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
             }
  
             // Check if bot is connected and paused
             const status = yukufy.getStatus(guildId);
             if (!status.paused) {
                  return interaction.reply({ content: 'Playback is not paused!', ephemeral: true });
             }
  
             // Optional: Check if user is in the same channel as the bot
             if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
             }
  
            try {
                const success = yukufy.resume(guildId);
                 if (success) {
                    await interaction.reply('▶️ Playback resumed.');
                } else {
                    // This might happen if the state changed right before command execution
                     await interaction.reply({ content: 'Could not resume playback.', ephemeral: true });
                }
            } catch (error) {
                console.error(`[Command Error: resume] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error resuming: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Leave command
    {
        data: new SlashCommandBuilder()
            .setName('leave')
            .setDescription('Makes the bot leave the voice channel'),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
            // Require user to be in the same channel to issue leave command
            if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You must be in the same voice channel as the bot to make it leave!', ephemeral: true });
            }
  
            try {
                // leave method already stops player and cleans up
                const success = yukufy.leave(guildId);
                if (success) {
                    await interaction.reply('👋 Leaving the voice channel!');
                }
                // Should always succeed if connection exists
            } catch (error) {
                console.error(`[Command Error: leave] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error leaving channel: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Loop command
    {
        data: new SlashCommandBuilder()
            .setName('loop')
            .setDescription('Sets the loop mode (queue, track, or off)')
            .addStringOption(option =>
                option.setName('mode')
                    .setDescription('Loop mode')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Off', value: '0' },
                        { name: 'Track', value: '1' },
                        { name: 'Queue', value: '2' },
                    )),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
             // Check if bot is connected
             if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
             }
  
  
            const mode = parseInt(interaction.options.getString('mode'), 10);
  
            try {
                yukufy.setLoopMode(guildId, mode);
  
                let responseText = '';
                switch (mode) {
                    case 0: responseText = '🔄 Loop mode: Off'; break;
                    case 1: responseText = '🔂 Loop mode: Current Track'; break;
                    case 2: responseText = '🔁 Loop mode: Queue'; break;
                    default: responseText = 'Loop mode updated.'; // Should not happen
                }
                await interaction.reply(responseText);
            } catch (error) {
                console.error(`[Command Error: loop] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error setting loop mode: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Shuffle command
    {
        data: new SlashCommandBuilder()
            .setName('shuffle')
            .setDescription('Shuffles the current music queue'),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
            // Check if bot is connected
             // Optional: Check if user is in the same channel
             if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
             }
  
            try {
                const queue = yukufy.shuffle(guildId);
  
                if (!queue || queue.length < 2) {
                    return interaction.reply({ content: 'Requires at least 2 songs in the queue to shuffle!', ephemeral: true });
                }
                await interaction.reply(`🔀 Queue shuffled! Use \`/queue\` to see the new order.`);
            } catch (error) {
                console.error(`[Command Error: shuffle] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error shuffling queue: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Remove command
    {
        data: new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Removes a song from the queue by its position')
            .addIntegerOption(option =>
                option.setName('position')
                    .setDescription('Position of the song in the queue (see /queue)')
                    .setRequired(true)
                    .setMinValue(1)), // User position starts at 1
        async execute(interaction) {
            const guildId = interaction.guildId;
             if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
             const voiceChannel = interaction.member?.voice?.channel;
             if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
             // Check if bot is connected
             // Optional: Check if user is in the same channel
             if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
             }
  
            const position = interaction.options.getInteger('position');
            const indexToRemove = position - 1; // Adjust to 0-based index
  
            try {
                 // removeFromQueue expects the correct 0-based index
                const removedTrack = yukufy.removeFromQueue(guildId, indexToRemove);
                await interaction.reply(`🗑️ Removed from queue: **${removedTrack.title}** by ${removedTrack.artist}`);
            } catch (error) {
                console.error(`[Command Error: remove] ${error.stack || error}`);
                // API error message should be informative (Invalid identifier or track not found)
                await interaction.reply({ content: `❌ Error removing track: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Move command
    {
        data: new SlashCommandBuilder()
            .setName('move')
            .setDescription('Moves a song to another position in the queue')
            .addIntegerOption(option =>
                option.setName('from')
                    .setDescription('Current position of the song (see /queue)')
                    .setRequired(true)
                    .setMinValue(1))
            .addIntegerOption(option =>
                option.setName('to')
                    .setDescription('New position for the song')
                    .setRequired(true)
                    .setMinValue(1)),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
             // Check if bot is connected
             // Optional: Check if user is in the same channel
             if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
             }
  
            const fromPosition = interaction.options.getInteger('from');
            const toPosition = interaction.options.getInteger('to');
            const fromIndex = fromPosition - 1; // Adjust to 0-based index
            const toIndex = toPosition - 1;   // Adjust to 0-based index
  
             try {
                 // moveInQueue expects correct 0-based indices
                yukufy.moveInQueue(guildId, fromIndex, toIndex);
                await interaction.reply(`↔️ Song from position #${fromPosition} moved to #${toPosition}.`);
            } catch (error) {
                console.error(`[Command Error: move] ${error.stack || error}`);
                 // API error message should be informative
                await interaction.reply({ content: `❌ Error moving track: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Now Playing command
    {
        data: new SlashCommandBuilder()
            .setName('nowplaying')
            .setDescription('Shows information about the currently playing song'),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            try {
                // Use getNowPlaying which includes formatted progress data
                const currentTrack = yukufy.getNowPlaying(guildId);
  
                if (!currentTrack) {
                    return interaction.reply({ content: 'Nothing is currently playing.', ephemeral: true });
                }
  
                const embed = new EmbedBuilder()
                    .setTitle('▶️ Now Playing')
                    .setColor('#1ED760') // Spotify Green
                    .setTimestamp();
  
                if (currentTrack.thumbnail) {
                    embed.setThumbnail(currentTrack.thumbnail);
                }
  
                // Use Markdown for better formatting
                embed.setDescription(`**[${currentTrack.title}](${currentTrack.url})**\n**By:** ${currentTrack.artist}`);
  
                // Use formatted fields from getNowPlaying
                const timeInfo = currentTrack.elapsedTimeFormatted
                               ? `${currentTrack.elapsedTimeFormatted} / ${currentTrack.durationFormatted}`
                               : currentTrack.durationFormatted || 'N/A';
                const source = currentTrack.source
                               ? currentTrack.source.charAt(0).toUpperCase() + currentTrack.source.slice(1)
                               : 'N/A';
  
                embed.addFields(
                    { name: 'Duration', value: timeInfo, inline: true },
                    // Access member object correctly
                    { name: 'Requested by', value: currentTrack.member?.displayName || 'Unknown', inline: true },
                    { name: 'Source', value: source, inline: true }
                );
  
                // Use progress data from getNowPlaying
                const progressBar = createProgressBar(currentTrack.progress);
                embed.addFields({ name: 'Progress', value: progressBar });
  
  
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error(`[Command Error: nowplaying] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error getting current track: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Volume command
    {
        data: new SlashCommandBuilder()
            .setName('volume')
            .setDescription('Sets the music volume (0-100+)')
            .addIntegerOption(option =>
                option.setName('level')
                    .setDescription('Volume level (0-100 recommended)')
                    .setRequired(true)
                    .setMinValue(0)), // Allow 0 volume
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            }
  
             // Check if bot is connected
              if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
              }
  
  
            const volumeLevel = interaction.options.getInteger('level');
  
            try {
                // Yukufy's setVolume applies globally or to the current resource
                yukufy.setVolume(volumeLevel);
                await interaction.reply(`🔊 Volume set to ${volumeLevel}%.`);
            } catch (error) {
                console.error(`[Command Error: volume] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error setting volume: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Lyrics command
    {
        data: new SlashCommandBuilder()
            .setName('lyrics')
            .setDescription('Gets lyrics for the current song'),
        async execute(interaction) {
            const guildId = interaction.guildId;
             if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            const currentTrack = yukufy.getNowPlaying(guildId); // Check if something is playing
            if (!currentTrack) {
                 return interaction.reply({ content: 'Nothing is playing to get lyrics for.', ephemeral: true });
            }
  
            await interaction.deferReply(); // Lyrics search can take time
  
            try {
                const lyricsData = await yukufy.getLyrics(guildId);
  
                const lyrics = lyricsData.lyrics;
                const chunks = splitLyrics(lyrics);
  
                if (chunks.length === 0) {
                     // Lyrics might be empty string from Genius sometimes
                     return interaction.editReply({ content: 'Could not find lyrics for this track (or lyrics are empty).' });
                }
  
                const initialEmbed = new EmbedBuilder()
                    .setTitle(`🎤 Lyrics for ${lyricsData.title}`)
                    .setURL(lyricsData.sourceURL || null) // Link to Genius source if available
                    .setColor('#FFFF00') // Genius Yellow
                    .setDescription(chunks[0]) // First chunk
                    .setFooter({ text: `Artist: ${lyricsData.artist} | Source: Genius` });
  
                await interaction.editReply({ embeds: [initialEmbed] });
  
                // Send remaining chunks as follow-up messages
                for (let i = 1; i < chunks.length; i++) {
                    const continuationEmbed = new EmbedBuilder()
                        .setColor('#FFFF00')
                        .setDescription(chunks[i]);
                    // Use followUp for subsequent messages related to the same interaction
                    await interaction.followUp({ embeds: [continuationEmbed], ephemeral: false }).catch(console.error);
                }
  
            } catch (error) {
                console.error(`[Command Error: lyrics] ${error.stack || error}`);
                 // API should throw informative errors (No lyrics found, Could not fetch, Timeout)
                await interaction.editReply({ content: `❌ Error fetching lyrics: ${error.message}` }).catch(()=>{}); // Catch if interaction expired
            }
        }
    },
  
    // Clear command
    {
        data: new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Clears all songs from the queue'),
        async execute(interaction) {
             const guildId = interaction.guildId;
             if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
             const voiceChannel = interaction.member?.voice?.channel;
             if (!voiceChannel) {
                 return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
             }
  
             // Check if bot is connected
              if (!voiceChannel.id) {
                 return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
              }
  
             const queue = yukufy.getQueue(guildId);
             if (queue.length === 0) {
                  return interaction.reply({ content: 'The queue is already empty!', ephemeral: true });
             }
  
            try {
                yukufy.clearQueue(guildId);
                await interaction.reply('🧹 Queue cleared!');
            } catch (error) {
                console.error(`[Command Error: clear] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error clearing queue: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Status command
    {
        data: new SlashCommandBuilder()
            .setName('status')
            .setDescription('Shows the music player status'),
        async execute(interaction) {
            const guildId = interaction.guildId;
            if (!guildId) return interaction.reply({ content: 'This command is only available in a server.', ephemeral: true });
  
            try {
                // getStatus provides formatted status info
                const status = yukufy.getStatus(guildId);
                const loopModeMap = ['Off', 'Track', 'Queue'];
  
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ Player Status')
                    .setColor('#4A90E2') // Blue
                    .setTimestamp()
                    .addFields(
                        { name: 'Connected', value: status.connected ? `✅ Yes (Channel ID: ${status.channelId || 'N/A'})` : '❌ No', inline: true },
                        { name: 'Playing', value: status.playing ? '▶️ Yes' : '⏹️ No', inline: true },
                        { name: 'Paused', value: status.paused ? '⏸️ Yes' : '▶️ No', inline: true },
                        { name: 'Volume', value: `🔊 ${status.volume}%`, inline: true },
                        { name: 'Loop Mode', value: `🔄 ${loopModeMap[status.loopMode] || 'Off'}`, inline: true },
                        { name: 'Queue Size', value: `🎵 ${status.queueSize}`, inline: true },
                        // Use RTT (Round Trip Time) for voice ping if available
                        { name: 'Voice Ping', value: `📶 ${status.ping?.rtt ?? 'N/A'} ms`, inline: true },
                        { name: 'Player State', value: `⚙️ ${status.playerStatus}`, inline: true },
                        // Uptime calculation
                        { name: 'Bot Uptime', value: `⏱️ ${Math.floor(status.uptimeSeconds / 3600)}h ${Math.floor((status.uptimeSeconds % 3600) / 60)}m ${Math.floor(status.uptimeSeconds % 60)}s`, inline: true },
                        { name: 'Active Filters', value: status.filters?.length > 0 ? status.filters.join(', ') : 'None', inline: false }
                    );
  
                if (status.currentTrack) {
                    // Display current track info concisely
                    const timeInfo = status.currentTrack.elapsedTimeFormatted
                               ? `${status.currentTrack.elapsedTimeFormatted} / ${status.currentTrack.durationFormatted}`
                               : status.currentTrack.durationFormatted || 'N/A';
                    embed.addFields({
                        name: 'Current Track',
                        value: `[${status.currentTrack.title}](${status.currentTrack.url}) | ${timeInfo}`
                    });
                }
  
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error(`[Command Error: status] ${error.stack || error}`);
                await interaction.reply({ content: `❌ Error getting status: ${error.message}`, ephemeral: true });
            }
        }
    },
  
    // Help command
    {
        data: new SlashCommandBuilder()
            .setName('help')
            .setDescription('Shows all available commands'),
        async execute(interaction) {
            // Generate command list dynamically
            const commandList = client.commands.map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
  
            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Commands')
                .setColor('#5865F2') // Discord Blurple
                .setDescription(commandList || 'No commands found.')
                .setFooter({ text: `${client.user.username} | Powered by Yukufy` });
  
            await interaction.reply({ embeds: [embed], ephemeral: true }); // Make help ephemeral
        }
    }
  ];
  
  // --- Register commands ---
  commands.forEach(cmd => {
    if (cmd.data?.name && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
    } else {
        console.warn(`[Command Load Warning] Skipping command due to missing 'data.name' or 'execute'.`);
    }
  });
  
  // --- Set up music event handlers ---
  
  yukufy.on('trackAdd', async ({ track, queue, guildId }) => {
    const textChannel = await getTextChannel(guildId, track.textChannel);
    if (!textChannel) return;
  
    const embed = new EmbedBuilder()
        .setColor('#A8DADC') // Light Blue color for additions
        .setTitle('➕ Added to Queue')
        .setDescription(`**[${track.title}](${track.url})**\nBy: ${track.artist}`)
        .setThumbnail(track.thumbnail || null)
        .addFields(
            { name: 'Duration', value: `\`${track.duration || 'N/A'}\``, inline: true },
            { name: 'Queue Position', value: `#${queue.length}`, inline: true },
            { name: 'Requested by', value: track.member?.displayName || 'Unknown', inline: true }
        )
        .setTimestamp();
  
    textChannel.send({ embeds: [embed] }).catch(console.error);
  });
  
  yukufy.on('trackStart', async (track) => {
    const guildId = track.guildId;
    const textChannel = await getTextChannel(guildId, track.textChannel);
     if (!textChannel) {
        console.log(`[Event: trackStart] No valid text channel for guild ${guildId} to announce track: ${track.title}`);
        return;
    }
  
    const embed = new EmbedBuilder()
        .setColor('#1ED760') // Spotify Green for playing
        .setTitle('▶️ Now Playing')
        .setDescription(`**[${track.title}](${track.url})**\nBy: ${track.artist}`)
        .setThumbnail(track.thumbnail || null)
        .addFields(
            { name: 'Duration', value: `\`${track.duration || 'N/A'}\``, inline: true },
            { name: 'Requested by', value: track.member?.displayName || 'Unknown', inline: true },
            { name: 'Source', value: track.source ? track.source.charAt(0).toUpperCase() + track.source.slice(1) : 'N/A', inline: true }
        )
         .setTimestamp()
         .setFooter({text: `Volume: ${yukufy.volume}%`}); // Show current volume
  
    textChannel.send({ embeds: [embed] }).catch(e => console.error(`[Event: trackStart] Failed to send message to channel ${textChannel.id}: ${e.message}`));
  });
  
  yukufy.on('queueEnd', (guildId) => {
    // Try to find a suitable text channel to notify
    client.guilds.fetch(guildId).then(async guild => { // Make async
        if (!guild) return;
        // Use the last known text channel if available, otherwise find one
        const lastTrack = yukufy.current[guildId] || yukufy.queues[guildId]?.[0]; // Get potential last track info
        let channel = lastTrack ? await getTextChannel(guildId, lastTrack.textChannel) : null;
  
        if (!channel) {
             channel = guild.channels.cache.find(c =>
                c.isTextBased() &&
                c.permissionsFor(guild.members.me)?.has('SendMessages')
            );
        }
  
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B') // Reddish color for ending
                .setTitle('🏁 Queue Ended')
                .setDescription('The music queue has finished! Add more songs or I\'ll disconnect soon.')
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(console.error);
        }
    }).catch(err => console.warn(`[Event: queueEnd] Could not fetch guild ${guildId} for notification: ${err.message}`));
  });
  
  yukufy.on('trackRemove', async ({ track, guildId }) => {
    // Only send notification if a text channel is associated with the track
    const textChannel = await getTextChannel(guildId, track.textChannel);
    if (!textChannel) return;
  
    textChannel.send(`🗑️ Removed: **${track.title}** from the queue.`).catch(console.error);
  });
  
  // yukufy.on('queueShuffle', ({ guildId, queue }) => {
  //     // Optional: Notify that the queue was shuffled
  //     console.log(`[Event: queueShuffle] Queue shuffled for guild ${guildId}. New size: ${queue.length}`);
  // });
  
  yukufy.on('disconnect', (data) => { // Event might pass data object { guildId }
    const guildId = data?.guildId;
    if (!guildId) return;
     // Try to find a suitable text channel to notify
     client.guilds.fetch(guildId).then(async guild => { // Make async
        if (!guild) return;
        // Use the last known text channel if available, otherwise find one
        const lastTrack = yukufy.current[guildId]; // Check if something was playing before disconnect
        let channel = lastTrack ? await getTextChannel(guildId, lastTrack.textChannel) : null;
  
        if (!channel) {
             channel = guild.channels.cache.find(c =>
                c.isTextBased() &&
                c.permissionsFor(guild.members.me)?.has('SendMessages')
            );
        }
        if (channel) {
             const embed = new EmbedBuilder()
                .setColor('#AAAAAA') // Gray for disconnect
                .setTitle('🔌 Disconnected')
                .setDescription('Left the voice channel.')
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(console.error);
        }
    }).catch(err => console.warn(`[Event: disconnect] Could not fetch guild ${guildId} for notification: ${err.message}`));
  });
  
  // --- Yukufy Debug/Error Listeners ---
  yukufy.on('error', async ({ guildId, track, error }) => { // Make async
    console.error(`[Yukufy Error] Guild: ${guildId || 'Global'} | Track: ${track?.title || 'N/A'} | Error: ${error}`);
  
    // Try to send error message to the track's text channel if possible
    const textChannel = track ? await getTextChannel(guildId, track.textChannel) : null;
    if (textChannel) {
       try {
            await textChannel.send(`⚠️ An error occurred while processing "${track?.title || 'Unknown Track'}":\n\`\`\`${error.message || error}\`\`\``);
       } catch (sendError) {
            console.error(`[Yukufy Error] Failed to send error message to channel ${textChannel.id}: ${sendError.message}`);
       }
    }
  });
  
  yukufy.on('warn', (message) => {
    console.warn(`[Yukufy Warn] ${message}`);
  });
  
  yukufy.on('debug', (message) => {
    // console.log(`[Yukufy Debug] ${message}`); // Uncomment for verbose debugging
  });
  
  // --- Client ready event ---
  client.on('ready', async () => {
    console.log(`--- Logged in as ${client.user.tag} ---`);
    console.log(`Node.js Version: ${process.version}`);
    console.log(`Discord.js Version: ${require('discord.js').version}`);
    console.log(`Yukufy Initialized. Leave on Empty: ${yukufy.leaveOnEmptyQueue}, Cooldown: ${yukufy.leaveOnEmptyQueueCooldown}ms`);
  
    // --- Register slash commands ---
    const rest = new REST({ version: '10' }).setToken(config.token);
    const commandData = commands.map(cmd => cmd.data.toJSON());
  
    try {
        console.log(`[Commands] Started refreshing ${commandData.length} application (/) commands.`);
  
        let route;
        if (config.guildId) {
            // Register commands only for the test guild (faster updates)
            route = Routes.applicationGuildCommands(client.user.id, config.guildId);
            console.log(`[Commands] Registering commands for test guild: ${config.guildId}`);
        } else {
            // Register commands globally (can take up to 1 hour to update)
            route = Routes.applicationCommands(client.user.id);
            console.log(`[Commands] Registering commands globally.`);
        }
  
        await rest.put(route, { body: commandData });
  
        console.log(`[Commands] Successfully reloaded application (/) commands.`);
    } catch (error) {
        console.error('[Commands] Error reloading application commands:', error);
    }
  
    // --- Set bot presence ---
    client.user.setPresence({
        activities: [{ name: 'music 🎶 | /help', type: 3 }], // Type 3 = Watching
        status: 'online',
    });
     console.log(`Presence set to: ${client.user.presence.activities[0]?.name || 'None'}`);
     console.log(`--- ${client.user.username} is ready! ---`);
  });
  
  // --- Handle slash command interactions ---
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return; // Only handle slash commands
  
    const command = client.commands.get(interaction.commandName);
  
    if (!command) {
        console.warn(`[Interaction] No command matching '${interaction.commandName}' was found.`);
        // Use await for the reply
        await interaction.reply({ content: 'Command not found!', ephemeral: true }).catch(() => {});
        return;
    }
  
    // console.log(`[Interaction] Executing command '${interaction.commandName}' by ${interaction.user.tag} in guild ${interaction.guildId || 'DM'}`);
  
    try {
        // Execute the command
        await command.execute(interaction); // Removed client argument as it's globally accessible
    } catch (error) {
        console.error(`[Interaction Error] Command: ${interaction.commandName} | User: ${interaction.user.tag} | Error: ${error.stack || error}`);
        const errorMessage = '😥 Oops! An error occurred while executing this command.';
  
        // Try to reply or follow up about the error
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            console.error(`[Interaction Error] Failed to send error reply for command ${interaction.commandName}:`, replyError);
        }
    }
  });
  
  // --- Handle Process Errors ---
  process.on('unhandledRejection', (reason, promise) => {
    console.error('----- Unhandled Rejection -----');
    console.error('Reason:', reason instanceof Error ? reason.stack : reason);
    // console.error('Promise:', promise); // Can be verbose
    console.error('-------------------------------');
  });
  
  process.on('uncaughtException', (error, origin) => {
    console.error('----- Uncaught Exception -----');
    console.error('Error:', error.stack || error);
    console.error('Origin:', origin);
    console.error('------------------------------');
    // Consider graceful shutdown for critical uncaught exceptions
    // process.exit(1);
  });
  
  process.on('warning', (warning) => {
    console.warn('----- Process Warning -----');
    console.warn('Name:', warning.name);
    console.warn('Message:', warning.message);
    console.warn('Stack:', warning.stack);
    console.warn('---------------------------');
  });
  
  
  // --- Login to Discord ---
  if (!config.token || config.token === 'YOUR_BOT_TOKEN_HERE') {
    console.error("FATAL ERROR: Bot token not configured in config.token or environment variable BOT_TOKEN!");
    process.exit(1);
  }
  if (!config.clientId || config.clientId === 'YOUR_CLIENT_ID_HERE') {
    console.error("FATAL ERROR: Client ID not configured in config.clientId or environment variable CLIENT_ID!");
    process.exit(1);
  }
  
  
  client.login(config.token)
    .then(() => console.log("[Login] Authentication successful."))
    .catch(err => {
        console.error("[Login Error] Failed to log in:", err);
        process.exit(1); // Exit if login fails
    });