const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    const slide = $('div.golf-status-swiper .swiper-slide').first()
    if (!slide.length) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const courses = []
    let drivingRange = 'unknown'

    // Each row is <p><strong>Label:</strong> Value</p>
    slide.find('p').each((_i, el) => {
      const strong = $(el).find('strong').first()
      if (!strong.length) return

      const label = strong.text().replace(/:$/, '').trim().toLowerCase()
      const value = $(el).text().replace(strong.text(), '').trim().toLowerCase()

      const isOpen   = value.includes('åpen') || value.includes('apen')
      const isClosed = value.includes('stengt')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (label === 'bane') {
        courses.push({ name: 'Golfbanen', status })
      } else if (label.includes('range')) {
        drivingRange = status
      } else if (label !== 'dato' && label !== 'simulator' && status !== 'unknown') {
        courses.push({ name: strong.text().replace(/:$/, '').trim(), status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Karmøy scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
