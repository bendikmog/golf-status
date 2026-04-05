const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(`${url}/aktuelt/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    })
    const $ = cheerio.load(response.data)

    // Valdres bruker /aktuelt/ med a.box-link-elementer for nyhetsinnlegg
    // Hvert innlegg har h3 (tittel) og p (ingress)
    const posts = []
    $('a.box-link').each((i, el) => {
      if (i >= 5) return
      const title = $(el).find('h3').first().text().trim()
      const excerpt = $(el).find('p').first().text().trim()
      if (title) posts.push(`${title} ${excerpt}`)
    })

    if (posts.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const combinedText = posts.join(' ').toLowerCase()

    const courseOpen =
      combinedText.includes('banen er åpen') ||
      combinedText.includes('banen åpner') ||
      combinedText.includes('åpen for spill') ||
      combinedText.includes('sesongåpning') ||
      combinedText.includes('åpner banen') ||
      combinedText.includes('sesongen er i gang') ||
      combinedText.includes('banen er klar')

    const courseClosed =
      combinedText.includes('stengt banen') ||
      combinedText.includes('banen er stengt') ||
      combinedText.includes('stengt for sesongen') ||
      combinedText.includes('vinterstengt') ||
      combinedText.includes('holder stengt') ||
      combinedText.includes('stengt inntil')

    const statusText = posts[0]
      ? posts[0].substring(0, 300)
      : null

    return {
      courses: [{
        name: 'Golfbanen',
        status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'
      }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Valdres scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
