const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Ringerike has a Joomla custom module "div.mod-custom"
    // with text like "Bane: Stengt Range: Stengt Golfbil: Stengt"
    $('.mod-custom').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (!lower.includes('bane:') && !lower.includes('range:')) return

      const courseOpen   = lower.includes('bane: åpen') || lower.includes('bane:åpen')
      const courseClosed = lower.includes('bane: stengt') || lower.includes('bane:stengt')
      const rangeOpen    = lower.includes('range: åpen') || lower.includes('range:åpen')
      const rangeClosed  = lower.includes('range: stengt') || lower.includes('range:stengt')

      if (courseOpen || courseClosed) courseStatus = courseOpen ? 'open' : 'closed'
      if (rangeOpen || rangeClosed) rangeStatus = rangeOpen ? 'open' : 'closed'

      return false
    })

    // Also grab any longer status note
    $('p, div').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.toLowerCase().startsWith('banestatus:') && text.length < 200) {
        statusText = text.replace(/banestatus:\s*/i, '').trim()
        return false
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Ringerike scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }