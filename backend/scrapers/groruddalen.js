const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // ── Course & range status from the structured table ──────────────────────
    let courseStatus = 'unknown'
    let rangeStatus  = 'unknown'

    $('table tr').each((i, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return

      const label     = $(cells[0]).text().trim().toLowerCase()
      const statusRaw = $(cells[1]).text().trim().toUpperCase()

      const isOpen   = statusRaw.includes('ÅPEN') || statusRaw.includes('OPEN')
      const isClosed = statusRaw.includes('STENGT')
      if (!isOpen && !isClosed) return

      const status = isOpen ? 'open' : 'closed'

      if (label.includes('golfbanen') || label === 'banen') courseStatus = status
      if (label.includes('driving range') || label.includes('range')) rangeStatus = status
    })

    // ── StatusText: pick the news article that best matches known status ──────
    // Groruddalen's article dates are unreliable (all show same date) and DOM
    // order is inconsistent — so instead we score each relevant article by how
    // well it aligns with the table status we already know is correct.
    const candidates = []

    $('.article-box').each((i, el) => {
      const spans = $(el).find('.content p span')
      const title   = spans.eq(0).text().trim()
      const subtext = spans.eq(1).text().trim()
      const text = [title, subtext].filter(Boolean).join(' – ')
      if (!text) return

      const lower = text.toLowerCase()

      const mentionsCourse = lower.includes('banen') || lower.includes('bane')
      const mentionsRange  = lower.includes('range') || lower.includes('rangen')
      if (!mentionsCourse && !mentionsRange) return

      const signalsClosed = lower.includes('stengt') || lower.includes('stenger') || lower.includes('holder stengt')
      const signalsOpen   = lower.includes('åpen') || lower.includes('åpner') || lower.includes('open')

      let score = 1 // base score for being relevant

      // Bonus if article aligns with the current table status
      if (mentionsRange) {
        if (rangeStatus === 'closed' && signalsClosed) score += 10
        if (rangeStatus === 'open'   && signalsOpen)   score += 10
        // Penalty if it contradicts known status (likely outdated)
        if (rangeStatus === 'closed' && signalsOpen && !signalsClosed) score -= 5
        if (rangeStatus === 'open'   && signalsClosed && !signalsOpen) score -= 5
      }
      if (mentionsCourse) {
        if (courseStatus === 'closed' && signalsClosed) score += 10
        if (courseStatus === 'open'   && signalsOpen)   score += 10
        if (courseStatus === 'closed' && signalsOpen && !signalsClosed) score -= 5
        if (courseStatus === 'open'   && signalsClosed && !signalsOpen) score -= 5
      }

      candidates.push({ text, score, domIndex: i })
    })

    // Pick highest score; break ties by preferring later DOM position
    candidates.sort((a, b) => b.score - a.score || b.domIndex - a.domIndex)

    const statusText = candidates.length > 0 ? candidates[0].text : null

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Groruddalen scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
