const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    const table = $('table#eael-data-table-6c2ff753')
    if (!table.length) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const courses = []
    let drivingRange = 'unknown'

    table.find('tbody tr').each((_i, row) => {
      const cells = $(row).find('td .td-content')
      if (cells.length < 2) return

      const label = $(cells[0]).text().trim().toLowerCase()
      const value = $(cells[1]).text().trim().toLowerCase()

      // "Åpen" = open, "Vinter" or "Stengt" = closed
      const isOpen   = value.includes('åpen') || value.includes('apen')
      const isClosed = value.includes('stengt') || value.includes('vinter')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label === 'bane') {
        courses.push({ name: 'Golfbanen', status })
      } else if (label.includes('range') || label.includes('drivingrange')) {
        drivingRange = status
      } else if (label !== 'greener' && label !== 'teested') {
        courses.push({ name: $(cells[0]).text().trim(), status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Ogna scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
