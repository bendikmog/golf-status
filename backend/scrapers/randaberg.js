const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url + 'banestatus', { timeout: 25000 })
    const $ = cheerio.load(response.data)

    const courses = []
    let drivingRange = 'unknown'

    // Wix richTextElement pairs: <h2> heading followed by <ul> with status bullet points
    // Iterate over all richTextElement divs, track the current section label
    let currentSection = null

    $('[data-testid="richTextElement"]').each((_i, el) => {
      const heading = $(el).find('h2').first()
      if (heading.length) {
        currentSection = heading.text().trim().toLowerCase()
        return
      }

      // Collect all bullet text for this section
      const bullets = []
      $(el).find('li').each((_j, li) => {
        const text = $(li).text().replace(/\s+/g, ' ').trim()
        if (text) bullets.push(text.toLowerCase())
      })
      if (!bullets.length) return

      const allText = bullets.join(' ')
      const isOpen   = allText.includes('åpen') || allText.includes('apen')
      const isClosed = allText.includes('stengt')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (currentSection && (currentSection.includes('range') || currentSection.includes('driving'))) {
        drivingRange = status
      } else if (currentSection && !currentSection.includes('status oppdatert')) {
        const name = currentSection.charAt(0).toUpperCase() + currentSection.slice(1)
        courses.push({ name, status })
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Randaberg scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
