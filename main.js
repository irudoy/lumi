const { Controller } = require('./Controller.js')

const { Lightbulb } = require('./services/Lightbulb.js')
const { LightSensor } = require('./services/LightSensor.js')
const { Button } = require('./services/Button.js')
const { Siren } = require('./services/Siren.js')

new Controller([
  new Lightbulb(),
  new LightSensor(),
  new Button(),
  new Siren(),
])
