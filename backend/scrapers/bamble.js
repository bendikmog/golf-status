const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const https = require('https')
    const response = await axios.get(url, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Find all text-editor widgets and look for status info
    $('p, .elementor-widget-text-editor div').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.length < 10 || text.length > 400) return

      const lower = text.toLowerCase()

      // Only process if it contains relevant keywords
      if (!lower.includes('banen') && !lower.includes('range') && !lower.includes('rang')) return

      const courseOpen   = lower.includes('bane åpen') || lower.includes('banen åpen') || lower.includes('banen er åpen')
      const courseClosed = lower.includes('banen stengt') || lower.includes('banen er stengt')
      const rangeOpen    = lower.includes('rangen åpen') || lower.includes('range åpen') || lower.includes('rangen er åpen')
      const rangeClosed  = lower.includes('rangen stengt') || lower.includes('rangen er stengt') ||
                           lower.includes('rangen tengt') || lower.includes('range stengt')  // catches typos too

      if (courseOpen || courseClosed) courseStatus = courseOpen ? 'open' : 'closed'
      if (rangeOpen || rangeClosed) rangeStatus = rangeOpen ? 'open' : 'closed'

      // Use as note if meaningful
      if (!statusText && text.length > 20) statusText = text
      return false
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Bamble scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }