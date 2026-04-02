const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Same widget class as Aas Gaard but content is static HTML — no Puppeteer needed
    const widget = $('.widget.coursecond')

    if (widget.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Remove the headline
    widget.find('.headline').remove()

    // Get and clean the text
    const rawText = widget.text()
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!rawText) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const lowerText = rawText.toLowerCase()

    // Detect open/closed from the free text
    const courseOpen = lowerText.includes('banen åpen') ||
                       lowerText.includes('banen er åpen') ||
                       lowerText.includes('åpner banen') ||
                       lowerText.includes('banen åpner')

    const courseClosed = lowerText.includes('banen stengt') ||
                         lowerText.includes('banen er stengt')

    const rangeOpen = lowerText.includes('range åpen') ||
                      lowerText.includes('rangen åpen') ||
                      lowerText.includes('range åpner') ||
                      lowerText.includes('driving range åpner')

    const rangeClosed = lowerText.includes('range stengt') ||
                        lowerText.includes('rangen stengt')

    return {
      courses: [{ name: 'Golfbanen', status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      // Show as a note on the card — truncate to avoid huge text blocks
      statusText: rawText.substring(0, 300) + (rawText.length > 300 ? '...' : ''),
    }

  } catch (error) {
    console.error(`Clubsite status text scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }