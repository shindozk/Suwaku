/**
 * Suwaku Bot - Complete Example with Slash Commands
 *
 * This example demonstrates all features of Suwaku with Discord.js v14 slash commands
 */

// Load environment variables
import "dotenv/config";

// Verify environment variables
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error("❌ ERROR: DISCORD_BOT_TOKEN not found in .env file");
  process.exit(1);
}

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import {
  SuwakuClient,
  Structure,
  JSONStorageAdapter,
  FilterPreset,
  SearchEngine,
  SponsorBlockCategory,
} from "suwaku";

// --- Structure Extend ---
// We extend the default Queue to add a custom "isFull" property
Structure.extend("Queue", (SuwakuQueue) => {
  return class MyCustomQueue extends SuwakuQueue {
    get isFull() {
      return this.size >= 100;
    }

    // Custom method to get only YouTube tracks
    get youtubeTracks() {
      return this.tracks.filter((t) => t.source === "youtube");
    }
  };
});

// Import TrackSource for type checking
import { TrackSource } from "suwaku";

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Create Suwaku client
const suwaku = new SuwakuClient(client, {
  nodes: [
    {
      host: process.env.LAVALINK_HOST || "localhost",
      port: parseInt(process.env.LAVALINK_PORT) || 2333,
      password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
      secure: process.env.LAVALINK_SECURE === "true",
      identifier: "main-node",
    },
  ],
  searchEngine: SearchEngine.SPOTIFY,
  defaultVolume: 80,
  autoLeave: true,
  autoLeaveDelay: 30000,
  historySize: 50,
  enableFilters: true,
  retryOnStuck: true,
  loadBalancer: true,
  enableLyrics: true,

  // Automatically skip sponsors, intros and other non-music segments
  sponsorBlockCategories: [
    SponsorBlockCategory.SPONSOR,
    SponsorBlockCategory.SELFPROMO,
    SponsorBlockCategory.INTERACTION,
    SponsorBlockCategory.INTRO,
    SponsorBlockCategory.OUTRO,
    SponsorBlockCategory.PREVIEW,
  ],

  autoplayPlatform: ["spsearch", "ytsearch"],

  storageAdapter: new JSONStorageAdapter({
    filePath: "./suwaku-persistence.json",
  }),
});

