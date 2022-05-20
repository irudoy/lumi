const fs = require('fs')

const { Service } = require('../Service.js')

class Siren extends Service {
  static id = 'SIREN'
  init() {
  }
}

module.exports = { Siren }
