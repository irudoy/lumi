import EventEmitter from 'events'
import mqtt from 'mqtt'
import os from 'os'

import { handleError } from './helpers.mjs'

const mac = os.networkInterfaces().wlan0[0].mac.replace(/:/g, '').toUpperCase()

/** @typedef {import('./Service.mjs').Service} Service */
/** @typedef {import('mqtt').Client} MQTTClient */
/** @typedef {import('mqtt').IClientPublishOptions} MQTTClientPublishOptions */

export class Controller extends EventEmitter {
  /** @type {Map<string, Service>} */
  #servicesMap = new Map()

  /** @type {MQTTClient} */
  #client

  #rootTopic = `lumi_${mac}`

  /**
   * @param {Service[]} services
   */
  constructor(services) {
    super()

    console.log('Starting Lumi...')

    console.log('Connecting to the MQTT broker')

    this.#client = mqtt.connect('mqtt://192.168.1.63', {
      port: 44444,
      keepalive: 60,
      reconnectPeriod: 1000,
      clean: true,
      will: {
        topic: `${this.#rootTopic}/state`,
        payload: 'offline',
        qos: 1,
        retain: true,
      },
    })

    this.#client.on('connect', () => {
      console.log('MQTT Connected successfully')
      this.#client.subscribe([`${this.#rootTopic}/+/set`, `${this.#rootTopic}/+/+/set`], (err, granted) => {
        if (err) {
          handleError(err)
          return
        }
        console.log('Subscription granted', granted)
        this.broadcast('state', 'online', { retain: true })
        this.emit('connect')
      })
    })

    this.#client.on('error', handleError)

    this.#client.on('message', (topic, message) => {
      console.log(`-> Got message \`${message}\` for topic \`${topic}\``)
      this.emit(topic.replace(new RegExp(`^${this.#rootTopic}/`), ''), message.toString())
    })

    services.forEach((service) => {
      const { id } = service
      if (id === undefined) throw new Error('Service should have an ID')
      if (this.#servicesMap.has(id)) throw new Error(`Duplicated ID: ${id}`)
      this.#servicesMap.set(id, service.register(this))
      service.init()
    })
  }

  /**
   *
   * @param {string} topic
   * @param {string} message
   * @param {MQTTClientPublishOptions} options
   */
  broadcast(topic, message, options = {}) {
    this.#client.publish(`${this.#rootTopic}/${topic}`, message, options, (err) => {
      if (err) handleError('Publish failed', err)
      console.log(`<- Sent message \`${message}\` for topic \`${this.#rootTopic}/${topic}\``)
    })
  }

  /**
   * @param {string} id
   */
  getService(id) {
    return this.#servicesMap.get(id)
  }

  getAllServices() {
    return this.#servicesMap.values()
  }
}
