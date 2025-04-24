const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState
} = require('@discordjs/voice');
const SpotifyWebApi = require('spotify-web-api-node');
const SoundCloud = require('soundcloud-scraper');
const scdl = require('soundcloud-downloader').default;
const ytSearch = require('yt-search');
const axios = require('axios');
const sodium = require('libsodium-wrappers');
const { EventEmitter } = require('events');
const Genius = require('genius-lyrics');

// Initialize sodium for optimized voice processing\;

(async () => { await sodium.ready; })();

/**
 * @typedef {Object} TrackInfo
 * @property {string} url
 * @property {string} title
 * @property {string} artist
 * @property {string} duration    // MM:SS format
 * @property {string} source      // 'spotify' | 'soundcloud'
 * @property {number} likes
 * @property {string} thumbnail
 * @property {Object} member      // Discord member who requested
 * @property {Object} textChannel // Channel where request was made
 * @property {string} guildId
 */

/**
 * Convert milliseconds to MM:SS
 */
function convertMsToMinutesSeconds(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

class YukufyClient extends EventEmitter {
  /**
   * @param {Client} client  // Discord.js client
   * @param {Object} options
   * @param {Object} options.api
   * @param {string} options.api.clientId
   * @param {string} options.api.clientSecret
   * @param {string} [options.api.youtubeApiKey]
   * @param {Object} options.player
   * @param {number} [options.player.defaultVolume]
   * @param {boolean} [options.player.leaveOnEmptyQueue]
   * @param {number} [options.player.leaveOnEmptyQueueCooldown]
   * @param {boolean} [options.player.autoPlayRelated]
   */
  constructor(client, { api, player }) {
    super();
    if (!client) throw new Error('Discord.js client is required');
    if (!api?.clientId || !api?.clientSecret) throw new Error('Spotify credentials are required');

    this.client = client;
    this.apiConfig = {
      clientId: api.clientId,
      clientSecret: api.clientSecret,
      youtubeApiKey: api.youtubeApiKey || null
    };

    this.playerConfig = {
      defaultVolume: player?.defaultVolume ?? 50,
      leaveOnEmptyQueue: player?.leaveOnEmptyQueue ?? true,
      leaveOnEmptyQueueCooldown: player?.leaveOnEmptyQueueCooldown ?? 30000,
      autoPlayRelated: player?.autoPlayRelated ?? false
    };

    this.volume = this.playerConfig.defaultVolume;
    this.queue = new Map();
    this.currentTracks = new Map();
    this.isPlaying = new Map();
    this.loopMode = new Map();

    // API clients
    this.spotifyApi = new SpotifyWebApi({
      clientId: this.apiConfig.clientId,
      clientSecret: this.apiConfig.clientSecret
    });
    this.soundcloudClient = new SoundCloud.Client();
    this.soundcloudClientId = null;
    this.lyricsClient = new Genius.Client();

    this.tokenExpirationTime = 0;
    this.authenticationPromise = this._authenticateSpotify();

    this._setupTokenRefresh();
    this._emitVersion();
  }

  /**
   * Initialize SoundCloud and Spotify tokens
   */
  async initialize() {
    try {
      this.soundcloudClientId = await SoundCloud.keygen();
      await this.authenticationPromise;
      this.emit('ready', { client: this });
      return this;
    } catch (error) {
      console.error('[Yukufy] Initialization error:', error);
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  async _authenticateSpotify() {
    try {
      const data = await this.spotifyApi.clientCredentialsGrant();
      this.spotifyApi.setAccessToken(data.body.access_token);
      this.tokenExpirationTime = Date.now() + data.body.expires_in * 1000 - 60000;
      return true;
    } catch (error) {
      console.error('[Yukufy] Spotify auth error:', error);
      throw new Error(`Spotify authentication failed: ${error.message}`);
    }
  }

  _setupTokenRefresh() {
    setInterval(async () => {
      if (Date.now() >= this.tokenExpirationTime) {
        try {
          await this._authenticateSpotify();
        } catch (error) {
          console.error('[Yukufy] Spotify token refresh error:', error);
        }
      }
    }, 15 * 60 * 1000);
  }

  _emitVersion() {
    this.emit('info', {
      name: 'Yukufy',
      version: '1.6.0',
      description: 'Advanced music client for Discord.js'
    });
  }

  _getQueueData(guildId, create = false) {
    if (!this.queue.has(guildId) && create) {
      this.queue.set(guildId, []);
      this.currentTracks.set(guildId, null);
      this.isPlaying.set(guildId, false);
      this.loopMode.set(guildId, 0);
    }
    return {
      queue: this.queue.get(guildId) || [],
      currentTrack: this.currentTracks.get(guildId),
      isPlaying: this.isPlaying.get(guildId) || false,
      loopMode: this.loopMode.get(guildId) || 0
    };
  }

  async search(query, source = 'spotify') {
    try {
      await this.authenticationPromise;
      if (!query) throw new Error('Search query is required');
      const isUrl = /^(https?:\/\/)?(www\.)?(spotify\.com|soundcloud\.com)/.test(query);
      if (isUrl) {
        if (query.includes('spotify.com')) source = 'spotify';
        else if (query.includes('soundcloud.com')) source = 'soundcloud';
      }
      switch (source.toLowerCase()) {
        case 'spotify': {
          const data = await this.spotifyApi.searchTracks(query, { limit: 20 });
          if (!data.body.tracks.items.length) throw new Error('No results on Spotify');
          return data.body.tracks.items.map(t => ({
            title: t.name,
            artist: t.artists[0].name,
            url: t.external_urls.spotify,
            duration: convertMsToMinutesSeconds(t.duration_ms),
            id: t.id,
            int_id: ``, // id aleatorio
            source: 'spotify',
            likes: t.popularity,
            thumbnail: t.album.images[0]?.url || null
          }));
        }
        case 'soundcloud': {
          if (!this.soundcloudClientId) this.soundcloudClientId = await SoundCloud.keygen();
          const scInfo = await scdl.search({
            query, limit: 20, resourceType: 'tracks', client_id: this.soundcloudClientId
          });
          if (!scInfo.collection.length) throw new Error('No results on SoundCloud');
          return scInfo.collection.map(t => ({
            title: t.title,
            artist: t.user.username,
            url: t.permalink_url,
            duration: convertMsToMinutesSeconds(t.duration),
            id: t.id.toString(),
            int_id: ``, // id aleatorio
            source: 'soundcloud',
            likes: t.likes_count,
            thumbnail: t.artwork_url || null
          }));
        }
        default:
          throw new Error(`Platform "${source}" not supported`);
      }
    } catch (error) {
      console.error('[Yukufy] Search error:', error);
      throw error;
    }
  }

  async play({ query, voiceChannel, textChannel, member, source = 'spotify' }) {
    if (!query || !voiceChannel || !textChannel || !member) {
      throw new Error('Missing parameters for play');
    }
    const guildId = voiceChannel.guild.id;
    try {
      this._getQueueData(guildId, true);
      await this._connect(voiceChannel);
      const results = await this.search(query, source);
      const track = results[0];
      if (!track) throw new Error('No track found');
      const trackInfo = { ...track, member, textChannel, guildId, addedAt: Date.now() };
      this.queue.get(guildId).push(trackInfo);
      this.emit('trackAdd', { track: trackInfo, queue: this.queue.get(guildId), guildId });
      if (!this.isPlaying.get(guildId)) await this._processQueue(guildId);
      return trackInfo;
    } catch (error) {
      console.error('[Yukufy] Play error:', error);
      throw error;
    }
  }

  async _connect(voiceChannel) {
    const guildId = voiceChannel.guild.id;
    let connection = getVoiceConnection(guildId);
    if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
      if (connection) connection.destroy();
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true
      });
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000)
          ]);
        } catch (err) {
          connection.destroy();
          this._cleanupResources(guildId);
          this.emit('disconnect', { guildId, error: err });
        }
      });
      connection.on(VoiceConnectionStatus.Ready, () => {
        this.emit('connect', { guildId, channelId: voiceChannel.id });
      });
      if (!this._players) this._players = new Map();
      if (!this._players.has(guildId)) {
        const player = createAudioPlayer();
        player.on(AudioPlayerStatus.Idle, () => this._handleTrackEnd(guildId));
        player.on('error', err => this._handlePlayerError(guildId, err));
        this._players.set(guildId, player);
      }
      connection.subscribe(this._players.get(guildId));
    }
    return connection;
  }

  async _processQueue(guildId) {
    const data = this._getQueueData(guildId);
    if (!data.queue.length) {
      this.isPlaying.set(guildId, false);
      if (this.playerConfig.leaveOnEmptyQueue) {
        setTimeout(() => {
          const current = this._getQueueData(guildId);
          if (!current.queue.length) this.leave(guildId);
        }, this.playerConfig.leaveOnEmptyQueueCooldown);
      }
      return false;
    }
    let nextTrack;
    const loop = this.loopMode.get(guildId);
    if (loop === 1 && data.currentTrack) nextTrack = data.currentTrack;
    else { nextTrack = data.queue.shift(); if (loop === 2) data.queue.push(nextTrack); }
    try {
      this.currentTracks.set(guildId, nextTrack);
      this.isPlaying.set(guildId, true);
      const player = this._players.get(guildId);
      if (!player) throw new Error('Audio player not found');
      const stream = await this._getAudioStream(nextTrack);
      const resource = createAudioResource(stream, { inlineVolume: true, metadata: nextTrack });
      resource.volume.setVolume(this.volume / 100);
      player.play(resource);
      this.emit('trackStart', { track: nextTrack, guildId });
      return true;
    } catch (error) {
      console.error('[Yukufy] Queue processing error:', error);
      this.emit('trackError', { track: nextTrack, guildId, error });
      return this._processQueue(guildId);
    }
  }

  async _getAudioStream(track) {
    try {
      const query = `${track.artist} ${track.title}`.trim();
      if (!query) throw new Error('Artist and title are required');
      const ytResult = await ytSearch(query);
      if (!ytResult.videos.length) throw new Error(`No YouTube video for "${query}"`);
      const videoId = new URL(ytResult.videos[0].url).searchParams.get('v');
      if (!videoId) throw new Error('Unable to extract video ID');
      const rapidOptions = {
        method: 'GET',
        url: 'https://youtube-mp3-2025.p.rapidapi.com/v1/social/youtube/audio',
        params: { id: videoId, quality: '320kbps' },
        headers: {
          'x-rapidapi-key': '195d9d56f0mshf2ef5b15de50facp11ef65jsn7dbd159005d4',
          'x-rapidapi-host': 'youtube-mp3-2025.p.rapidapi.com'
        }
      };
      const rapidRes = await axios.request(rapidOptions);
      if (rapidRes.data.error) throw new Error(rapidRes.data.error);
      const downloadUrl = rapidRes.data.linkDownload;
      if (!downloadUrl) throw new Error('No download link from API');
      const response = await axios.get(downloadUrl, { responseType: 'stream', timeout: 30000 });
      return response.data;
    } catch (err) {
      console.error('[Yukufy] Audio stream error:', err);
      throw err;
    }
  }

  _handleTrackEnd(guildId) {
    const track = this.currentTracks.get(guildId);
    if (track) this.emit('trackEnd', { track, guildId });
    this._processQueue(guildId);
  }

  _handlePlayerError(guildId, error) {
    const track = this.currentTracks.get(guildId);
    console.error('[Yukufy] Player error:', error);
    this.emit('playerError', { track, guildId, error });
    this._processQueue(guildId);
  }

  _cleanupResources(guildId) {
    this.queue.set(guildId, []);
    this.currentTracks.set(guildId, null);
    this.isPlaying.set(guildId, false);
    this.emit('queueClear', { guildId });
  }

  async skip(guildId) {
    const player = this._players.get(guildId);
    if (!player) throw new Error('Audio player not found');
    player.stop();
    this.emit('trackSkip', { track: this.currentTracks.get(guildId), guildId });
    return true;
  }

  async stop(guildId) {
    const player = this._players.get(guildId);
    if (!player) throw new Error('Audio player not found');
    player.stop();
    this._cleanupResources(guildId);
    return true;
  }

  async pause(guildId) {
    const player = this._players.get(guildId);
    if (!player) throw new Error('Audio player not found');
    if (player.state.status === AudioPlayerStatus.Paused) return { status: 'alreadyPaused' };
    player.pause();
    this.emit('trackPause', { track: this.currentTracks.get(guildId), guildId });
    return { status: 'paused' };
  }

  async resume(guildId) {
    const player = this._players.get(guildId);
    if (!player) throw new Error('Audio player not found');
    if (player.state.status === AudioPlayerStatus.Playing) return { status: 'alreadyPlaying' };
    player.unpause();
    this.emit('trackResume', { track: this.currentTracks.get(guildId), guildId });
    return { status: 'resumed' };
  }

  async setVolume(guildId, volume) {
    if (volume < 0 || volume > 100) throw new Error('Volume must be between 0-100');
    this.volume = volume;
    const player = this._players.get(guildId);
    if (player?.state.resource) player.state.resource.volume.setVolume(volume / 100);
    this.emit('volumeChange', { volume, guildId });
    return volume;
  }

  async setLoopMode(guildId, mode) {
    if (![0,1,2].includes(mode)) throw new Error('Invalid loop mode');
    this.loopMode.set(guildId, mode);
    this.emit('loopChange', { mode, guildId });
    return mode;
  }

  async getQueue(guildId) {
    const data = this._getQueueData(guildId);
    return { current: data.currentTrack, queue: data.queue, isPlaying: data.isPlaying, loopMode: data.loopMode };
  }

  async getNowPlaying(guildId) {
    const data = this._getQueueData(guildId);
    if (!data.currentTrack || !data.isPlaying) return null;
    const player = this._players.get(guildId);
    if (!player?.state.resource) return data.currentTrack;
    const elapsedMs = player.state.resource.playbackDuration;
    const elapsed = convertMsToMinutesSeconds(elapsedMs);
    const [min, sec] = data.currentTrack.duration.split(':').map(Number);
    const totalMs = (min*60 + sec)*1000;
    const progress = parseFloat(((elapsedMs/totalMs)*100).toFixed(2));
    return { ...data.currentTrack, elapsedTime: `${elapsed}/${data.currentTrack.duration}`, progress, elapsedMs, totalMs };
  }

  async shuffle(guildId) {
    const queue = this.queue.get(guildId) || [];
    if (queue.length < 2) return queue;
    for (let i=queue.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    this.emit('queueShuffle', { queue, guildId });
    return queue;
  }

  async remove(guildId, index) {
    const queue = this.queue.get(guildId) || [];
    if (index<0||index>=queue.length) throw new Error('Invalid index');
    const [track] = queue.splice(index,1);
    this.emit('trackRemove',{ track, index, guildId });
    return track;
  }

  async leave(guildId) {
    const connection = getVoiceConnection(guildId);
    if (!connection) return false;
    const player = this._players.get(guildId);
    player?.stop();
    connection.destroy();
    this._cleanupResources(guildId);
    this._players.delete(guildId);
    this.emit('disconnect',{ guildId });
    return true;
  }

  async getRelatedTracks(guildId) {
    const current = this.currentTracks.get(guildId);
    if (!current) throw new Error('No track playing');
    if (current.source==='spotify') {
      const res = await this.spotifyApi.getArtistTopTracks(current.id,'BR');
      return res.body.tracks.map(t=>({ title:t.name, artist:t.artists[0].name, url:t.external_urls.spotify, duration:convertMsToMinutesSeconds(t.duration_ms), id:t.id, source:'spotify', likes:t.popularity, thumbnail:t.album.images[0]?.url||null }));
    } else {
      const results = await ytSearch(`${current.artist} similar songs`);
      return results.videos.map(v=>({ title:v.title, artist:v.channel.name, url:v.url, duration:v.duration.raw, id:v.id, source:'youtube', likes:null, thumbnail:v.thumbnails[0]?.url||null }));
    }
  }

  async addRelatedTracks(guildId,count=3) {
    const related = await this.getRelatedTracks(guildId);
    const tracks = related.slice(0,count).map(track=>({ ...track, member:this.currentTracks.get(guildId).member, textChannel:this.currentTracks.get(guildId).textChannel, guildId, addedAt:Date.now() }));
    const queue = this.queue.get(guildId);
    tracks.forEach(t=>queue.push(t));
    tracks.forEach(t=>this.emit('trackAdd',{ track:t, queue, guildId, autoAdded:true }));
    return tracks;
  }

  async getPlaylistInfo(url) { throw new Error('Not implemented'); }

  async playPlaylist(opts) { throw new Error('Not implemented'); }

  getPlayerStats(guildId) {
    const data = this._getQueueData(guildId);
    const connection = getVoiceConnection(guildId);
    return { isConnected:!!connection, isPlaying:data.isPlaying, queueSize:data.queue.length, loopMode:data.loopMode, volume:this.volume, currentTrack:data.currentTrack, ping:connection?.ping||null };
  }

  getClientInfo() {
    const guildCount=[...new Set(this.queue.keys())].length;
    let total=0; this.queue.forEach(q=>total+=q.length);
    return { version:'1.6.0', name:'Yukufy', activeSessions:guildCount, totalQueued:total, uptime:process.uptime(), memory:process.memoryUsage().heapUsed/1024/1024, spotifyAuthenticated:!!this.spotifyApi.getAccessToken(), tokenExpiresIn:Math.max(0,(this.tokenExpirationTime-Date.now())/1000) };
  }
}

module.exports = { YukufyClient };