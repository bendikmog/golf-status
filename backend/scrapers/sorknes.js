const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(`${url}/banestatus`, {
      validateStatus: (s) => s < 600,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    })
    const $ = cheerio.load(response.data)

    // Sørknes har en dedikert /banestatus-side (Laravel/Livewire-basert)
    // Statusteksten ligger i div.main-content under article#article
    const contentEl = $('article#article .main-content').first()

    if (contentEl.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const rawText = contentEl.text()
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!rawText) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const lower = rawText.toLowerCase()

    const courseOpen =
      lower.includes('banen er åpen') ||
      lower.includes('banen åpner') ||
      lower.includes('åpen for spill') ||
      lower.includes('banen er klar') ||
      lower.includes('åpner banen') ||
      lower.includes('sesongåpning') ||
      lower.includes('sesongen er i gang') ||
      lower.includes('banen er open') ||
      lower.includes('open for spill')

    const courseClosed =
      lower.includes('banen er stengt') ||
      lower.includes('stengt for sesongen') ||
      lower.includes('banen stengt') ||
      lower.includes('holder stengt') ||
      lower.includes('stengt inntil') ||
      lower.includes('vinterstengt')

    const rangeOpen =
      lower.includes('range åpen') ||
      lower.includes('rangen åpen') ||
      lower.includes('driving range åpen') ||
      lower.includes('korthullsbanen åpen') ||
      lower.includes('range open') ||
      lower.includes('rangen open') ||
      lower.includes('driving range open')

    const rangeClosed =
      lower.includes('range stengt') ||
      lower.includes('rangen stengt')

    const statusText = rawText.length > 300
      ? rawText.substring(0, 300) + '...'
      : rawText

    return {
      courses: [{
        name: 'Golfbanen',
        status: courseOpen ? 'open' : courseClosed ? 'closed' : 'unknown'
      }],
      drivingRange: rangeOpen ? 'open' : rangeClosed ? 'closed' : 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Sørknes scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
