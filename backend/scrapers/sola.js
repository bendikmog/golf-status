const puppeteer = require('puppeteer')

async function scrape(url) {
  let browser
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Click the STATUS link to reveal the table
    await page.evaluate(() => {
      const statusLink = [...document.querySelectorAll('a')].find(a => a.innerText.trim() === 'STATUS')
      statusLink?.click()
    })
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Read the status table
    const result = await page.evaluate(() => {
      const table = [...document.querySelectorAll('table')]
        .find(t => t.innerText.includes('STENGT') || t.innerText.includes('ÅPEN'))
      if (!table) return null

      const rows = [...table.querySelectorAll('tr')].map(row => {
        const cells = [...row.querySelectorAll('td')]
        return {
          label: cells[0]?.innerText?.replace(/\s+/g, ' ').trim(),
          value: cells[1]?.innerText?.replace(/\s+/g, ' ').trim()
        }
      }).filter(r => r.label && r.value)

      return rows
    })

    if (!result) return { courses: [], drivingRange: 'unknown', statusText: null }

    const courses = []
    let drivingRange = 'unknown'

    result.forEach(({ label, value }) => {
      const l = label.toLowerCase()
      const isOpen   = value.includes('ÅPEN')
      const isClosed = value.includes('STENGT')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      if (l.includes('golfbane') || l.includes('bane')) {
        courses.push({ name: label.replace(/:$/, '').trim(), status })
      } else if (l.includes('driving range') || l.includes('range')) {
        // Combine both ranges — open if any is open
        if (isOpen) drivingRange = 'open'
        else if (drivingRange === 'unknown' && isClosed) drivingRange = 'closed'
      }
    })

    return {
      courses: courses.length > 0 ? courses : [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange,
      statusText: null,
    }

  } catch (error) {
    console.error(`Sola scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  } finally {
    if (browser) await browser.close()
  }
}

module.exports = { scrape }