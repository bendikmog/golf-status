const axios = require('axios')
const cheerio = require('cheerio')
const { isRelevantStatusText } = require('./utils')

const RELEVANT_KEYWORDS = ['bane', 'bana', 'range', 'rang', 'åpen', 'stengt', 'open', 'vinterstengt']

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Status vises i header-baren (.ci-news span)
    $('.hb-ci .ci-news span, .hb-ci span').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()
      if (!lower) return

      const isOpen = lower.includes('åpen') || lower.includes('open')
      const isClosed = lower.includes('stengt')
      const isRange = lower.includes('range') || lower.includes('rang')
      const isCourse = lower.includes('bane') || lower.includes('bana')

      if (isRange) {
        if (isOpen && rangeStatus === 'unknown') rangeStatus = 'open'
        if (isClosed && rangeStatus === 'unknown') rangeStatus = 'closed'
      }
      if (isCourse) {
        if (isOpen && courseStatus === 'unknown') courseStatus = 'open'
        if (isClosed && courseStatus === 'unknown') courseStatus = 'closed'
      }
    })

    // Hent statusnotat fra nyheter/paragrafer med relevante nøkkelord
    $('p, h1, h2, h3, h4, h5').each((i, el) => {
      if (statusText) return
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.length < 10 || text.length > 400) return
      const lower = text.toLowerCase()
      const hasRelevant = RELEVANT_KEYWORDS.some(kw => lower.includes(kw))
      if (hasRelevant && isRelevantStatusText($, el)) {
        statusText = text.length > 300 ? text.substring(0, 300) + '...' : text
      }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Hitra scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
