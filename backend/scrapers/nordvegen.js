const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let drivingRange = 'unknown'
    let statusText = null

    // Banestatus widget: <li id="black-studio-tinymce-2"> with class .textwidget
    const widget = $('li#black-studio-tinymce-2 .textwidget')
    if (widget.length) {
      const text = widget.text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (lower.includes('åpen') || lower.includes('apen'))  courseStatus = 'open'
      if (lower.includes('stengt')) courseStatus = 'closed'
      if (lower.includes('range') && lower.includes('åpen')) drivingRange = 'open'
      if (lower.includes('range') && lower.includes('stengt')) drivingRange = 'closed'

      if (text.length > 3) statusText = text
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }

  } catch (error) {
    console.error(`Nordvegen scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
