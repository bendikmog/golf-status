const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const feedRes = await axios.get(url.replace(/\/?$/, '') + '/feed/', { timeout: 25000 })
    const $ = cheerio.load(feedRes.data, { xmlMode: true })

    const currentYear = new Date().getFullYear()
    let courseStatus = 'unknown'
    let drivingRange = 'unknown'
    let statusText = null

    $('item').each((_i, el) => {
      const pubDate = $(el).find('pubDate').text().trim()
      const postYear = pubDate ? new Date(pubDate).getFullYear() : null

      // Only trust posts from the current season
      if (postYear !== currentYear) return

      const title   = $(el).find('title').text().trim()
      const content = $(el).find('description, encoded').first().text()
      const combined = (title + ' ' + content).toLowerCase()

      const mentionsBane  = combined.includes('bane') || combined.includes('bana')
      const mentionsRange = combined.includes('driving range') || combined.includes('rangen')
      const isOpen   = combined.includes('opning') || combined.includes('open') ||
                       combined.includes('åpen') || combined.includes('apen')
      const isClosed = combined.includes('stengt') || combined.includes('stengd') ||
                       combined.includes('closed')

      if (mentionsBane && courseStatus === 'unknown') {
        if (isOpen)   courseStatus = 'open'
        else if (isClosed) courseStatus = 'closed'
        if (courseStatus !== 'unknown') statusText = title
      }

      if (mentionsRange && drivingRange === 'unknown') {
        if (isOpen)   drivingRange = 'open'
        else if (isClosed) drivingRange = 'closed'
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }

  } catch (error) {
    console.error(`Nordfjord scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
