/**
 * Suwaku Structure Manager
 * Allows extending core classes like Player, Track, and Queue
 */
class Structure {
    static structures = {
        Player: null,
        Track: null,
        Queue: null,
        Node: null
    };

    /**
     * Extend a core structure
     * @param {string} name The structure to extend (Player, Track, Queue, Node)
     * @param {Function} extender A function that returns the extended class
     */
    static extend(name, extender) {
        if (name in this.structures) {
            const original = this.get(name);
            return this.structures[name] = extender(original);
        }
    }

    /**
     * Get a structure class
     * @param {string} name The structure name
     */
    static get(name) {
        return this.structures[name];
    }
}

export default Structure;
