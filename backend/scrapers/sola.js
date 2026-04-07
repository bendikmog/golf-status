const { getBrowser } = require('./browser')

async function scrape(url) {
  let page
  try {
    const browser = await getBrowser()
    page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Click the STATUS link (#drop-status) to reveal the table
    await page.evaluate(() => {
      const statusLink = document.querySelector('#drop-status') ||
        [...document.querySelectorAll('a')].find(a => a.innerText.trim() === 'STATUS')
      statusLink?.click()
    })

    // Wait until the status table appears (up to 8 seconds), ignore timeout
    await page.waitForFunction(() => {
      return [...document.querySelectorAll('table')]
        .some(t => t.innerText.includes('STENGT') || t.innerText.includes('ÅPEN') || t.innerText.includes('OPEN'))
    }, { timeout: 8000 }).catch(() => {})

    // Read the status table
    const result = await page.evaluate(() => {
      const table = [...document.querySelectorAll('table')]
        .find(t => t.innerText.includes('STENGT') || t.innerText.includes('ÅPEN') || t.innerText.includes('OPEN'))
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
    let drivingRange = null

    result.forEach(({ label, value }) => {
      const l = label.toLowerCase()
      const isOpen   = value.includes('ÅPEN') || value.includes('OPEN')
      const isClosed = value.includes('STENGT')
      const status   = isOpen ? 'open' : isClosed ? 'closed' : 'unknown'

      // Skip admin/service rows
      if (l.includes('klubbkontor') || l.includes('bilutleie')) return

      // Add everything (courses, ranges, treningsområder) to the list
      courses.push({ name: label.replace(/:$/, '').trim(), status })
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
    if (page) await page.close().catch(() => {})
  }
}

module.exports = { scrape }
