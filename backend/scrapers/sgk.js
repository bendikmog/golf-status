const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // SGK has a wp-block-table with two columns: label and status
    const table = $('.wp-block-table table').first()
    if (table.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const courses = []
    let drivingRange = 'unknown'

    table.find('tr').each((i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return

      const label = $(cells[0]).text().replace(/\s+/g, ' ').trim().toLowerCase()
      const value = $(cells[1]).text().replace(/✅/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

      const isOpen   = value.includes('åpen')
      const isClosed = value.includes('stengt') || value.includes('under bygging')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label === 'bane') {
        courses.push({ name: 'Golfbanen', status })
      } else if (label.includes('driving range') || label.includes('range')) {
        drivingRange = status
      } else if (label.includes('hull')) {
        courses.push({ name: $(cells[0]).text().trim(), status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`SGK scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }