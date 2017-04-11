const { app } = require("electron")
const screenshot = require("./screenshot-app")
const sock = require("axon").socket("rep")

const terminate = () => {
  app.quit()
}

const port = process.env.ELECTRON_SCREENSHOT_PORT || "21823"
sock.connect(parseInt(port, 10), process.env.HOST || "localhost")

app.on("window-all-closed", () => {})
app.on("ready", () => {
  if(process.platform === "darwin" && app.dock.hide !== undefined) {
    app.dock.hide()
  }

  sock.on("message", (task, options, reply) => {
    switch (task) {
    case "take-screenshot" :
      screenshot(
          options,
          (err, data, cleanup) => reply(err ? err.message : null, data, cleanup)
        )
      break
    case "close" :
      terminate()
      break
    default:
    }
  })
})
