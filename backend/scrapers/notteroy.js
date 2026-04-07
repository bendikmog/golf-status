const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Nøtterøy has h2 labels followed by h3 status values
    // e.g. <h2>18 hulls-banen</h2> <h3>Åpen</h3>
    const statusMap = {}
    $('h2').each((i, el) => {
      const label = $(el).text().trim().toLowerCase()
      const next = $(el).next('h3')
      if (next.length > 0) {
        const status = next.text().trim().toLowerCase()
        statusMap[label] = status
      }
    })

    // Parse courses
    const courses = []
    for (const [label, status] of Object.entries(statusMap)) {
      const isOpen = status.startsWith('åpen') || status.startsWith('open')
      const isClosed = status.startsWith('stengt') || status.startsWith('ikke tillatt')
      const parsedStatus = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label.includes('hull') || label.includes('banen')) {
        courses.push({
          name: $(Array.from($('h2')).find(h => $(h).text().trim().toLowerCase() === label)).text().trim(),
          status: parsedStatus
        })
      }
    }

    // Parse range
    const rangeStatus = statusMap['driving range'] || ''
    const rangeOpen = rangeStatus.startsWith('åpen') || rangeStatus.startsWith('open')
    const rangeClosed = rangeStatus.startsWith('stengt')

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText: null,
    }

  } catch (error) {
    console.error(`Nøtterøy scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }