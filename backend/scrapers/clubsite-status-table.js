const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    const result = {
      courses: [],
      drivingRange: null,
      statusText: null,
    }

    $('table tr').each((i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return

      const label = $(cells[0]).text().trim().toLowerCase()
      const statusRaw = $(cells[1]).text().trim()
      const isOpen = statusRaw.toUpperCase().includes('ÅPEN')
      const status = isOpen ? 'open' : 'closed'

      // Match any course-like label — handles "golfbanen", "banen",
      // "18-hullsbanen", "9-hullsbanen", "championship course" etc.
      const isCourse = (
        label.includes('banen') ||
        label.includes('hull') ||
        label.includes('course') ||
        label.includes('golfbane')
      ) && !label.includes('range') && !label.includes('øving')

      if (isCourse) {
        // Use the original label as the course name, cleaned up
        const name = $(cells[0]).text().trim().replace(/\s*i\s*$/, '')
        result.courses.push({ name, status })
      }

      if (label.includes('driving range') || label.includes('drivingrange') || label.includes('driving-range')) {
        result.drivingRange = status
      }
    })

    return result

  } catch (error) {
    console.error(`Clubsite table scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }