const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(response.data)

    const courses = []
    let drivingRange = 'unknown'

    // Webflow: .master_info_container — first one holds the status grid.
    // Each row is .w-layout-hflex.flex-block with two .master_info_text divs:
    // first = label, second.status = value ("åpen" / "stengt")
    const container = $('.master_info_container').first()

    container.find('.flex-block').each((_i, row) => {
      const divs = $(row).find('.master_info_text')
      if (divs.length < 2) return

      const label = $(divs[0]).text().replace(/:$/, '').trim().toLowerCase()
      const value = $(divs[1]).text().trim().toLowerCase()

      const isOpen   = value.includes('åpen') || value.includes('apen')
      const isClosed = value.includes('stengt')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label === 'banestatus') {
        courses.push({ name: 'Golfbanen', status })
      } else if (label.includes('driving range') || label.includes('range')) {
        drivingRange = status
      }
      // greener, teesteder, simulator — skip (not shown as main course rows)
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Sauda scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
