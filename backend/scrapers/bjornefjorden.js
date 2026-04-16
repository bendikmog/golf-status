const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    const courses = []
    let drivingRange = 'unknown'

    // Custom CMS: div.baneStatus with structured li items
    // Each li has .bane (label) and .status with class "open" or "closed"
    $('div.baneStatus li').each((_i, el) => {
      const label  = $(el).find('.bane').text().replace(/:$/, '').trim().toLowerCase()
      const statusEl = $(el).find('.status')
      const isOpen   = statusEl.hasClass('open')
      const isClosed = statusEl.hasClass('closed')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label.includes('range') || label.includes('driving')) {
        drivingRange = status
      } else if (
        label.includes('bane') ||
        label.includes('hull') ||
        label.includes('pitch') ||
        label.includes('putting')
      ) {
        const name = $(el).find('.bane').text().replace(/:$/, '').trim()
        courses.push({ name, status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Bjørnefjorden scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
