const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { timeout: 25000 })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'

    // Wix: find the "Banestatus" heading, then read the adjacent status value element
    let statusContainerId = null
    $('[data-testid="richTextElement"]').each((_i, el) => {
      if ($(el).text().trim().toLowerCase() === 'banestatus') {
        // The next sibling richTextElement contains the actual status value
        const next = $(el).next('[data-testid="richTextElement"]')
        if (next.length) {
          statusContainerId = next
        }
        return false
      }
    })

    // Fallback: use the known Wix component ID
    const statusEl = statusContainerId || $('#comp-iyve4r4i')
    if (statusEl && statusEl.length) {
      // Use full element text — strip zero-width spaces and normalize whitespace
      const text = statusEl.text().replace(/\u200b/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (text.includes('åpen') || text.includes('apen')) courseStatus = 'open'
      else if (text.includes('stengt')) courseStatus = 'closed'
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText: null,
    }

  } catch (error) {
    console.error(`PRGK scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
