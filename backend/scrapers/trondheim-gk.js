const axios = require('axios')
const cheerio = require('cheerio')
const { isRelevantStatusText } = require('./utils')

const BASE = 'https://www.golfklubben.no'

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Finn nyeste lenke med 'banestatus' i href eller tekst
    let articleUrl = null
    $('a').each((i, el) => {
      if (articleUrl) return
      const href = $(el).attr('href') || ''
      const text = $(el).text().toLowerCase()
      if ((href.includes('banestatus') || text.includes('banestatus')) && href.startsWith('/nyheter/')) {
        articleUrl = BASE + href
      }
    })

    if (!articleUrl) {
      return { courses: [{ name: 'Golfbanen', status: 'unknown' }], drivingRange: 'unknown', statusText: null }
    }

    const postRes = await axios.get(articleUrl)
    const post$ = cheerio.load(postRes.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    post$('p').each((i, el) => {
      const text = post$(el).text().replace(/\s+/g, ' ').trim()
      if (text.length < 10 || text.length > 400) return
      const lower = text.toLowerCase()

      const isOpen   = /(åpen|open|åpnet)/.test(lower)
      const isClosed = /(stengt|vinterstengt)/.test(lower)
      const isRange  = /range|rang/.test(lower)
      const isCourse = /\bbane[nt]?\b|\bbana\b/.test(lower)

      if (isRange && !isCourse) {
        if (isOpen  && rangeStatus  === 'unknown') rangeStatus  = 'open'
        if (isClosed && rangeStatus === 'unknown') rangeStatus  = 'closed'
      }
      if (isCourse && !isRange) {
        if (isOpen  && courseStatus === 'unknown') courseStatus = 'open'
        if (isClosed && courseStatus === 'unknown') courseStatus = 'closed'
      }

      if (!statusText && text.length > 20 && (isOpen || isClosed) && (isRange || isCourse)) {
        statusText = text.length > 300 ? text.substring(0, 300) + '...' : text
      }
    })

    return { courses: [{ name: 'Golfbanen', status: courseStatus }], drivingRange: rangeStatus, statusText }

  } catch (error) {
    console.error(`Trondheim GK scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
