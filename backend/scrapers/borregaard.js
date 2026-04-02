const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Borregaard has h3 headings followed by status text on the front page
    $('h3').each((i, el) => {
      const heading = $(el).text().trim().toLowerCase()
      const next = $(el).next()
      const text = next.text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (heading === 'banen') {
        const courseOpen = lower.includes('åpen')
        const courseClosed = lower.includes('stengt') || lower.includes('åpner')
        courseStatus = courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'
        if (text.length > 5) statusText = text
      }

      if (heading === 'driving range') {
        const open = lower.includes('åpen') 
        const closed = lower.includes('stengt') || lower.includes('åpner')
        rangeStatus = open ? 'open' : closed ? 'closed' : 'unknown'
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Borregaard scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }