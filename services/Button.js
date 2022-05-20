const fs = require('fs')

const { Service } = require('../Service.js')

class Button extends Service {
  static id = 'BUTTON'

  #handle = '/dev/input/event0'

  init() {
    let t0 = 0
    let t1 = 0
    let timer = null
    let value = 0

    const publish = (value) => this.controller.broadcast('button', String(value))

    const config = {
      clickDuration: 300,
    }

    const stream = fs.createReadStream(this.#handle, {
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

module.exports = { Button }
