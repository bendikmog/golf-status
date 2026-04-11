const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    // Status ligger i en <h2> på siden
    $('h2').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (/banen er (åpen|open)/.test(lower)) courseStatus = 'open'
      else if (/banen er stengt/.test(lower)) courseStatus = 'closed'
    })

    // Hent beskrivende tekst fra avsnitt etter h2
    $('p').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.length > 20 && !statusText) statusText = text
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Ekholt scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
