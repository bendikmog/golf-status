const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const statusUrl = url.replace(/\/?$/, '/') + '?p=415'
    const statusPage = await axios.get(statusUrl, { timeout: 10000 })
    const $s = cheerio.load(statusPage.data)

    let courseStatus = 'unknown'
    let practiceStatus = 'unknown'
    let drivingRange = 'unknown'

    const parseStatus = (text) => {
      text = text.toLowerCase()
      if (text.includes('open') || text.includes('åpen') || text.includes('apen')) return 'open'
      if (text.includes('stengt')) return 'closed'
      return null
    }

    // Structure: <h5>Banen:</h5><p>Stengt – ...</p>
    //            <h5>Treningsområdet og Driving Range:</h5><p>Open – ...</p>
    $s('h5').each((_i, el) => {
      const heading = $s(el).text().toLowerCase()
      const nextText = $s(el).next('p').text()

      if (heading.includes('bane') && courseStatus === 'unknown') {
        const status = parseStatus(nextText)
        if (status) courseStatus = status
      }
      if ((heading.includes('range') || heading.includes('treningsområde')) && drivingRange === 'unknown') {
        const status = parseStatus(nextText)
        if (status) {
          drivingRange = status
          practiceStatus = status
        }
      }
    })

    return {
      courses: [
        { name: 'Golfbanen', status: courseStatus },
        { name: 'Treningsområde', status: practiceStatus },
      ],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Voss scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
