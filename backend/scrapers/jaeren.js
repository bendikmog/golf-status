const axios = require('axios')
const cheerio = require('cheerio')

// Extract text with spaces between block-level elements
function blockText($, el) {
  const html = $(el).html() || ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|li|h[1-6]|td|th)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBlocks($) {
  let courseStatus = 'unknown'
  let drivingRange = 'unknown'
  let statusText = null

  // Course status keywords — deliberately exclude hull-counts (9-hull, 18-hull)
  // as they appear in general marketing descriptions and trigger false positives.
  // Only phrases that clearly describe current status are used.
  const isCourseBlock = (lower) =>
    lower.includes('banestatus') ||
    lower.includes('banen er åpen') ||
    lower.includes('banen åpen') ||
    lower.includes('banen er stengt') ||
    lower.includes('banen stengt')

  $('[data-sqsp-text-block-content], .sqs-html-content').each(function(_, el) {
    const text = blockText($, el)
    const lower = text.toLowerCase()

    const hasDrivingRange = lower.includes('drivingrange') || lower.includes('driving range')

    if (hasDrivingRange) {
      if (lower.includes('åpen') || lower.includes('apen') || lower.includes('open')) drivingRange = 'open'
      else if (lower.includes('stengt') || lower.includes('closed')) drivingRange = 'closed'

      // Also check this status block for explicit course status mentions
      if (courseStatus === 'unknown' && isCourseBlock(lower)) {
        if (lower.includes('åpen') || lower.includes('apen') || lower.includes('open')) courseStatus = 'open'
        else if (lower.includes('stengt') || lower.includes('closed')) courseStatus = 'closed'
        if (!statusText && text.length > 10) statusText = text.substring(0, 250)
      }
    } else if (isCourseBlock(lower)) {
      if (courseStatus === 'unknown') {
        if (lower.includes('åpen') || lower.includes('apen') || lower.includes('open')) courseStatus = 'open'
        if (lower.includes('stengt') || lower.includes('closed')) courseStatus = 'closed'
      }
      if (!statusText && text.length > 10) statusText = text.substring(0, 250)
    }
  })

  return { courseStatus, drivingRange, statusText }
}

async function scrape(url) {
  try {
    const base = url.replace(/\/?$/, '')

    // Fetch main page (driving range status) and blog (course status) in parallel
    const [mainRes, blogRes] = await Promise.allSettled([
      axios.get(base, { timeout: 25000 }),
      axios.get(base + '/nyheter?format=json', { timeout: 25000 }),
    ])

    let mainResult = { courseStatus: 'unknown', drivingRange: 'unknown', statusText: null }
    if (mainRes.status === 'fulfilled') {
      mainResult = parseBlocks(cheerio.load(mainRes.value.data))
    }

    // Check latest banestatus blog post for course status and status note
    let blogResult = { courseStatus: 'unknown', drivingRange: 'unknown', statusText: null }
    if (blogRes.status === 'fulfilled') {
      const posts = blogRes.value.data?.items || []
      const statusPost = posts.find(p =>
        p.title?.toLowerCase().includes('banestatus') ||
        p.urlId?.toLowerCase().includes('banestatus') ||
        p.fullUrl?.toLowerCase().includes('banestatus')
      )
      if (statusPost) {
        const postHref = statusPost.fullUrl || statusPost.url || ''
        const postUrl = postHref.startsWith('http') ? postHref : base + postHref
        try {
          const postRes = await axios.get(postUrl, { timeout: 25000 })
          const $post = cheerio.load(postRes.data)
          blogResult = parseBlocks($post)
          // Capture first meaningful text block as status note even if status is unknown
          if (!blogResult.statusText) {
            $post('[data-sqsp-text-block-content], .sqs-html-content').each(function(_, el) {
              if (blogResult.statusText) return false
              const text = blockText($post, el)
              // Skip footer/contact blocks
              if (text.length > 50 && !text.toLowerCase().includes('org.nr') && !text.toLowerCase().includes('kontakt')) {
                blogResult.statusText = text.substring(0, 300)
              }
            })
          }
        } catch (_) {}
      }
    }

    // Blog post takes precedence for course status (dedicated status updates)
    // Main page preferred for driving range (permanent status block)
    const courseStatus = blogResult.courseStatus !== 'unknown' ? blogResult.courseStatus
      : mainResult.courseStatus !== 'unknown' ? mainResult.courseStatus
      : 'unknown'
    const drivingRange = mainResult.drivingRange !== 'unknown' ? mainResult.drivingRange : blogResult.drivingRange
    const statusText = blogResult.statusText || mainResult.statusText

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange,
      statusText,
    }

  } catch (error) {
    console.error(`Jæren scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
