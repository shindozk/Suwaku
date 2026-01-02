/**
 * Lyrics Manager - Advanced lyrics fetching with intelligent provider fallback
 * Redesigned for robustness and high-precision synchronization.
 * 
 * Provider Priority:
 * 1. LRCLIB (Best public synced lyrics database)
 * 2. Musixmatch (High quality synced/plain)
 * 3. Netease (High quality plain lyrics)
 * 3. Lavalink Node (Plugin-based lyrics)
 * 4. LewdHuTao (Musixmatch/YouTube fallback)
 * 5. Genius (High quality plain lyrics)
 * 6. Lyrica (Multi-source fallback)
 * 7. OVH (Legacy fallback)
 */

import { validateNonEmptyString } from "../utils/validators.js";
import axios from "axios";
import fetch from "node-fetch";
import fetchCookie from "fetch-cookie";
import Genius from "genius-lyrics";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";

class LyricsManager {
  constructor(client) {
    this.client = client;
    this.cache = new Map();
    this.cacheTTL = 3600000; // 1 hour
    this.requestTimeout = 8000; // Increased for better reliability

    this.genius = new Genius.Client(this.client.options.geniusApiKey || undefined);

    // Musixmatch Native Configuration
    this.mxmToken = null;
    this.mxmExpiration = 0;
    this.mxmRootUrl = "https://apic-desktop.musixmatch.com/ws/1.1/";
    this.mxmAppId = "web-desktop-app-v1.0";
    this.mxmCachePath = join(homedir(), ".cache", "suwaku", "musixmatch_token.json");
    
    // Cookie-enabled fetch for Musixmatch (fixes redirect loops)
    this.mxmFetch = fetchCookie(fetch);
    
    this.stats = {
      musixmatch: { hits: 0, misses: 0, errors: 0 },
      lrclib: { hits: 0, misses: 0, errors: 0 },
      lavalink: { hits: 0, misses: 0, errors: 0 },
      genius: { hits: 0, misses: 0, errors: 0 },
      lewdhutao: { hits: 0, misses: 0, errors: 0 },
      lyrica: { hits: 0, misses: 0, errors: 0 },
      netease: { hits: 0, misses: 0, errors: 0 },
      ovh: { hits: 0, misses: 0, errors: 0 },
    };

    // Advanced sync contexts
    this.syncContexts = new Map();
  }

  /**
   * Redesigned High-Precision Calibrator
   * Uses network jitter and Lavalink processing lag for micro-adjustments
   */
  calibrate(player) {
    if (!player) return 0;

    const nodePing = player.node?.ping || 0;
    
    // Base latency calculation:
    // Ping/2 (one-way) + 150ms (Lavalink internal buffer/processing)
    let dynamicOffset = (nodePing / 2) + 150;

    // Jitter compensation: If ping is high, add more buffer
    if (nodePing > 200) dynamicOffset += 50;
    if (nodePing > 500) dynamicOffset += 100;

    this.syncContexts.set(player.guildId, {
      offset: dynamicOffset,
      lastSync: Date.now(),
      ping: nodePing
    });

    this.client.emit("debug", `[LyricsManager] 🧬 Advanced Calibrator: offset=${dynamicOffset.toFixed(2)}ms for guild ${player.guildId}`);
    return dynamicOffset;
  }

  /**
   * High-Precision Synced Time
   * Combines Lavalink's interpolation with our dynamic network correction
   */
  getSyncedTime(player) {
    if (!player) return 0;
    
    // Use player's internal high-precision position if available
    const basePosition = typeof player.getCurrentPosition === 'function' 
      ? player.getCurrentPosition() 
      : player.position;

    let context = this.syncContexts.get(player.guildId);
    
    // Auto-calibrate every 20 seconds or if jitter is detected
    if (!context || (Date.now() - context.lastSync > 20000)) {
      this.calibrate(player);
      context = this.syncContexts.get(player.guildId);
    }

    // getCurrentPosition already has a +200ms static offset.
    // We adjust it by our dynamic calculation.
    const finalCorrection = context.offset - 200;
    
    return Math.min(
      basePosition + finalCorrection,
      player.current?.duration || Infinity
    );
  }

