const puppeteer = require('puppeteer')

let browser = null

// Returns a shared browser instance, launching a new one if needed
async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        if (browser) {
            try { await browser.close() } catch (_) {}
        }
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox'],
        })
    }
    return browser
}

module.exports = { getBrowser }
