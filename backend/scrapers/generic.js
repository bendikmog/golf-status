const axios = require('axios')
const cheerio = require('cheerio')
const { isRelevantStatusText } = require('./utils')

async function scrape(url) {
  try {
    const https = require('https')
    const response = await axios.get(url, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    })
    const $ = cheerio.load(response.data)

    let courseStatus = 'unknown'
    let rangeStatus = 'unknown'
    let statusText = null

    // --- Primær: sjekk paragrafer og Elementor-widgets ---
    $('p, .elementor-widget-text-editor div').each((i, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.length < 10 || text.length > 400) return

      const lower = text.toLowerCase()

      // Filtrer ut tekst uten relevante nøkkelord
      const hasCourseKeyword = lower.includes('banen') || lower.includes('bana') ||
                               lower.includes('golfpark') || lower.includes('stengt') ||
                               lower.includes('åpen') || lower.includes('vinterstengt')
      const hasRangeKeyword  = lower.includes('range') || lower.includes('rang')

      if (!hasCourseKeyword && !hasRangeKeyword) return

      const courseOpen   = /\bbanen er (åpen|open|åpnet)\b/.test(lower) ||
                           /\bbanen (åpen|open)\b/.test(lower) ||
                           /\bbane (åpen|open)\b/.test(lower) ||
                           /\bbana er (åpen|open|åpnet)\b/.test(lower) ||
                           /\bbana (åpen|open)\b/.test(lower) ||
                           /golfpark(en)? er (åpen|open|åpnet)\b/.test(lower) ||
                           /banestatus:\s*(åpen|open|åpnet)/.test(lower)
      const courseClosed = /\bbanen er stengt\b/.test(lower) ||
                           /\bbanen stengt\b/.test(lower) ||
                           /\bbanen:\s*stengt/.test(lower) ||
                           /\bbane er stengt\b/.test(lower) ||
                           /golfpark(en)? er (stengt|vinterstengt)\b/.test(lower) ||
                           /\bvinterstengt\b/.test(lower) ||
                           /banestatus:\s*(stengt|vinterstengt)/.test(lower)
      const rangeOpen    = lower.includes('rangen åpen')     || lower.includes('range åpen')      ||
                           lower.includes('rangen er åpen')  || lower.includes('rangen open')     ||
                           lower.includes('range open')      || lower.includes('rangen er open')  ||
                           /rangen\b.*åpnet/.test(lower) ||
                           /range\b.*åpnet/.test(lower) ||
                           /driving range:\s*(åpen|open|åpnet)/.test(lower) ||
                           /driving range er (åpen|open|åpnet)/.test(lower) ||
                           lower.includes('rangen har åpnet') || lower.includes('range har åpnet')
      const rangeClosed  = lower.includes('rangen stengt')    || lower.includes('rangen er stengt') ||
                           lower.includes('rangen tengt')     || lower.includes('range stengt')    ||
                           /driving range:\s*stengt/.test(lower) ||
                           /driving range er stengt/.test(lower)

      if (courseOpen && courseStatus === 'unknown')  courseStatus = 'open'
      if (courseClosed && courseStatus === 'unknown') courseStatus = 'closed'
      if (rangeOpen && rangeStatus === 'unknown')   rangeStatus = 'open'
      if (rangeClosed && rangeStatus === 'unknown') rangeStatus = 'closed'

      // Bruk som note hvis meningsfull, inneholder statuskeyword og ikke for gammel
      const hasStatusKeyword = /(åpen|open|åpnet|stengt|vinterstengt)/.test(lower)
      if (!statusText && text.length > 20 && hasStatusKeyword && isRelevantStatusText($, el)) {
        statusText = text.replace(/([a-zæøå!])([A-ZÆØÅ])/g, '$1 $2')
      }
    })

    // --- Fallback: scan headinger og nyhetstitler ---
    if (courseStatus === 'unknown' || rangeStatus === 'unknown') {
      const fallbackTexts = []
      $('h1, h2, h3, h4, h5, a').each((i, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim()
        if (t.length >= 10) fallbackTexts.push(t)
      })
      $('img[alt]').each((i, el) => {
        const t = $(el).attr('alt').trim()
        if (t.length >= 10) fallbackTexts.push(t)
      })
      fallbackTexts.forEach(text => {
        // Normaliser manglende mellomrom mellom sammenslåtte ord (f.eks. "klubbBanen" → "klubb Banen")
        const normalized = text.replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2')
        const lower = normalized.toLowerCase()

        if (courseStatus === 'unknown') {
          const hasBane = /\bbane[nt]?\b|\bbana\b/.test(lower)
          if (hasBane && /(åpen|open)/.test(lower)) courseStatus = 'open'
          else if (hasBane && /(stengt|vinterstengt)/.test(lower)) courseStatus = 'closed'
          else if (/stengt for sesongen/.test(lower)) courseStatus = 'closed'
        }
        if (rangeStatus === 'unknown') {
          const hasRange = lower.includes('rang')
          if (hasRange && /(åpen|open|åpnet)/.test(lower)) rangeStatus = 'open'
          else if (hasRange && /stengt/.test(lower)) rangeStatus = 'closed'
        }
      })
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: rangeStatus,
      statusText,
    }

  } catch (error) {
    console.error(`Bamble scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
