const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Tyrifjord has a status block in a div.cc_mob
    // with lines like "Banen: Stengt", "Driving range: Stengt"
    const statusBlock = $('.cc_mob').first()
    if (statusBlock.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Replace <br> tags with newlines before extracting text
    const html = statusBlock.html()?.replace(/<br\s*\/?>/gi, '\n') || ''
    const text = cheerio.load(html).text().replace(/\s+/g, ' ').trim()
    const lower = text.toLowerCase()

    const courseOpen = lower.includes('banen: åpen')
    const courseClosed = lower.includes('banen: stengt') ||
                         lower.includes('banen: åpner')

    const rangeOpen = lower.includes('driving range: åpen') ||
                      lower.includes('range: åpen')
    const rangeClosed = lower.includes('driving range: stengt') ||
                        lower.includes('range: stengt') ||
                        lower.includes('driving range: åpner')

    // Show extra note text after status lines if meaningful
    const note = text
      .replace(/dagens banestatus/gi, '')
      .replace(/banestatus/gi, '')
      .replace(/\d{4}-\d{2}-\d{2}\s*-\s*\d{4}-\d{2}-\d{2}:?/g, '')
      .replace(/banen:.*?(stengt|åpen)/gi, '')
      .replace(/treningsgreener:.*?(stengt|åpen)/gi, '')
      .replace(/driving range:.*?(stengt|åpen)[^.]*\./gi, '')
      .replace(/golfbil:.*?\./gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      courses: [{ name: 'Golfbanen', status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText: note.length > 10 ? note.substring(0, 300) : null,
    }

  } catch (error) {
    console.error(`Tyrifjord scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }