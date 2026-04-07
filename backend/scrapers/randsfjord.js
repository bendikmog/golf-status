const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url, { validateStatus: (s) => s < 600 })
    const $ = cheerio.load(response.data)

    // Randsfjorden bruker WordPress-blogg på forsiden for å
    // kommunisere banestatus via nyhetsinnlegg
    // Vi scanner de siste innleggenes titler og tekster
    const posts = []

    $('article, .post, .hentry').each((i, el) => {
      if (i >= 5) return // bare de 5 siste innleggene

      const title = $(el).find('h1, h2, h3, .entry-title')
        .first().text().trim()
      const excerpt = $(el).find('p').first().text().trim()

      if (title) posts.push(`${title} ${excerpt}`)
    })

    // Fallback: scan alle headings om article-tag ikke funker
    if (posts.length === 0) {
      $('h1, h2, h3').each((i, el) => {
        if (i >= 10) return
        posts.push($(el).text().trim())
      })
    }

    const combinedText = posts.join(' ').toLowerCase()

    // Detekter åpen
    const courseOpen =
      combinedText.includes('sesongåpning') ||
      combinedText.includes('åpner banen') ||
      combinedText.includes('banen åpner') ||
      combinedText.includes('banen er åpen') ||
      combinedText.includes('åpen for spill') ||
      combinedText.includes('sesongen er i gang') ||
      combinedText.includes('banen er open') ||
      combinedText.includes('open for spill')

    // Detekter stengt
    const courseClosed =
      combinedText.includes('vinterstengt') ||
      combinedText.includes('banen stengt') ||
      combinedText.includes('stengt for sesongen') ||
      combinedText.includes('banen er stengt') ||
      combinedText.includes('holder stengt') ||
      combinedText.includes('stengt inntil')

    // Bruk første innlegg som statusnotat
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
    console.error(`Randsfjord scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }