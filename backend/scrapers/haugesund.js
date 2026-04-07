const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let drivingRange = 'unknown'

    // Scan all text-bearing elements for Norwegian status keywords
    $('h1, h2, h3, h4, p').each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase()

      if (text.includes('banen er åpen') || text.includes('banen åpen')) courseStatus = 'open'
      else if (text.includes('banen er stengt') || text.includes('banen stengt')) courseStatus = 'closed'

      if (text.includes('driving range') && text.includes('åpen')) drivingRange = 'open'
      else if (text.includes('driving range') && text.includes('stengt')) drivingRange = 'closed'
    })

    return {
      courses: [
        { name: '9-hulls folkebane', status: courseStatus },
        { name: '6-hulls Pitch & Putt', status: courseStatus },
      ],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Haugesund scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
