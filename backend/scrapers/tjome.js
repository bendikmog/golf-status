const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Tjøme has an Elementor popup (id 3054) with alternating
    // label / text-content columns
    const popup = $('[data-elementor-id="3054"]')
    if (popup.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Collect all text blocks in order
    const blocks = []
    popup.find('.elementor-widget-text-editor, .elementor-widget-heading').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text && text.toLowerCase() !== 'banestatus') blocks.push(text)
    })

    // Pair up: even = label, odd = value
    const pairs = {}
    for (let i = 0; i < blocks.length - 1; i += 2) {
      pairs[blocks[i].toLowerCase()] = blocks[i + 1].toLowerCase()
    }

    // Parse bane status
    const baneVal = pairs['banen'] || ''
    const courseOpen   = (baneVal.includes('åpen') || baneVal.includes('open')) && !baneVal.includes('stengt')
    const courseClosed = baneVal.includes('stengt') || baneVal.includes('frost') || baneVal.includes('snø')

    // Parse range status
    const rangeVal = pairs['drivingrange'] || pairs['driving range'] || ''
    const rangeOpen   = rangeVal.includes('åpen') || rangeVal.includes('open')
    const rangeClosed = rangeVal.includes('stengt')

    // Status note from bane
    const statusText = baneVal.length > 5 && courseClosed
      ? blocks[1] // the actual bane description
      : null

    return {
      courses: [{ name: 'Golfbanen', status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Tjøme scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }