const path = require("path")
const axon = require("axon")
const spawn = require("cross-spawn")
const electronpath = require("electron")

const app = path.join(__dirname, "../")
const sock = axon.socket("req")

let bindSocketPromise
function bindSocket() {
  if(bindSocketPromise) {
    return bindSocketPromise
  }
  bindSocketPromise = new Promise((resolve) => {
    sock.bind(0, "localhost", () => {
      process.env.ELECTRON_SCREENSHOT_PORT = sock.server.address().port
      resolve()
    })
  })
  return bindSocketPromise
}

module.exports = {
  count: 0,

  start(options) {
    if(this.count === 0) {
      return this.createBrowser().then(screenshot.bind(null, options))
    }

    return new Promise((resolve, reject) => {
      options.delay = options.delay || 0

      if(!options.width || !options.height) {
        reject(new Error("At least `height` and `width` must be set"))
        return
      }

      if(options.crop) {
        if(!options.crop.x) {
          options.crop.x = 0
        }
        if(!options.crop.y) {
          options.crop.y = 0
        }
        if(!options.crop.width || !options.crop.height) {
          reject(new Error("In crop, at least `height` and `width` must be set"))
          return
        }
      }

      sock.send("take-screenshot", options, (error, img) => {
        if(error) {
          reject(new Error(error))
          return
        }
        // Make axon data a real buffer again
        img.data = new Buffer(img.data.data)
        resolve(img)
      })
    })
  },

  createBrowser() {
    const self = this
    this.count += 1
    return bindSocket().then(() => {
      spawn(electronpath, ["src/screenshot-service.js"], { cwd: app }).once("close", () => {
        self.count -= 1
      })
    })
  },

  close() {
    this.closeAll()
  },

  closeAll() {
    for(let i = 0; i < this.count; i += 1) {
      sock.send("close")
    }
    sock.close()
    bindSocketPromise = undefined
    this.count = 0
  },

  scale(scale) {
    const browserChange = scale - this.count
    if(browserChange < 0) {
      for(let i = 0; i < -browserChange; i += 1) {
        this.close()
      }
    }else{
      for(let b = 0; b < browserChange; b += 1) {
        this.createBrowser()
      }
    }
  }
}

process.on("exit", module.exports.close.bind(module.exports))
