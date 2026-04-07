const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    const courses = []
    let drivingRange = 'unknown'

    // Sunnfjord uses Elementor progress bars for status on the homepage:
    // <span class="elementor-progress-text">BANE: STENGT</span>
    $('span.elementor-progress-text').each((_i, el) => {
      const text  = $(el).text().replace(/\s+/g, ' ').trim()
      const colon = text.indexOf(':')
      if (colon === -1) return

      const label  = text.slice(0, colon).trim().toLowerCase()
      const value  = text.slice(colon + 1).trim().toLowerCase()
      const isOpen   = value.includes('open') || value.includes('åpen') || value.includes('apen')
      const isClosed = value.includes('stengt') || value.includes('closed')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label.includes('range') || label.includes('driving')) {
        drivingRange = status
      } else if (label.includes('bane') || label.includes('hull') || label.includes('simulator')) {
        const raw = text.slice(0, colon).trim().toLowerCase()
        const name = raw.charAt(0).toUpperCase() + raw.slice(1)
        courses.push({ name, status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Sunnfjord scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
