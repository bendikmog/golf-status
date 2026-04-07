const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Sandefjord has a div.status-main with "Banen: Stengt" etc.
    const statusBlock = $('.status-main')
    if (statusBlock.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const text = statusBlock.text().replace(/\s+/g, ' ').trim()
    const lower = text.toLowerCase()

    const courseOpen   = lower.includes('banen: åpen') || lower.includes('banen:åpen') ||
                         lower.includes('banen: open') || lower.includes('banen:open')
    const courseClosed = lower.includes('banen: stengt') || lower.includes('banen:stengt') ||
                         lower.includes('banen: åpner')

    const rangeOpen    = lower.includes('driving range: åpen') || lower.includes('driving range:åpen') ||
                         lower.includes('driving range: open') || lower.includes('driving range:open')
    const rangeClosed  = lower.includes('driving range: stengt') || lower.includes('driving range:stengt') ||
                         lower.includes('driving range: åpner')

    return {
      courses: [{ name: 'Golfbanen', status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText: null,
    }

  } catch (error) {
    console.error(`Sandefjord scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }