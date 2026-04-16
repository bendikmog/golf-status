const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    // Stord has no dedicated status page — scan their Wix blog RSS for status posts
    const feedRes = await axios.get(url.replace(/\/?$/, '') + '/blog-feed.xml', { timeout: 25000 })
    const $ = cheerio.load(feedRes.data, { xmlMode: true })

    let courseStatus = 'unknown'
    let statusText = null

    $('item').each((_i, el) => {
      const title   = $(el).find('title').text().trim().toLowerCase()
      const content = $(el).find('description').text().toLowerCase()
      const combined = title + ' ' + content

      if (combined.includes('bane') || combined.includes('bana') || combined.includes('banestatus')) {
        if (combined.includes('open') || combined.includes('åpen') || combined.includes('apen')) {
          courseStatus = 'open'
        } else if (combined.includes('stengt') || combined.includes('stengd') || combined.includes('closed')) {
          courseStatus = 'closed'
        }
        if (courseStatus !== 'unknown') {
          statusText = $(el).find('title').text().trim()
          return false
        }
      }
    })

    // Fallback: check homepage rich text (Wix wixui-rich-text elements)
    if (courseStatus === 'unknown') {
      const homeRes = await axios.get(url, { timeout: 25000 }).catch(() => null)
      if (homeRes) {
        const $h = cheerio.load(homeRes.data)
        $h('.wixui-rich-text, [data-testid="richTextElement"]').each((_i, el) => {
          const text = $h(el).text().replace(/\s+/g, ' ').trim().toLowerCase()
          if (text.includes('bane') || text.includes('bana')) {
            if (text.includes('open') || text.includes('åpen') || text.includes('apen')) {
              courseStatus = 'open'; return false
            } else if (text.includes('stengt') || text.includes('stengd') || text.includes('closed')) {
              courseStatus = 'closed'; return false
            }
          }
        })
      }
    }

    return {
      courses: [{ name: 'Golfbanen', status: courseStatus }],
      drivingRange: 'unknown',
      statusText,
    }

  } catch (error) {
    console.error(`Stord scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
