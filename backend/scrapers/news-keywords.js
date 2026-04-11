const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    const headlines = []
    $('a, h1, h2, h3, h4, .news-title, .article-title').each((i, el) => {
      const text = $(el).text().trim().toLowerCase()
      // Only inculde text that is long enough to be meaningful
      // - filters out menu items, buttons, single words
      if (text.length > 10) {
        headlines.push(text)
      }
    })

    // Also check alt attributes on images — Squarespace uses these for article titles
    $('img[alt]').each((i, el) => {
      const alt = $(el).attr('alt').trim().toLowerCase()
      if (alt.length > 5 && alt.length < 100) {
        headlines.push(alt)
      }
    })

    const recentText = headlines.slice(0, 50).join(' ')

    const courseOpen = recentText.includes('banen er åpen') ||
                       recentText.includes('banen er open') ||
                       recentText.includes('sesongen er åpen') ||
                       recentText.includes('bana er åpen') ||
                       recentText.includes('bana er open')

    const courseClosed = recentText.includes('banen er stengt') ||
                         recentText.includes('banen stengt') ||
                         recentText.includes('banen er nå stengt') ||
                         recentText.includes('stengt for sesongen') ||
                         recentText.includes('bana er stengt') ||
                         recentText.includes('bana stengt')

    const rangeOpen = recentText.includes('rangen er åpen') ||
                      recentText.includes('rangen åpner') ||
                      recentText.includes('drivingrangen er åpen')

    const rangeClosed = recentText.includes('rangen er stengt') ||
                        recentText.includes('rangen stengt')

    const courseStatus = courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'

    return {
      // Wrap in array - same structure as clubsite scraper
      courses: [{name: 'Golfbanen', status: courseStatus}],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
    }

  } catch (error) {
    console.error(`News keywords scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown' }
  }
}

module.exports = { scrape }