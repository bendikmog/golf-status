const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Find the smallest element containing the status block
    let statusBlock = null
    $('*').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (
        text.toLowerCase().includes('banestatus') &&
        text.includes('Bane:') &&
        text.length < 400
      ) {
        statusBlock = text
      }
    })

    if (!statusBlock) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    // Parse each line as "Label: STATUS"
    const lines = statusBlock
      .replace(/banestatus:?/gi, '')
      .replace(/greenfee:.*/si, '')
      .split(/(?=[A-ZÆØÅ][a-zæøå])/)  // split before capital letters
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(l => l.includes(':'))

    const courses = []
    let drivingRange = 'unknown'

    lines.forEach(line => {
      const [rawLabel, rawStatus] = line.split(':').map(s => s.trim())
      if (!rawLabel || !rawStatus) return

      const label = rawLabel.toLowerCase()
      const status = rawStatus.toLowerCase()
      const isOpen = status.includes('åpen') || status.includes('åpent')
      const isClosed = status.includes('stengt') || status.includes('åpner')
      const parsedStatus = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label.includes('range') || label.includes('drivingrange')) {
        drivingRange = parsedStatus
      } else if (label.includes('golfbil') || label.includes('bil')) {
        // skip — not relevant for course status
      } else {
        // Everything else is a course/facility badge
        courses.push({
          name: rawLabel,
          status: parsedStatus
        })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,  // all info is shown as badges
    }

  } catch (error) {
    console.error(`Eiker scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }