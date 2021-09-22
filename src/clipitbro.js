const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Twitter = require('twitter')
const { prompt } = require('enquirer')

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
      choices: Object.keys(choices)
    })

    return choices[answer]
  }

  async _download(url) {
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

    const output = path.resolve(...Object.values(form))

    const res = await axios.get(url, { responseType: 'stream' })
    const ws = res.data.pipe(fs.createWriteStream(output))

    return new Promise((resolve, reject) => {
      ws.on('error', e => reject(e.message))

      ws.on('finish', () => {
        console.log(`Successfully downloaded ${output}`)
        resolve()
      })
    })
  }

  download(url) {
    return new Promise(async (resolve, reject) => {
      const id = this.extract_id(url)
      if (!id) return reject('An invalid URL was selected.')

      const data = await this.client.get('statuses/lookup', { id })
      if (!data.length) return reject('I can\'t find any tweets that match the id.')

      const video_url = await this.select_video(data[0].extended_entities.media[0])
      if (!video_url) return reject('There is no video in the specified tweet.')

      await this._download(video_url).catch(reject)

      return resolve()
    })
  }
}

module.exports = Clipitbro
