const axios = require('axios')
const cheerio = require('cheerio')
const https = require('https')

async function scrape(url) {
  try {
    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
    const $ = cheerio.load(response.data)

    let courseStatus   = 'unknown'
    let rangeStatus    = 'unknown'
    let shortStatus    = 'unknown'

    // All status lines live in the first text-editor widget as individual <p> tags
    $('.elementor-widget-text-editor p').each((i, el) => {
      const text  = $(el).text().replace(/\s+/g, ' ').trim()
      const lower = text.toLowerCase()

      if (/\bbanen er (åpen|open)\b/.test(lower))    courseStatus = 'open'
      if (/\bbanen er stengt\b/.test(lower))        courseStatus = 'closed'

      if (/drivingrangen er (åpen|open)/.test(lower))   rangeStatus = 'open'
      if (/drivingrangen er stengt/.test(lower))        rangeStatus = 'closed'

      if (/korthullsbanen er (åpen|open)/.test(lower))   shortStatus = 'open'
      if (/korthullsbanen er stengt/.test(lower))        shortStatus = 'closed'
    })

    return {
      courses: [
        { name: 'Golfbanen',       status: courseStatus },
        { name: 'Korthullsbanen',  status: shortStatus  },
      ],
      drivingRange: rangeStatus,
      statusText: null,
    }

  } catch (error) {
    console.error(`Atlungstad scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
