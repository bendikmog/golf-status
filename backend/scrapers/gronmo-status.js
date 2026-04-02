const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
    try {
        const response = await axios.get(url)
        const $ = cheerio.load(response.data)

        // Grønmo has a status line in the format:
        // "Banen: Stengt | Rangen: Stengt | Nærspill: Stengt"
        // This is found in the article content of the driving range page
        let courseStatus = 'unknown'
        let rangeStatus = 'unknown'
        let statusText = null

        // Look for the pipe-separated status line — it's in an h4 tag
        $('h4, article p, .entry-content p').each((i, el) => {
        const text = $(el).text().trim()

        if (text.includes('|') && text.toLowerCase().includes('banen')) {
            // Clean up multiple spaces before checking
            const lower = text.toLowerCase().replace(/\s+/g, ' ')

            const courseOpen   = lower.includes('banen: åpen')
            const courseClosed = lower.includes('banen: stengt')
            const rangeOpen    = lower.includes('rangen: åpen')
            const rangeClosed  = lower.includes('rangen: stengt')

            if (courseOpen || courseClosed) {
            courseStatus = courseOpen ? 'open' : 'closed'
            }
            if (rangeOpen || rangeClosed) {
            rangeStatus = rangeOpen ? 'open' : 'closed'
            }

            // Only show as note if it contains more than just status values
            // Strip out the known status parts and see if anything meaningful remains
            const stripped = text
            .replace(/banen:\s*(åpen|stengt)/gi, '')
            .replace(/rangen:\s*(åpen|stengt)/gi, '')
            .replace(/nærspill:\s*(åpen|stengt)/gi, '')
            .replace(/\|/g, '')
            .replace(/\s+/g, ' ')
            .trim()

            // If stripping status leaves meaningful text, show it as a note
            statusText = stripped.length > 5 ? text.replace(/\s+/g, ' ').trim() : null
            return false
        }
        })

            return {
                courses: [{name: 'Golfbanen', status: courseStatus}],
                drivingRange: rangeStatus,
                statusText,
            }

} catch (error) {
    console.error(`Grønmo scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }