const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'

    // Struktur: <h3>BANEN:</h3><p>STENGT/ÅPEN</p>
    $('h3').each((i, el) => {
      const label = $(el).text().trim().toLowerCase()
      const value = $(el).next('p').text().trim().toLowerCase()
      if (!value) return

      const isOpen = value.includes('åpen') || value.includes('open') || value === 'åpent'
      const isClosed = value.includes('stengt')

      if (label.includes('bane') || label.includes('bana')) {
        if (isOpen) courseStatus = 'open'
        if (isClosed) courseStatus = 'closed'
      } else if (label.includes('range') || label.includes('rang')) {
        if (isOpen) rangeStatus = 'open'
        if (isClosed) rangeStatus = 'closed'
      }
    })

    return { courses: [{ name: 'Golfbanen', status: courseStatus }], drivingRange: rangeStatus, statusText: null }

  } catch (error) {
    console.error(`Oppdal scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
