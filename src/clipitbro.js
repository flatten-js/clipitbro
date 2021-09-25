const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Twitter = require('twitter')
const { prompt } = require('enquirer')

const logger = require('./logger.js')

class Clipitbro {
  constructor(env) {
    this.client = this._certification(env)
  }

  _certification(env) {
    return new Twitter({
      consumer_key: env.TWITTER_API_KEY,
      consumer_secret: env.TWITTER_API_SECRET_KEY,
      access_token_key: env.TWITTER_API_TOKEN_KEY,
      access_token_secret: env.TWITTER_API_TOKEN_SECRET_KEY
    })
  }

  extract_id(url) {
    const pattern = /https?:\/\/twitter.com\/\w{1,15}\/status\/(\d+)/
    return (url.match(pattern) || [])[1]
  }

  extract_resolution(url) {
    const pattern = /\/(\d+x\d+)\//
    return (url.match(pattern) || [])[1]
  }

  extract_file(url) {
    const pattern = /\/([\w-]+).mp4\??/
    return (url.match(pattern) || [])[1]
  }

  async select_video(media) {
    const variants = media.video_info?.variants
    if (!variants) return

    const choices = variants.reduce((acc, cur, i) => {
      if (cur.content_type != 'video/mp4') return acc
      const resolution = this.extract_resolution(cur.url)
      const choice = `${resolution}: ${cur.bitrate}`
      return { ...acc, [choice]: cur.url }
    }, {})

    const { answer } = await prompt({
      type: 'select',
      name: 'answer',
      message: 'Select the video you want to download',
      choices: Object.keys(choices).sort((a, b) => {
        const pixel = choice => {
          const re = /(\d+)x(\d+)/
          const [width, height] = choice.match(re).slice(1)
          return width * height
        }
        return pixel(a) - pixel(b)
      })
    })

    return choices[answer]
  }

  async _download(url, options) {
    const { form } = await prompt({
      type: 'form',
      name: 'form',
      message: 'Enter the output destination information:',
      choices: [
        { name: 'dir', message: 'dir' },
        {
          name: 'file',
          message: 'file',
          initial: this.extract_file(url),
          result: f => `${f}.mp4`
        }
      ]
    })

    if (options.mkdir) fs.mkdirSync(form.dir, { recursive: true })
    const output = path.resolve(...Object.values(form))

    const res = await axios.get(url, { responseType: 'stream' })
    const ws = res.data.pipe(fs.createWriteStream(output))

    return new Promise((resolve, reject) => {
      ws.on('error', e => reject(e.message))
      ws.on('finish', () => resolve(`output: ${output}`))
    })
  }

  _success(resolve, url, msg) {
    logger.info('#successful')
    logger.info(`url: ${url}`)
    return resolve(msg)
  }

  _error(reject, url, msg) {
    logger.error('#error')
    logger.error(`url: ${url}`)
    return reject(msg)
  }

  download(url, options) {
    return new Promise(async (resolve, reject) => {
      const success = this._success.bind(this, resolve, url)
      const error = this._error.bind(this, reject, url)

      const id = this.extract_id(url)
      if (!id) return error('An invalid URL was selected.')

      const data = await this.client.get('statuses/lookup', { id })
      if (!data.length) return error('I can\'t find any tweets that match the id.')

      const media = data[0].extended_entities?.media[0]
      if (!media) return error('There is no media in the specified tweet.')

      const video_url = await this.select_video(media)
      if (!video_url) return error('There is no video in the specified tweet.')

      try {
        const msg = await this._download(video_url, options)
        return success(msg)
      } catch (e) {
        return error(e)
      }
    })
  }
}

module.exports = Clipitbro
