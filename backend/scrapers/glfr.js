/**
 * Generic GLFR RSS feed scraper.
 *
 * Usage: call scrapeGlfr(slug) directly, or use scrape(url) where
 * url is the club's homepage — the GLFR slug must be configured per-club.
 *
 * For per-club use, each club file just calls scrapeGlfr with its own slug.
 */

const axios = require('axios')
const cheerio = require('cheerio')

const BASE = 'https://business-api.glfr.com/feeds/club-status/'

async function scrapeGlfr(slug) {
  const feedUrl = BASE + slug
  const response = await axios.get(feedUrl, { timeout: 10000 })
  const $ = cheerio.load(response.data, { xmlMode: true })

  const item = $('item').first()
  if (!item.length) return null

  const title = item.find('title').text().trim()
  const lower = title.toLowerCase()

  // category: "critical" typically means closed/warning, "normal" = open
  const category = item.find('category').text().trim().toLowerCase()

  // Validate the date range in <guid> — format: "YYYY-MM-DD - YYYY-MM-DD"
  // If today is outside the validity window, the club hasn't updated GLFR → unknown
  const guid = item.find('guid').text().trim()
  const dateMatch = guid.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/)
  if (dateMatch) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const validFrom = new Date(dateMatch[1])
    const validTo   = new Date(dateMatch[2])
    validTo.setHours(23, 59, 59, 999)
    if (today < validFrom || today > validTo) {
      return {
        courses: [{ name: 'Golfbanen', status: 'unknown' }],
        drivingRange: 'unknown',
        statusText: null,
      }
    }
  }

  let courseStatus = 'unknown'
  const isOpenWord   = lower.includes('åpen') || lower.includes('apen') || lower.includes('open')
  const isClosedWord = lower.includes('stengt') || lower.includes('stenging') || lower.includes('closed') || lower.includes('steng')

  if (isOpenWord)   courseStatus = 'open'
  if (isClosedWord) courseStatus = 'closed'

  // Fall back to GLFR category when title gives no clear signal
  if (courseStatus === 'unknown') {
    if (category === 'normal')   courseStatus = 'open'
    if (category === 'critical') courseStatus = 'closed'
  }

  // Try to detect driving range from title
  let drivingRange = 'unknown'
  if (lower.includes('range') && (lower.includes('åpen') || lower.includes('open'))) drivingRange = 'open'
  if (lower.includes('range') && (lower.includes('stengt') || lower.includes('closed'))) drivingRange = 'closed'

  const isMeaningless = title.toLowerCase() === 'banestatus' || title.length <= 3
  const statusText = isMeaningless ? null : title

  return {
    courses: [{ name: 'Golfbanen', status: courseStatus }],
    drivingRange,
    statusText,
  }
}

module.exports = { scrapeGlfr }
