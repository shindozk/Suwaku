import { SuwakuTrack } from '../../src/structures/SuwakuTrack';
import { TrackData, LavalinkTrackResponse, LavalinkTrackInfo, TrackSource } from '../../src/types';

describe('SuwakuTrack', () => {
  const mockTrackData: TrackData = {
    id: 'test-track-1',
    title: 'Test Song',
    author: 'Test Artist',
    url: 'https://example.com/track',
    duration: 180000,
    thumbnail: 'https://example.com/thumb.jpg',
    source: TrackSource.YOUTUBE,
    isStream: false,
    isSeekable: true,
    position: 0,
    encoded: 'encoded-track-data',
    artworkUrl: 'https://example.com/artwork.jpg',
    isrc: 'USRC12345678',
    album: 'Test Album',
    playlistName: 'Test Playlist',
    playlistUrl: 'https://example.com/playlist',
    playlistId: 'playlist-1',
    identifier: 'identifier-1',
    sourceName: TrackSource.YOUTUBE
  };

  const mockLavalinkResponse: LavalinkTrackResponse = {
    encoded: 'lavalink-encoded-data',
    info: {
      identifier: 'lavalink-id',
      isSeekable: true,
      author: 'Lavalink Artist',
      length: 240000,
      isStream: false,
      position: 0,
      title: 'Lavalink Song',
      uri: 'https://lavalink.example.com/track',
      artworkUrl: 'https://lavalink.example.com/art.jpg',
      isrc: 'USRC87654321',
      sourceName: 'youtube',
      pluginInfo: {}
    }
  };

  describe('constructor', () => {
    it('should create track from TrackData', () => {
      const track = new SuwakuTrack(mockTrackData);
      
      expect(track.id).toBe('test-track-1');
      expect(track.title).toBe('Test Song');
      expect(track.author).toBe('Test Artist');
      expect(track.url).toBe('https://example.com/track');
      expect(track.duration).toBe(180000);
      expect(track.thumbnail).toBe('https://example.com/thumb.jpg');
      expect(track.isStream).toBe(false);
      expect(track.isSeekable).toBe(true);
      expect(track.encoded).toBe('encoded-track-data');
      expect(track.artworkUrl).toBe('https://example.com/artwork.jpg');
      expect(track.isrc).toBe('USRC12345678');
      expect(track.album).toBe('Test Album');
      expect(track.playlistName).toBe('Test Playlist');
    });

    it('should create track from LavalinkTrackResponse', () => {
      const track = new SuwakuTrack(mockLavalinkResponse);
      
      expect(track.id).toBe('lavalink-id');
      expect(track.title).toBe('Lavalink Song');
      expect(track.author).toBe('Lavalink Artist');
      expect(track.url).toBe('https://lavalink.example.com/track');
      expect(track.duration).toBe(240000);
      expect(track.thumbnail).toBe('https://lavalink.example.com/art.jpg');
      expect(track.isStream).toBe(false);
      expect(track.isSeekable).toBe(true);
      expect(track.encoded).toBe('lavalink-encoded-data');
      expect(track.artworkUrl).toBe('https://lavalink.example.com/art.jpg');
      expect(track.isrc).toBe('USRC87654321');
      expect(track.album).toBeNull();
      expect(track.playlistName).toBeNull();
    });

    it('should generate ID if not provided', () => {
      const data = { ...mockTrackData, id: undefined };
      const track = new SuwakuTrack(data as any);
      
      expect(track.id).toBeDefined();
      expect(track.id.length).toBeGreaterThan(0);
    });
  });

  describe('getters', () => {
    it('should return formatted duration', () => {
      const track = new SuwakuTrack({ ...mockTrackData, duration: 125000 });
      expect(track.formattedDuration).toBe('2:05');
    });

    it('should calculate progress', () => {
      const track = new SuwakuTrack(mockTrackData);
      track.position = 90000;
      expect(track.progress).toBe(50);
    });

    it('should return best thumbnail', () => {
      const track = new SuwakuTrack({ ...mockTrackData, artworkUrl: 'artwork.jpg', thumbnail: 'thumb.jpg' });
      expect(track.bestThumbnail).toBe('artwork.jpg');
    });
  });

  describe('methods', () => {
    it('should update position with bounds checking', () => {
      const track = new SuwakuTrack(mockTrackData);
      
      track.updatePosition(50000);
      expect(track.position).toBe(50000);
      
      track.updatePosition(-10000);
      expect(track.position).toBe(0);
      
      track.updatePosition(200000);
      expect(track.position).toBe(180000); // max duration
    });

    it('should create clone with overrides', () => {
      const track = new SuwakuTrack(mockTrackData);
      const cloned = track.clone({ title: 'Cloned Title' });
      
      expect(cloned.title).toBe('Cloned Title');
      expect(cloned.id).not.toBe(track.id); // new ID generated
      expect(track.title).toBe('Test Song'); // original unchanged
    });

    it('should check equality by ID', () => {
      const track1 = new SuwakuTrack({ ...mockTrackData, id: 'same-id' });
      const track2 = new SuwakuTrack({ ...mockTrackData, id: 'same-id' });
      const track3 = new SuwakuTrack({ ...mockTrackData, id: 'different-id' });
      
      expect(track1.equals(track2)).toBe(true);
      expect(track1.equals(track3)).toBe(false);
    });

    it('should serialize to JSON', () => {
      const track = new SuwakuTrack(mockTrackData);
      const json = track.toJSON();
      
      expect(json.id).toBe('test-track-1');
      expect(json.title).toBe('Test Song');
      expect(json.duration).toBe(180000);
    });

    it('should deserialize from JSON', () => {
      const track = SuwakuTrack.from(mockTrackData);
      expect(track.title).toBe('Test Song');
    });

    it('should create from Lavalink array', () => {
      const tracks = SuwakuTrack.fromLavalinkArray([mockLavalinkResponse, mockLavalinkResponse]);
      expect(tracks.length).toBe(2);
      expect(tracks[0].title).toBe('Lavalink Song');
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const minimalData: TrackData = {
        title: 'Minimal',
        author: 'Artist',
        duration: 100000
      };
      
      const track = new SuwakuTrack(minimalData);
      expect(track.title).toBe('Minimal');
      expect(track.url).toBeNull();
      expect(track.thumbnail).toBeNull();
      expect(track.album).toBeNull();
    });

    it('should parse source correctly', () => {
      const youtubeTrack = new SuwakuTrack({ ...mockTrackData, source: TrackSource.YOUTUBE });
      expect(youtubeTrack.source).toBe(TrackSource.YOUTUBE);
      
      const spotifyTrack = new SuwakuTrack({ ...mockTrackData, source: TrackSource.SPOTIFY });
      expect(spotifyTrack.source).toBe(TrackSource.SPOTIFY);
    });
  });
});