const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)

    // Replace <br> tags with space BEFORE loading into cheerio
    const html = response.data.replace(/<br\s*\/?>/gi, ' ')

    const $ = cheerio.load(html)


    const pageText = $('body').text()
    .replace(/\s+/g, ' ')
    .toLowerCase()

    const courseOpen = pageText.includes('banen er åpen')
    const courseClosed = pageText.includes('banen er stengt') ||
                         pageText.includes('banen er\nstengt')

    // Also check alternative phrasings
    const rangeOpen = pageText.includes('rangen er åpen') ||
                    pageText.includes('drivingrange er åpen') ||
                    pageText.includes('range er åpen')

    const rangeClosed = pageText.includes('rangen er stengt') ||
                        pageText.includes('drivingrange er stengt') ||
                        pageText.includes('range er stengt')

    // Also grab the note from the banner text (shown on all pages)
    let statusText = null
    const bannerText = $('body').text()
      .match(/Åpner snart[^.]+\./)?.[0]?.replace(/\s+/g, ' ')?.trim()
    if (bannerText) statusText = bannerText

    return {
      courses: [{ name: 'Golfbanen', status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown' }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Halden scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }