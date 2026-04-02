const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Norsjø has an Elementor heading "Banestatus" followed by 
    // a text widget with the actual status
    $('h1, h2, h3, h4, h5, .elementor-heading-title').each((i, el) => {
      const text = $(el).text().trim()
      if (text.toLowerCase() !== 'banestatus') return

      // Get the next sibling text widget
      const next = $(el).closest('.elementor-widget').next('.elementor-widget')
      const statusRaw = next.text().replace(/\s+/g, ' ').trim().toLowerCase()

      if (!statusRaw || statusRaw.includes('ingen aktiv')) {
        // No active status — treat as unknown
        return false
      }

      const courseOpen   = statusRaw.includes('åpen') && !statusRaw.includes('stengt')
      const courseClosed = statusRaw.includes('stengt')
      const rangeOpen    = statusRaw.includes('range åpen') || statusRaw.includes('driving range åpen')
      const rangeClosed  = statusRaw.includes('range stengt') || statusRaw.includes('driving range stengt')

      courseStatus = courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'
      if (rangeOpen) rangeStatus = 'open'
      if (rangeClosed) rangeStatus = 'closed'

      const note = next.text().replace(/\s+/g, ' ').trim()
      if (note.length > 5 && !note.toLowerCase().includes('ingen aktiv')) {
        statusText = note
      }
      return false
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Norsjø scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }