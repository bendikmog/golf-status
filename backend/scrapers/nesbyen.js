const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Nesfjellet has a status in a <strong class="h4"> element
    // e.g. "Banen - (åpen)" or "Banen - (stengt for sesongen)"
    let courseStatus = 'unknown'
    let statusText = null

    $('strong, h1, h2, h3, h4').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (!lower.startsWith('banen')) return

      if (lower.includes('åpen') || lower.includes('open'))   courseStatus = 'open'
      if (lower.includes('stengt')) courseStatus = 'closed'

      // Show as note, cleaned up
      statusText = text.replace(/^banen\s*[-–]\s*/i, '').replace(/[()]/g, '').trim()
      return false
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Nesbyen scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }