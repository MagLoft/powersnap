#!/usr/bin/env node
'use strict'
var program = require('commander')
var Promise = require('bluebird');
var chalk = require('chalk')
var fs = require("fs")
var crypto = require('crypto');
var screenshot = require('electron-screenshot-service')

function validateDir(dir) {
  if(!fs.existsSync(dir)) {
    console.error(chalk.bold.red(`ERROR: Directory '${dir}' does not exist!`))
    process.exit(1)
  }
  return dir
}

function log(message, color) {
  if(program.silent || (program.json && color != JSON.stringify)) {return}
  if(color) {
    console.log(color(message))
  }else{
    console.log(message)
  }
}

program
  .version("1.0.0")
  .usage('[options] <url ...>')
  .arguments('[urls...]')
  .option('-w, --width <width>', 'device width', parseInt, 600)
  .option('-h, --height <height>', 'device height', parseInt, 900)
  .option('-d, --dir <dir>', 'target directory', validateDir, ".")
  .option('-f, --file <file>', 'output file pattern', "screenshot-{md5}-{width}x{height}.png")
  .option('-s, --silent', 'silent mode (no output)', false)
  .option('-j, --json', 'return json output', false)
  .action(function(urls) {
    
    // Validation
    if(!program.file) {
      log(`No output file specified...`, chalk.bold.red)
      program.outputHelp()
      return
    }
    
    // Generate md5 hashes
    let md5s = urls.map(function(url) {
      return crypto.createHash('md5').update(url).digest('hex')
    })
    
    // Generate filenames
    let filenames = urls.map(function(url, index) {
      let filename = program.file
      filename = filename.replace("{index}", index+1)
      filename = filename.replace("{width}", program.width)
      filename = filename.replace("{height}", program.height)
      filename = filename.replace("{md5}", md5s[index])
      return filename
    })
    
    // Run Screenshot Genearator
    log(`Generating ${urls.length} screenshot${urls.length == 1 ? '' : 's'} to '${program.file}' (${program.width}x${program.height})`, chalk.bold.blue)
    
    screenshot.scale(urls.length)
    Promise.all(urls.map(function(url, index) {
      log(`▸ Generating screenshot for '${url}' to '${program.dir}/${filenames[index]}'`)
    	return screenshot({
    		url: url,
    		width: program.width,
    		height: program.height
    	})
    })).then(function (images) {
    	images.forEach(function (image, index) {
    		fs.writeFileSync(`${program.dir}/${filenames[index]}`, image.data)
    	})
      log("▸ All screenshots complete", chalk.bold.green)
      
      if(program.json) {
        log({status: "success", urls: urls.map(function(url, index) {
          return {url: url, md5: md5s[index], filename: filenames[index], index: index+1, width: program.width, height: program.height};
        })}, JSON.stringify)
      }
    }).catch(function (err) {
      log(err.message, chalk.bold.red)
      if(program.json) {
        log({status: "error", error: err.message}, JSON.stringify)
      }
    }).finally(function(results) {
      screenshot.close()
    })
    
    return
  })
  .parse(process.argv)

if (program.args.length == 0) {
  program.outputHelp()
}
