const fs = require('fs')

const { Service } = require('../Service.js')

class RGB {
  /**
   * @param {number} r
   * @param {number} g
   * @param {number} b
   */
  constructor(r, g, b) {
    this.update(r, g, b)
  }

  update(...args) {
    const [rgb] = args
    const [r, g, b] = args
    if (rgb instanceof RGB) {
      this.r = rgb.r
      this.g = rgb.g
      this.b = rgb.b
    } else {
      this.r = r
      this.g = g
      this.b = b
    }
  }

  /**
   * @returns {[number, number, number]}
   */
  toArray() {
    return [this.r, this.g, this.b]
  }

  serializeMQTT() {
    return JSON.stringify({
      R: this.r,
      G: this.g,
      B: this.b,
    })
  }

  isOff() {
    return this.r === 0 && this.g === 0 && this.b === 0
  }
}

class Lightbulb extends Service {
  static id = 'LIGHTBULB'

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
    this.#stateRGB.r || 255,
    this.#stateRGB.g || 255,
    this.#stateRGB.b || 255,
  )

  /** @type {Set<Promise<void>>} */
  #tasks = new Set()

  #switchState = false

  getState() {
    return {
      ...this.#stateRGB,
    }
  }

  /**
   *
   * @param {NodeJS.ErrnoException | string | null} err
   */
  #handleError(err) {
    if (err) {
      console.error(err)
    }
  }

  /**
   * @param {string} path
   * @param {string} value
   * @returns {Promise<void>}
   */
  #writeFile(path, value) {
    return new Promise((resolve, reject) => {
      fs.writeFile(path, value, (err) => {
        if (err) reject(err)
        resolve()
      })
    })
  }

  /**
   * @param {string} handle
   * @param {number} from
   * @param {number} to
   */
  async #updateSmooth(handle, from, to) {
    if (to === from) return
    let i = from
    while (i !== to) {
      i = to > from ? i + 1 : i - 1
      try {
        await this.#writeFile(handle, String(i))
      } catch (e) {
        this.#handleError(e)
        i = to
      }
    }
  }

  #updateLEDHardware() {
    Promise.all(this.#tasks).finally(() => {
      const p1 = this.#updateSmooth(this.#handles.r, this.#prevStateRGB.r, this.#stateRGB.r).then(() => this.#tasks.delete(p1))
      this.#tasks.add(p1)
      const p2 = this.#updateSmooth(this.#handles.g, this.#prevStateRGB.g, this.#stateRGB.g).then(() => this.#tasks.delete(p2))
      this.#tasks.add(p2)
      const p3 = this.#updateSmooth(this.#handles.b, this.#prevStateRGB.b, this.#stateRGB.b).then(() => this.#tasks.delete(p3))
      this.#tasks.add(p3)

      this.#prevStateRGB.update(this.#stateRGB)
    })
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
      this.#handleError(e)
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
      this.#handleError(`Unacceptable message: ${message}`)
      return
    }

    /** @type {[number, number, number]} */
    const rgb = [data.r, data.g, data.b]

    if (rgb.includes(null) || rgb.includes(undefined)) {
      this.#handleError(`Unacceptable message: ${message}`)
      return
    }

    if (this.#switchState) {
      this.#stateRGB.update(...rgb)
      this.#updateLEDHardware()
    } else {
      this.#lastStateRGB.update(...rgb)
    }

    this.controller.broadcast('light/rgb', this.#stateRGB.serializeMQTT())
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

    this.#updateLEDHardware()

    this.controller.broadcast('light', this.#switchState ? 'true' : 'false')
  }

  init(controller) {
    controller.on('light/set', this.#handleSwitch.bind(this))
    controller.on('light/rgb/set', this.#handleSetRGB.bind(this))
  }
}

module.exports = { Lightbulb }
