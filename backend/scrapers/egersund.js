const { scrapeGlfr } = require('./glfr')
const { scrape: scrapeNews } = require('./news-keywords')

// Egersund publishes status via GLFR RSS — with fallback to news-keywords
async function scrape(url) {
  try {
    const result = await scrapeGlfr('egersund-golfklubb')
    if (result && result.courses.length > 0 && result.courses[0].status !== 'unknown') {
      return result
    }
  } catch (_e) {
    // GLFR unavailable — fall through
  }

  // Fallback: latest news headline
  try {
    return await scrapeNews(url)
  } catch (error) {
    console.error(`Egersund scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
