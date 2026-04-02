const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Holtsmark uses an Elementor popup with two parallel ul lists:
    // First ul = labels (18 hulls banen, Drivingrange, etc.)
    // Second ul = statuses (Stengt, Åpen, etc.)
    const popup = $('[data-elementor-id="5858"]')
    if (popup.length === 0) {
      return {
        courses: [],
        drivingRange: 'unknown',
        statusText: 'Automatisk henting av banestatus er ikke tilgjengelig. Sjekk klubbens nettside for oppdatert status.',
      }
    }

    const lists = popup.find('.elementor-icon-list-items')
    if (lists.length < 2) {
      return {
        courses: [],
        drivingRange: 'unknown',
        statusText: 'Finner ikke banestatus. Sjekk klubbens nettside for oppdatert status.',
      }
    }

    // Extract labels and statuses
    const labels = []
    $(lists[0]).find('li').each((i, el) => {
      labels.push($(el).text().trim().toLowerCase())
    })

    const statuses = []
    $(lists[1]).find('li').each((i, el) => {
      statuses.push($(el).text().trim().toLowerCase())
    })

    // Map labels to statuses
    const statusMap = {}
    labels.forEach((label, i) => {
      statusMap[label] = statuses[i] || 'unknown'
    })

    // Detect course statuses
    const courses = []
    Object.entries(statusMap).forEach(([label, status]) => {
      const isCourse = label.includes('banen') ||
                       label.includes('hull') ||
                       label.includes('bane') 
      const isOpen = status.includes('åpen')
      const isClosed = status.includes('stengt') || status.includes('åpner')

      if (isCourse && !label.includes('range') && !label.includes('bil') && !label.includes('kiosk')) {
        courses.push({
          name: label.charAt(0).toUpperCase() + label.slice(1),
          status: isOpen ? 'open' : isClosed ? 'closed' : 'unknown'
        })
      }
    })

    // Detect range status
    const rangeLabel = Object.keys(statusMap).find(l =>
      l.includes('range') || l.includes('drivingrange')
    )
    const rangeStatus = rangeLabel ? statusMap[rangeLabel] : 'unknown'
    const rangeOpen = rangeStatus.includes('åpen')
    const rangeClosed = rangeStatus.includes('stengt') || rangeStatus.includes('åpner')

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText: null,
    }

  } catch (error) {
    console.error(`Holtsmark scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }