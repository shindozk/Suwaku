import { MemoryStorageAdapter } from './MemoryStorageAdapter.js';

/**
 * Manages player state persistence
 */
export class PersistenceManager {
    /**
     * @param {SuwakuClient} client 
     * @param {Object} options 
     */
    constructor(client, options = {}) {
        this.client = client;
        this.storage = options.storage || new MemoryStorageAdapter();
        this.prefix = options.prefix || 'suwaku:player:';

        this._setupListeners();
    }

    /**
     * Setup event listeners to track player changes
     * @private
     */
    _setupListeners() {
        this.client.on('playerCreate', (player) => {
            this.save(player);

            // Save on various events
            player.on('trackStart', () => this.save(player));
            player.on('queueUpdate', () => this.save(player));
            player.on('filtersUpdate', () => this.save(player));
            player.on('volumeChange', () => this.save(player));
            player.on('loopChange', () => this.save(player));
            player.on('pause', () => this.save(player));
            player.on('resume', () => this.save(player));
        });

        this.client.on('playerDestroy', (player) => {
            this.delete(player.guildId);
        });
    }

    /**
     * Save player state to storage
     * @param {SuwakuPlayer} player 
     * @returns {Promise<void>}
     */
    async save(player) {
        if (!player || player.state === 'DESTROYED') return;

        const data = player.toJSON();
        await this.storage.set(`${this.prefix}${player.guildId}`, data);
        this.client.emit('debug', `Saved player state for guild ${player.guildId}`);
    }

    /**
     * Delete player state from storage
     * @param {string} guildId 
     * @returns {Promise<void>}
     */
    async delete(guildId) {
        await this.storage.delete(`${this.prefix}${guildId}`);
        this.client.emit('debug', `Deleted player state for guild ${guildId}`);
    }

    /**
     * Get all saved players
     * @returns {Promise<Array<Object>>}
     */
    async getAll() {
        const all = await this.storage.all();
        return Object.entries(all)
            .filter(([key]) => key.startsWith(this.prefix))
            .map(([, value]) => value);
    }

    /**
     * Restore all players from storage
     * @returns {Promise<number>} Number of restored players
     */
    async restore() {
        const playersData = await this.getAll();
        if (playersData.length === 0) return 0;

        this.client.emit('debug', `Restoring ${playersData.length} players...`);

        let restoredCount = 0;
        for (const data of playersData) {
            try {
                const guild = this.client.discordClient.guilds.cache.get(data.guildId);
                if (!guild) continue;

                const voiceChannel = guild.channels.cache.get(data.voiceChannelId);
                if (!voiceChannel) continue;

                const textChannel = data.textChannelId ? guild.channels.cache.get(data.textChannelId) : null;

                const player = await this.client.join({
                    voiceChannel,
                    textChannel,
                    deaf: data.options?.deaf || false,
                    mute: data.options?.mute || false
                });

                if (player) {
                    // Restore volume
                    if (data.volume) await player.setVolume(data.volume);

                    // Restore queue
                    if (data.queue && data.queue.tracks) {
                        const TrackClass = this.client.structures.get('Track');
                        const tracks = data.queue.tracks.map(t => new TrackClass(t, t.requester));
                        player.queue.addMultiple(tracks);
                    }

                    // Restore current track if it was playing
                    if (data.current) {
                        const TrackClass = this.client.structures.get('Track');
                        const currentTrack = new TrackClass(data.current, data.current.requester);

                        // If the player isn't playing, start the current track at the saved position
                        if (!player.playing) {
                            await player.play(currentTrack, {
                                startTime: data.position || 0,
                                paused: data.paused || false
                            });
                        }
                    }

                    // Restore filters
                    if (data.filters) {
                        await player.filters.setFilters(data.filters);
                    }

                    restoredCount++;
                }
            } catch (error) {
                this.client.emit('debug', `Failed to restore player for guild ${data.guildId}: ${error.message}`);
            }
        }

        return restoredCount;
    }
}
