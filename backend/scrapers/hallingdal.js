const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Hallingdal has a WordPress text widget in the sidebar
    // with class "widget_black_studio_tinymce"
    const widget = $('.widget_black_studio_tinymce')
    if (widget.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Get text from the widget, skip the heading
    let statusText = null
    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'

    widget.each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (!lower.includes('banen') && !lower.includes('range')) return

      const courseOpen   = lower.includes('banen er åpen') || lower.includes('banen åpen') || lower.includes('banen åpner')
      const courseClosed = lower.includes('banen er stengt') || lower.includes('banen stengt')
      const rangeOpen    = lower.includes('rangen er åpen') || lower.includes('range åpen') || lower.includes('range åpner')
      const rangeClosed  = lower.includes('rangen er stengt') || lower.includes('range stengt')

      if (courseOpen || courseClosed) courseStatus = courseOpen ? 'open' : 'closed'
      if (rangeOpen || rangeClosed) rangeStatus = rangeOpen ? 'open' : 'closed'

      // Strip heading and use as note
      const note = text.replace(/^aktuelt\s*/i, '').trim()
      if (note.length > 5) statusText = note
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Hallingdal scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }