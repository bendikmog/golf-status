const axios = require('axios')
const cheerio = require('cheerio')

async function scrape(url) {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)

    const container = $('.course-status-container .text')
    if (container.length === 0) {
      return { courses: [], drivingRange: 'unknown', statusText: null }
    }

    const courses = []
    let drivingRange = 'unknown'

    // Replace <br> with newlines for line-by-line parsing
    container.find('br').replaceWith('\n')
    const text = container.text()

    text.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.includes(':')) return

      const colonIdx = trimmed.indexOf(':')
      const label = trimmed.substring(0, colonIdx).trim().toLowerCase()
      const value = trimmed.substring(colonIdx + 1).trim().toLowerCase()

      const isOpen = value.includes('åpen') || value.includes('åpent') || value.includes('open')
      const isClosed = value.includes('stengt')
      if (!isOpen && !isClosed) return

      const status = isOpen ? 'open' : 'closed'

      const isRange = label.includes('range') || label.includes('rang')
      const isStudio = label.includes('studio')
      const isCourse = label.includes('byneset') || label.includes('bane') || label.includes('south') || label.includes('north')
      const isTraining = label.includes('treningsområde') || label.includes('putting') || label.includes('korthull')

      if (isRange) {
        drivingRange = status
      } else if (!isStudio && (isCourse || isTraining)) {
        const displayName = trimmed.substring(0, colonIdx).trim()
        courses.push({ name: displayName, status })
      }
    })

    return { courses, drivingRange, statusText: null }

  } catch (error) {
    console.error(`Byneset scrape failed for ${url}:`, error.message)
    return { courses: [], drivingRange: 'unknown', statusText: null }
  }
}

module.exports = { scrape }
