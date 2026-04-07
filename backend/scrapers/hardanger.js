const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    // Status is published on /banen/ as free-text prose in a Divi text block
    const baneUrl = url.replace(/\/?$/, '') + '/banen/'
    const response = await axios.get(baneUrl, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    // Divi: .et_pb_text_inner p — first paragraph contains the current status sentence
    $('.et_pb_text_inner p, .entry-content p').each((_i, el) => {
      const text  = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (lower.includes('bane') || lower.includes('bana')) {
        if (lower.includes('open') || lower.includes('åpen') || lower.includes('apen')) {
          courseStatus = 'open'
          statusText = text.length > 5 ? text.substring(0, 200) : null
          return false
        }
        if (lower.includes('stengt') || lower.includes('stengd') || lower.includes('closed')) {
          courseStatus = 'closed'
          statusText = text.length > 5 ? text.substring(0, 200) : null
          return false
        }
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Hardanger scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
