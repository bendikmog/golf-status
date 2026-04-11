const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    // Status vises i <h5>Golfbanen: <b>Åpen/Stengt</b>
    $('h5').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (lower.includes('golfbanen')) {
        if (lower.includes('åpen') || lower.includes('open')) courseStatus = 'open'
        else if (lower.includes('stengt')) courseStatus = 'closed'
        if (!statusText && text.length > 10) statusText = text.replace(/([a-zæøå!])([A-ZÆØÅ])/g, '$1 $2')
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Tingvoll scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
