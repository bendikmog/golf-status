const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Get the first meaningful h1 — the latest news headline
    let latestHeadline = null
    $('h1, h2, h3, h4').each((i, el) => {
      const text = $(el).text().trim()
      // Skip sidetitler og navigasjonselementer
      if (
        text.length > 10 &&
        text.toLowerCase() !== 'nyheter' &&
        text.toLowerCase() !== 'siste nytt' &&
        text.toLowerCase() !== 'siste nytt fra gogk' &&
        !text.toLowerCase().includes('golfklubb') &&
        !text.toLowerCase().includes('meny')
      ) {
        latestHeadline = text
        return false
      }
    })

    return {
      // We can't reliably determine open/closed from news headlines
      courses: [],
      drivingRange: 'unknown',
      // Show latest headline as a note so user can judge themselves
      statusText: latestHeadline,
    }

  } catch (error) {
    console.error(`Squarespace news scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }