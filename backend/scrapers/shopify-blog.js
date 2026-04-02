const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // Romerike uses direct <a> links with href containing the blog slug
    // Find the first article link — most recent post
    let latestTitle = null
    let latestExcerpt = null

    // Extract blog slug from url to match article links
    // e.g. url = "https://romerikegk.no/blogs/banestatus"
    // article links contain "/blogs/banestatus/"
    const urlPath = new URL(url).pathname  // e.g. "/blogs/banestatus"

    // Exclude tag filter links (/tagged/) — only match actual article links
    $(`a[href*="${urlPath}/"]`).each((i, el) => {
    const href = $(el).attr('href') || ''
    
    // Skip tag filter links
    if (href.includes('/tagged/')) return
    
    const text = $(el).text().trim()
    if (text.length > 5 && !latestTitle) {
        latestTitle = text
        const excerpt = $(el).closest('li, div, article')
                            .find('p')
                            .first()
                            .text()
                            .replace(/\s+/g, ' ')
                            .trim()
        if (excerpt && excerpt !== text) latestExcerpt = excerpt
    }
    })

    if (!latestTitle) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const statusText = latestExcerpt
      ? `${latestTitle}: ${latestExcerpt}`.substring(0, 300)
      : latestTitle

    return {
      courses: [],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Shopify blog scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }