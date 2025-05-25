import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState
} from '@discordjs/voice';
import SpotifyWebApi from 'spotify-web-api-node';
import SoundCloud from 'soundcloud-scraper';
import scdl from 'soundcloud-downloader';
import ytSearch from 'yt-search';
import sodium from 'libsodium-wrappers';
import { EventEmitter } from 'events';
import Genius from 'genius-lyrics';
import { v4 as uuidv4 } from 'uuid';

import getAudioStream from './Stream.js';

(async () => { await sodium.ready; })();

/**
 * @typedef {Object} TrackInfo
 * @property {string} id
 * @property {string} url
 * @property {string} title
 * @property {string} artist
 * @property {string} duration     // MM:SS
 * @property {string} source       // 'spotify'|'soundcloud'
 * @property {number} likes
 * @property {string} thumbnail
 * @property {Object} member
 * @property {Object} textChannel
 * @property {string} guildId
 * @property {number} addedAt      // timestamp ms
 */

const convertMsToMinutesSeconds = ms => {
  if (isNaN(ms) || ms < 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  return `${m}:${s}`;
};

class YukufyClient extends EventEmitter {
  constructor(client, { api, player = {} }) {
    super();
    if (!client) throw new Error('Discord.js client is required');
    if (!api?.clientId || !api?.clientSecret) throw new Error('Spotify credentials are required');

    this.client = client;
    this.spotifyApi = new SpotifyWebApi({ clientId: api.clientId, clientSecret: api.clientSecret });
    this.soundcloudClient = new SoundCloud.Client();
    this.soundcloudClientId = null;
    this.lyricsClient = new Genius.Client();
    this.tokenExpirationTime = 0;
    this._authenticateSpotify();

    this.queues = {};    // guildId: TrackInfo[]
    this.current = {};   // guildId: TrackInfo | null
    this.isPlaying = {}; // guildId: boolean
    this.loopMode = {};  // guildId: 0=off, 1=track, 2=queue
    this.filters = {};   // guildId: string[]
    this.volume = player.defaultVolume ?? 75;

    this.leaveOnEmptyQueue = player.leaveOnEmptyQueue ?? false;
    this.leaveOnEmptyQueueCooldown = player.leaveOnEmptyQueueCooldown ?? 30000;
    this._leaveTimeouts = new Map();

    this.player = null;

    this._setupTokenRefresh();
    this.emit('info', { name: 'Yukufy', version: '1.9.0' });
  }

  async _authenticateSpotify() {
    try {
        const data = await this.spotifyApi.clientCredentialsGrant();
        this.spotifyApi.setAccessToken(data.body.access_token);
        this.tokenExpirationTime = Date.now() + data.body.expires_in * 1000 - 60000;
        this.emit('debug', 'Spotify token refreshed.');
    } catch (error) {
        this.emit('error', { error: `Spotify authentication failed: ${error.message}` });
    }
  }

  _setupTokenRefresh() {
    setInterval(async () => {
      if (Date.now() >= this.tokenExpirationTime) {
          await this._authenticateSpotify();
      }
    }, 15 * 60 * 1000);
  }

  _initGuild(guildId) {
    if (!this.queues[guildId]) {
      this.queues[guildId] = [];
      this.loopMode[guildId] = 0;
      this.isPlaying[guildId] = false;
      this.current[guildId] = null;
      this.filters[guildId] = [];
      this.emit('debug', `Initialized state for guild ${guildId}`);
    }
  }

  _formatSpotifyTrack(spotifyTrack) {
    if (!spotifyTrack || !spotifyTrack.id) return null;
    const artist = spotifyTrack.artists?.[0];
    const albumImage = spotifyTrack.album?.images?.[0];
    return {
      id: uuidv4(),
      url: spotifyTrack.external_urls?.spotify,
      title: spotifyTrack.name,
      artist: artist?.name || 'Unknown Artist',
      duration: convertMsToMinutesSeconds(spotifyTrack.duration_ms),
      source: 'spotify',
      likes: spotifyTrack.popularity,
      thumbnail: albumImage?.url,
      artistId: artist?.id
    };
  }

  _formatSoundCloudTrack(scTrack) {
    if (!scTrack || !scTrack.permalink_url) return null;
    const user = scTrack.user;
    return {
      id: uuidv4(),
      url: scTrack.permalink_url,
      title: scTrack.title,
      artist: user?.username || 'Unknown Artist',
      duration: convertMsToMinutesSeconds(scTrack.duration),
      source: 'soundcloud',
      likes: scTrack.likes_count,
      thumbnail: scTrack.artwork_url || user?.avatar_url
    };
  }

  async search(query, source = 'spotify') {
    await this._authenticateSpotify(); // Ensure token is fresh
    if (!query) throw new Error('Search query cannot be empty.');
    const originalQuery = query.trim(); // Store the original user query
    this.emit('debug', `Processing search for query: "${originalQuery}" with source: ${source}`);

    let isSpotifyUrl = false;
    let isSoundCloudUrl = false;
    let spotifyTrackId = null;
    let soundCloudUrl = null;

    try {
        const url = new URL(originalQuery); // Use originalQuery for URL parsing
        if (url.hostname.includes('spotify.com') && url.pathname.includes('/track/')) { // Simplified Spotify URL check
            isSpotifyUrl = true;
            spotifyTrackId = url.pathname.split('/').pop();
            if (!spotifyTrackId) throw new Error('Invalid Spotify track URL (missing ID).');
            source = 'spotify'; // Force source if Spotify URL
            this.emit('debug', `Detected Spotify track URL. ID: ${spotifyTrackId}`);
        } else if (url.hostname.includes('soundcloud.com') && url.pathname.split('/').length > 2) {
             isSoundCloudUrl = true;
             soundCloudUrl = originalQuery; // Use originalQuery
             source = 'soundcloud'; // Force source if SoundCloud URL
             this.emit('debug', `Detected SoundCloud track URL: ${soundCloudUrl}`);
        }
    } catch (e) {
        this.emit('debug', `Query is not a standard URL. Treating as text search for ${source}.`);
    }

    try {
        if (isSpotifyUrl && spotifyTrackId) {
            this.emit('debug', `Workspaceing exact Spotify track ID: ${spotifyTrackId}`);
            const trackData = await this.spotifyApi.getTrack(spotifyTrackId);
            if (!trackData.body) throw new Error(`Track with ID ${spotifyTrackId} not found on Spotify.`);
            const formatted = this._formatSpotifyTrack(trackData.body);
            return formatted ? [formatted] : [];

        } else if (isSoundCloudUrl && soundCloudUrl) {
             this.emit('debug', `Workspaceing exact SoundCloud info for URL: ${soundCloudUrl}`);
             if (!this.soundcloudClientId) {
                 try { this.soundcloudClientId = await SoundCloud.keygen(); }
                 catch (scError) { throw new Error('Could not initialize SoundCloud.'); }
             }
             const trackData = await scdl.getInfo(soundCloudUrl, this.soundcloudClientId);
             if (!trackData) throw new Error(`Track not found or invalid SoundCloud URL: ${soundCloudUrl}`);
             const formatted = this._formatSoundCloudTrack(trackData);
             return formatted ? [formatted] : [];

        } else { // Text search
            this.emit('debug', `Performing text search for "${originalQuery}" on ${source}`);
            let results = [];
            let firstSuitableFormattedTrack = null;

            const originalQueryLower = originalQuery.toLowerCase();
            const queryHasLive = originalQueryLower.includes("live");
            const queryHasCover = originalQueryLower.includes("cover");
            const queryHasRemix = originalQueryLower.includes("remix");

            // Determine keywords to filter out from track titles
            const keywordsToFilterOut = [];
            if (!queryHasLive) keywordsToFilterOut.push("live");
            if (!queryHasCover) keywordsToFilterOut.push("cover");
            if (!queryHasRemix) keywordsToFilterOut.push("remix");

            switch (source) {
                case 'spotify': {
                    const searchResults = await this.spotifyApi.searchTracks(originalQuery, { limit: 10 }); // Fetch a few to allow filtering
                    const rawTracks = searchResults.body.tracks?.items || [];
                    if (rawTracks.length === 0) return [];

                    for (const track of rawTracks) {
                        const trackTitleLower = track.name.toLowerCase();
                        let isSuitable = true;
                        if (keywordsToFilterOut.length > 0) {
                            for (const keyword of keywordsToFilterOut) {
                                if (trackTitleLower.includes(keyword)) {
                                    isSuitable = false;
                                    this.emit('debug', `Spotify filter: Excluding "${track.name}" due to keyword "${keyword}" (Query: "${originalQuery}")`);
                                    break;
                                }
                            }
                        }
                        if (isSuitable) {
                            firstSuitableFormattedTrack = this._formatSpotifyTrack(track);
                            break; // Found the first suitable track
                        }
                    }
                    return firstSuitableFormattedTrack ? [firstSuitableFormattedTrack] : [];
                }
                case 'soundcloud': {
                    if (!this.soundcloudClientId) {
                        try { this.soundcloudClientId = await SoundCloud.keygen(); }
                        catch (scError) { throw new Error('Could not initialize SoundCloud search.'); }
                    }
                    // For scdl.search, query is the main param. Limit is good.
                    const searchResponse = await scdl.search({ query: originalQuery, limit: 10, resourceType: 'tracks', client_id: this.soundcloudClientId });
                    const rawTracks = searchResponse?.collection || [];
                    if (rawTracks.length === 0) return [];

                    for (const track of rawTracks) {
                        const trackTitleLower = track.title.toLowerCase();
                        let isSuitable = true;
                         if (keywordsToFilterOut.length > 0) {
                            for (const keyword of keywordsToFilterOut) {
                                if (trackTitleLower.includes(keyword)) {
                                    isSuitable = false;
                                    this.emit('debug', `SoundCloud filter: Excluding "${track.title}" due to keyword "${keyword}" (Query: "${originalQuery}")`);
                                    break;
                                }
                            }
                        }
                        if (isSuitable) {
                            firstSuitableFormattedTrack = this._formatSoundCloudTrack(track);
                            break; // Found the first suitable track
                        }
                    }
                    return firstSuitableFormattedTrack ? [firstSuitableFormattedTrack] : [];
                }
                default:
                    throw new Error(`Source "${source}" is not supported for text search.`);
            }
        }
    } catch (error) {
        // ... (keep existing error handling)
        if (error.response) { console.error(`[Search Error] API Response Error (${error.response.status}):`, error.response.data); }
        else if (error.body) { console.error(`[Search Error] Spotify API Error (${error.statusCode}):`, error.body); }
        else { console.error(`[Search Error] General error during search for "${originalQuery}" on ${source}:`, error); }
        this.emit('error', { error: `Search failed for "${originalQuery}" on ${source}: ${error.message || 'Unknown error'}` });
        return [];
    }
  }

  async play({ query, voiceChannel, textChannel, member, source }) {
    if (!voiceChannel || !textChannel || !member) {
        throw new Error('Missing required parameters: voiceChannel, textChannel, or member.');
    }
    const guildId = voiceChannel.guild.id;
    this._initGuild(guildId);

    try {
        await this._connect(voiceChannel);
    } catch (connectionError) {
        this.emit('error', { guildId, error: `Failed to connect for play command: ${connectionError.message}` });
        throw connectionError;
    }

    const results = await this.search(query, source);
    if (!results || results.length === 0) {
      this.emit('searchNoResult', { query, source, guildId, textChannelId: textChannel.id });
      throw new Error(`No track found for query "${query}" from source "${source}".`);
    }

    const t = results[0];
    const trackInfo = {
      id: uuidv4(),
      ...t,
      guildId,
      member: {
        id: member.id,
        username: member.user.username,
        displayName: member.displayName
      },
      textChannel: {
         id: textChannel.id,
         name: textChannel.name
      },
      addedAt: Date.now()
    };

    const wasPlaying = this.isPlaying[guildId];
    const queue = this.queues[guildId];
    queue.push(trackInfo);
    this.emit('trackAdd', { track: trackInfo, queue, guildId });

    if (!wasPlaying && !this.current[guildId]) {
      this.emit('debug', `Triggering _processQueue for ${guildId} after adding track to empty/idle queue.`);
      this._processQueue(guildId).catch(err => {
          this.emit('error', {guildId, error: `Error starting queue processing: ${err.message}`});
      });
    } else {
        this.emit('debug', `Track added to queue for ${guildId}. Player state: isPlaying=${this.isPlaying[guildId]}, current=${this.current[guildId]?.title || 'None'}`);
    }

    return trackInfo;
  }

  async _connect(voiceChannel) {
    const guildId = voiceChannel.guild.id;
    let connection = getVoiceConnection(guildId);

    if (!connection || [VoiceConnectionStatus.Destroyed, VoiceConnectionStatus.Disconnected].includes(connection.state.status)) {
        this.emit('debug', `Creating/Recreating voice connection for ${guildId}`);
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            this.emit('warn', `Voice connection disconnected for ${guildId}. State: ${newState.status}. Trying to recover...`);
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                 this.emit('info', `Voice connection recovering for ${guildId}.`);
            } catch (error) {
                 this.emit('error', {guildId, error:`Voice connection lost permanently for ${guildId}. Destroying.`});
                if(connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
                this._cleanupResources(guildId);
            }
        });

         connection.on(VoiceConnectionStatus.Destroyed, () => {
             this.emit('info', `Voice connection successfully destroyed for ${guildId}.`);
              this._cleanupResources(guildId);
         });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            this.emit('connect', guildId);
        } catch (error) {
            this.emit('error', {guildId, error:`Failed to establish voice connection for ${guildId}: ${error.message}`});
            if(connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            throw new Error(`Failed to connect to voice channel: ${error.message || error}`);
        }
    } else if (connection.state.status === VoiceConnectionStatus.Ready) {
         this.emit('debug', `Voice connection for ${guildId} already exists and is Ready.`);
    } else {
         this.emit('debug', `Voice connection for ${guildId} exists but is in state: ${connection.state.status}. Waiting for Ready...`);
          try {
            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
            this.emit('debug', `Voice connection for ${guildId} reached Ready state.`);
          } catch (error) {
             this.emit('error', {guildId, error:`Existing connection for ${guildId} failed to become Ready: ${error.message}`});
             if(connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
             throw new Error(`Existing connection failed to become Ready: ${error.message || error}`);
          }
    }

    if (!this.player) {
        this.emit('debug', `Creating global AudioPlayer instance.`);
        this.player = createAudioPlayer();
        this._setupPlayerListeners();
    }

    if (connection.state.status === VoiceConnectionStatus.Ready && connection.state.subscription?.player !== this.player) {
        this.emit('debug', `Subscribing connection for ${guildId} to the player.`);
        connection.subscribe(this.player);
    }

    return connection;
  }

  _setupPlayerListeners() {
       this.player.on(AudioPlayerStatus.Idle, (oldState) => {
            const guildId = oldState.resource?.metadata?.guildId;
            if (guildId) {
                 this.emit('debug', `Player Idle event detected for guild ${guildId}. Previous state: ${oldState.status}`);
                 if (oldState.status === AudioPlayerStatus.Playing && this.current[guildId]?.id === oldState.resource.metadata?.id) {
                      this._handleTrackEnd(guildId);
                 } else if (oldState.status === AudioPlayerStatus.Buffering) {
                      this.emit('warn', `Player went Idle directly from Buffering for ${guildId}. Possible stream issue.`);
                      this._handleTrackEnd(guildId);
                 } else {
                      this.emit('debug', `Player Idle for ${guildId}, but previous state was ${oldState.status} or track mismatch. Ignoring Idle trigger for _handleTrackEnd.`);
                 }
            } else {
                 this.emit('warn', 'Player Idle event received, but no guildId found in resource metadata.');
            }
        });

        this.player.on(AudioPlayerStatus.Playing, (oldState) => {
          const resource = this.player.state.resource;
          const track = resource?.metadata;
          const guildId = track?.guildId;

           if (guildId && track) {
             this.emit('debug', `Player status changed to Playing for guild ${guildId}. Track: ${track.title}`);
             this.isPlaying[guildId] = true;
             this.emit('trackStart', track);
           } else {
             this.emit('warn', `Player entered Playing state but could not retrieve guildId or track metadata.`);
           }
     });

        this.player.on(AudioPlayerStatus.Paused, () => {
             const guildId = this.player.state.resource?.metadata?.guildId;
             if (guildId) {
                 this.emit('debug', `Player status changed to Paused for guild ${guildId}.`);
                 this.isPlaying[guildId] = false;
             }
        });

         this.player.on('error', error => {
             const resource = error.resource;
             const guildId = resource?.metadata?.guildId;
              if (guildId) {
                this.emit('error', {guildId, track: resource?.metadata, error: `AudioPlayer Error for guild ${guildId}: ${error.message}. Track: ${resource?.metadata?.title || 'Unknown'}`});
                 if (this.isPlaying[guildId]) {
                     this.isPlaying[guildId] = false;
                     this.current[guildId] = null;
                     setTimeout(() => this._processQueue(guildId).catch(err => this.emit('error', {guildId, error: `Error processing queue after player error: ${err.message}`})), 500);
                 }
              } else {
                 this.emit('error', {error: `Global AudioPlayer Error: ${error.message}. No guild context from resource.`});
              }
         });
  }

  async _processQueue(guildId, seekPosition = 0) {
    this._initGuild(guildId);
    const queue = this.queues[guildId];
    let trackToPlay = null;

    this.emit('debug', `_processQueue called for ${guildId}. Seek: ${seekPosition}s. Loop: ${this.loopMode[guildId]}. Queue size: ${queue.length}. Current: ${this.current[guildId]?.title || 'None'}`);

    if (seekPosition > 0 && this.current[guildId]) {
        this.emit('debug', `Seek request: Replaying ${this.current[guildId].title} from ${seekPosition}s.`);
        trackToPlay = this.current[guildId];
    } else {
        const currentTrack = this.current[guildId];
        const loopMode = this.loopMode[guildId];

        if (loopMode === 1 && currentTrack) {
            trackToPlay = currentTrack;
            this.emit('debug', `Loop Mode 1: Replaying track ${trackToPlay.title}.`);
        } else if (loopMode === 2) {
            if (currentTrack) {
                 if(!queue.some(t => t.id === currentTrack.id)) {
                    queue.push(currentTrack);
                    this.emit('debug', `Loop Mode 2: Added ${currentTrack.title} (ID: ${currentTrack.id}) to end of queue.`);
                 } else {
                     this.emit('debug', `Loop Mode 2: ${currentTrack.title} (ID: ${currentTrack.id}) already in queue.`);
                 }
            }
            if (queue.length > 0) {
                trackToPlay = queue.shift();
                this.emit('debug', `Loop Mode 2: Playing next track ${trackToPlay.title} (ID: ${trackToPlay.id}) from queue.`);
            } else if (currentTrack && queue.length === 0) {
                 trackToPlay = currentTrack;
                  this.emit('warn', `Loop Mode 2: Queue empty, replaying last track ${trackToPlay.title} (ID: ${trackToPlay.id}).`);
            }
        } else {
            if (queue.length > 0) {
                trackToPlay = queue.shift();
                this.emit('debug', `No Loop: Playing next track ${trackToPlay.title} (ID: ${trackToPlay.id}) from queue.`);
            } else {
                 this.emit('debug', `No Loop: Queue is empty. No track to play.`);
            }
        }
    }

    if (trackToPlay) {
        const prevTimeout = this._leaveTimeouts.get(guildId);
        if (prevTimeout) {
            clearTimeout(prevTimeout);
            this._leaveTimeouts.delete(guildId);
            this.emit('debug', `Cleared leave timeout for ${guildId} as a new track is starting.`);
        }

        this.current[guildId] = trackToPlay;

        try {
            const resource = await this._createAudioResource(trackToPlay, seekPosition);

             if (!resource) {
                 this.emit('error', {guildId, error: `Failed to create audio resource for ${trackToPlay.title}. Skipping.`});
                 this.isPlaying[guildId] = false;
                 this.current[guildId] = null;
                 await this._processQueue(guildId);
                 return;
             }

            this.player.play(resource);

            if (seekPosition > 0) {
                 this.emit('seek', { guildId, position: seekPosition, track: trackToPlay });
            }

        } catch (error) {
            this.emit('error', { guildId, track: trackToPlay, error: `Error during playback setup for ${trackToPlay?.title}: ${error.message || error}` });
            this.isPlaying[guildId] = false;
            this.current[guildId] = null;
             setTimeout(() => this._processQueue(guildId).catch(err => this.emit('error', {guildId, error:`Error processing queue after playback setup error: ${err.message}`})), 1500);
        }
    } else {
        this.emit('debug', `No track determined to play for ${guildId}. Queue is empty or loop conditions not met.`);

        this.isPlaying[guildId] = false;
        this.current[guildId] = null;

         if (this.player && this.player.state.status !== AudioPlayerStatus.Idle) {
              this.emit('warn', `_processQueue reached empty state for ${guildId}, but player status is ${this.player.state.status}. Forcing stop.`);
              this.player.stop(true);
         }

        this.emit('queueEnd', guildId);

        if (this.leaveOnEmptyQueue) {
            if (!this._leaveTimeouts.has(guildId)) {
                this.emit('debug', `Queue ended for ${guildId}. Setting leave timeout (${this.leaveOnEmptyQueueCooldown}ms).`);
                const timeout = setTimeout(() => {
                    const conn = getVoiceConnection(guildId);
                    if (conn && !this.isPlaying[guildId] && this.queues[guildId]?.length === 0) {
                        this.emit('debug', `Leave timeout triggered for ${guildId}. Leaving channel.`);
                        conn.destroy();
                        this._leaveTimeouts.delete(guildId);
                    } else {
                        this.emit('debug', `Leave timeout triggered for ${guildId}, but state changed (playing: ${this.isPlaying[guildId]}, queue: ${this.queues[guildId]?.length}, conn: ${!!conn}). Aborting leave.`);
                        this._leaveTimeouts.delete(guildId);
                    }
                }, this.leaveOnEmptyQueueCooldown);
                this._leaveTimeouts.set(guildId, timeout);
            } else {
                 this.emit('debug', `Queue ended for ${guildId}, but leave timeout already scheduled.`);
            }
        } else {
             this.emit('debug', `Queue ended for ${guildId}. Option leaveOnEmptyQueue is false.`);
        }
    }
  }

  _handleTrackEnd(guildId) {
    if (!this.current[guildId]) {
        this.emit('debug', `_handleTrackEnd called for ${guildId} but no current track. Ignoring.`);
        return;
    }

    const finishedTrack = this.current[guildId];
    const loopMode = this.loopMode[guildId];

    this.emit('debug', `Track end detected for ${finishedTrack.title} (ID: ${finishedTrack.id}) in guild ${guildId}. Loop: ${loopMode}`);

    this.emit('trackEnd', finishedTrack);

    setImmediate(() => {
       this._processQueue(guildId).catch(err => {
            this.emit('error', {guildId, error: `Error processing queue after track end: ${err.message}`});
       });
    });
  }

  async _createAudioResource(track, seekSeconds = 0) {
    const guildId = track.guildId;
    try {
        // The query for YouTube should be based on the track info we got from Spotify/SoundCloud
        const queryForYouTube = `${track.title} ${track.artist}`.trim().replace(/[^\w\sÀ-ÿ'-]/gi, '');
        this.emit('debug', `Searching YouTube for resource: "${queryForYouTube}" (Based on source track: "${track.title}")`);
        const ytResult = await ytSearch(queryForYouTube);

        if (!ytResult || !ytResult.videos || ytResult.videos.length === 0) {
            this.emit('error', { guildId, track, error: `No YouTube video found for query "${queryForYouTube}"` });
            return null;
        }

        let firstSuitableVideo = null;
        const sourceTrackTitleLower = track.title.toLowerCase(); // This is the title from Spotify/SoundCloud

        // Determine if the source track itself is a live, cover, or remix
        const sourceTrackIsLive = sourceTrackTitleLower.includes("live");
        const sourceTrackIsCover = sourceTrackTitleLower.includes("cover");
        const sourceTrackIsRemix = sourceTrackTitleLower.includes("remix");

        // Keywords to filter out from YouTube video titles
        const keywordsToFilterOutYouTube = [];
        if (!sourceTrackIsLive) keywordsToFilterOutYouTube.push("live");
        if (!sourceTrackIsCover) keywordsToFilterOutYouTube.push("cover");
        if (!sourceTrackIsRemix) keywordsToFilterOutYouTube.push("remix");

        for (const video of ytResult.videos) {
            const videoTitleLower = video.title.toLowerCase();
            let isSuitable = true;

            if (keywordsToFilterOutYouTube.length > 0) {
                for (const keyword of keywordsToFilterOutYouTube) {
                    if (videoTitleLower.includes(keyword)) {
                        isSuitable = false;
                        this.emit('debug', `YouTube filter: Excluding video "${video.title}" due to keyword "${keyword}" (Source track: "${track.title}")`);
                        break;
                    }
                }
            }

            if (isSuitable) {
                firstSuitableVideo = video;
                break; // Found the first suitable video
            }
        }

        if (!firstSuitableVideo) {
            // If filtering removed all results, we don't play anything from YouTube for this track.
            this.emit('warn', { guildId, track, message: `No YouTube video found for "${queryForYouTube}" that matches filtering criteria based on source track title "${track.title}".`});
            return null;
        }

        this.emit('debug', `Using YouTube video: ${firstSuitableVideo.title} (${firstSuitableVideo.url})`);

        const streamOptions = seekSeconds > 0 ? { seek: seekSeconds } : undefined;
        const stream = await getAudioStream(firstSuitableVideo.url, streamOptions);
        if (!stream) {
             this.emit('error', { guildId, track, error: `Failed to get audio stream for ${firstSuitableVideo.url}` });
             return null;
        }

        const resource = createAudioResource(stream, {
            metadata: track, // track is the metadata from Spotify/SoundCloud
            inlineVolume: true
        });

        resource.volume?.setVolume(this.volume / 100);
        return resource;

    } catch (error) {
        this.emit('error', { guildId, track, error: `Error creating audio resource for ${track.title}: ${error.message || error}` });
        return null;
    }
  }

  /** loop mode: 0=off, 1=track, 2=queue */
  setLoopMode(guildId, mode = 0) {
    if (![0, 1, 2].includes(mode)) throw new Error('Invalid loop mode. Use 0 (off), 1 (track), or 2 (queue).');
    this._initGuild(guildId);
    this.loopMode[guildId] = mode;
    this.emit('loopModeChange', { guildId, mode });
    return mode;
  }

  removeFromQueue(guildId, identifier) {
    this._initGuild(guildId);
    const queue = this.queues[guildId];
    let index = -1;

    if (typeof identifier === 'number') {
      if (identifier >= 0 && identifier < queue.length) {
        index = identifier;
      }
    } else if (typeof identifier === 'string') {
      index = queue.findIndex(t => t.id === identifier);
    }

    if (index === -1) {
        throw new Error(`Invalid identifier or track not found in queue: ${identifier}`);
    }

    const [removedTrack] = queue.splice(index, 1);
    this.emit('trackRemove', { track: removedTrack, queue, guildId });
    return removedTrack;
  }

  moveInQueue(guildId, fromIdentifier, toPosition) {
    this._initGuild(guildId);
    const queue = this.queues[guildId];

    const resolveIndex = id => {
        if (typeof id === 'number') return id;
        if (typeof id === 'string') return queue.findIndex(t => t.id === id);
        return -1;
    };

    const fromIndex = resolveIndex(fromIdentifier);

    if (fromIndex < 0 || fromIndex >= queue.length) {
      throw new Error(`Invalid 'from' identifier or track not found: ${fromIdentifier}`);
    }
    if (typeof toPosition !== 'number' || toPosition < 0 || toPosition >= queue.length) {
       throw new Error(`Invalid 'to' position: ${toPosition}. Must be a valid index in the queue.`);
    }
    if (fromIndex === toPosition) return queue;

    const [itemToMove] = queue.splice(fromIndex, 1);
    queue.splice(toPosition, 0, itemToMove);

    this.emit('queueReorder', { queue, guildId });
    return queue;
  }

  getQueue(guildId) {
    this._initGuild(guildId);
    return [...this.queues[guildId]];
    /* return this.queues[guildId].map((track, index) => ({
      position: index,
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.url,
      duration: track.duration,
      source: track.source,
      thumbnail: track.thumbnail,
      requestedBy: track.member,
      addedAt: track.addedAt
    })); */
  }

  skip(guildId) {
    this._initGuild(guildId);
    const current = this.current[guildId];
    if (!current || !this.player) {
        this.emit('debug', `Skip called for ${guildId}, but nothing is playing.`);
        return false;
    }

    this.emit('debug', `Skipping track ${current.title} in ${guildId}`);
    this.player.stop(true);
    return true;
  }

  shuffle(guildId) {
    this._initGuild(guildId);
    const queue = this.queues[guildId];
    if (queue.length < 2) return queue;

    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    this.emit('queueShuffle', { guildId, queue });
    return queue;
  }

  seek(guildId, positionInSeconds) {
    this._initGuild(guildId);
    const track = this.current[guildId];

    if (!track || !this.isPlaying[guildId]) {
        const errorMsg = 'Cannot seek: No track is currently playing.';
        this.emit('error', { guildId, error: errorMsg });
        throw new Error(errorMsg);
    }
    if (typeof positionInSeconds !== 'number' || positionInSeconds < 0) {
        const errorMsg = `Cannot seek: Position must be a non-negative number (received ${positionInSeconds}).`;
        this.emit('error', { guildId, error: errorMsg });
        throw new Error(errorMsg);
    }

    const durationParts = track.duration.split(':').map(Number);
    const totalDurationSeconds = (durationParts[0] * 60) + (durationParts[1] || 0);

    if (positionInSeconds >= totalDurationSeconds) {
        this.emit('debug', `Seek position (${positionInSeconds}s) is beyond track duration (${totalDurationSeconds}s). Skipping track.`);
        this.skip(guildId);
        return;
    }

    this.emit('debug', `Seeking to ${positionInSeconds}s for track ${track.title} in ${guildId}`);

     if (this.player.state.status !== AudioPlayerStatus.Idle) {
         // this.player.stop(true);
     }

    this._processQueue(guildId, positionInSeconds).catch(error => {
        this.emit('error', {guildId, error: `Error during seek processing: ${error.message || error}`});
    });
  }

  setFilter(guildId, filter) {
    this._initGuild(guildId);
    if (!this.filters[guildId].includes(filter)) {
        this.filters[guildId].push(filter);
        this.emit('filterAdd', { guildId, filter });
        // Ex: this._processQueue(guildId, this.player?.state.resource?.playbackDuration / 1000);
        this.emit('warn', `Filter functionality for '${filter}' not fully implemented. Filter added to list.`);
    }
  }

  removeFilter(guildId, filter) {
    this._initGuild(guildId);
    const initialLength = this.filters[guildId].length;
    this.filters[guildId] = this.filters[guildId].filter(f => f !== filter);
    if (this.filters[guildId].length < initialLength) {
        this.emit('filterRemove', { guildId, filter });
         this.emit('warn', `Filter functionality for '${filter}' not fully implemented. Filter removed from list.`);
    }
  }

  async createPlaylist(guildId, name) {
    this._initGuild(guildId);
    const queue = this.queues[guildId];
    const current = this.current[guildId];
    const tracksToSave = [];
    if (current) tracksToSave.push(current);
    tracksToSave.push(...queue);

    if (tracksToSave.length === 0) {
        throw new Error("Cannot create an empty playlist.");
    }

    const playlist = {
      name: name || `Playlist_${Date.now()}`,
      tracks: tracksToSave.map(t => ({
           title: t.title,
           artist: t.artist,
           url: t.url,
           source: t.source,
           duration: t.duration
      })),
      createdAt: Date.now(),
      creatorId: current?.member?.id || queue[0]?.member?.id
    };

    this.emit('playlistCreate', { guildId, playlist });
    this.emit('info', `Playlist '${playlist.name}' created structure (saving not implemented).`);
    return playlist;
  }

  async getLyrics(guildId) {
    this._initGuild(guildId);
    const track = this.current[guildId];
    if (!track) throw new Error('No track is currently playing.');

    try {
        const searchQuery = `${track.title} ${track.artist}`;
        this.emit('debug', `Searching lyrics for: ${searchQuery}`);
        const searchPromise = this.lyricsClient.songs.search(searchQuery);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Lyrics search timed out')), 15000));

        const results = await Promise.race([searchPromise, timeoutPromise]);

        if (!results || results.length === 0) {
            this.emit('lyricsNotFound', { track, guildId });
            throw new Error('No lyrics found for this track.');
        }

        const firstSong = results[0];
        this.emit('debug', `Found lyrics candidate: ${firstSong.title} by ${firstSong.artist?.name}`);

        const lyricsPromise = firstSong.lyrics();
        const lyricsTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetching lyrics timed out')), 15000));

        const lyrics = await Promise.race([lyricsPromise, lyricsTimeoutPromise]);

        if (!lyrics) {
             this.emit('lyricsNotFound', { track, guildId });
             throw new Error('Could not fetch lyrics content.');
        }

        return {
          title: track.title,
          artist: track.artist,
          lyrics: lyrics.trim(),
          sourceURL: firstSong.url
        };
    } catch (error) {
         this.emit('error', { guildId, track, error: `Failed to get lyrics: ${error.message}` });
         throw error;
    }
  }

  async getRelatedTracks(guildId) {
    this._initGuild(guildId);
    const track = this.current[guildId];
    if (!track) throw new Error('No track playing to find related tracks.');

    this.emit('debug', `Finding related tracks for ${track.title}`);
    try {
        if (track.source === 'spotify' && track.artistId) {
           await this._authenticateSpotify();
           const recommendations = await this.spotifyApi.getRecommendations({
               seed_tracks: [track.url.split('/').pop()],
               limit: 5
           });
           return recommendations.body.tracks.map(this._formatSpotifyTrack);
        } else {
          const query = `${track.title} ${track.artist} mix`;
          const results = await ytSearch({query, pages: 1});
           return results.videos
               .filter(v => v.title.toLowerCase().includes(track.title.toLowerCase()) === false)
               .slice(0, 5)
               .map(v => ({
                   title: v.title,
                   artist: v.author?.name || 'Unknown Artist',
                   duration: v.duration?.timestamp || '0:00',
                   url: v.url,
                   thumbnail: v.thumbnail,
                   source: 'youtube'
               }));
        }
    } catch (error) {
        this.emit('error', {guildId, track, error: `Failed to get related tracks: ${error.message}`});
        return [];
    }
  }

  getStatus(guildId) {
    this._initGuild(guildId);
    const connection = getVoiceConnection(guildId);
    const playerState = this.player?.state;
    const resource = playerState?.status === AudioPlayerStatus.Playing || playerState?.status === AudioPlayerStatus.Paused ? playerState.resource : null;

    return {
      guildId: guildId,
      connected: !!connection && connection.state.status === VoiceConnectionStatus.Ready,
      channelId: connection?.joinConfig?.channelId,
      playing: this.isPlaying[guildId],
      paused: playerState?.status === AudioPlayerStatus.Paused,
      loopMode: this.loopMode[guildId], // 0=off, 1=track, 2=queue
      volume: this.volume,
      filters: this.filters[guildId] || [],
      queueSize: this.queues[guildId]?.length || 0,
      currentTrack: this.current[guildId] ? this.getNowPlaying(guildId) : null,
      ping: connection?.ping || { udp: null, ws: null, rtt: null },
      uptimeSeconds: process.uptime(),
      playerStatus: playerState?.status || 'Idle'
    };
  }

  leave(guildId) {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
        this.emit('debug', `Leave called for ${guildId}, but no connection found.`);
        return false;
    }

    this.emit('debug', `Leaving voice channel in guild ${guildId}.`);
    const prevTimeout = this._leaveTimeouts.get(guildId);
    if (prevTimeout) {
        clearTimeout(prevTimeout);
        this._leaveTimeouts.delete(guildId);
    }

    if (this.player && connection.state.subscription?.player === this.player) {
       const currentGuild = this.player.state.resource?.metadata?.guildId;
       if (currentGuild === guildId) {
            this.player.stop(true);
       }
    }

    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
    }

    this.emit('disconnect', { guildId });
    return true;
  }

  getNowPlaying(guildId) {
    this._initGuild(guildId);
    const currentTrack = this.current[guildId];
    if (!currentTrack || !this.isPlaying[guildId] || !this.player?.state.resource) {
        return currentTrack;
    }

    const resource = this.player.state.resource;
    if (resource.metadata?.id !== currentTrack.id) {
        this.emit('warn', `getNowPlaying mismatch: player resource ID (${resource.metadata?.id}) != currentTrack ID (${currentTrack.id}) for guild ${guildId}`);
        return currentTrack;
    }

    const elapsedMs = resource.playbackDuration || 0;
    const elapsedFormatted = convertMsToMinutesSeconds(elapsedMs);

    const durationParts = currentTrack.duration.split(':').map(Number);
    const totalMs = ((durationParts[0] * 60) + (durationParts[1] || 0)) * 1000;

    let progress = 0;
    if (totalMs > 0) {
        progress = parseFloat(((elapsedMs / totalMs) * 100).toFixed(2));
        progress = Math.max(0, Math.min(100, progress));
    }

    return {
      ...currentTrack,
      elapsedTimeFormatted: `${elapsedFormatted}`, // MM:SS
      durationFormatted: currentTrack.duration,   // MM:SS
      elapsedMs: elapsedMs,
      totalMs: totalMs,
      progress: progress // (0-100%)
    };
  }

  stop(guildId) {
    this._initGuild(guildId);
    this.emit('debug', `Stop command received for guild ${guildId}.`);
    this.clearQueue(guildId);
    if (this.player && this.current[guildId]) {
        this.player.stop(true);
    } else {
        this.isPlaying[guildId] = false;
        this.current[guildId] = null;
        this._processQueue(guildId).catch(e => this.emit('error', { guildId, error: `Error processing queue after stop: ${e.message}` }));
    }
    return true;
  }

  clearQueue(guildId) {
    this._initGuild(guildId);
    const queue = this.queues[guildId];
    if (queue.length > 0) {
        this.queues[guildId] = [];
        this.emit('queueClear', { guildId });
    }
  }

  pause(guildId) {
    if (this.player && this.isPlaying[guildId]) {
      const success = this.player.pause();
      if (success) {
          this.isPlaying[guildId] = false;
          this.emit('pause', { guildId });
      }
      return success;
    }
    return false;
  }

  resume(guildId) {
    if (this.player && this.player.state.status === AudioPlayerStatus.Paused) {
      const currentGuild = this.player.state.resource?.metadata?.guildId;
      if (currentGuild === guildId) {
          const success = this.player.unpause();
          if (success) {
              this.isPlaying[guildId] = true;
              this.emit('resume', { guildId });
          }
          return success;
      }
    }
    return false;
  }

  setVolume(volume) {
    if (isNaN(volume) || volume < 0) throw new Error('Volume must be a non-negative number.');
    this.volume = Math.max(0, volume);
    if (this.player?.state.resource?.volume) {
      this.player.state.resource.volume.setVolume(this.volume / 100);
      this.emit('volumeChange', { volume: this.volume, guildId: this.player.state.resource.metadata?.guildId });
    } else {
         this.emit('volumeChange', { volume: this.volume, guildId: null });
    }
  }

  _cleanupResources(guildId) {
    this.emit('debug', `Cleaning up resources for guild ${guildId}`);
    const leaveTimeout = this._leaveTimeouts.get(guildId);
    if (leaveTimeout) {
        clearTimeout(leaveTimeout);
        this._leaveTimeouts.delete(guildId);
    }
    delete this.queues[guildId];
    delete this.current[guildId];
    delete this.isPlaying[guildId];
    delete this.loopMode[guildId];
    delete this.filters[guildId];
  }
}

export default YukufyClient;