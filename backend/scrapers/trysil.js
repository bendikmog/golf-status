const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let drivingRange = 'unknown'

    // Primær: status vises som <span>Banen er</span><br/><span>Åpen/Stengt</span>
    $('span').each((i, el) => {
      const text = $(el).text().trim().toLowerCase()
      if (text === 'banen er') {
        const statusText = $(el).nextAll('span').first().text().trim().toLowerCase()
        if (statusText === 'åpen' || statusText === 'open') courseStatus = 'open'
        else if (statusText === 'stengt') courseStatus = 'closed'
      }
      if (text === 'rangen er') {
        const statusText = $(el).nextAll('span').first().text().trim().toLowerCase()
        if (statusText === 'åpen' || statusText === 'open') drivingRange = 'open'
        else if (statusText === 'stengt') drivingRange = 'closed'
      }
    })

    // Fallback: søk i headinger og lenker etter relevante nøkkelord
    if (courseStatus === 'unknown') {
      const headlines = []
      $('a, h1, h2, h3, h4, p').each((i, el) => {
        const text = $(el).text().trim().toLowerCase()
        if (text.length > 10) headlines.push(text)
      })
      const text = headlines.slice(0, 50).join(' ')

      if (/banen er (åpen|open)|banen åpner|åpner banen|sesongåpning/.test(text)) courseStatus = 'open'
      else if (/banen er stengt|banen stengt|stengt for sesongen/.test(text)) courseStatus = 'closed'

      if (drivingRange === 'unknown') {
        if (/rangen er (åpen|open)|rangen åpner/.test(text)) drivingRange = 'open'
        else if (/rangen er stengt|rangen stengt/.test(text)) drivingRange = 'closed'
      }
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Trysil scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
