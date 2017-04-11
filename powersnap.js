#!/usr/bin/env node

const program = require("commander")
const Promise = require("bluebird")
const chalk = require("chalk")
const fs = require("fs")
const crypto = require("crypto")
const screenshot = require("./src/screenshot")
const path = require("path")
const util = require("util")

function validateDir(dir) {
  if(!fs.existsSync(dir)) {
    process.stdout.write(chalk.bold.red(`ERROR: Directory '${dir}' does not exist!\n`))
    process.exit(1)
  }
  return dir
}

function log(message, color) {
  if(program.silent || (program.json && color !== JSON.stringify)) { return }
  if(color) {
    process.stdout.write(`${color(message)}\n`)
  }else{
    process.stdout.write(`${message}\n`)
  }
}

program
  .version("1.2.0")
  .usage("[options] <url ...>")
  .arguments("[urls...]")
  .option("-w, --width <width>", "device width", "600")
  .option("-h, --height <height>", "device height", "900")
  .option("-p, --page", "capture full page", false)
  .option("-z, --zoom <zoom>", "zoom factor", "1.0")
  .option("-c, --css <css>", "css file", null)
  .option("-t, --format <format>", "format", "jpeg")
  .option("-q, --quality <format>", "quality", "90")
  .option("-d, --dir <dir>", "target directory", validateDir, ".")
  .option("-f, --file <file>", "output file pattern", "screenshot-{md5}-{width}x{height}.png")
  .option("-s, --silent", "silent mode (no output)", false)
  .option("-j, --json", "return json output", false)
  .action((urls) => {
    // Validation
    if(!program.file) {
      log(`No output file specified...`, chalk.bold.red)
      program.outputHelp()
      return
    }

    // Generate md5 hashes
    const md5s = urls.map(url => crypto.createHash("md5").update(url).digest("hex"))

    // Generate filenames
    const filenames = urls.map((url, index) => {
      let filename = program.file
      filename = filename.replace("{index}", index + 1)
      filename = filename.replace("{width}", program.width)
      filename = filename.replace("{height}", program.height)
      filename = filename.replace("{md5}", md5s[index])
      filename = filename.replace("{basename}", path.basename(url, ".html"))
      return filename
    })

    // Run Screenshot Genearator

    message = util.format("Generating %s screenshot(s) to '%s' (%sx%s)",
      urls.length,
      program.file,
      program.width,
      program.height
    )
    log(message, chalk.bold.blue)

    // Inject CSS
    let css = "body{ background:#FFFFFF !important;}::-webkit-scrollbar{opacity:0 !important;display: none !important;}"
    if(program.css != null) {
      css += fs.readFileSync(program.css, { encoding: "utf-8" })
    }

    screenshot.scale(urls.length)
    Promise.all(urls.map((url, index) => {
      log(`▸ Generating screenshot for '${url}' to '${program.dir}/${filenames[index]}'`)
      return screenshot.start({
        url,
        format: program.format,
        quality: parseInt(program.quality, 10),
        width: parseInt(program.width, 10),
        height: parseInt(program.height, 10),
        page: program.page,
        zoom: parseFloat(program.zoom),
        css
      })
    })).then((images) => {
      images.forEach((image, index) => {
        fs.writeFileSync(`${program.dir}/${filenames[index]}`, image.data)
      })
      log("▸ All screenshots complete", chalk.bold.green)

      if(program.json) {
        log({ status: "success", urls: urls.map((url, index) => ({
          url,
          md5: md5s[index],
          filename: filenames[index],
          index: index + 1,
          width: program.width,
          height: program.height
        })) }, JSON.stringify)
      }
    }).catch((err) => {
      log(err.message, chalk.bold.red)
      if(program.json) {
        log({ status: "error", error: err.message }, JSON.stringify)
      }
    }).finally(() => {
      screenshot.close()
    })
  })
  .parse(process.argv)

if(program.args.length === 0) {
  program.outputHelp()
}
