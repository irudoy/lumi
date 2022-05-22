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
 * @param {NodeJS.ErrnoException | string | null} err
 */
export function handleError(err) {
  if (err) {
    console.error(err)
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
      this.r = /** @type {number} */ (r)
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
