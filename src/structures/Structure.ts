/**
 * Base structure class for extending Suwaku structures
 * @module structures/Structure
 */

/**
 * Structure extension registry
 */
export interface StructureExtensions {
  Track?: new (...args: any[]) => any;
  Player?: new (...args: any[]) => any;
  Queue?: new (...args: any[]) => any;
  Node?: new (...args: any[]) => any;
}

/**
 * Base class for extending Suwaku structures
 */
export class Structure {
  static structures: StructureExtensions = {};

  /**
   * Extend a structure with a custom class
   * @param name - Name of the structure to extend
   * @param constructor - Custom constructor function
   */
  static extend<K extends keyof StructureExtensions>(
    name: K,
    constructor: (Base: StructureExtensions[K]) => StructureExtensions[K]
  ): void {
    const BaseClass = this.structures[name];

    if (BaseClass) {
      this.structures[name] = constructor(BaseClass);
    }
  }

  /**
   * Get the current structure class
   */
  static get<K extends keyof StructureExtensions>(name: K): StructureExtensions[K] | undefined {
    return this.structures[name];
  }
}