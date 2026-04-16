const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let statusText = null

    // WPFront Notification Bar — try rendered div first
    const bar = $('#wpfront-notification-bar, .wpfront-notification-bar-message')
    if (bar.length) {
      const text = bar.text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()
      if (lower.includes('åpen') || lower.includes('apen')) courseStatus = 'open'
      else if (lower.includes('stengt')) courseStatus = 'closed'
      if (text.length > 3) statusText = text
    }

    // Fallback: check known status pages
    if (courseStatus === 'unknown') {
      const base = url.replace(/\/?$/, '')
      for (const path of ['/dalen-golf/', '/bane/']) {
        const page = await axios.get(base + path, { timeout: 25000 }).catch(() => null)
        if (!page) continue
        const $p = cheerio.load(page.data)
        $p('h1, h2, h3, h4, p, li').each((_i, el) => {
          const text = $p(el).text().replace(/\s+/g, ' ').trim().toLowerCase()
          if (text.includes('vinterstengt') || text.includes('stengt')) { courseStatus = 'closed'; return false }
          if (text.includes('åpen') || text.includes('apen')) { courseStatus = 'open'; return false }
        })
        if (courseStatus !== 'unknown') break
      }
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Tysnes scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
