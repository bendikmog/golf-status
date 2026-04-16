const axios = require('axios')
const cheerio = require('cheerio')
const { getBrowser } = require('./browser')

async function scrape(url) {
  // Primary: Puppeteer to render Wix /dagens-status page
  let page = null
  try {
    const browser = await getBrowser()
    page = await browser.newPage()
    const statusUrl = url.replace(/\/?$/, '') + '/dagens-status'
    await page.goto(statusUrl, { waitUntil: 'networkidle2', timeout: 20000 })

    const { courses, drivingRange } = await page.evaluate(() => {
      const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.includes(':'))
      const courses = []
      let drivingRange = 'unknown'

      for (const line of lines) {
        const colon = line.indexOf(':')
        if (colon === -1) continue
        const label  = line.slice(0, colon).trim()
        const rest   = line.slice(colon + 1).trim().toLowerCase()
        const isOpen   = rest.includes('åpen') || rest.includes('open') || rest.includes('apen')
        const isClosed = rest.includes('stengt') || rest.includes('closed')
        if (!isOpen && !isClosed) continue

        const status = isOpen ? 'open' : 'closed'
        const labelLower = label.toLowerCase()

        const skip = labelLower.includes('simulator') ||
                     labelLower.includes('lørdag') ||
                     labelLower.includes('søndag') ||
                     labelLower.includes('mandag') ||
                     labelLower.includes('tirsdag') ||
                     labelLower.includes('onsdag') ||
                     labelLower.includes('torsdag') ||
                     labelLower.includes('fredag')
        if (skip) continue

        if (labelLower.includes('driving range') || labelLower.includes('range')) {
          drivingRange = status
        } else {
          courses.push({ name: label, status })
        }
      }

      return { courses, drivingRange }
    })

    if (courses.length > 0) {
      return { courses, drivingRange, statusText: null }
    }
  } catch (e) {
    console.error(`Bergen Puppeteer scrape failed:`, e.message)
  } finally {
    if (page) await page.close().catch(() => {})
  }

  // Fallback: blog RSS feed (current year only)
  try {
    const feedRes = await axios.get(url.replace(/\/?$/, '') + '/blog-feed.xml', { timeout: 25000 })
    const $ = cheerio.load(feedRes.data, { xmlMode: true })

    const currentYear = new Date().getFullYear()
    let courseStatus = 'unknown'
    let drivingRange = 'unknown'
    let statusText = null

    $('item').each((_i, el) => {
      const pubDate = $(el).find('pubDate').text().trim()
      if (pubDate && new Date(pubDate).getFullYear() !== currentYear) return

      const title   = $(el).find('title').text().trim()
      const content = $(el).find('description, encoded').first().text()
      const combined = (title + ' ' + content).toLowerCase()

      if ((combined.includes('bane') || combined.includes('bana')) && courseStatus === 'unknown') {
        const isOpen   = combined.includes('åpen') || combined.includes('åpner') || combined.includes('apen')
        const isClosed = combined.includes('stengt') || combined.includes('stenger')
        if (isOpen && !isClosed)   { courseStatus = 'open';   statusText = title }
        else if (isClosed && !isOpen) { courseStatus = 'closed'; statusText = title }
      }

      if ((combined.includes('driving range') || combined.includes('rangen')) && drivingRange === 'unknown') {
        if (combined.includes('åpen')) drivingRange = 'open'
        else if (combined.includes('stengt')) drivingRange = 'closed'
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }
  } catch (error) {
    console.error(`Bergen RSS scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
