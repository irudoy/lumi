/**
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * @param {(NodeJS.ErrnoException | string | null)[]} args
 */
export function handleError(...args) {
  if (args[0]) {
    console.log(...args)
  }
}

export class RGB {
  /** @type {number} */
  r
  /** @type {number} */
  g
  /** @type {number} */
  b

  /**
   * @param {number} r
   * @param {number} g
   * @param {number} b
   */
  constructor(r, g, b) {
    this.update(r, g, b)
  }

  /**
   * @param {unknown} v
   * @returns {number}
   */
  #validate(v) {
    if (typeof v !== 'number' || Number.isNaN(v)) {
      throw new Error(`Invalid RGB value: ${v}`)
    }
    return /** @type {number} */ (v)
  }

  /**
   * @param  {[number, number, number] | [RGB]} args
   */
  update(...args) {
    const [rgb] = args
    const [r, g, b] = args
    if (rgb instanceof RGB) {
      this.r = rgb.r
      this.g = rgb.g
      this.b = rgb.b
    } else {
      this.r = this.#validate(r)
      this.g = this.#validate(g)
      this.b = this.#validate(b)
    }
  }

  /**
   * @returns {[number, number, number]}
   */
  toArray() {
    return [this.r, this.g, this.b]
  }

  toString() {
    return `rgb(${this.r}, ${this.g}, ${this.b})`
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
