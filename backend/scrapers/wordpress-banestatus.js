const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // ============================================
    // PRIMARY: Banestatus widget — used for badges
    // This is the permanent status field maintained
    // throughout the season
    // ============================================

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'

    // Primary: look for a "Banestatus" h3 widget with structured open/closed text
    $('h3').each((i, el) => {
      if ($(el).text().trim().toLowerCase() === 'banestatus') {
        const parent = $(el).parent()
        const text = parent.text().replace($(el).text(), '').toLowerCase().trim()

        const courseOpen   = text.includes('banen: åpen') || text.includes('banen åpen') || text.includes('banen er åpen')
        const courseClosed = text.includes('banen: stengt') || text.includes('banen stengt') || text.includes('banen er stengt')
        const rangeOpen    = text.includes('driving range åpen') || text.includes('driving range: åpen') || text.includes('rangen åpen')
        const rangeClosed  = text.includes('driving range stengt') || text.includes('driving range: stengt') || text.includes('rangen stengt')

        if (courseOpen || courseClosed) courseStatus = courseOpen ? 'open' : 'closed'
        if (rangeOpen || rangeClosed)   rangeStatus  = rangeOpen  ? 'open' : 'closed'
      }
    })

    // Fallback: scan all headings for plain "åpen"/"stengt" keywords.
    // Handles sites like ugk.no where status is written as a standalone h1, e.g. "Banen er stengt."
    if (courseStatus === 'unknown') {
      $('h1, h2, h3, h4').each((_i, el) => {
        const text = $(el).text().trim().toLowerCase()
        if (text.includes('banen er åpen') || text.includes('banen åpen')) courseStatus = 'open'
        else if (text.includes('banen er stengt') || text.includes('banen stengt')) courseStatus = 'closed'
      })
    }

    // ============================================
    // SECONDARY: Hero/header text — used as note
    // This is a temporary message that changes often
    // Only show it if it contains relevant golf info
    // ============================================

    let statusText = null
    const heroEl = $('.kadcaptiontext p, .site-description, [class*="caption"] p')
    if (heroEl.length > 0) {
      const heroText = heroEl.first().text().trim()
      const lower = heroText.toLowerCase()

      // Only use as note if it contains relevant status info
      const isRelevant = lower.includes('åpen') ||
                         lower.includes('stengt') ||
                         lower.includes('åpner') ||
                         lower.includes('stenger') ||
                         lower.includes('banen') ||
                         lower.includes('range')

      if (isRelevant && heroText.length > 5) {
        statusText = heroText
      }
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`WordPress banestatus scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }