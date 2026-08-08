/**
 * Player action methods extracted from SuwakuClient
 * @module client/PlayerActions
 */

import { VoiceChannel, TextChannel, GuildMember } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { SuwakuPlayer } from '../structures/SuwakuPlayer';
import { validateObject, validateNonEmptyString } from '../utils/validators';
import type { SearchEngine, URLFilterOptions, SearchResult, SearchOptions } from '../types';
import type { SuwakuClient } from './SuwakuClient';

/**
 * Check if a URL is allowed by the whitelist/blacklist filter
 */
export function isURLAllowed(client: SuwakuClient, url: string): boolean {
  const filter = client.options.urlFilter as URLFilterOptions | undefined;
  if (!filter) return true;

  const { whitelist = [], blacklist = [] } = filter;

  for (const pattern of blacklist) {
    if (typeof pattern === 'string') {
      if (url.includes(pattern)) return false;
    } else if (pattern.test(url)) {
      return false;
    }
  }

  if (whitelist.length === 0) return true;

  for (const pattern of whitelist) {
    if (typeof pattern === 'string') {
      if (url.includes(pattern)) return true;
    } else if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Play a track or search result in a voice channel
 */
export async function play(
  client: SuwakuClient,
  options: {
    query?: string;
    track?: import('../structures/SuwakuTrack').SuwakuTrack | import('../structures/SuwakuTrack').SuwakuTrack[] | SearchResult;
    voiceChannel: VoiceChannel;
    textChannel?: TextChannel;
    member?: GuildMember;
    source?: SearchEngine;
    engine?: SearchEngine;
    fallbackSources?: SearchEngine[];
    volume?: number;
    paused?: boolean;
    startTime?: number;
    endTime?: number;
    noReplace?: boolean;
    addAllResults?: boolean;
  }
): Promise<import('../structures/SuwakuTrack').SuwakuTrack | { isPlaylist: boolean; playlistInfo: import('../types').SearchResult['playlistInfo']; tracks: import('../structures/SuwakuTrack').SuwakuTrack[]; firstTrack: import('../structures/SuwakuTrack').SuwakuTrack }> {
  validateObject(options, 'Play options');

  const {
    query,
    track,
    voiceChannel,
    textChannel,
    member,
    source,
    engine,
    fallbackSources,
    volume,
    paused,
    startTime,
    endTime,
    noReplace
  } = options;

  if (!voiceChannel) {
    throw new Error('Voice channel is required for play()');
  }

  const vc = voiceChannel as VoiceChannel;
  const tc = textChannel as TextChannel | undefined;
  const mem = member as GuildMember | undefined;

  let player = client.playerManager.get(vc.guild.id) ||
    client.playerManager.create({
      guildId: vc.guild.id,
      voiceChannelId: vc.id,
      textChannelId: tc?.id
    });

  if (!player.node) {
    const bestNode = client.nodes.getBest();
    if (bestNode) {
      player.node = bestNode;
    }
  }

  if (volume !== undefined) player.setVolume(Number(volume));
  if (paused !== undefined) player.setPaused(Boolean(paused));

  // If player is connected but to a different channel, move to the user's channel
  if (player.connected && player.voiceChannelId !== vc.id) {
    player.disconnect();
    player.setDiscordVoiceConnected(false);
  }

  if (!player.connected) {
    try {
      const connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator as any,
        selfDeaf: false,
        selfMute: false,
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        player.setDiscordVoiceConnected(true);
      } catch {
        connection.destroy();
        throw new Error('Failed to join voice channel');
      }

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          player.setDiscordVoiceConnected(false);
          connection.destroy();
        }
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        player.setDiscordVoiceConnected(false);
      });

      await player.connect();

      try {
        await client.voiceStates.waitForConnection(vc.guild.id);
      } catch {
        // If voice update fails, we still continue — Lavalink may retry
      }
    } catch (error) {
      throw new Error(`Failed to join voice channel: ${(error as Error).message}`);
    }
  }

  let searchResult: SearchResult = { loadType: 'empty', tracks: [] };

  if (track) {
    const trackObj = track as import('../structures/SuwakuTrack').SuwakuTrack | import('../structures/SuwakuTrack').SuwakuTrack[] | SearchResult;
    if ('tracks' in trackObj && Array.isArray(trackObj.tracks)) {
      searchResult = trackObj as SearchResult;
    } else if (Array.isArray(trackObj)) {
      searchResult = { loadType: 'search', tracks: trackObj } as SearchResult;
    } else {
      searchResult = { loadType: 'track', tracks: [trackObj] } as SearchResult;
    }
  } else if (query) {
    client.emit('debug', `Searching for: ${query}`);
    const searchSource = (source as SearchEngine) || (engine as SearchEngine);
    searchResult = await client.searchManager.search(query, {
      source: searchSource,
      fallbackSources: fallbackSources as SearchEngine[] | undefined,
      requester: mem
    } as SearchOptions);
  } else {
    throw new Error("Either 'query' or 'track' must be provided to play()");
  }

  if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
    throw new Error('No tracks found to play');
  }

  const isPlaylist = searchResult.loadType === 'playlist';
  const playlistInfo = searchResult.playlistInfo ?? null;

  if (mem) {
    const requesterInfo = {
      id: mem.id,
      username: mem.user?.username || 'Unknown',
      displayName: mem.displayName || mem.user?.username || 'Unknown',
      avatar: mem.user?.displayAvatarURL?.() || null
    };

    searchResult.tracks.forEach((t: import('../structures/SuwakuTrack').SuwakuTrack) => {
      t.setRequester(requesterInfo);
    });
  }

  const wasEmpty = player.queue.isEmpty && !player.currentTrack;

  const shouldAddMultiple = isPlaylist || (searchResult.tracks.length > 1 && (Array.isArray(track) || options.addAllResults));

  const suwakuTracks = searchResult.tracks;

  if (shouldAddMultiple) {
    const tracksToAdd = wasEmpty ? suwakuTracks.slice(1) : suwakuTracks;
    if (tracksToAdd.length > 0) {
      if (tracksToAdd.length > (client.options.batchThreshold ?? 50)) {
        await player.addTracksBatch(tracksToAdd, playlistInfo as any);
      } else {
        player.addTracks(tracksToAdd, playlistInfo as any);
      }
    }
  } else if (searchResult.tracks.length > 0) {
    if (!wasEmpty) {
      player.addTrack(suwakuTracks[0]);
    }
  }

  if (wasEmpty && searchResult.tracks.length > 0) {
    await player.play(searchResult.tracks[0], {
      startTime,
      endTime,
      noReplace
    });
  }

  if (isPlaylist) {
    return {
      isPlaylist: true,
      playlistInfo: playlistInfo ?? undefined,
      tracks: searchResult.tracks,
      firstTrack: searchResult.tracks[0]
    };
  }

  return searchResult.tracks[0];
}

