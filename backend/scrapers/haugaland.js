const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let statusText = null
    let courseStatus = 'unknown'
    let drivingRange = 'unknown'

    // The site has two .banestatus elements — one is a broken PHP snippet,
    // the other (in the mobile column) contains the actual plain-text status.
    $('p.banestatus, span.banestatus').each((_i, el) => {
      const text = $(el).text().trim()
      if (!text || text.includes('<?php')) return

      const lower = text.toLowerCase()
      if (lower.includes('åpen') || lower.includes('apen'))  courseStatus = 'open'
      if (lower.includes('stengt')) courseStatus = 'closed'
      if (lower.includes('range') && lower.includes('åpen')) drivingRange = 'open'
      if (lower.includes('range') && lower.includes('stengt')) drivingRange = 'closed'

      if (text.length > 3) statusText = text
      return false // use first valid match only
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }

  } catch (error) {
    console.error(`Haugaland scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
