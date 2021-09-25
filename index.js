require('dotenv').config()

const { program } = require('commander')

const package = require('./package.json')
const Clipitbro = require('./src/clipitbro.js')
const logger = require('./src/logger.js')

const clipitbro = new Clipitbro(process.env)

program.version(package.version)

program
  .argument('<url>')
  .option('-m, --mkdir', 'Automatically created when the directory specified in the output destination does not exist')
  .action((url, options) => {
    clipitbro.download(url, options)
    .then(msg => logger.info(msg))
    .catch(e => logger.error(e))
  })

program.parse(process.argv)
