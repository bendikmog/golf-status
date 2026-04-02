const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // The status box sits in an aside/complementary element
    // Each line is a separate generic element with course status text
    const statusLines = []
    $('aside p, aside li, aside div, .sidebar p, .sidebar li, [class*="status"] li').each((i, el) => {
        const text = $(el).text().trim()
        if (text && text.length < 100) statusLines.push(text.toLowerCase())
    })

    // Search for course status
    const courseOpen = statusLines.some(t =>
        (t.includes('banen') || t.includes('bane')) && t.includes('åpen')
    )
    const courseClosed = statusLines.some(t => 
        (t.includes('banen') || t.includes('bane')) && t.includes('stengt')
    )

    //Search for driving range status
    const rangeOpen = statusLines.some(t =>
        (t.includes('range') || t.includes('rangen')) && t.includes('åpen')
    )
    const rangeClosed = statusLines.some(t => 
        (t.includes('range') || t.includes('rangen')) && t.includes('stengt')
    )

    const courseStatus = courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'
    const rangeStatus = rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown'
    
    return {
        courses: [{name: 'Golfbanen', status: courseStatus }],
        drivingRange: rangeStatus,
        statusText: null
    }

  } catch (error) {
    console.error(`Krokhol sidebar scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null}
  }
}

module.exports = { scrape }