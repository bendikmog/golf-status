const puppeteer = require('puppeteer')

async function scrape(url) {
    //browser keeps webinstance running - we'll close it in the finally block
    let browser = null
    
    try {
        // start invisbile chorme-browser
        browser = await puppeteer.launch({
            //headless: true means invisible - no visible browser is shown on the screen
            headless: true,
            args: ['--no-sandbox'],
        })

        // Open a new tab in browser
        const page = await browser.newPage()

        // Go to URL and wait for it to load
        await page.goto(url, { waitUntil: 'networkidle2'})

        // Wait 3 seconds extra as widget is loaded by JS
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Fetch HTML directly from browser via page.evaluate()
        // This runs code IN the browser, not in Node.js
        const statusText = await page.evaluate(() => {
            const widget = document.querySelector('.widget.coursecond .gimmie-status')
            if (!widget) return null

            // Remove image if there is one
            const img = widget.querySelector('.template.img')
            if (img) img.remove()
            
            // Fetch all text elements separately and join with spaces
            // This will give the right spacing
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
        return { courses: [], drivingRange: 'unknown', statusText: null}    
    } finally {
        // Always close browser - if not it hangs in the background
        if (browser) await browser.close()
    }
}

module.exports = { scrape }