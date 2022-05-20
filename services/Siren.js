const fs = require('fs')

const { Service } = require('../Service.js')

class Siren extends Service {
  static id = 'SIREN'
  init() {
    this.controller.on('topic', time => console.log({ time }))
  }
}

module.exports = { Siren }
