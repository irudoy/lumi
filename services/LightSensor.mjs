import fs from 'fs'

import { Service } from '../Service.mjs'

export class LightSensor extends Service {
  static id = 'LIGHT_SENSOR'

  #handle = fs.openSync('/sys/bus/iio/devices/iio:device0/in_voltage5_raw', 'r')

  value = 0

  /**
   * @param {number} value
   */
  #update(value) {
    this.value = value
    this.controller.broadcast('illuminance', String(this.value))
  }

  init() {
    // TODO
    const config = {
      pollInterval: 1000,
      threshold: 50,
    }

    setInterval(() => {
      fs.readFile(this.#handle, (err, data) => {
        if (err) {
          console.error(err)
          return
        }
        const newValue = parseInt(data.toString(), 10)
        if (Math.abs(newValue - this.value) > config.threshold) {
          this.#update(newValue)
        }
      })
    }, config.pollInterval)
  }
}