/**
 * Join a voice channel and create/return a player
 */
export async function join(
  client: SuwakuClient,
  options: { voiceChannel: VoiceChannel; textChannel?: TextChannel; deaf?: boolean; mute?: boolean }
): Promise<SuwakuPlayer> {
  validateObject(options, 'Join options');
  validateObject(options.voiceChannel, 'Voice channel');

  const { voiceChannel: vc, textChannel: tc, deaf = false, mute = false } = options;
  const guildId = vc.guild.id;

  let player = client.playerManager.get(guildId);

  if (player) {
    if (player.voiceChannelId === vc.id) {
      client.emit('debug', `Player already in voice channel ${vc.id}`);
      return player;
    }

    client.emit('debug', `Moving player from ${player.voiceChannelId} to ${vc.id}`);
  } else {
    client.emit('debug', `Creating player for guild ${guildId} in channel ${vc.id}`);
    player = client.playerManager.create({
      guildId,
      voiceChannelId: vc.id,
      textChannelId: tc?.id,
      deaf,
      mute
    });

    if (!player.node) {
      const bestNode = client.nodes.getBest();
      if (bestNode) {
        player.node = bestNode;
      }
    }
  }

  await player.connect();

  client.emit('playerJoin', player, vc);

  return player;
}

/**
 * Leave a voice channel and optionally destroy the player
 */
export async function leave(client: SuwakuClient, guildId: string, destroy = true): Promise<boolean> {
  validateNonEmptyString(guildId, 'Guild ID');

  const player = client.playerManager.get(guildId);

  if (!player) {
    client.emit('debug', `No player found for guild ${guildId}`);
    return false;
  }

  client.emit('debug', `Leaving voice channel in guild ${guildId}`);

  player.disconnect();

  if (destroy) {
    await player.destroy();
  }

  client.emit('playerLeave', player);

  return true;
}
