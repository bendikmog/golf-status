const axios = require('axios')
const cheerio = require('cheerio')

const RELEVANT_KEYWORDS = ['bane', 'bana', 'range', 'rang', 'åpen', 'stengt', 'open', 'vinterstengt', 'sesong', 'åpning']

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Finn lenker til bloggposter med relevante stikkord i tittelen
    let relevantPostUrl = null
    $('a').each((i, el) => {
      if (relevantPostUrl) return
      const text = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase()
      const href = $(el).attr('href') || ''
      if (!href.includes('/nyhet/') && !href.includes('/post/') && !href.includes('/news/')) return
      if (RELEVANT_KEYWORDS.some(kw => text.includes(kw))) {
        relevantPostUrl = href.startsWith('http') ? href : new URL(href, url).href
      }
    })

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    if (relevantPostUrl) {
      const postRes = await axios.get(relevantPostUrl)
      const post$ = cheerio.load(postRes.data)

      post$('p').each((i, el) => {
        const text = post$(el).text().replace(/\s+/g, ' ').trim()
        if (text.length < 10 || text.length > 400) return
        const lower = text.toLowerCase()

        const isOpen = lower.includes('åpen') || lower.includes('open')
        const isClosed = lower.includes('stengt') || lower.includes('vinterstengt')
        const isRange = lower.includes('range') || lower.includes('rang')
        const isCourse = lower.includes('bane') || lower.includes('bana') || lower.includes('sesong')

        if (isRange) {
          if (isOpen && rangeStatus === 'unknown') rangeStatus = 'open'
          if (isClosed && rangeStatus === 'unknown') rangeStatus = 'closed'
        }
        if (isCourse && !isRange) {
          if (isOpen && courseStatus === 'unknown') courseStatus = 'open'
          if (isClosed && courseStatus === 'unknown') courseStatus = 'closed'
        }

        if (!statusText && text.length > 20 && RELEVANT_KEYWORDS.some(kw => lower.includes(kw))) {
          statusText = text.length > 300 ? text.substring(0, 300) + '...' : text
        }
      })
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Klabu scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