  /**
   * Main entry point: Intelligent Multi-Provider Fetcher
   */
  async get(track, options = {}) {
    const {
      author = "",
      player = null,
      romanized = false,
      preferSynced = true,
    } = options;

    const isTrackInstance = track && typeof track === "object" && track.encoded;
    const title = isTrackInstance ? track.title : track;
    let trackAuthor = isTrackInstance ? track.author || track.artist : author;

    if (!trackAuthor && isTrackInstance && track.requester?.username) {
      trackAuthor = track.requester.username;
    }
    
    trackAuthor = trackAuthor || "Unknown Artist";
    validateNonEmptyString(title, "Track title");

    const cleanTitle = this._cleanMetadata(title);
    const cleanAuthor = this._cleanMetadata(trackAuthor);
    
    this.client.emit("debug", `[LyricsManager] 🔍 Resolving lyrics for: "${cleanTitle}" by "${cleanAuthor}" (ISRC: ${isTrackInstance ? (track.isrc || 'N/A') : 'N/A'})`);

    const cacheKey = `${cleanTitle}:${cleanAuthor}:${romanized}:${preferSynced}`.toLowerCase();

    const cached = this._getFromCache(cacheKey);
    if (cached) {
      if (player && preferSynced && cached.isSynced) this.calibrate(player);
      return cached;
    }

    const trackDuration = isTrackInstance ? track.duration : 0;
    const trackEncoded = isTrackInstance ? track.encoded : null;

    // Execution Queue for robust fetching
    const providers = [
      { name: 'musixmatch', fetch: () => this._fetchFromMusixmatch(cleanTitle, cleanAuthor, isTrackInstance ? track.isrc : null, trackDuration) },
      { name: 'lrclib', fetch: () => this._fetchFromLRCLIB(cleanTitle, cleanAuthor, trackDuration, romanized, preferSynced) },
      { name: 'netease', fetch: () => this._fetchFromNetease(cleanTitle, cleanAuthor) },
      { name: 'lavalink', fetch: () => (player && trackEncoded) ? this._fetchFromLavalinkNode(player, trackEncoded) : null },
      { name: 'lewdhutao', fetch: () => this._fetchFromLewdHuTao(cleanTitle, cleanAuthor) },
      { name: 'genius', fetch: () => !preferSynced ? this._fetchFromGenius(cleanTitle, cleanAuthor) : null },
      { name: 'lyrica', fetch: () => !preferSynced ? this._fetchFromLyrica(cleanTitle, cleanAuthor) : null },
      { name: 'ovh', fetch: () => !preferSynced ? this._fetchFromOVH(cleanTitle, cleanAuthor) : null }
    ];

    for (const provider of providers) {
      try {
        const result = await provider.fetch();
        if (result && (preferSynced ? result.isSynced : true)) {
          if (player && result.isSynced) this.calibrate(player);
          
          // Add language detection if not provided by the source
          if (!result.language) {
            result.language = this._detectLanguage(result.lyrics || (result.lines?.[0]?.text));
          }

          this._saveToCache(cacheKey, result);
          
          // Emit event for tracking
          this.client.emit("lyricsLoad", player, result);
          this.client.emit("debug", `[LyricsManager] ✅ Lyrics loaded for "${result.title}" from ${result.source}`);
          
          return result;
        }
      } catch (err) {
        this.client.emit("debug", `[LyricsManager] Provider ${provider.name} failed: ${err.message}`);
      }
    }

    return null;
  }

  // --- Core Provider Implementations ---

