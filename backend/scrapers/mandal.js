const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let drivingRange = 'unknown'
    let statusText = null

    // Mandal uses WordPress with large paragraph blocks for status:
    // <p class="has-large-font-size">Status: Banen er åpen. ...</p>
    // <p class="has-large-font-size">Driving rangen er stengt.</p>
    $('p.has-large-font-size').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (lower.startsWith('status:') || lower.includes('banen er') || lower.includes('bane ')) {
        if (lower.includes('åpen') || lower.includes('apen')) courseStatus = 'open'
        else if (lower.includes('stengt')) courseStatus = 'closed'
        if (!statusText && text.length > 5) statusText = text
      }

      if (lower.includes('driving range') || lower.includes('rangen')) {
        if (lower.includes('åpen') || lower.includes('apen')) drivingRange = 'open'
        else if (lower.includes('stengt')) drivingRange = 'closed'
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }

  } catch (error) {
    console.error(`Mandal scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
