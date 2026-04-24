const { getBrowser } = require('./browser')

// Norefjell sin side er en React SPA — innholdet rendres av JavaScript
// etter at HTML-en er lastet. Derfor må vi bruke Puppeteer (en ekte nettleser)
// for å kunne lese teksten. Axios + cheerio ville bare sett en tom <div id="root">.
//
// Statusen vises på hovedsiden under seksjonen "OPPDATERT INFO / Baneforhold",
// med teksten "Banen er åpen" eller lignende, etterfulgt av en beskrivelse.
async function scrape(url) {
  let page
  try {
    const browser = await getBrowser()
    page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Vent til statusteksten er rendret av React
    await page.waitForFunction(() => {
      return /banen er (åpen|stengt|vinterstengt)/i.test(document.body.innerText)
    }, { timeout: 8000 }).catch(() => {})

    const bodyText = await page.evaluate(() => document.body.innerText)

    const match = bodyText.match(/banen er (åpen|stengt|vinterstengt)/i)
    if (!match) return { courses: [], drivingRange: 'unknown', statusText: null }

    const isOpen = /åpen/i.test(match[0])
    const courseStatus = isOpen ? 'open' : 'closed'

    // Prøv å plukke beskrivelses-linjen rett etter statusen — den har typisk
    // nyttig info som "Green 1 er allerede fin etter dressing" e.l.
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean)
    const statusLineIndex = lines.findIndex(l => /^banen er (åpen|stengt|vinterstengt)/i.test(l))
    let statusText = null
    if (statusLineIndex >= 0) {
      const nextLine = lines[statusLineIndex + 1]
      if (nextLine && nextLine.length > 20 && nextLine.length < 300) {
        statusText = nextLine
      }
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Norefjell status page scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

module.exports = { scrape }
