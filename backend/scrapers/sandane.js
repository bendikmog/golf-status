const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    // Sandane uses WordPress with plain text status in main content:
    // "Bane: Åpen", "Range: Åpen", "Simulatorar: Åpen"
    const bodyText = $('main').text().replace(/\s+/g, ' ')

    let courseStatus = 'unknown'
    let drivingRange = 'unknown'

    const baneMatch = bodyText.match(/Bane\s*:\s*(Åpen|Stengt|Open|Closed)/i)
    if (baneMatch) courseStatus = baneMatch[1].toLowerCase().startsWith('å') || baneMatch[1].toLowerCase() === 'open' ? 'open' : 'closed'

    const rangeMatch = bodyText.match(/Range\s*:\s*(Åpen|Stengt|Open|Closed)/i)
    if (rangeMatch) drivingRange = rangeMatch[1].toLowerCase().startsWith('å') || rangeMatch[1].toLowerCase() === 'open' ? 'open' : 'closed'

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Sandane scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
