const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Hemsedal uses Elementor icon-box-title h3 elements for status
    // e.g. <h3 class="elementor-icon-box-title"><span>Golfbanen er stengt</span></h3>
    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'

    $('.elementor-icon-box-title').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase()

      if (text.includes('golfbanen er åpen') || text.includes('golfbanen er open'))   courseStatus = 'open'
      if (text.includes('golfbanen er stengt'))                                       courseStatus = 'closed'
      if (text.includes('drivingrangen er åpen') || text.includes('drivingrangen er open'))  rangeStatus = 'open'
      if (text.includes('drivingrangen er stengt'))                                          rangeStatus = 'closed'
    })

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText: null,
    }

  } catch (error) {
    console.error(`Hemsedal scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }