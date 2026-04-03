const { getBrowser } = require('./browser')

async function scrape(url) {
    let page = null

    try {
        const browser = await getBrowser()
        page = await browser.newPage()
        await page.goto(url, { waitUntil: 'networkidle2' })

        // Wait for widget to load instead of a hardcoded sleep
        await page.waitForSelector('.widget.coursecond .gimmie-status', { timeout: 8000 }).catch(() => {})

        const statusText = await page.evaluate(() => {
            const widget = document.querySelector('.widget.coursecond .gimmie-status')
            if (!widget) return null

            // Remove image if there is one
            const img = widget.querySelector('.template.img')
            if (img) img.remove()

            // Fetch all text elements separately and join with spaces
            const parts = []
            widget.childNodes.forEach(node => {
                const text = node.textContent.trim()
                if (text) parts.push(text)
            })

            return parts.join(' ').replace(/\s+/g, ' ').trim() || null
        })

        return {
            courses: [],
            drivingRange: 'unknown',
            statusText,
        }

    } catch (error) {
        console.error(`Coursecond widget scrape failed for ${url}:`, error.message)
        return { courses: [], drivingRange: 'unknown', statusText: null }
    } finally {
        if (page) await page.close().catch(() => {})
    }
}

module.exports = { scrape }