// Slash Commands Definition
const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song")
    .addStringOption(
      (option) =>
        option
          .setName("query")
          .setDescription("Song name or URL")
          .setRequired(true)
          .setAutocomplete(true), // Enable native autocomplete
    )
    .addStringOption((option) =>
      option
        .setName("source")
        .setDescription("Search source (youtube, spotify, soundcloud, etc)")
        .addChoices(
          { name: "YouTube", value: "youtube" },
          { name: "YouTube Music", value: "youtubemusic" },
          { name: "Spotify", value: "spotify" },
          { name: "SoundCloud", value: "soundcloud" },
          { name: "Deezer", value: "deezer" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("volume")
        .setDescription("Initial volume (0-100)")
        .setMinValue(0)
        .setMaxValue(100),
    ),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause the current song"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume the paused song"),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip to the next song"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the queue"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the music queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the current song"),

  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Adjust the volume")
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("Volume (0-100)")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100),
    ),

  new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Track", value: "track" },
          { name: "Queue", value: "queue" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the queue"),

  new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seek to a specific time")
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription("Time in seconds")
        .setRequired(true)
        .setMinValue(0),
    ),

  new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Apply an audio filter")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Filter type")
        .setRequired(true)
        .addChoices(
          { name: "Nightcore", value: FilterPreset.NIGHTCORE },
          { name: "Vaporwave", value: FilterPreset.VAPORWAVE },
          { name: "Bass Boost Low", value: FilterPreset.BASSBOOST_LOW },
          { name: "Bass Boost Medium", value: FilterPreset.BASSBOOST_MEDIUM },
          { name: "Bass Boost High", value: FilterPreset.BASSBOOST_HIGH },
          { name: "8D", value: FilterPreset.EIGHTD },
          { name: "Karaoke", value: FilterPreset.KARAOKE },
          { name: "Clear Filters", value: "clear" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join your voice channel"),

  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave the voice channel"),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Clear the music queue"),

  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a song from the queue")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position of the song to remove")
        .setRequired(true)
        .setMinValue(1),
    ),

  new SlashCommandBuilder()
    .setName("skipto")
    .setDescription("Skip to a specific song in the queue")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position to skip to")
        .setRequired(true)
        .setMinValue(1),
    ),

  new SlashCommandBuilder()
    .setName("back")
    .setDescription("Play the previous song"),

  new SlashCommandBuilder()
    .setName("removeduplicates")
    .setDescription("Remove duplicate songs from the queue"),

  new SlashCommandBuilder()
    .setName("removebyrequester")
    .setDescription("Remove all songs requested by a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User whose songs should be removed")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay mode"),

  new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Lyrics management")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action to perform")
        .addChoices(
          { name: "Sync (Real-time)", value: "sync" },
          { name: "Full (Static)", value: "full" },
          { name: "Stop Sync", value: "stop" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Prefer original/romanized lyrics")
        .addChoices(
          { name: "Original/Romanized", value: "original" },
          { name: "Translated (Default)", value: "translated" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Song name (optional, defaults to current song)"),
    ),

  new SlashCommandBuilder()
    .setName("restart")
    .setDescription("Restart the current song"),

  new SlashCommandBuilder()
    .setName("move")
    .setDescription("Move a song to a different position in the queue")
    .addIntegerOption((option) =>
      option
        .setName("from")
        .setDescription("Current position of the song")
        .setRequired(true)
        .setMinValue(1),
    )
    .addIntegerOption((option) =>
      option
        .setName("to")
        .setDescription("New position for the song")
        .setRequired(true)
        .setMinValue(1),
    ),

  new SlashCommandBuilder()
    .setName("swap")
    .setDescription("Swap two songs in the queue")
    .addIntegerOption((option) =>
      option
        .setName("first")
        .setDescription("Position of the first song")
        .setRequired(true)
        .setMinValue(1),
    )
    .addIntegerOption((option) =>
      option
        .setName("second")
        .setDescription("Position of the second song")
        .setRequired(true)
        .setMinValue(1),
    ),

  new SlashCommandBuilder()
    .setName("mood")
    .setDescription("Search music by mood (Suwaku Exclusive)")
    .addStringOption((option) =>
      option
        .setName("mood")
        .setDescription("The mood to search for")
        .setRequired(true)
        .addChoices(
          { name: "Happy 😊", value: "happy" },
          { name: "Sad 😢", value: "sad" },
          { name: "Lo-Fi ☕", value: "lofi" },
          { name: "Workout 💪", value: "workout" },
          { name: "Party 🥳", value: "party" },
          { name: "Focus 🧠", value: "focus" },
          { name: "Dark 🌑", value: "dark" },
          { name: "Romantic ❤️", value: "romantic" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("dynamic")
    .setDescription("Toggle Dynamic Rhythm mode (Suwaku Exclusive)"),

  new SlashCommandBuilder()
    .setName("morph")
    .setDescription("Change your voice/audio style (Suwaku Exclusive)")
    .addStringOption((option) =>
      option
        .setName("style")
        .setDescription("The style to apply")
        .setRequired(true)
        .addChoices(
          { name: "Robot 🤖", value: "robot" },
          { name: "Chipmunk 🐿️", value: "chipmunk" },
          { name: "Monster 👹", value: "monster" },
          { name: "Telephone ☎️", value: "telephone" },
          { name: "Radio 📻", value: "radio" },
          { name: "None (Reset) ❌", value: "none" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("sponsorblock")
    .setDescription("Configure SponsorBlock categories to skip")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(true)
        .addChoices(
          { name: "Default Skip (Sponsors/Intros)", value: "default" },
          { name: "Full Skip (All non-music)", value: "full" },
          { name: "Disable", value: "disable" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("search-all")
    .setDescription("Search for tracks, albums and artists (LavaSearch)")
    .addStringOption((option) =>
      option.setName("query").setDescription("Search query").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("nodes")
    .setDescription("Show status of all Lavalink nodes"), // Updated description

  new SlashCommandBuilder()
    .setName("restore")
    .setDescription("Manually restore previous music sessions"), // Added new command
];

// Register slash commands
async function registerCommands() {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const clientId = process.env.DISCORD_CLIENT_ID || client.user?.id;

    if (!clientId) {
      console.error(
        "❌ ERROR: DISCORD_CLIENT_ID not found and bot is not ready.",
      );
      return;
    }

    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_BOT_TOKEN,
    );

    if (guildId) {
      console.log(`🔄 Registering guild commands for: ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log("✅ Guild commands registered!");
    } else {
      console.log("🔄 Registering global application commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("✅ Global commands registered!");
    }
  } catch (error) {
    console.error("❌ Error registering slash commands:", error);

    if (error.rawError?.errors) {
      console.error("Error details:");
      console.error(JSON.stringify(error.rawError.errors, null, 2));
    }
  }
}

suwaku.on("lyricsLoad", (player, lyrics) => {
  console.log(`✅ Lyrics loaded from ${lyrics.source} for: ${lyrics.title}`);
});

// Bot ready event
client.on("ready", async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);

  // Initialize Suwaku
  await suwaku.init();

  // --- RESTORE PLAYERS ---
  try {
    const restored = await suwaku.restorePlayers();
    if (restored > 0) {
      console.log(`✅ Restored ${restored} music sessions!`);
    }
  } catch (err) {
    console.error("❌ Error restoring music sessions:", err);
  }

  // Register slash commands
  await registerCommands();

  console.log("🎵 Suwaku Bot is ready!");
  console.log("📝 Use slash commands to control the music");
});

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  // Handle Autocomplete
  if (interaction.isAutocomplete()) {
    const { commandName } = interaction;

    if (commandName === "play") {
      try {
        const focusedValue = interaction.options.getFocused();
        const source = interaction.options.getString("source");

        // Use Suwaku's native autocomplete
        const choices = await suwaku.autocomplete(focusedValue, { source });

        // Add safety check: only respond if interaction hasn't expired (3 seconds)
        return await interaction.respond(choices);
      } catch (error) {
        // Discord error 10062 (Unknown Interaction) happens when response takes > 3s
        // or the user typing speed triggers too many requests
        if (error.code !== 10062) {
          console.error(`[AUTOCOMPLETE ERROR] ${error.message}`);
        }
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    // Check if user is in a voice channel (except for queue and nowplaying)
    const voiceChannel = interaction.member.voice.channel;

    if (
      !voiceChannel &&
      commandName !== "queue" &&
      commandName !== "nowplaying"
    ) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel!",
        ephemeral: true,
      });
    }

    const player = suwaku.getPlayer(interaction.guildId);

    // PLAY COMMAND
    if (commandName === "play") {
      const query = interaction.options.getString("query");
      const source = interaction.options.getString("source");
      const volume = interaction.options.getInteger("volume");

      await interaction.deferReply();

      try {
        // Step 1: Search first (New API requirement)
        const searchResult = await suwaku.search(query, {
          requester: interaction.member,
          source: source, // Use the selected source
        });

        if (
          !searchResult ||
          !searchResult.tracks ||
          searchResult.tracks.length === 0
        ) {
          return interaction.editReply({
            content: `❌ No results found for: **${query}**${source ? ` using **${source}**` : ""}`,
          });
        }

        // Step 2: Play the result with reproduction options
        const result = await suwaku.play({
          track: searchResult,
          voiceChannel,
          textChannel: interaction.channel,
          member: interaction.member,
          volume: volume ?? undefined, // Set initial volume if provided
        });

        if (result.isPlaylist) {
          await interaction.editReply({
            content: `✅ Playlist **${result.playlistInfo.name}** added with ${result.tracks.length} songs!`,
            ephemeral: true,
          });
        } else {
          await interaction.editReply({
            content: `✅ **${result.title}** added to queue!`,
            ephemeral: true,
          });
        }
      } catch (error) {
        console.error("Error in play command:", error);
        await interaction.editReply({
          content: `❌ Error: ${error.message}\n\nMake sure Lavalink is running and configured correctly.`,
        });
      }
      return;
    }

    // PAUSE COMMAND
    if (commandName === "pause") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (player.paused) {
        return interaction.reply({
          content: "⏸️ Already paused!",
          ephemeral: true,
        });
      }

      await player.pause();
      return interaction.reply("⏸️ Paused!");
    }

    // RESUME COMMAND
    if (commandName === "resume") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (!player.paused) {
        return interaction.reply({
          content: "▶️ Already playing!",
          ephemeral: true,
        });
      }

      await player.resume();
      return interaction.reply("▶️ Resumed!");
    }

    // SKIP COMMAND
    if (commandName === "skip") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (!player.current) {
        return interaction.reply({
          content: "❌ No song playing!",
          ephemeral: true,
        });
      }

      const skipped = player.current;
      await player.skip();
      return interaction.reply(`⏭️ Skipped: **${skipped.title}**`);
    }

    // STOP COMMAND
    if (commandName === "stop") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      await player.stop();
      player.queue.clear();
      return interaction.reply("⏹️ Stopped and cleared queue!");
    }

    // QUEUE COMMAND
    if (commandName === "queue") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (!player.current && player.queue.isEmpty) {
        return interaction.reply({
          content: "📭 Queue is empty!",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎵 Music Queue")
        .setColor("#0099ff");

      if (player.current) {
        embed.addFields({
          name: "▶️ Now Playing",
          value: `**${player.current.title}**\nBy: ${player.current.author}\nDuration: ${player.current.formattedDuration}`,
        });
      }

      if (!player.queue.isEmpty) {
        const queue = player.queue.tracks.slice(0, 10);
        const queueText = queue
          .map(
            (track, i) =>
              `${i + 1}. **${track.title}** - ${track.formattedDuration}`,
          )
          .join("\n");

        embed.addFields({
          name: `📋 Queue (${player.queue.size} songs)`,
          value:
            queueText +
            (player.queue.size > 10
              ? `\n... and ${player.queue.size - 10} more`
              : ""),
        });
      }

      embed.setFooter({
        text: `Loop: ${player.loop} | Volume: ${player.volume}%`,
      });

      return interaction.reply({ embeds: [embed] });
    }

    // NOW PLAYING COMMAND
    if (commandName === "nowplaying") {
      if (!player || !player.current) {
        return interaction.reply({
          content: "❌ No song playing!",
          ephemeral: true,
        });
      }

      const track = player.current;
      const position = player.getCurrentPosition();
      const duration = track.duration;
      const progress = Math.floor((position / duration) * 20);
      const progressBar =
        "▬".repeat(progress) + "🔘" + "▬".repeat(20 - progress);

      const embed = new EmbedBuilder()
        .setTitle("🎵 Now Playing")
        .setDescription(`**${track.title}**\nBy: ${track.author}`)
        .addFields(
          { name: "Duration", value: track.formattedDuration, inline: true },
          {
            name: "Requested by",
            value: track.requester?.username || "Unknown",
            inline: true,
          },
          {
            name: "Progress",
            value: `${progressBar}\n${formatDuration(position)} / ${track.formattedDuration}`,
          },
        )
        .setColor("#0099ff");

      if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
      }

      return interaction.reply({ embeds: [embed] });
    }

    // VOLUME COMMAND
    if (commandName === "volume") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const volume = interaction.options.getInteger("level");
      await player.setVolume(volume);
      return interaction.reply(`🔊 Volume set to ${volume}%`);
    }

    // LOOP COMMAND
    if (commandName === "loop") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const mode = interaction.options.getString("mode");
      player.setLoop(mode);

      const modeText = {
        off: "Off",
        track: "Track",
        queue: "Queue",
      };

      return interaction.reply(`🔁 Loop mode: ${modeText[mode]}`);
    }

    // SHUFFLE COMMAND
    if (commandName === "shuffle") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (player.queue.isEmpty) {
        return interaction.reply({
          content: "❌ Queue is empty!",
          ephemeral: true,
        });
      }

      player.shuffleQueue();
      return interaction.reply(`🔀 Shuffled ${player.queue.size} songs!`);
    }

    // SEEK COMMAND
    if (commandName === "seek") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (!player.current) {
        return interaction.reply({
          content: "❌ No song playing!",
          ephemeral: true,
        });
      }

      const seconds = interaction.options.getInteger("seconds");
      const ms = seconds * 1000;

      if (ms > player.current.duration) {
        return interaction.reply({
          content: "❌ Time exceeds song duration!",
          ephemeral: true,
        });
      }

      await player.seek(ms);
      return interaction.reply(`⏩ Seeked to ${formatDuration(ms)}`);
    }

    // FILTER COMMAND
    if (commandName === "filter") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const filterType = interaction.options.getString("type");

      if (filterType === "clear") {
        await player.filters.clearFilters();
        return interaction.reply("🎚️ Filters cleared!");
      }

      await interaction.deferReply();

      try {
        await player.filters.applyPreset(filterType);
        await interaction.editReply(
          `🎚️ Filter ${filterType} applied successfully!`,
        );
      } catch (error) {
        await interaction.editReply(
          `❌ Error applying filter: ${error.message}`,
        );
      }
      return;
    }

    // JOIN COMMAND
    if (commandName === "join") {
      await interaction.deferReply();

      try {
        await suwaku.join({
          voiceChannel,
          textChannel: interaction.channel,
          deaf: false,
          mute: false,
        });

        await interaction.editReply(
          `✅ Joined voice channel **${voiceChannel.name}**!`,
        );
      } catch (error) {
        await interaction.editReply(
          `❌ Error joining channel: ${error.message}`,
        );
      }
      return;
    }

    // LEAVE COMMAND
    if (commandName === "leave") {
      if (!player) {
        return interaction.reply({
          content: "❌ Not in any voice channel!",
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      try {
        await suwaku.leave(interaction.guildId);
        await interaction.editReply("👋 Left the voice channel!");
      } catch (error) {
        await interaction.editReply(
          `❌ Error leaving channel: ${error.message}`,
        );
      }
      return;
    }

    // CLEAR COMMAND
    if (commandName === "clear") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (player.queue.isEmpty) {
        return interaction.reply({
          content: "❌ Queue is already empty!",
          ephemeral: true,
        });
      }

      player.clearQueue();
      return interaction.reply("🧹 Queue cleared!");
    }

    // REMOVE COMMAND
    if (commandName === "remove") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const position = interaction.options.getInteger("position");

      if (position > player.queue.size) {
        return interaction.reply({
          content: `❌ Position out of range! Queue size: ${player.queue.size}`,
          ephemeral: true,
        });
      }

      const removed = player.removeTrack(position - 1);
      return interaction.reply(`🗑️ Removed: **${removed.title}**`);
    }

    // SKIPTO COMMAND
    if (commandName === "skipto") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const position = interaction.options.getInteger("position");

      if (position > player.queue.size) {
        return interaction.reply({
          content: `❌ Position out of range! Queue size: ${player.queue.size}`,
          ephemeral: true,
        });
      }

      await player.jumpTo(position - 1);
      return interaction.reply(`⏭️ Skipped to song at position #${position}`);
    }

    // BACK COMMAND
    if (commandName === "back") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      if (player.queue.previous.length === 0) {
        return interaction.reply({
          content: "❌ No previous song found in history!",
          ephemeral: true,
        });
      }

      await player.back();
      return interaction.reply("⏮️ Playing previous song!");
    }

    // REMOVEDUPLICATES COMMAND
    if (commandName === "removeduplicates") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const removedCount = player.queue.removeDuplicates();
      return interaction.reply(`♻️ Removed ${removedCount} duplicate songs!`);
    }

    // REMOVEBYREQUESTER COMMAND
    if (commandName === "removebyrequester") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("user");
      const removed = player.queue.removeByRequester(user.id);

      return interaction.reply(
        `🗑️ Removed ${removed.length} songs requested by **${user.tag}**!`,
      );
    }

    // AUTOPLAY COMMAND
    if (commandName === "autoplay") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      player.options.autoPlay = !player.options.autoPlay;
      return interaction.reply(
        `♾️ Autoplay is now **${player.options.autoPlay ? "ENABLED" : "DISABLED"}**`,
      );
    }

    // LYRICS COMMAND
    if (commandName === "lyrics") {
      const action = interaction.options.getString("action") || "sync";
      const language = interaction.options.getString("language");
      const query = interaction.options.getString("query");
      const romanized = language === "original";

      // Ensure there's a player for most actions
      if (!player && !query) {
        return interaction.reply({
          content: "❌ Play a song or provide a query to get lyrics!",
          ephemeral: true,
        });
      }

      // STOP ACTION
      if (action === "stop") {
        if (player && player.lyricsInterval) {
          clearInterval(player.lyricsInterval);
          player.lyricsInterval = null;
          if (player.lyricsMessage) {
            const embed = new EmbedBuilder(player.lyricsMessage.embeds[0].data);
            embed.setDescription("⏹️ Lyrics sync stopped.");
            embed.setColor("#FF0000");
            player.lyricsMessage.edit({ embeds: [embed] }).catch(() => {});
            player.lyricsMessage = null;
          }
          return interaction.reply({
            content: "⏹️ Lyrics sync stopped.",
            ephemeral: true,
          });
        }
        return interaction.reply({
          content: "❌ No active lyrics sync.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      try {
        // Fetch lyrics using the improved manager
        const lyricsResult = await suwaku.lyricsManager.get(
          query || player.current,
          {
            player,
            romanized, // Use user preference from command option
            preferSynced: action === "sync",
          },
        );

        if (!lyricsResult || !lyricsResult.lyrics) {
          return interaction.editReply(
            `❌ No lyrics found for: **${query || player.current.title}**.\n\n💡 Tip: Try searching with a different query or check if the song name is correct.`,
          );
        }

        const syncMode = action === "sync" && lyricsResult.isSynced;

        // SYNC MODE
        if (syncMode) {
          if (!player || !player.playing) {
            return interaction.editReply(
              "❌ Sync mode can only be used while a song is playing.",
            );
          }

          // Clear any existing lyrics tasks for this player
          if (player.lyricsInterval) clearInterval(player.lyricsInterval);
          if (player.lyricsMessage) {
            player.lyricsMessage.delete().catch(() => {});
          }

          const track = player.current;

          // Send initial message
          const embed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setAuthor({ name: lyricsResult.author })
            .setTitle(lyricsResult.title)
            .setThumbnail(track.thumbnail)
            .setDescription("```\n| Waiting for lyrics to start...\n```")
            .setFooter({
              text: `Requested by ${interaction.user.username} • Lyrics from ${lyricsResult.provider}${lyricsResult.isSynced ? " (Synced)" : ""}`,
              iconURL: interaction.user.displayAvatarURL(),
            });

          const lyricsMsg = await interaction.editReply({ embeds: [embed] });
          player.lyricsMessage = lyricsMsg;

          let lastLineText = "";
          let lastUpdateTime = 0;

          // Start the ticker with improved timing
          player.lyricsInterval = setInterval(() => {
            // Safety checks
            if (
              !player.playing ||
              !player.current ||
              player.current.identifier !== track.identifier
            ) {
              clearInterval(player.lyricsInterval);
              player.lyricsInterval = null;
              player.lyricsMessage = null;
              return;
            }

            // Get nearby lines with improved timing precision (automatically uses calibrated time)
            const { previous, current, next } = suwaku.lyricsManager.getNearbyLines(lyricsResult.lines, player);
            const now = Date.now();

            const currentText = current || "(Instrumental)";

            // Only update if line changed or enough time passed (prevent spam)
            if (currentText !== lastLineText && (now - lastUpdateTime) > 300) {
              lastLineText = currentText;
              lastUpdateTime = now;

              const prevLine = previous
                ? `${previous.replace(/(\r\n|\n|\r)/gm, "")}`
                : " ";
              const currLine = currentText
                ? `| ${currentText.replace(/(\r\n|\n|\r)/gm, "")}`
                : "| (Instrumental)";
              const nextLineText = next
                ? `${next.replace(/(\r\n|\n|\r)/gm, "")}`
                : " ";

              embed.setDescription(
                `\`\`\`\n${prevLine}\n${currLine}\n${nextLineText}\n\`\`\``,
              );

              // Use .catch() to handle cases where the message was deleted
              lyricsMsg.edit({ embeds: [embed] }).catch(() => {
                clearInterval(player.lyricsInterval);
                player.lyricsInterval = null;
                player.lyricsMessage = null;
              });
            }
          }, 250); // Reduced interval for better sync (250ms instead of 750ms)

          return;
        }

        // STATIC / FULL lyrics
        const embed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setAuthor({ name: lyricsResult.author })
          .setTitle(`Lyrics: ${lyricsResult.title}`)
          .setThumbnail(player?.current?.thumbnail)
          .setFooter({
            text: `Lyrics from ${lyricsResult.provider}${lyricsResult.isSynced ? " (Synced available - use /lyrics action:sync)" : ""}`,
            iconURL: client.user.displayAvatarURL(),
          });

        const fullLyrics = lyricsResult.lyrics;
        if (fullLyrics.length > 4000) {
          embed.setDescription(fullLyrics.substring(0, 3997) + "...");
          embed.addFields({
            name: "⚠️ Lyrics Truncated",
            value: "The full lyrics are too long to display. Only showing first 4000 characters.",
          });
        } else {
          embed.setDescription(fullLyrics);
        }

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("[BOT] Lyrics command error:", error);
        return interaction.editReply(
          `❌ An error occurred while fetching lyrics: ${error.message}\n\n💡 Tip: Try again or use a different query.`,
        );
      }
    }

    // SPONSORBLOCK COMMAND
    if (commandName === "sponsorblock") {
      if (!player)
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });

      const action = interaction.options.getString("action");
      let categories = [];

      if (action === "default") categories = ["sponsor", "intro"];
      if (action === "full")
        categories = [
          "sponsor",
          "selfpromo",
          "interaction",
          "intro",
          "outro",
          "preview",
          "music_offtopic",
        ];

      const success = await player.setSponsorBlock(categories);

      if (!success) {
        return interaction.reply({
          content:
            "❌ Failed to set SponsorBlock. Ensure the plugin is installed on Lavalink.",
          ephemeral: true,
        });
      }

      return interaction.reply(
        `🛡️ SponsorBlock updated! Status: **${categories.length > 0 ? `Enabled (${categories.join(", ")})` : "Disabled"}**`,
      );
    }

    // NODES COMMAND
    if (commandName === "nodes") {
      const nodes = suwaku.nodes.getAllNodes();
      const embed = new EmbedBuilder()
        .setTitle("🛰️ Lavalink Nodes Monitor")
        .setColor("#00ff00");

      for (const node of nodes) {
        const health = node.getHealth();
        const status = node.connected ? "✅ Connected" : "❌ Disconnected";
        const load = node.stats
          ? `${(node.stats.cpu.systemLoad * 100).toFixed(1)}% CPU`
          : "N/A";

        embed.addFields({
          name: `${node.identifier} [${status}]`,
          value: `Ping: ${node.ping}ms | Load: ${load}\nHealth: ${health.healthy ? "💎 Elite" : "⚠️ Unstable"}\nIssues: ${health.issues.join(", ") || "None"}`,
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    // RESTORE COMMAND
    if (commandName === "restore") {
      await interaction.deferReply();
      try {
        const restored = await suwaku.restorePlayers();
        if (restored > 0) {
          return interaction.editReply(
            `⭐ Successfully restored **${restored}** music sessions!`,
          );
        } else {
          return interaction.editReply(
            "📜 No previous sessions found in storage to restore.",
          );
        }
      } catch (err) {
        return interaction.editReply(
          `❌ Failed to restore sessions: ${err.message}`,
        );
      }
    }

    // SEARCH-ALL COMMAND (LavaSearch)
    if (commandName === "search-all") {
      const query = interaction.options.getString("query");
      await interaction.deferReply();

      const result = await suwaku.searchManager.search(query);

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Global Search: ${query}`)
        .setColor("#9b59b6");

      if (result.tracks?.length) {
        embed.addFields({
          name: "🎵 Tracks",
          value: result.tracks
            .slice(0, 3)
            .map((t) => `[${t.title}](${t.url})`)
            .join("\n"),
        });
      }

      if (result.albums?.length) {
        embed.addFields({
          name: "💽 Albums",
          value: result.albums
            .slice(0, 3)
            .map((a) => `**${a.info.name}** by ${a.info.author}`)
            .join("\n"),
        });
      }

      if (result.artists?.length) {
        embed.addFields({
          name: "👤 Artists",
          value: result.artists
            .slice(0, 3)
            .map((a) => `**${a.info.name}**`)
            .join("\n"),
        });
      }

      if (
        !result.tracks?.length &&
        !result.albums?.length &&
        !result.artists?.length
      ) {
        return interaction.editReply("❌ No results found.");
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // RESTART COMMAND
    if (commandName === "restart") {
      if (!player || !player.current) {
        return interaction.reply({
          content: "❌ No song playing!",
          ephemeral: true,
        });
      }

      await player.restart();
      return interaction.reply("🔄 Restarted the current song!");
    }

    // MOVE COMMAND
    if (commandName === "move") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const from = interaction.options.getInteger("from");
      const to = interaction.options.getInteger("to");

      if (from > player.queue.size || to > player.queue.size) {
        return interaction.reply({
          content: `❌ Position out of range! Queue size: ${player.queue.size}`,
          ephemeral: true,
        });
      }

      player.queue.move(from - 1, to - 1);
      return interaction.reply(
        `🚚 Moved song from position **#${from}** to **#${to}**`,
      );
    }

    // SWAP COMMAND
    if (commandName === "swap") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const first = interaction.options.getInteger("first");
      const second = interaction.options.getInteger("second");

      if (first > player.queue.size || second > player.queue.size) {
        return interaction.reply({
          content: `❌ Position out of range! Queue size: ${player.queue.size}`,
          ephemeral: true,
        });
      }

      player.queue.swap(first - 1, second - 1);
      return interaction.reply(
        `🔀 Swapped songs at positions **#${first}** and **#${second}**`,
      );
    }

    // MOOD COMMAND (Suwaku Exclusive)
    if (commandName === "mood") {
      const mood = interaction.options.getString("mood");

      await interaction.deferReply();

      const searchResult = await suwaku.searchByMood(mood, {
        requester: interaction.member,
      });

      if (
        !searchResult ||
        !searchResult.tracks ||
        searchResult.tracks.length === 0
      ) {
        return interaction.editReply("❌ No tracks found for this mood!");
      }

      await suwaku.play({
        track: searchResult,
        voiceChannel,
        textChannel: interaction.channel,
        member: interaction.member,
      });

      if (searchResult.suggestedPreset) {
        const currentPlayer = suwaku.getPlayer(interaction.guildId);
        if (currentPlayer)
          await currentPlayer.filters.applyPreset(searchResult.suggestedPreset);
      }

      return interaction.editReply(
        `✨ **Mood: ${mood}** - Added **${searchResult.tracks[0].title}** to queue${searchResult.suggestedPreset ? ` with **${searchResult.suggestedPreset}** filter` : ""}!`,
      );
    }

    // DYNAMIC COMMAND (Suwaku Exclusive)
    if (commandName === "dynamic") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const isEnabled = player.toggleDynamicRhythm();
      return interaction.reply(
        isEnabled
          ? "⚡ **Dynamic Rhythm Enabled!** The bass will now pulse with the beat."
          : "🛑 **Dynamic Rhythm Disabled.**",
      );
    }

    // MORPH COMMAND (Suwaku Exclusive)
    if (commandName === "morph") {
      if (!player) {
        return interaction.reply({
          content: "❌ No active player!",
          ephemeral: true,
        });
      }

      const style = interaction.options.getString("style");

      if (style === "none") {
        await player.filters.clearFilters();
        return interaction.reply("✨ Audio style reset to normal.");
      }

      await player.filters.applyPreset(style);
      return interaction.reply(
        `🎭 Audio morphed to: **${style.toUpperCase()}**`,
      );
    }
  } catch (error) {
    console.error("Error executing command:", error);

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
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Suwaku Events
suwaku.on("nodeConnect", (node) => {
  console.log(`🔗 Node ${node.identifier} connected`);
});

suwaku.on("nodeDisconnect", (node, data) => {
  console.warn(`⚠️  Node ${node.identifier} disconnected`);
});

suwaku.on("nodeError", (node, error) => {
  console.error(`❌ Node ${node.identifier} error:`, error.message);
});

suwaku.on("trackStart", async (player, track) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (!channel) return;

  // Clear any previous lyrics jobs
  if (player.lyricsInterval) clearInterval(player.lyricsInterval);
  player.lyricsInterval = null;
  if (player.lyricsMessage) {
    player.lyricsMessage.delete().catch(() => {});
    player.lyricsMessage = null;
  }

  const embed = new EmbedBuilder()
    .setTitle("🎵 Now Playing")
    .setDescription(`[**${track.title}**](${track.url})`)
    .addFields(
      { name: "Author", value: track.author, inline: true },
      { name: "Duration", value: track.formattedDuration, inline: true },
      {
        name: "Requested by",
        value: track.requester?.username || "Unknown",
        inline: true,
      },
    )
    .setThumbnail(track.thumbnail)
    .setColor("#2b2d31")
    .setFooter({
      text: `Suwaku Music Bot`,
      iconURL: client.user.displayAvatarURL(),
    });

  await channel
    .send({ embeds: [embed] })
    .then((msg) => {
      player.nowPlayingMessage = msg;
    })
    .catch((err) =>
      console.error(`[BOT] Error sending trackStart embed: ${err.message}`),
    );

  // --- AUTO SYNC LYRICS ---
  try {
    // Clean up existing lyrics tasks if any
    if (player.lyricsInterval) {
      clearInterval(player.lyricsInterval);
      player.lyricsInterval = null;
    }
    if (player.lyricsMessage) {
      player.lyricsMessage.delete().catch(() => {});
      player.lyricsMessage = null;
    }

    const lyricsResult = await suwaku.lyricsManager.get(track, {
      player,
      romanized: false,
      preferSynced: true,
    });

    if (lyricsResult && lyricsResult.isSynced) {
      // Send initial message
      const lyricsEmbed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setAuthor({ name: track.author })
        .setTitle(track.title)
        .setThumbnail(track.thumbnail)
        .setDescription("```\n| Waiting for lyrics to start...\n```")
        .setFooter({
          text: `Lyrics by ${lyricsResult.provider}`,
          iconURL: client.user.displayAvatarURL(),
        });

      const lyricsMsg = await channel.send({ embeds: [lyricsEmbed] });
      player.lyricsMessage = lyricsMsg;

      let lastLineText = "";
      let lastUpdateTime = 0;

      // Start the ticker with improved timing
      player.lyricsInterval = setInterval(() => {
        if (
          !player.playing ||
          !player.current ||
          player.current.identifier !== track.identifier
        ) {
          clearInterval(player.lyricsInterval);
          player.lyricsInterval = null;
          if (player.lyricsMessage) {
            lyricsMsg.delete().catch(() => {});
            player.lyricsMessage = null;
          }
          return;
        }

        // Get nearby lines with improved timing precision (automatically uses calibrated time)
        const { previous, current, next } = suwaku.lyricsManager.getNearbyLines(lyricsResult.lines, player);
        const now = Date.now();

        const currentText = current || "(Instrumental)";

        // Only update if line changed or enough time passed (prevent spam)
        if (currentText !== lastLineText && (now - lastUpdateTime) > 300) {
          lastLineText = currentText;
          lastUpdateTime = now;

          const prevLine = previous
            ? `${previous.replace(/(\r\n|\n|\r)/gm, "")}`
            : " ";
          const currLine = currentText
            ? `| ${currentText.replace(/(\r\n|\n|\r)/gm, "")}`
            : "| (Instrumental)";
          const nextLineText = next
            ? `${next.replace(/(\r\n|\n|\r)/gm, "")}`
            : " ";

          lyricsEmbed.setDescription(
            `\`\`\`\n${prevLine}\n${currLine}\n${nextLineText}\n\`\`\``,
          );

          lyricsMsg.edit({ embeds: [lyricsEmbed] }).catch(() => {
            clearInterval(player.lyricsInterval);
            player.lyricsInterval = null;
            player.lyricsMessage = null;
          });
        }
      }, 250); // Reduced interval for better sync (250ms instead of 750ms)
    }
  } catch (error) {
    console.error(`[BOT] Auto-lyrics error: ${error.message}`);
  }
});

suwaku.on("trackAdd", (player, track) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(
      `✅ Added: **${track.title}** (Position: #${player.queue.size})`,
    );
  }
});

suwaku.on("trackAddPlaylist", (player, playlistData) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(
      `📋 Added playlist: **${playlistData.name}** with ${playlistData.trackCount} songs!`,
    );
  }
});

suwaku.on("queueEnd", (player) => {
  player.nowPlayingMessage = null;
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send("📭 Queue ended!");
  }
});

suwaku.on("trackStuck", (player, track, threshold) => {
  console.warn(`⚠️  Track stuck: ${track.title} (${threshold}ms)`);
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`⚠️ Track stuck, attempting to resume...`);
  }
});

suwaku.on("trackError", (player, track, error) => {
  console.error(`❌ Track error: ${track.title}`, error);
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) {
    channel.send(`❌ Error playing: **${track.title}**`);
  }
});

