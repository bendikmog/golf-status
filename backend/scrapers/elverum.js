const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Elverum har en dedikert /banestatus/-side
    // med fritekst fra greenkeeper i en <article>-tag
    const article = $('article, .entry-content, .post-content')

    if (article.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Fjern WordPress-søppel (mce_SELRES spans etc.)
    article.find('span[data-mce-type]').remove()

    const rawText = article.text()
      .replace(/Banestatus/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!rawText) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const lower = rawText.toLowerCase()

    const courseOpen   = lower.includes('banen er åpen') ||
                         lower.includes('banen åpner') ||
                         lower.includes('åpen for spill') ||
                         lower.includes('banen er klar') ||
                         lower.includes('banen er open') ||
                         lower.includes('open for spill')

    const courseClosed = lower.includes('banen er stengt') ||
                         lower.includes('stengt for spill') ||
                         lower.includes('holder stengt') ||
                         lower.includes('stengt inntil')

    const rangeOpen    = lower.includes('range åpen') ||
                         lower.includes('rangen åpen') ||
                         lower.includes('driving range åpen') ||
                         lower.includes('range open') ||
                         lower.includes('rangen open')

    const rangeClosed  = lower.includes('range stengt') ||
                         lower.includes('rangen stengt')

    // Vis friteksten som notat, maks 300 tegn
    const statusText = rawText.length > 300
      ? rawText.substring(0, 300) + '...'
      : rawText

    return {
      courses: [{
        name: 'Golfbanen',
        status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'
      }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Elverum scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }