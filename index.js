const path = require('path')
const fs = require('fs')
const puppeteer = require('puppeteer');

(async () => {
  // NORMAL HEADLESS LAUNCH DISABLES GPU
  // WORK-AROUND IS TO LAUNCH NON-HEADLESS
  // THEN SWITCH TO HEADLESS AGAIN WITH COMMAND LINE ARGS
  // https://github.com/GoogleChrome/puppeteer/issues/1260#issuecomment-348878456
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--headless',
      '--hide-scrollbars',
      '--mute-audio'
    ]
  })
  const page = await browser.newPage()
  await page.goto(`file:${path.join(__dirname, 'index.html')}`)

  // `nglReady` SET IN PAGE JS WHEN STAGE `loadFile` PROMISE RESOLVES
  // NGL `stage` OBJECT ADDED TO `window` IN PAGE JS
  await page.waitForFunction('typeof window.nglReady !== "undefined"')
  await page.waitForFunction('window.nglReady === true')
  await page.waitForFunction('window.stage.tasks.count === 0')

  const windowHandle = await page.evaluateHandle(() => Promise.resolve(window))

  const blob = await page.evaluate(window => {
    // WRAP BROWSER `FileReader` IN A PROMISE TO BE ASYNC/AWAIT FRIENDLY
    async function blobToBinaryString (blob, window) {
      return new Promise((resolve, reject) => {
        let reader = new window.FileReader()
        let binaryString = null
        reader.onloadend = () => {
          binaryString = reader.result
          resolve(binaryString)
        }
        reader.readAsBinaryString(blob)
      })
    }

    return Promise.resolve(
      window.stage.makeImage({
        factor: 2,
        type: 'image/png',
        antialias: true,
        transparent: true,
        trim: true
      }).then(blob => {
        console.log('NGL screenshot generated')
        return blobToBinaryString(blob, window)
      }).catch(error => {
        console.error(error)
        console.error('Could not produce screenshot')
        return error
      })
    )
  }, windowHandle)

  fs.writeFile('screenshot.png', blob, 'binary', err => {
    if (err) {
      console.error('Error writing screenshot image')
      throw err
    }
  })

  await browser.close()
})()