suwaku.on("error", (error) => {
  if (!error) {
    console.error("❌ Suwaku error: Unknown error (no error object provided)");
    return;
  }

  const errorMessage = error.message || error.toString() || "Unknown error";
  console.error("❌ Suwaku error:", errorMessage);

  // Provide helpful hints based on error type
  if (errorMessage.includes("502") || errorMessage.includes("503")) {
    console.log(
      "💡 Tip: Lavalink server may be offline or restarting. Try again in a few seconds.",
    );
  } else if (errorMessage.includes("404")) {
    console.log(
      "💡 Tip: Check if Lavalink server supports API v4 (/v4/websocket)",
    );
  } else if (
    errorMessage.includes("401") ||
    errorMessage.includes("403") ||
    errorMessage.includes("Authentication")
  ) {
    console.log(
      "💡 Tip: Check Lavalink password in .env file (LAVALINK_PASSWORD)",
    );
  } else if (errorMessage.includes("ECONNREFUSED")) {
    console.log(
      "💡 Tip: Check if Lavalink is running and host/port are correct in .env",
    );
  } else if (errorMessage.includes("ENOTFOUND")) {
    console.log("💡 Tip: Check LAVALINK_HOST in .env file");
  }
});

suwaku.on("debug", (message) => {
// Off debug logs
});

// Login to Discord
console.log("🔐 Logging in to Discord...");
client.login(process.env.DISCORD_BOT_TOKEN);
