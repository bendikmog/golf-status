const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    // Status lives on a dedicated subpage
    const statusUrl = url.replace(/\/?$/, '') + '/banen-2/banen.html'
    const response = await axios.get(statusUrl, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    // One.com CMS: status text in <p class="mobile-undersized-upper"> inside text components
    // Also look at general paragraph text for ÅPEN/STENGT
    const candidates = $('p.mobile-undersized-upper, p strong, h3, p').toArray()

    for (const el of candidates) {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const upper = text.toUpperCase()

      if (upper.includes('STENGT') || upper.includes('ÅPEN') || upper.includes('APEN')) {
        const lower = text.toLowerCase()
        if (lower.includes('åpen') || lower.includes('apen')) courseStatus = 'open'
        else if (lower.includes('stengt')) courseStatus = 'closed'

        if (text.length > 5 && !statusText) statusText = text
        break
      }
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Sirdal scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
