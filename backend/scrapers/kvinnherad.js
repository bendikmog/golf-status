const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const baneUrl = url.replace(/\/?$/, '') + '/bane/'
    const response = await axios.get(baneUrl, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    // Scan all text on the page — Kvinnherad has "Banen er OPEN" / "Undarheim golfbane er STENGD"
    // in elements that may not be standard headings/paragraphs
    const fullText = $('body').text().replace(/\s+/g, ' ')
    const lower = fullText.toLowerCase()

    // "Banen er OPEN/STENGD/STENGT" — Norwegian Nynorsk uses STENGD
    const openMatch   = lower.match(/\b(banen?|bana|undarheim golfbane)\s+er\s+(open|åpen|apen)\b/)
    const closedMatch = lower.match(/\b(banen?|bana|undarheim golfbane)\s+er\s+(stengt|stengd|closed)\b/)

    if (openMatch)   { courseStatus = 'open';   statusText = openMatch[0] }
    if (closedMatch) { courseStatus = 'closed';  statusText = closedMatch[0] }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Kvinnherad scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
