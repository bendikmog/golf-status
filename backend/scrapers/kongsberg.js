const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    const courses = []
    let drivingRange = 'unknown'

    // Find the Banestatus table — has two columns: Funksjon | Status
    $('table').each((i, table) => {
      // Check if this table contains status data
      const headers = $(table).find('th').map((j, th) => $(th).text().trim().toLowerCase()).get()
      const isStatusTable = headers.includes('funksjon') && headers.includes('status')
      if (!isStatusTable) return

      $(table).find('tr').each((j, row) => {
        const cells = $(row).find('td')
        if (cells.length < 2) return

        const label = $(cells[0]).text().trim().toLowerCase()
        const statusRaw = $(cells[1]).text().trim().toLowerCase()
        const isOpen = statusRaw === 'åpen' || statusRaw === 'open'
        const isClosed = statusRaw === 'stengt'
        const status = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

        if (label.includes('range') || label.includes('driving')) {
          drivingRange = status
        } else if (
          label.includes('bane') ||
          label.includes('hull') ||
          label.includes('putting') ||
          label.includes('treningsområde')
        ) {
          const name = $(cells[0]).text().trim()
          courses.push({ name, status })
        }
      })
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Kongsberg scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }