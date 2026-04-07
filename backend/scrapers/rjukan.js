const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'

    // Rjukan has a <p> with "Banestatus: Range – Åpen • Banen – Stengt"
    $('p').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (!text.toLowerCase().startsWith('banestatus:')) return

      const lower = text.toLowerCase()

      // Parse range status
      const rangeOpen   = lower.includes('range') && (lower.includes('range – åpen') || lower.includes('range – åpent') || lower.includes('range -åpen') || lower.includes('range – open'))
      const rangeClosed = lower.includes('range') && (lower.includes('range – stengt') || lower.includes('range -stengt'))

      // Parse course status
      const courseOpen   = lower.includes('banen – åpen') || lower.includes('banen – åpent') || lower.includes('banen -åpen') || lower.includes('banen – open')
      const courseClosed = lower.includes('banen – stengt') || lower.includes('banen -stengt')

      if (rangeOpen || rangeClosed) rangeStatus = rangeOpen ? 'open' : 'closed'
      if (courseOpen || courseClosed) courseStatus = courseOpen ? 'open' : 'closed'

      return false
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText: null,
    }

  } catch (error) {
    console.error(`Rjukan scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }