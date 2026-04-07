const axios = require('axios')
const cheerio = require('cheerio')
const { scrapeGlfr } = require('./glfr')

async function scrape(url) {
  // Primary: GLFR API
  try {
    const result = await scrapeGlfr('herdla-golfklubb')
    if (result && result.courses.length > 0 && result.courses[0].status !== 'unknown') {
      return result
    }
  } catch (_e) {
    // GLFR unavailable — fall through to HTML scrape
  }

  // Fallback: scrape homepage og:description and headings
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    const ogDesc = ($('meta[property="og:description"]').attr('content') || '').replace(/\s+/g, ' ').trim()
    const ogLower = ogDesc.toLowerCase()
    if (ogLower.includes('åpen') || ogLower.includes('apen') || ogLower.includes('open')) courseStatus = 'open'
    else if (ogLower.includes('stengt') || ogLower.includes('closed')) courseStatus = 'closed'
    if (ogDesc.length > 5 && ogDesc.length < 120 && courseStatus !== 'unknown') statusText = ogDesc

    if (courseStatus === 'unknown') {
      $('h1, h2, h3, h4, p').each((_i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase()
        if (text.includes('åpen') || text.includes('apen') || text.includes('open')) { courseStatus = 'open'; return false }
        if (text.includes('stengt') || text.includes('closed')) { courseStatus = 'closed'; return false }
      })
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }
  } catch (error) {
    console.error(`Herdla scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
