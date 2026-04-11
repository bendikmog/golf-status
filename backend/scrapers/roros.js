const axios = require('axios')
const cheerio = require('cheerio')
const { isRelevantStatusText } = require('./utils')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // Statusen vises som H2 øverst på siden: "Banen er stengt/åpen..."
    $('h1, h2, h3').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      const isOpen = /\bbane[nt]?\b.*(åpen|open)/.test(lower) || /\b(åpen|open).*\bbane[nt]?\b/.test(lower)
      const isClosed = /\bbane[nt]?\b.*stengt/.test(lower) || /stengt.*\bbane[nt]?\b/.test(lower)
      const isRangeOpen = /\brange\b.*(åpen|open)/.test(lower) || /(åpen|open).*\brange\b/.test(lower)
      const isRangeClosed = /\brange\b.*stengt/.test(lower) || /stengt.*\brange\b/.test(lower)

      if (isOpen && courseStatus === 'unknown') courseStatus = 'open'
      if (isClosed && courseStatus === 'unknown') courseStatus = 'closed'
      if (isRangeOpen && rangeStatus === 'unknown') rangeStatus = 'open'
      if (isRangeClosed && rangeStatus === 'unknown') rangeStatus = 'closed'

      if (!statusText && (isOpen || isClosed) && text.length > 10 && text.length <= 300) {
        statusText = text
      }
    })

    // Hent statusnotat fra nyheter med relevante nøkkelord (siste nyheter)
    if (!statusText) {
      $('p').each((i, el) => {
        if (statusText) return
        const text = $(el).text().replace(/\s+/g, ' ').trim()
        if (text.length < 10 || text.length > 400) return
        const lower = text.toLowerCase()
        const hasCourse = /\bbane[nt]?\b|\bbana\b/.test(lower)
        const hasStatus = /(åpen|open|stengt|vinterstengt)/.test(lower)
        if (hasCourse && hasStatus && isRelevantStatusText($, el)) {
          statusText = text.length > 300 ? text.substring(0, 300) + '...' : text
        }
      })
    }

    return { courses: [{ name: 'Golfbanen', status: courseStatus }], drivingRange: rangeStatus, statusText }

  } catch (error) {
    console.error(`Røros scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
