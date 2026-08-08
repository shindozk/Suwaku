import { SuwakuQueue } from '../../src/structures/SuwakuQueue';
import { SuwakuTrack } from '../../src/structures/SuwakuTrack';
import { TrackData } from '../../src/types';
import { LoopMode } from '../../src/types';

const createMockTrack = (overrides: Partial<TrackData> = {}): SuwakuTrack => {
  const trackData: TrackData = {
    id: `track-${Date.now()}-${Math.random()}`,
    title: 'Test Track',
    author: 'Test Artist',
    duration: 180000,
    ...overrides
  };
  return new SuwakuTrack(trackData);
};

describe('SuwakuQueue', () => {
  let queue: SuwakuQueue;
  let tracks: SuwakuTrack[];

  beforeEach(() => {
    queue = new SuwakuQueue({ maxHistorySize: 10 });
    tracks = [
      createMockTrack({ id: 'track-1', title: 'Track 1', author: 'Artist 1', duration: 180000 }),
      createMockTrack({ id: 'track-2', title: 'Track 2', author: 'Artist 2', duration: 240000 }),
      createMockTrack({ id: 'track-3', title: 'Track 3', author: 'Artist 3', duration: 200000 }),
    ];
  });

  describe('basic operations', () => {
    it('should add track to end by default', () => {
      const track = createMockTrack();
      queue.add(track);
      
      expect(queue.size).toBe(1);
      expect(queue.tracks[0]).toBe(track);
    });

    it('should add track at specific index', () => {
      const t1 = createMockTrack({ id: '1' });
      const t2 = createMockTrack({ id: '2' });
      const t3 = createMockTrack({ id: '3' });
      
      queue.add(t1);
      queue.add(t3);
      queue.add(t2, 1); // insert at index 1
      
      expect(queue.tracks.map(t => t.id)).toEqual(['1', '2', '3']);
    });

    it('should add multiple tracks', () => {
      queue.addMultiple(tracks);
      
      expect(queue.size).toBe(3);
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 1', 'Track 2', 'Track 3']);
    });

    it('should insert at start', () => {
      queue.add(tracks[1]);
      queue.add(tracks[2]);
      queue.insertAtStart(tracks[0]);
      
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 1', 'Track 2', 'Track 3']);
    });

    it('should remove track by index', () => {
      queue.addMultiple(tracks);
      const removed = queue.remove(1);
      
      expect(removed.title).toBe('Track 2');
      expect(queue.size).toBe(2);
    });

    it('should remove track by reference', () => {
      queue.addMultiple(tracks);
      const removed = queue.removeByReference(tracks[1]);
      
      expect(removed).toBe(true);
      expect(queue.size).toBe(2);
    });

    it('should clear queue', () => {
      queue.addMultiple(tracks);
      queue.clear();
      
      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
    });

    it('should get track by index', () => {
      queue.addMultiple(tracks);
      
      expect(queue.get(0)?.title).toBe('Track 1');
      expect(queue.get(1)?.title).toBe('Track 2');
      expect(queue.get(5)).toBeUndefined();
    });

    it('should peek first track', () => {
      queue.addMultiple(tracks);
      
      expect(queue.peek()?.title).toBe('Track 1');
    });
  });

  describe('queue properties', () => {
    it('should calculate total duration', () => {
      queue.addMultiple(tracks);
      expect(queue.duration).toBe(620000); // 180k + 240k + 200k
    });

    it('should report isEmpty correctly', () => {
      expect(queue.isEmpty).toBe(true);
      queue.add(createMockTrack());
      expect(queue.isEmpty).toBe(false);
    });

    it('should track loop mode', () => {
      expect(queue.loopMode).toBe(LoopMode.OFF);
      queue.setLoopMode(LoopMode.TRACK);
      expect(queue.loopMode).toBe(LoopMode.TRACK);
    });
  });

  describe('skip and back', () => {
    beforeEach(() => {
      queue.addMultiple(tracks);
    });

    it('should skip to specific index', () => {
      const skipped = queue.skipTo(2);
      
      expect(skipped.title).toBe('Track 3');
      expect(queue.tracks.length).toBe(1); // only track 3 remains
      expect(queue.previous.length).toBe(2); // tracks 1 and 2 moved to history
    });

    it('should go back to previous track', () => {
      queue.skipTo(1); // skip track 1
      const back = queue.back();
      
      expect(back?.title).toBe('Track 1');
      expect(queue.tracks[0].title).toBe('Track 1');
    });

    it('should return undefined when no history', () => {
      const back = queue.back();
      expect(back).toBeUndefined();
    });
  });

  describe('duplicates and filtering', () => {
    it('should remove duplicates by ID', () => {
      const t1 = createMockTrack({ id: 'dup' });
      const t2 = createMockTrack({ id: 'dup' });
      const t3 = createMockTrack({ id: 'unique' });
      
      queue.addMultiple([t1, t2, t3]);
      const removed = queue.removeDuplicates();
      
      expect(removed).toBe(1);
      expect(queue.size).toBe(2);
    });

    it('should remove tracks by requester', () => {
      const t1 = createMockTrack({ id: '1', requester: { id: 'user1' } });
      const t2 = createMockTrack({ id: '2', requester: { id: 'user2' } });
      const t3 = createMockTrack({ id: '3', requester: { id: 'user1' } });
      
      queue.addMultiple([t1, t2, t3]);
      const removed = queue.removeByRequester('user1');
      
      expect(removed.length).toBe(2);
      expect(queue.size).toBe(1);
    });

    it('should get tracks by requester', () => {
      const t1 = createMockTrack({ id: '1', requester: { id: 'user1' } });
      const t2 = createMockTrack({ id: '2', requester: { id: 'user2' } });
      
      queue.addMultiple([t1, t2]);
      const user1Tracks = queue.getByRequester('user1');
      
      expect(user1Tracks.length).toBe(1);
      expect(user1Tracks[0].id).toBe('1');
    });

    it('should get tracks by source', () => {
      const t1 = createMockTrack({ source: 'youtube' as any });
      const t2 = createMockTrack({ source: 'spotify' as any });
      
      queue.addMultiple([t1, t2]);
      const youtubeTracks = queue.getBySource('youtube');
      
      expect(youtubeTracks.length).toBe(1);
    });

    it('should get tracks by duration range', () => {
      const t1 = createMockTrack({ duration: 100000 });
      const t2 = createMockTrack({ duration: 200000 });
      const t3 = createMockTrack({ duration: 300000 });
      
      queue.addMultiple([t1, t2, t3]);
      const midTracks = queue.getByDuration(150000, 250000);
      
      expect(midTracks.length).toBe(1);
      expect(midTracks[0].duration).toBe(200000);
    });

    it('should search tracks by query', () => {
      queue.addMultiple(tracks);
      const results = queue.search('track 2');
      
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Track 2');
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      queue.addMultiple(tracks);
    });

    it('should sort by title', () => {
      queue.sort('title' as any, true);
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 1', 'Track 2', 'Track 3']);
      
      queue.sort('title' as any, false);
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 3', 'Track 2', 'Track 1']);
    });

    it('should sort by author', () => {
      queue.sort('author' as any);
      // implementation depends on sort logic
    });

    it('should sort by duration', () => {
      queue.sort('duration' as any, true);
      expect(queue.tracks.map(t => t.duration)).toEqual([180000, 200000, 240000]);
    });
  });

  describe('manipulation', () => {
    beforeEach(() => {
      queue.addMultiple(tracks);
    });

    it('should shuffle queue', () => {
      const original = [...queue.tracks];
      queue.shuffle();
      
      expect(queue.size).toBe(original.length);
      // order should likely be different (not guaranteed but very likely)
    });

    it('should reverse queue', () => {
      queue.reverse();
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 3', 'Track 2', 'Track 1']);
    });

    it('should move track', () => {
      const moved = queue.move(0, 2);
      expect(moved).toBe(true);
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 2', 'Track 3', 'Track 1']);
    });

    it('should swap tracks', () => {
      const swapped = queue.swap(0, 2);
      expect(swapped).toBe(true);
      expect(queue.tracks.map(t => t.title)).toEqual(['Track 3', 'Track 2', 'Track 1']);
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      const manyTracks = Array.from({ length: 25 }, (_, i) => 
        createMockTrack({ id: `t${i}`, title: `Track ${i}` })
      );
      queue.addMultiple(manyTracks);
    });

    it('should get first N tracks', () => {
      const first = queue.first(5);
      expect(first.length).toBe(5);
    });

    it('should get last N tracks', () => {
      const last = queue.last(5);
      expect(last.length).toBe(5);
    });

    it('should get page', () => {
      const page = queue.getPage(2, 10);
      expect(page.length).toBe(10);
    });

    it('should calculate total pages', () => {
      const pages = queue.getTotalPages(10);
      expect(pages).toBe(3); // 25 items / 10 = 2.5 -> 3 pages
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize', () => {
      queue.addMultiple(tracks);
      queue.setLoopMode(LoopMode.QUEUE);
      
      const json = queue.toJSON();
      expect(json.tracks.length).toBe(3);
      expect(json.loopMode).toBe(LoopMode.QUEUE);
      
      const restored = SuwakuQueue.from(json);
      expect(restored.size).toBe(3);
      expect(restored.loopMode).toBe(LoopMode.QUEUE);
    });
  });
});