  async _fetchFromLRCLIB(title, author, duration = 0, romanized = false, onlySynced = false) {
    try {
      const durationSec = Math.floor(duration / 1000);
      let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(author)}&track_name=${encodeURIComponent(title)}`;
      if (durationSec > 0) url += `&duration=${durationSec}`;

      const response = await axios.get(url, { timeout: this.requestTimeout });
      const data = response.data;

      if (data && (onlySynced ? data.syncedLyrics : (data.syncedLyrics || data.plainLyrics))) {
        this.stats.lrclib.hits++;
        return this._formatLRCLIBResponse(data);
      }

      // Fallback: Search
      const query = `${title} ${author}`;
      this.client.emit("debug", `[LyricsManager] LRCLIB get failed, trying search: "${query}"`);
      const searchRes = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      
      if (searchRes.data?.length) {
        // Encontra o melhor match validando o artista
        const best = searchRes.data.find(res => {
          const isArtistMatch = res.artistName.toLowerCase().includes(author.toLowerCase()) || 
                               author.toLowerCase().includes(res.artistName.toLowerCase());
          return isArtistMatch && (onlySynced ? !!res.syncedLyrics : true);
        }) || searchRes.data[0]; // Fallback para o primeiro se nenhum match de artista for perfeito

        if (onlySynced ? best.syncedLyrics : true) {
          this.stats.lrclib.hits++;
          return this._formatLRCLIBResponse(best);
        }
      }
    } catch (e) {
      this.stats.lrclib.errors++;
    }
    return null;
  }

  async _fetchFromMusixmatch(title, author, isrc = null, duration = 0) {
    try {
      this.client.emit("debug", `[LyricsManager] Searching Musixmatch (Native): "${author} - ${title}" (ISRC: ${isrc || 'N/A'})`);

      let track = null;

      // 1. Try by ISRC if available
      if (isrc) {
        const trackRes = await this._mxmRequest("track.get", { track_isrc: isrc });
        if (trackRes?.message?.header?.status_code === 200) {
          track = trackRes.message.body.track;
        }
      }

      // 2. Fallback to Search
      if (!track) {
        // 2.1 Try searching by Artist first, then Title (Sequential)
        const artistSearchRes = await this._mxmRequest("track.search", {
          q_artist: author,
          q_track: title,
          page_size: 10,
          s_track_rating: "desc",
          f_has_lyrics: 1
        });

        if (artistSearchRes?.message?.header?.status_code === 200 && artistSearchRes.message.body.track_list?.length > 0) {
          const candidates = artistSearchRes.message.body.track_list.map(item => item.track);
          
          track = candidates.find(t => {
            const mxmArtist = t.artist_name.toLowerCase();
            const mxmTitle = t.track_name.toLowerCase();
            const expectedArtist = author.toLowerCase();
            const expectedTitle = title.toLowerCase();

            const isArtistMatch = mxmArtist.includes(expectedArtist) || expectedArtist.includes(mxmArtist);
            const isTitleMatch = mxmTitle.includes(expectedTitle) || expectedTitle.includes(mxmTitle);
            const durationMatch = duration > 0 ? Math.abs(t.track_length * 1000 - duration) < 5000 : true;

            return isArtistMatch && isTitleMatch && durationMatch;
          });
        }

        // 2.2 Fallback to Global Search (Combined query)
        if (!track) {
          const globalSearchRes = await this._mxmRequest("track.search", {
            q: `${author} ${title}`,
            page_size: 10,
            s_track_rating: "desc",
            f_has_lyrics: 1
          });

          if (globalSearchRes?.message?.header?.status_code === 200 && globalSearchRes.message.body.track_list?.length > 0) {
            const candidates = globalSearchRes.message.body.track_list.map(item => item.track);
            track = candidates.find(t => {
              const mxmArtist = t.artist_name.toLowerCase();
              const mxmTitle = t.track_name.toLowerCase();
              const expectedArtist = author.toLowerCase();
              const expectedTitle = title.toLowerCase();
              const durationMatch = duration > 0 ? Math.abs(t.track_length * 1000 - duration) < 10000 : true;
              return (mxmArtist.includes(expectedArtist) || expectedArtist.includes(mxmArtist)) && 
                     (mxmTitle.includes(expectedTitle) || expectedTitle.includes(mxmTitle)) &&
                     durationMatch;
            });
          }
        }
      }

      // 2.3 Last resort for "Topic" channels or missing author match
      if (!track && (author.toLowerCase().includes("topic") || author.toLowerCase().includes("unknown"))) {
        const titleOnlyRes = await this._mxmRequest("track.search", {
          q: title,
          page_size: 5,
          s_track_rating: "desc",
          f_has_lyrics: 1
        });
        
        if (titleOnlyRes?.message?.header?.status_code === 200 && titleOnlyRes.message.body.track_list?.length > 0) {
          // Find first one that matches title and has reasonable duration
          track = titleOnlyRes.message.body.track_list.find(item => {
            const mxmTitle = item.track.track_name.toLowerCase();
            const expectedTitle = title.toLowerCase();
            const durationMatch = duration > 0 ? Math.abs(item.track.track_length * 1000 - duration) < 10000 : true;
            return (mxmTitle.includes(expectedTitle) || expectedTitle.includes(mxmTitle)) && durationMatch;
          })?.track || titleOnlyRes.message.body.track_list[0].track;
        }
      }

      if (!track) {
        this.stats.musixmatch.misses++;
        return null;
      }

      const trackId = track.track_id;
      let lyricsData = null;
      let isSynced = false;
      let syncedLyrics = null;

      // 3. Try RichSync (Word-level synchronization)
      try {
        const richRes = await this._mxmRequest("track.richsync.get", { track_id: trackId });
        if (richRes?.message?.header?.status_code === 200) {
          const body = richRes.message.body.richsync.richsync_body;
          syncedLyrics = this._mxmParseRichSync(body);
          if (syncedLyrics?.length > 0) isSynced = true;
        }
      } catch (e) {}

      // 4. Try Subtitle (Line-level synchronization)
      if (!isSynced) {
        try {
          const subRes = await this._mxmRequest("track.subtitle.get", { track_id: trackId });
          if (subRes?.message?.header?.status_code === 200) {
            const body = subRes.message.body.subtitle.subtitle_body;
            syncedLyrics = this._mxmParseSubtitle(body);
            if (syncedLyrics?.length > 0) isSynced = true;
          }
        } catch (e) {}
      }

      // 5. Always get Plain Lyrics as base
      const lyricsRes = await this._mxmRequest("track.lyrics.get", { track_id: trackId });
      if (lyricsRes?.message?.header?.status_code === 200) {
        lyricsData = lyricsRes.message.body.lyrics.lyrics_body;
      }

      if (!lyricsData && !syncedLyrics) return null;

      this.stats.musixmatch.hits++;

      // Formatar as linhas para o padrão interno
      let lines = [];
      if (isSynced && syncedLyrics) {
        lines = syncedLyrics.map(l => ({
          time: l.time.total * 1000,
          text: l.text
        }));
      } else {
        lines = this._parsePlainText(lyricsData);
      }

      return {
        source: "musixmatch",
        provider: `Musixmatch (${isSynced ? 'Synced' : 'Plain'})`,
        title: track.track_name,
        author: track.artist_name,
        album: track.album_name,
        duration: track.track_length,
        isrc: track.track_isrc,
        trackId: track.track_id,
        lyrics: lyricsData || "",
        syncedLyrics: isSynced ? this._formatAsLRC(lines) : null,
        isSynced: isSynced,
        language: track.track_language || "unknown",
        lines: lines
      };

    } catch (e) {
      this.stats.musixmatch.errors++;
      this.client.emit("debug", `[LyricsManager] Musixmatch native fetch failed: ${e.message}`);
      return null;
    }
  }

  // --- Musixmatch Native Helpers ---

  async _mxmGetToken() {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check memory cache
    if (this.mxmToken && currentTime < this.mxmExpiration) {
      return this.mxmToken;
    }

    // Check file cache
    try {
      const data = await readFile(this.mxmCachePath, "utf-8");
      const cached = JSON.parse(data);
      if (cached.token && cached.expiration > currentTime) {
        this.mxmToken = cached.token;
        this.mxmExpiration = cached.expiration;
        return this.mxmToken;
      }
    } catch (e) {}

    // Fetch new token using cookie-enabled fetch
    try {
      const url = new URL(`${this.mxmRootUrl}token.get`);
      url.searchParams.set("app_id", this.mxmAppId);
      url.searchParams.set("user_language", "en");
      url.searchParams.set("t", Date.now());

      const res = await this.mxmFetch(url.toString(), {
        headers: this._mxmHeaders()
      });
      
      const data = await res.json();

      if (data?.message?.header?.status_code === 401) {
        this.client.emit("debug", `[LyricsManager] Musixmatch token 401, waiting 10s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return this._mxmGetToken();
      }

