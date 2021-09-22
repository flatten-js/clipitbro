const log4js = require('log4js')

const logger = log4js.getLogger()
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    app: { type: 'file', filename: '.activity.log' }
  },
  categories: {
    default: { appenders: ['out', 'app'], level: 'all' }
  }
})

module.exports = logger
