const puppeteer = require('puppeteer')

// Vi husker selve oppstarten (et promise), ikke bare den ferdige nettleseren.
// Puppeteer-scraperne kjører parallelt: hvis alle så "ingen nettleser" samtidig,
// ville hver av dem startet sin egen Chrome, og bare én ville blitt lukket.
// Ved å dele samme promise venter de andre på den ene oppstarten som pågår.
let browserPromise = null

// Returns a shared browser instance, launching a new one if needed
async function getBrowser() {
    if (browserPromise) {
        const browser = await browserPromise
        if (browser.isConnected()) return browser
        // Chrome har krasjet — lukk restene og start på nytt under
        try { await browser.close() } catch (_) {}
    }
    browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
    })
    // Feiler oppstarten, glem promiset så neste kall kan prøve igjen
    browserPromise.catch(() => { browserPromise = null })
    return browserPromise
}

// Lukker Chrome når Puppeteer-runden er ferdig, så den ikke ligger og bruker
// minne døgnet rundt. Neste getBrowser() starter en ny.
async function closeBrowser() {
    if (!browserPromise) return
    const promise = browserPromise
    browserPromise = null
    try {
        const browser = await promise
        await browser.close()
    } catch (_) {}
}

module.exports = { getBrowser, closeBrowser }
