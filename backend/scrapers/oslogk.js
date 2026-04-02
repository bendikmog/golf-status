const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Oslo GK has a dedicated status page with free text sections
    // The main status section is under h3 "Banen"
    let statusText = null
    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'

    // Find the "Banen" section
    $('h3').each((i, el) => {
    if ($(el).text().trim().toLowerCase() === 'banen') {

        // Status text is in a sibling div with class "dagens-status_rich-text"
        const richText = $(el).closest('.dagens-status_item')
                            .find('.dagens-status_rich-text')

        // Replace <br> tags with spaces before extracting text
        richText.find('br').replaceWith(' ')

        // Extract text from each paragraph separately and join with space
        // - prevents sentences from merging without spaces
        const parts = []
        richText.find('p, li').each((i, el) => {
            const t = $(el).text().replace(/\s+/g, ' ').trim()
            if (t) parts.push(t)
        })

        // Fallback to full text if no paragraphs found
        const text = parts.length > 0
            ? parts.join(' ')
            : richText.text().replace(/\s+/g, ' ').trim()

        const lower = text.toLowerCase()

        const courseOpen = lower.includes('banen er åpen') ||
                        lower.includes('banen åpner')
                        

        const courseClosed = lower.includes('banen') &&
                            lower.includes('stengt')

        const rangeOpen = (lower.includes('driving range') || lower.includes('rangen')) &&
                            lower.includes('åpen')

        const rangeClosed = (lower.includes('driving range') || lower.includes('rangen')) &&
                            lower.includes('stengt')

        if (courseOpen || courseClosed) {
        courseStatus = courseOpen ? 'open' : 'closed'
        }
        if (rangeOpen || rangeClosed) {
        rangeStatus = rangeOpen ? 'open' : 'closed'
        }

        statusText = text.length > 300 ? text.substring(0, 300) + '...' : text
        return false
    }
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Oslo GK scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }