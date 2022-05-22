/** @typedef {import('./Controller.mjs').Controller} Controller */

export class Service {
  /** @type {string} */
  static id

  /** @type {Controller} */
  controller

  /**
   * @returns {string}
   */
  get id() {
    // @ts-expect-error
    return this.constructor.id
  }

  /**
   * @param {Controller} instance
   */
  register(instance) {
    this.controller = instance
    return this
  }

  /**
   * @param {Controller} instance
   */
  init(instance) {
    throw new Error('Not implemented')
  }
}
