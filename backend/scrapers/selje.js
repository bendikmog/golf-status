const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let drivingRange = 'unknown'
    let statusText = null

    // Selje posts status in an h3.claim element:
    // "Banestatus: Stengt p.g.a store mengder nedbør! Driving Range må også holdes stengt."
    $('h1, h2, h3, h4, p').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()
      if (!lower.includes('banestatus')) return

      const afterColon = lower.includes(':') ? lower.split(':').slice(1).join(':') : lower

      if (afterColon.includes('stengt')) courseStatus = 'closed'
      else if (afterColon.includes('åpen') || afterColon.includes('apen') || afterColon.includes('open')) courseStatus = 'open'

      if (lower.includes('driving range') || lower.includes('rangen')) {
        if (lower.includes('range') && lower.includes('stengt')) drivingRange = 'closed'
        else if (lower.includes('range') && (lower.includes('åpen') || lower.includes('open'))) drivingRange = 'open'
      }

      if (text.length > 10) statusText = text
      return false
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }

  } catch (error) {
    console.error(`Selje scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
