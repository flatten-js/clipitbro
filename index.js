require('dotenv').config()

const { program } = require('commander')

const package = require('./package.json')
const Clipitbro = require('./src/clipitbro.js')

const clipitbro = new Clipitbro(process.env)

program.version(package.version)

program
  .argument('<url>')
  .action(async url => await clipitbro.download(url).catch(console.error))

program.parse(process.argv)
