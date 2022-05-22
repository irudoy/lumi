import fs from 'fs'
import { interpolateRgb } from 'd3-interpolate'

import { handleError, sleep, RGB } from '../helpers.mjs'
import { Service } from '../Service.mjs'

/**
 * @typedef {Object} LightbulbOptions
 *
 * @prop {number=} transitionSpeedMs TODO Description
 */

/** @typedef {Required<LightbulbOptions>} LightbulbDefaultOptions */

/** @typedef {import('../Controller.mjs')} Controller */

export class Lightbulb extends Service {
  static id = 'LIGHTBULB'
  static topicStateGet = 'light'
  static topicStateSet = 'light/set'
  static topicRGBGet = 'light/rgb'
  static topicRGBSet = 'light/rgb/set'

  /** @type {LightbulbDefaultOptions} */
  static defaultOptions = {
    transitionSpeedMs: 500
  }

  /** @type {LightbulbDefaultOptions} */ // TODO
  #options

  #handles = {
    r: fs.openSync('/sys/class/leds/red/brightness', 'r+'),
    g: fs.openSync('/sys/class/leds/green/brightness', 'r+'),
    b: fs.openSync('/sys/class/leds/blue/brightness', 'r+'),
  }

  #stateRGB = new RGB(
    parseInt(fs.readFileSync(this.#handles.r, 'utf-8'), 10),
    parseInt(fs.readFileSync(this.#handles.g, 'utf-8'), 10),
    parseInt(fs.readFileSync(this.#handles.b, 'utf-8'), 10),
  )

  #prevStateRGB = new RGB(
    this.#stateRGB.r,
    this.#stateRGB.g,
    this.#stateRGB.b,
  )

  // TODO: persist in fs
  #lastStateRGB = new RGB(
    255,
    255,
    255,
  )

  /** @type {Promise<void> | null} */
  #currentTransition = null

  #terminateTransition = false

  #switchState = false

  /**
   * @param {LightbulbOptions} options
   */
  constructor(options = {}) {
    super()
    this.#options = {
      ...Lightbulb.defaultOptions,
      ...options,
    }
  }

  /**
   * @param {fs.PathOrFileDescriptor} handle
   * @param {string} value
   * @returns {Promise<void>}
   */
  #writeFile(handle, value) {
    return new Promise((resolve, reject) => {
      fs.writeFile(handle, value, (err) => {
        if (err) reject(err)
        resolve()
      })
    })
  }

  async #scheduleTransition() {
    if (this.#currentTransition) {
      this.#terminateTransition = true
      await this.#currentTransition
      this.#terminateTransition = false
    }

    this.#currentTransition = this.#startTransition()
    await this.#currentTransition
    this.#currentTransition = null
  }

  async #startTransition() {
    const getColor = interpolateRgb(this.#prevStateRGB.toString(), this.#stateRGB.toString())

    const frames = this.#options.transitionSpeedMs / 1000 * 60
    const frameTime = 16.666 // 60 FPS

    for (let i = 0; i < frames; i++) {
      if (this.#terminateTransition) {
        break
      }

      const [, r, g, b] = getColor((i + 1) / frames).match(/rgb\((\d+), (\d+), (\d+)\)/)

      Promise.all([
        this.#writeFile(this.#handles.r, r),
        this.#writeFile(this.#handles.g, g),
        this.#writeFile(this.#handles.b, b),
      ]).catch(e => {
        handleError(e)
        i = frames
      })

      this.#prevStateRGB.update(parseInt(r, 10), parseInt(g, 10), parseInt(b, 10))

      await sleep(frameTime)
    }
  }

  /**
   * @param {any} v
   */
  #castToFloat(v) {
    if (v === undefined) return v
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const float = parseFloat(v)
      if (!Number.isNaN(float)) {
        return float
      }
    }
    throw new Error(`Wrong value: ${v}`)
  }

  /**
   * @param {string} message
   * @returns {{ h?: number; s?: number; v?: number; r?: number; g?: number; b?: number; w?: number } | null}
   */
  #parseMessage(message) {
    let data = null
    try {
      const { H, S, V, R, G, B, W } = JSON.parse(message)
      data = {
        h: this.#castToFloat(H),
        s: this.#castToFloat(S),
        v: this.#castToFloat(V),
        r: this.#castToFloat(R),
        g: this.#castToFloat(G),
        b: this.#castToFloat(B),
        w: this.#castToFloat(W),
      }
    } catch (e) {
      handleError(/** @type {Error} */ (e))
    }
    return data
  }

  /**
   * @param {string} message
   *
   * {"H":"296.0","S":"99.0","V":"100.0","R":238.0,"G":3.0,"B":255.0,"W":0.0}
   */
  #handleSetRGB(message) {
    const data = this.#parseMessage(message)

    if (!data) {
      handleError(`Unacceptable message: ${message}`)
      return
    }

    /** @type {[number, number, number]} */
    const rgb = [data.r, data.g, data.b]

    if (rgb.includes(null) || rgb.includes(undefined)) {
      handleError(`Unacceptable message: ${message}`)
      return
    }

    if (this.#switchState) {
      this.#stateRGB.update(...rgb)
      this.#scheduleTransition()
    } else {
      this.#lastStateRGB.update(...rgb)
    }

    this.controller.broadcast(Lightbulb.topicStateGet, this.#stateRGB.serializeMQTT())
  }

  /**
   *
   * @param {'true' | 'false'} message
   */
  #handleSwitch(message) {
    const state = message === 'true'

    this.#switchState = state

    if (state) {
      this.#stateRGB.update(this.#lastStateRGB)
    } else {
      this.#lastStateRGB.update(this.#stateRGB)
      this.#stateRGB.update(0, 0, 0)
    }

    this.#scheduleTransition()

    this.controller.broadcast(Lightbulb.topicStateGet, this.#switchState ? 'true' : 'false')
  }

  init() {
    this.controller.on(Lightbulb.topicStateSet, this.#handleSwitch.bind(this))
    this.controller.on(Lightbulb.topicRGBSet, this.#handleSetRGB.bind(this))

    this.controller.broadcast(Lightbulb.topicStateGet, this.#switchState ? 'true' : 'false')
    this.controller.broadcast(Lightbulb.topicRGBGet, this.#lastStateRGB.serializeMQTT())
  }
}
