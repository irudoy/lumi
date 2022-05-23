import fs from 'fs'

import { Service } from '../Service.mjs'

export class Button extends Service {
  static id = 'BUTTON'
  static topicGet = 'button'

  #path = '/dev/input/event0'

  init() {
    // TODO
    const config = {
      clickDuration: 300,
    }

    let t0 = 0
    let t1 = 0
    /** @type {NodeJS.Timer} */
    let timer = null
    let value = 0

    /** @type {(value: number) => void} */
    const publish = (value) => this.controller.broadcast(Button.topicGet, String(value))

    this.controller.on('connect', () => this.controller.broadcast(Button.topicGet, '0'))

    const stream = fs.createReadStream(this.#path, {
      flags: 'r',
      encoding: null,
      fd: null,
      autoClose: true,
    })

    stream.on('data', (/** @type {Buffer} */ buf) => {
      for (let i = 0; i < buf.length; i += 16) {
        const event = {
          tssec: buf.readUInt32LE(i),
          tsusec: buf.readUInt32LE(i + 4),
          type: buf.readUInt16LE(i + 8),
          code: buf.readUInt16LE(i + 10),
          value: buf.readUInt32LE(i + 12),
        }

        t1 = +new Date()

        if (event.value === 1) {
          clearTimeout(timer)

          if ((t1 - t0) < config.clickDuration) {
            value++
          } else {
            value = 1
          }

          t0 = t1

          timer = setTimeout(() => publish(value), config.clickDuration);
        }
      }
    })

    stream.on('error', e => console.error(e))
  }
}
