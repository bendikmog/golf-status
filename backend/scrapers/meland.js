const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const statusUrl = url.replace(/\/?$/, '') + '/banestatus'
    const response = await axios.get(statusUrl, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    const courses = []
    let drivingRange = 'unknown'

    // Meland Squarespace: status items in a <ul> on /banestatus
    // Each <li> is "Facilitet STATUS" or "Facilitet: STATUS"
    $('ul li').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      const isOpen   = lower.includes('åpen') || lower.includes('apen') || lower.includes('open')
      const isClosed = lower.includes('stengt') || lower.includes('closed')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : null
      if (!status) return

      if (lower.includes('bane') && !lower.includes('range') && !lower.includes('driving')) {
        courses.push({ name: 'Golfbanen', status })
      }
      if (lower.includes('range') || lower.includes('driving')) {
        drivingRange = status
      }
      if (lower.includes('chippe') || lower.includes('putte') || lower.includes('putting')) {
        courses.push({ name: 'Chippe- og puttegreen', status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Meland scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
