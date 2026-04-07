const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Hof has a topbar with "BANESTATUS: STENGT FOR SESONGEN" or "BANESTATUS: ÅPEN"
    // It appears on all pages in the header/topbar
    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Find the banestatus topbar element
    $('li, span, div, p').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (!text.toLowerCase().startsWith('banestatus:')) return

      const lower = text.toLowerCase()
      const courseOpen   = (lower.includes('åpen') || lower.includes('open')) && !lower.includes('stengt')
      const courseClosed = lower.includes('stengt') || lower.includes('sesongen')

      courseStatus = courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'

      // Show as note
      statusText = text.replace(/banestatus:\s*/i, '').trim()
      return false
    })

    // Also check latest news post for range info
    $('h2 a, h3 a').each((i, el) => {
      const text = $(el).text().trim().toLowerCase()
      if (!rangeStatus !== 'unknown') return
      if (text.includes('drivingrange åpner') || text.includes('range åpner')) {
        rangeStatus = 'closed' // åpner = not open yet
      }
      if (text.includes('drivingrange åpen') || text.includes('range åpen') ||
          text.includes('drivingrange open') || text.includes('range open')) {
        rangeStatus = 'open'
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Hof scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }