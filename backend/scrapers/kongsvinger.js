const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    const popup = $('[data-elementor-id="337"]')
    if (popup.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    const courses = []

    // Structure is "Label : Value" lines
    // e.g. "Banen : Stengt", "Driving range : Åpen", "Treningsområde : 6 hulls banen er åpen"
    const text = popup.text()
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.includes(' : '))

    const extraCourses = []

    lines.forEach(line => {
      const [rawLabel, rawValue] = line.split(' : ').map(s => s.trim())
      if (!rawLabel || !rawValue) return

      const label = rawLabel.toLowerCase()
      const value = rawValue.toLowerCase()
      const isOpen   = value.includes('åpen') || value.includes('åpent')
      const isClosed = value.includes('stengt')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label === 'banen') {
        courseStatus = status
      } else if (label.includes('range') || label.includes('driving')) {
        rangeStatus = status
      } else if (label.includes('treningsområde') || label.includes('treningsomrade')) {
        // Show as a separate course row e.g. "6 hulls banen er åpen"
        extraCourses.push({ name: rawLabel, status })
      }
    })

    return {
      courses: [
        { name: 'Golfbanen', status: courseStatus },
        ...extraCourses
      ],
      drivingRange: rangeStatus,
      statusText: null,
    }

  } catch (error) {
    console.error(`Kongsvinger scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }