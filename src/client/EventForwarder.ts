/**
 * Event forwarding and Discord listener setup extracted from SuwakuClient
 * @module client/EventForwarder
 */

import type { SuwakuClient } from './SuwakuClient';

/**
 * Wire internal manager events to the SuwakuClient's public event bus
 */
export function setupEventForwarding(client: SuwakuClient): void {
  // Node lifecycle events
  client.nodes.on('nodeConnect', (node) => client.emit('nodeConnect', node));
  client.nodes.on('nodeDisconnect', (node, data) => client.emit('nodeDisconnect', node, data));
  client.nodes.on('nodeError', (node, error) => client.emit('nodeError', node, error));
  client.nodes.on('nodeReady', (node, data) => client.emit('nodeReady', node, data));
  client.nodes.on('nodeStats', (node, stats) => client.emit('nodeStats', node, stats));
  client.nodes.on('debug', (msg) => client.emit('debug', msg));
  client.nodes.on('warn', (msg) => client.emit('warn', msg));
  client.nodes.on('error', (error) => client.emit('error', error));

  // Player update from Lavalink
  client.nodes.on('playerUpdate', (data) => client.playerManager.handlePlayerUpdate(data));

  // Track events from Lavalink → PlayerManager
  client.nodes.on('trackStart', (data) => {
    client.playerManager.handleTrackStart(data.guildId, data.track);
  });
  client.nodes.on('trackEnd', (data) => {
    client.playerManager.handleTrackEnd(data.guildId, data.track, data.reason);
  });
  client.nodes.on('trackException', (data) => {
    client.playerManager.handleTrackException(data.guildId, data.track, data.error);
  });
  client.nodes.on('trackStuck', (data) => {
    client.playerManager.handleTrackStuck(data.guildId, data.track, data.threshold);
  });
  client.nodes.on('websocketClosed', (data) => {
    client.emit('websocketClosed', data);
  });

  // PlayerManager events → SuwakuClient
  client.playerManager.on('playerCreate', (player) => client.emit('playerCreate', player));
  client.playerManager.on('playerDestroy', (player) => client.emit('playerDestroy', player));
  client.playerManager.on('playerJoin', (player, voiceChannel) => client.emit('playerJoin', player, voiceChannel));
  client.playerManager.on('playerLeave', (player) => client.emit('playerLeave', player));
  client.playerManager.on('trackStart', (player, track) => client.emit('trackStart', player, track));
  client.playerManager.on('trackEnd', (player, track, reason) => client.emit('trackEnd', player, track, reason));
  client.playerManager.on('trackError', (player, track, error) => client.emit('trackError', player, track, error));
  client.playerManager.on('trackStuck', (player, track, threshold) => client.emit('trackStuck', player, track, threshold));
  client.playerManager.on('queueEnd', (player) => client.emit('queueEnd', player));
  client.playerManager.on('trackAdd', (player, track) => client.emit('trackAdd', player, track));
  client.playerManager.on('tracksAdd', (player, tracks) => client.emit('tracksAdd', player, tracks));
  client.playerManager.on('trackAddPlaylist', (player, playlistData) => client.emit('trackAddPlaylist', player, playlistData));
  client.playerManager.on('playlistProgress', (player, progress) => client.emit('playlistProgress', player, progress));
  client.playerManager.on('trackRemove', (player, track, position) => client.emit('trackRemove', player, track, position));
  client.playerManager.on('debug', (msg) => client.emit('debug', msg));
  client.playerManager.on('error', (error) => client.emit('error', error));

  // Voice events
  client.voiceStates.on('voiceStateUpdate', (data) => client.emit('voiceStateUpdate', data));
  client.voiceStates.on('voiceServerUpdate', (data) => client.emit('voiceServerUpdate', data));
  client.voiceStates.on('voiceDisconnect', (data) => client.emit('voiceDisconnect', data));
  client.voiceStates.on('voiceConnectionAttempt', (data) => client.emit('voiceConnectionAttempt', data));
}

/**
 * Set up Discord.js raw gateway event listeners and voice state tracking
 */
export function setupDiscordListeners(client: SuwakuClient, getClientId: () => string | null): void {
  client.discordClient.on('raw', (packet: { t?: string; d?: unknown }) => {
    if (packet.t === 'VOICE_STATE_UPDATE') {
      client.voiceStates.handlePacket({ t: 'VOICE_STATE_UPDATE', d: packet.d as any });
    } else if (packet.t === 'VOICE_SERVER_UPDATE') {
      client.voiceStates.handlePacket({ t: 'VOICE_SERVER_UPDATE', d: packet.d as any });
    }
  });

  if (client.options.trackPlayerMoved) {
    client.discordClient.on('voiceStateUpdate', (oldState: any, newState: any) => {
      handleVoiceStateUpdate(client, getClientId(), oldState, newState);
    });
  }

  client.discordClient.once('clientReady', () => {
    if (!client.ready) {
      client.init().catch((error: Error) => {
        client.emit('error', error);
      });
    }
  });
}

/**
 * Handle Discord voice state updates for player tracking
 */
function handleVoiceStateUpdate(
  client: SuwakuClient,
  clientId: string | null,
  oldState: { channelId?: string | null; channel?: { id?: string } | null; guild: { id: string } },
  newState: { id: string; channelId?: string | null; channel?: { id?: string } | null; guild: { id: string } }
): void {
  const guildId = newState.guild.id;
  const player = client.players.get(guildId);

  if (newState.id === clientId) {
    if (!player) return;

    const oldChannelId = oldState.channelId || oldState.channel?.id;
    const newChannelId = newState.channelId || newState.channel?.id;

    let state = 'UNKNOWN';
    if (!oldChannelId && newChannelId) {
      state = 'JOINED';
    } else if (oldChannelId && !newChannelId) {
      state = 'LEFT';
    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      state = 'MOVED';
    }

    if (state === 'UNKNOWN') return;

    client.emit('debug', `Player ${state.toLowerCase()} voice channel in guild ${guildId}`);

    if (state === 'MOVED' && newChannelId) {
      player.setVoiceChannelId(newChannelId);
    }

    client.emit('playerMoved', player, state, {
      oldChannelId,
      newChannelId
    });
  }

  if (player) {
    player.handleVoiceStateUpdate();
  }
}
