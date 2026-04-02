const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Norefjell has a dedicated status page with free text in an article element
    const article = $('article, .entry-content, main .content, .post-content')

    if (article.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Get the text and clean it up
    const statusText = article.text()
      .replace(/Informasjon om banestatus/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || null

    // Try to detect open/closed from the text
    const lowerText = statusText?.toLowerCase() || ''

    const courseOpen = lowerText.includes('banen er åpen') ||
                       lowerText.includes('banen åpner') ||
                       lowerText.includes('åpner banen')

    const courseClosed = lowerText.includes('banen er stengt') ||
                         lowerText.includes('banen stengt')

    const rangeOpen = lowerText.includes('rangen er åpen') ||
                      lowerText.includes('range åpner') ||
                      lowerText.includes('driving range åpner')

    const rangeClosed = lowerText.includes('rangen er stengt') ||
                        lowerText.includes('range stengt')

    return {
      courses: [{ name: 'Golfbanen', status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      // Show the free text as a note on the card
      statusText,
    }

  } catch (error) {
    console.error(`Norefjell status page scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }