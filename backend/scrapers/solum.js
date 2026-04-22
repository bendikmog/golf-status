const { getBrowser } = require('./browser')

async function scrape(url) {
  let page
  try {
    const browser = await getBrowser()
    page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Wix gjengir teksten på klientsiden, så vi venter til "BANEN ER …" dukker opp
    await page.waitForFunction(() => {
      return /BANEN ER (ÅPEN|STENGT)/i.test(document.body.innerText)
    }, { timeout: 8000 }).catch(() => {})

    const statusText = await page.evaluate(() => {
      const match = document.body.innerText.match(/BANEN ER (ÅPEN|STENGT)/i)
      return match ? match[0] : null
    })

    if (!statusText) return { courses: [], drivingRange: 'unknown', statusText: null }

    const isOpen = /ÅPEN/i.test(statusText)
    const status = isOpen ? 'open' : 'closed'

    return {
      courses: [{ name: 'Golfbanen', status }],
      drivingRange: 'unknown',
      statusText: null,
    }

  } catch (error) {
    console.error(`Solum scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

module.exports = { scrape }