      if (data?.message?.header?.status_code === 200) {
        const token = data.message.body.user_token;
        this.mxmToken = token;
        this.mxmExpiration = currentTime + 600; // 10 minutes

        // Save to file
        try {
          await mkdir(dirname(this.mxmCachePath), { recursive: true });
          await writeFile(this.mxmCachePath, JSON.stringify({
            token: this.mxmToken,
            expiration: this.mxmExpiration
          }));
        } catch (e) {}

        return this.mxmToken;
      }
    } catch (e) {
      this.client.emit("debug", `[LyricsManager] Musixmatch token fetch failed: ${e.message}`);
    }

    return null;
  }

  async _mxmRequest(action, params = {}, retry = true) {
    let token = await this._mxmGetToken();
    if (!token && action !== "token.get") return null;

    try {
      const url = new URL(`${this.mxmRootUrl}${action}`);
      url.searchParams.set("app_id", this.mxmAppId);
      url.searchParams.set("usertoken", token);
      url.searchParams.set("t", Date.now());
      
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      const res = await this.mxmFetch(url.toString(), {
        headers: this._mxmHeaders(),
        timeout: this.requestTimeout
      });
      
      const data = await res.json();

      // Handle 401 Unauthorized (Token expired)
      if (data?.message?.header?.status_code === 401 && retry) {
        this.client.emit("debug", `[LyricsManager] Musixmatch token 401, retrying with new token...`);
        this.mxmToken = null; // Invalidate cache
        return this._mxmRequest(action, params, false);
      }

      return data;
    } catch (e) {
      this.client.emit("debug", `[LyricsManager] Musixmatch request error (${action}): ${e.message}`);
      return null;
    }
  }

  _mxmHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Referer": "https://www.musixmatch.com/",
      "Origin": "https://www.musixmatch.com"
    };
  }

  _mxmParseSubtitle(body) {
    if (!body) return [];
    const lines = body.split("\n");
    const timestampMap = new Map();

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const match = trimmedLine.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.+)/);
      if (match) {
        const minutes = match[1];
        const seconds = match[2];
        const hundredths = match[3];
        const text = match[4].trim();
        const timestampKey = `${minutes}:${seconds}.${hundredths}`;

        if (!timestampMap.has(timestampKey)) {
          timestampMap.set(timestampKey, []);
        }
        timestampMap.get(timestampKey).push(text);
      }
    }

    const syncedLyrics = [];
    for (const [timestampKey, textParts] of timestampMap) {
      const match = timestampKey.match(/(\d{2}):(\d{2})\.(\d{2})/);
      if (!match) continue;

      const minutesNum = parseInt(match[1], 10);
      const secondsNum = parseInt(match[2], 10);
      const hundredthsNum = parseInt(match[3], 10);
      const totalSeconds = minutesNum * 60 + secondsNum + hundredthsNum / 100;

      const combinedText = textParts.filter(t => t.length > 0).join(" ").trim();
      if (combinedText) {
        syncedLyrics.push({
          text: combinedText,
          time: { total: totalSeconds, minutes: minutesNum, seconds: secondsNum, ms: hundredthsNum * 10 }
        });
      }
    }

    return syncedLyrics.sort((a, b) => a.time.total - b.time.total);
  }

  _mxmParseRichSync(body) {
    try {
      const data = JSON.parse(body);
      const timestampMap = new Map();

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.ts && item.l && Array.isArray(item.l)) {
            const startTime = parseFloat(item.ts);
            for (const lyricItem of item.l) {
              if (lyricItem.c) {
                if (!timestampMap.has(startTime)) {
                  timestampMap.set(startTime, []);
                }
                timestampMap.get(startTime).push(lyricItem.c);
              }
            }
          }
        }
      }

      const syncedLyrics = [];
      for (const [startTime, textParts] of timestampMap) {
        const minutes = Math.floor(startTime / 60);
        const seconds = Math.floor(startTime % 60);
        const ms = Math.floor((startTime % 1) * 1000);

        const combinedText = textParts.filter(t => t.trim().length > 0).join(" ").trim();
        if (combinedText) {
          syncedLyrics.push({
            text: combinedText,
            time: { total: startTime, minutes, seconds, ms }
          });
        }
      }

      return syncedLyrics.sort((a, b) => a.time.total - b.time.total);
    } catch (e) {
      return [];
    }
  }

  _formatAsLRC(lines) {
    return lines.map(l => {
      const totalSeconds = l.time / 1000;
      const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
      const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
      const ms = Math.floor((totalSeconds % 1) * 100).toString().padStart(2, "0");
      return `[${m}:${s}.${ms}] ${l.text}`;
    }).join("\n");
  }

  async _fetchFromLavalinkNode(player, encodedTrack) {
    try {
      if (!player.node?.rest?.getLyrics) return null;
      const data = await player.node.rest.getLyrics(encodedTrack);
      if (data?.syncedLyrics) {
        this.stats.lavalink.hits++;
        return {
          source: "lavalink", provider: "Lavalink Node",
          title: data.name, author: data.artist,
          lyrics: data.syncedLyrics, syncedLyrics: data.syncedLyrics, isSynced: true,
          lines: this._parseLRC(data.syncedLyrics)
        };
      }
    } catch (e) { this.stats.lavalink.errors++; }
    return null;
  }

  async _fetchFromGenius(title, author) {
    try {
      const searches = await this.genius.songs.search(`${title} ${author}`);
      if (searches[0]) {
        const lyrics = await searches[0].lyrics();
        this.stats.genius.hits++;
        return {
          source: "genius", provider: "Genius",
          title: searches[0].title, author: searches[0].artist.name,
          lyrics, plainLyrics: lyrics, isSynced: false,
          lines: this._parsePlainText(lyrics)
        };
      }
    } catch (e) { this.stats.genius.errors++; }
    return null;
  }

  async _fetchFromLewdHuTao(title, author) {
    try {
      const res = await axios.get(`https://lewdhutao.my.id/v2/musixmatch/lyrics`, {
        params: { title, artist: author },
        timeout: this.requestTimeout
      });
      if (res.data?.lyrics) {
        this.stats.lewdhutao.hits++;
        return {
          source: "lewdhutao", provider: "LewdHuTao",
          title, author, lyrics: res.data.lyrics, isSynced: false,
          lines: this._parsePlainText(res.data.lyrics)
        };
      }
    } catch (e) { this.stats.lewdhutao.errors++; }
    return null;
  }

  async _fetchFromLyrica(title, author) {
    try {
      // Lyrica API public instances often follow this pattern or similar. 
      // Using a placeholder or common public endpoint if available, otherwise fallback.
      const res = await axios.get(`https://lyrica.vercel.app/api/lyrics`, {
        params: { q: `${author} ${title}` },
        timeout: this.requestTimeout
      });
      if (res.data?.lyrics) {
        this.stats.lyrica.hits++;
        return {
          source: "lyrica", provider: "Lyrica",
          title, author, lyrics: res.data.lyrics, isSynced: false,
          lines: this._parsePlainText(res.data.lyrics)
        };
      }
    } catch (e) { this.stats.lyrica.errors++; }
    return null;
  }

  async _fetchFromNetease(title, author) {
    try {
      const searchRes = await axios.get(`https://music.163.com/api/search/get/web`, {
        params: { s: `${title} ${author}`, type: 1, limit: 1 },
        timeout: this.requestTimeout
      });

      const songId = searchRes.data?.result?.songs?.[0]?.id;
      if (!songId) return null;

      const lyricRes = await axios.get(`https://music.163.com/api/song/lyric`, {
        params: { id: songId, lv: 1, kv: 1, tv: -1 },
        timeout: this.requestTimeout
      });

      const lrc = lyricRes.data?.lrc?.lyric;
      if (lrc) {
        this.stats.netease.hits++;
        return {
          source: "netease", provider: "Netease Cloud Music",
          title, author,
          lyrics: lrc, syncedLyrics: lrc, isSynced: true,
          lines: this._parseLRC(lrc)
        };
      }
    } catch (e) { this.stats.netease.errors++; }
    return null;
  }

  async _fetchFromOVH(title, author) {
    try {
      const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(author)}/${encodeURIComponent(title)}`);
      if (res.data?.lyrics) {
        this.stats.ovh.hits++;
        return {
          source: "ovh", provider: "Lyrics.ovh",
          title, author, lyrics: res.data.lyrics, isSynced: false,
          lines: this._parsePlainText(res.data.lyrics)
        };
      }
    } catch (e) { this.stats.ovh.errors++; }
    return null;
  }

  // --- Utility Methods ---

  getNearbyLines(lyrics, timeOrPlayer) {
    const time = typeof timeOrPlayer === "object" ? this.getSyncedTime(timeOrPlayer) : timeOrPlayer;
    const lines = Array.isArray(lyrics) ? lyrics : this._parseLRC(lyrics);
    if (!lines.length) return { previous: "", current: "", next: "", index: -1 };

    let idx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (time >= (lines[i].time || 0)) { idx = i; break; }
    }

    return {
      previous: idx > 0 ? lines[idx - 1].text : "",
      current: idx !== -1 ? lines[idx].text : "",
      next: idx < lines.length - 1 ? lines[idx + 1].text : "",
      index: idx
    };
  }

  _parseLRC(lrc) {
    if (!lrc) return [];
    const lines = [];
    // Enhanced regex to handle [mm:ss.xx], [mm:ss:xx], [mm:ss.xxx], and multiple tags per line
    const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[\.:](\d{2,3}))?\]/g;
    
    const rawLines = lrc.split(/\r?\n/);
    for (const raw of rawLines) {
      const text = raw.replace(timeRegex, "").trim();
      if (!text && !raw.includes("[")) continue;

      let match;
      let hasTime = false;
      // Reset regex index for each line
      timeRegex.lastIndex = 0;
      
      while ((match = timeRegex.exec(raw)) !== null) {
        hasTime = true;
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const msRaw = match[3] || "0";
        const ms = (min * 60000) + (sec * 1000) + parseInt(msRaw.padEnd(3, "0").substring(0, 3));
        
        lines.push({ 
          time: ms, 
          text: text || "..." 
        });
      }

      // If no timestamp but has text, it might be a header or plain line
      if (!hasTime && text && !text.startsWith("[")) {
        // We can treat it as a line with time 0 or ignore if we only want synced
      }
    }
    
    return lines.sort((a, b) => a.time - b.time);
  }

  _parsePlainText(text) {
    return (text || "").split("\n").map(l => ({ time: 0, text: l.trim() })).filter(l => l.text);
  }

  _detectLanguage(text) {
    if (!text) return "unknown";
    
    // Simple character-based detection
    const patterns = {
      "ja": /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/,
      "ko": /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/,
      "zh": /[\u4e00-\u9fa5]/,
      "ru": /[\u0400-\u04FF]/,
      "pt": /[áàâãéèêíïóôõöúç]/i,
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }

    return "en"; // Default to English if no specific pattern matches
  }

  _cleanMetadata(text) {
    if (!text) return "";
    return text
      .replace(/\[.*?\]|\(.*?\)/g, "")
      .replace(/Official Video|Official Audio|Lyric Video|Lyrics|Video|Audio|Music Video|HD|4K|8K|- Topic|ft\.|feat\.|featuring/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  _getFromCache(key) {
    const c = this.cache.get(key);
    if (c && Date.now() - c.timestamp < this.cacheTTL) return c.data;
    this.cache.delete(key);
    return null;
  }

  _saveToCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
    if (this.cache.size > 1000) this.cache.delete(this.cache.keys().next().value);
  }

  _formatLRCLIBResponse(data) {
    const isSynced = !!data.syncedLyrics;
    return {
      source: "lrclib", provider: "LRCLIB",
      title: data.trackName, author: data.artistName,
      lyrics: data.syncedLyrics || data.plainLyrics,
      isSynced, lines: isSynced ? this._parseLRC(data.syncedLyrics) : this._parsePlainText(data.plainLyrics)
    };
  }
}

export { LyricsManager };
