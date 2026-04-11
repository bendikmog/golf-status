const axios = require('axios')
const cheerio = require('cheerio')
const { scrape: genericScrape } = require('./generic.js')

const BASE = 'https://tromsogolf.com'

async function scrape(url) {
  // Primær: generic scraper på forsiden
  const result = await genericScrape(url)

  // Sekundær: sjekk /banestatus/ for eventuelle oppdateringer
  try {
    const res = await axios.get(`${BASE}/banestatus/`)
    const $ = cheerio.load(res.data)

    $('p, h2, h3, h4, h5').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()
      if (text.length < 5 || text.length > 400) return

      const isOpen   = /(åpen|open|åpnet)/.test(lower)
      const isClosed = /(stengt|vinterstengt)/.test(lower)
      const isRange  = /range|rang/.test(lower)
      const isCourse = /\bbane[nt]?\b|\bbana\b/.test(lower)

      if (isRange && !isCourse) {
        if (isOpen  && result.drivingRange === 'unknown') result.drivingRange = 'open'
        if (isClosed && result.drivingRange === 'unknown') result.drivingRange = 'closed'
      }
      if (isCourse && !isRange) {
        if (isOpen  && result.courses[0]?.status === 'unknown') result.courses[0].status = 'open'
        if (isClosed && result.courses[0]?.status === 'unknown') result.courses[0].status = 'closed'
      }

      if (!result.statusText && (isOpen || isClosed) && (isRange || isCourse) && text.length > 20) {
        result.statusText = text.length > 300 ? text.substring(0, 300) + '...' : text
      }
    })
  } catch (e) {
    // Banestatus-siden utilgjengelig — bruk bare forsideresultatet
  }

  return result
}

module.exports = { scrape }
