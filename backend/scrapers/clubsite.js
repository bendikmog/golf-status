const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    // ============================================
    // STEP 1: Try the status table first
    // Clubsite tables have clear ÅPEN/STENGT values
    // ============================================

    const tableResult = scrapeTable($)

    // ============================================
    // STEP 2: Try the free text widget
    // Used as fallback or to supplement table data
    // ============================================

    const widgetResult = scrapeWidget($)

    // ============================================
    // STEP 3: Combine results
    // Table wins for open/closed — widget fills gaps
    // and always provides the status note text
    // ============================================

    const rawCourses = tableResult.courses.length > 0
      ? tableResult.courses
      : widgetResult.courses

    // Deduplicate by name (some sites repeat the same table rows)
    const seen = new Set()
    const deduped = rawCourses.filter(c => {
      const key = c.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort: real courses first, training areas (korthull, putting, etc.) last
    const isReal = name => {
      const n = name.toLowerCase()
      return !n.includes('korthull') && !n.includes('putting') &&
             !n.includes('chipping') && !n.includes('treningsgreen') &&
             !n.includes('nærspill') && !n.includes('trening') &&
             !n.includes('øving') && !n.includes('range')
    }
    const courses = [
      ...deduped.filter(c => isReal(c.name)),
      ...deduped.filter(c => !isReal(c.name)),
    ]

    const drivingRange = tableResult.drivingRange !== 'unknown'
      ? tableResult.drivingRange
      : widgetResult.drivingRange

    return {
      courses,
      drivingRange,
      // Always show the free text note if available
      statusText: widgetResult.statusText,
    }

  } catch (error) {
    console.error(`Clubsite scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

// ============================================
// TABLE SCRAPER
// Reads the structured ÅPEN/STENGT table
// ============================================

function scrapeTable($) {
  const result = { courses: [], drivingRange: 'unknown' }

  $('table tr').each((i, row) => {
    const cells = $(row).find('td')
    if (cells.length < 2) return

    const label = $(cells[0]).text().trim().toLowerCase()
    const statusRaw = $(cells[1]).text().trim().toUpperCase()

    // Only trust explicit ÅPEN/STENGT — ignore "Se info", empty, etc.
    const isOpen = statusRaw.includes('ÅPEN') || statusRaw.includes('OPEN')
    const isClosed = statusRaw.includes('STENGT')
    if (!isOpen && !isClosed) return

    const status = isOpen ? 'open' : 'closed'

    // Match any course-like label
    const isCourse = (
      label.includes('banen') ||
      label.includes('hull') ||
      label.includes('course') ||
      label.includes('golfbane') ||
      label.includes('bane') ||
      label.includes('aksjonær') ||
      label.includes('sløyfe') ||
      label.includes('putting') ||
      label.includes('korthull') ||
      label.includes('trening') ||
      label.includes('øving') ||
      label.includes('pitch')
    ) && !label.includes('range') &&
     !label.includes('golfbil') &&
     !label.includes('bil på') &&
     !label.includes('kiosk')

    if (isCourse) {
      const name = $(cells[0]).text().trim().replace(/\s*i\s*$/, '')
      result.courses.push({ name, status })
    }

    if (
      label.includes('driving range') ||
      label.includes('drivingrange') ||
      label.includes('driving-range') ||
      label.includes('range') ||
      label.includes('rangen')
    ) {
      result.drivingRange = status
    }
  })

  return result
}

// ============================================
// WIDGET SCRAPER
// Reads the free text coursecond widget
// ============================================

function scrapeWidget($) {
  const result = { courses: [], drivingRange: 'unknown', statusText: null }

  // Use only the FIRST coursecond widget - some sites have it twice
  const widget = $('.widget.coursecond').first()
  if (widget.length === 0) return result

  // Traget the content div directly - avoids picking up the headline
  const contentEl = widget.find('.cond-content, .gimmie-status').first()
  const target = contentEl.length > 0 ? contentEl : widget

  // Replace <br> tags with spaces before extracting texts
  // - otherwise sentences get joind without spaces
  target.find('br').replaceWith(' ')
  
  target.find('.headline, h3').remove()

  // Remove headline just in case
  target.find('.headline').remove()
  target.find('h3').remove()

  const rawText = target.text()
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!rawText) return result

  // Phrases that are meaningless placeholders — filter these out
  const MEANINGLESS_PHRASES = [
    'avventer rapport',
    'ingen gjeldende status',
    'ingen status',
    'ikke tilgjengelig',
    'kommer snart',
    'oppdateres snart',
  ]

  const isMeaningless = MEANINGLESS_PHRASES.some(phrase =>
    rawText.toLowerCase().includes(phrase)
  )

    // Strip out pure status phrases to see if anything meaningful remains
    const stripped = rawText
    .replace(/banen\s+er\s+stengt\.?/gi, '')
    .replace(/banen\s+er\s+åpen\.?/gi, '')
    .replace(/banen\s+stengt\.?/gi, '')
    .replace(/banen\s+åpen\.?/gi, '')
    .replace(/driving\s*range\s+er\s+(åpen|stengt)\.?/gi, '')
    .replace(/rangen\s+er\s+(åpen|stengt)\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

    // Only show note if there's meaningful content beyond pure status
    const isJustStatus = stripped.length < 10 || rawText.length < 30

    result.statusText = (isMeaningless || isJustStatus)
    ? null
    : rawText.length > 300
        ? rawText.substring(0, 300) + '...'
        : rawText

  const lower = rawText.toLowerCase()

  const courseOpen = lower.includes('banen åpen') ||
                     lower.includes('banen er åpen') ||
                     lower.includes('åpner banen') ||
                     lower.includes('banen åpner') ||
                     lower.includes('bane åpen') ||
                     lower.includes('banen open') ||
                     lower.includes('banen er open') ||
                     lower.includes('bane open')

  const courseClosed = lower.includes('banen stengt') ||
                       lower.includes('banen er stengt') ||
                       lower.includes('stenger banen')

  const rangeOpen = lower.includes('range åpen') ||
                    lower.includes('rangen åpen') ||
                    lower.includes('range åpner') ||
                    lower.includes('drivingrange åpen') ||
                    lower.includes('driving range åpner') ||
                    lower.includes('range open') ||
                    lower.includes('rangen open')

  const rangeClosed = lower.includes('range stengt') ||
                      lower.includes('rangen stengt')

  if (courseOpen || courseClosed) {
    result.courses = [{
      name: 'Golfbanen',
      status: courseOpen ? 'open' : 'closed'
    }]
  }

  if (rangeOpen || rangeClosed) {
    result.drivingRange = rangeOpen ? 'open' : 'closed'
  }

  return result
}

module.exports = { scrape }