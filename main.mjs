import { Controller } from './Controller.mjs'
import { Lightbulb } from './services/Lightbulb.mjs'
import { LightSensor } from './services/LightSensor.mjs'
import { Button } from './services/Button.mjs'
import { Siren } from './services/Siren.mjs'

new Controller([
  new Lightbulb(),
  new LightSensor(),
  new Button(),
  new Siren(),
])
