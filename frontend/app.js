// The URL of the backend API
const API_URL = '/api/courses'

// Keep track of all courses and the active filter
let allCourses = []
let activeRegion = 'all'
let userLat = null
let userLon = null
let maxDistance = null

// Run this as soon as the page loads
document.addEventListener('DOMContentLoaded',() => {
    fetchCourses()
})

// Fetch all course data from our backend
async function fetchCourses() {
    const MAX_RETRIES = 5
    const RETRY_DELAY_MS = 4000

    showLoading(true)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(API_URL)
            const data = await response.json()

            const courses = data.courses
            allCourses = courses

            buildFilterButtons(courses)
            renderCourses(courses)

            // Show last updated timestamp
            if (data.meta?.cachedAt) {
                const updated = new Date(data.meta.cachedAt)
                const formatted = updated.toLocaleString('nb-NO', {
                    timeZone: 'Europe/Oslo',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                })
                const el = document.getElementById('last-updated')
                if (el) el.textContent = `Sist oppdatert: ${formatted}`
            }

            showLoading(false)
            return

        } catch (error) {
            console.error(`Forsøk ${attempt} feilet:`, error)

            if (attempt < MAX_RETRIES) {
                // Server starter trolig opp — vent og prøv igjen
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
            } else {
                // Alle forsøk brukt opp — vis feilmelding
                showLoading(false)
                document.getElementById('error').classList.remove('hidden')
            }
        }
    }
}

// Calculate distance in km between two coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Build filtering
function buildFilterButtons(courses) {
  const filterContainer = document.getElementById('filter-bar')
  if (!filterContainer) return

  const counties = [...new Set(courses.map(c => c.county).filter(Boolean))].sort()

  filterContainer.innerHTML = `
    <div class="filter-box">
      <span class="filter-label">Status</span>
      <div class="filter-group">
        <button class="filter-btn active" data-filter="status" data-value="all">Alle</button>
        <button class="filter-btn" data-filter="status" data-value="green">🟢 Åpen</button>
        <button class="filter-btn" data-filter="status" data-value="yellow">🟡 Delvis åpen</button>
        <button class="filter-btn" data-filter="status" data-value="red">🔴 Stengt</button>
      </div>
    </div>
    <div class="filter-box">
      <span class="filter-label">Område</span>
      <div class="filter-group">
        <button class="filter-btn active" data-filter="county" data-value="all">Alle</button>
        ${counties.map(c => `<button class="filter-btn" data-filter="county" data-value="${c}">${c}</button>`).join('')}
      </div>
    </div>
  `

  // Active filters — sets for multi-select
  const activeStatuses = new Set(['all'])
  const activeCounties = new Set(['all'])

  function applyFilters() {
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase().trim() || ''

    document.querySelectorAll('.course-card').forEach(card => {
      const id = card.dataset.courseId
      const course = courses.find(c => c.id === id)
      if (!course) return

      const overallStatus = getOverallStatus(course)
      const statusMatch = activeStatuses.has('all') || activeStatuses.has(overallStatus)
      const countyMatch = activeCounties.has('all') || activeCounties.has(course.county)
      const searchMatch = searchQuery === '' || course.name.toLowerCase().includes(searchQuery)

      // Distance filter
      const distanceMatch = !userLat || !maxDistance
      ? true
      : haversineDistance(userLat, userLon, course.lat, course.lon) <= maxDistance

      card.style.display = statusMatch && countyMatch && searchMatch && distanceMatch ? '' : 'none'
    })
  }

  function handleFilterClick(e) {
    const btn = e.target.closest('[data-filter]')
    if (!btn) return

    const filter = btn.dataset.filter
    const value = btn.dataset.value
    const activeSet = filter === 'status' ? activeStatuses : activeCounties
    const groupSelector = `[data-filter="${filter}"]`

    if (value === 'all') {
      // Clicking "Alle" resets to only "Alle" active
      activeSet.clear()
      activeSet.add('all')
    } else {
      // Toggle this value
      activeSet.delete('all')
      if (activeSet.has(value)) {
        activeSet.delete(value)
        // If nothing left, reset to "Alle"
        if (activeSet.size === 0) activeSet.add('all')
      } else {
        activeSet.add(value)
      }
    }

    // Update button active states
    document.querySelectorAll(groupSelector).forEach(b => {
      b.classList.toggle('active', activeSet.has(b.dataset.value))
    })

    applyFilters()
  }

  filterContainer.addEventListener('click', handleFilterClick)
  document.getElementById('search-input').addEventListener('input', e => {
    applyFilters()
  })

  // Distance filter
  const postnummerInput = document.getElementById('postnummer-input')
  const distanceSelect = document.getElementById('distance-select')

  async function updateDistanceFilter() {
    const nr = postnummerInput.value.trim()
    const dist = distanceSelect.value

    if (nr.length === 4 && dist) {
      try {
        postnummerInput.style.borderColor = '#d97706' // loading indicator
        const response = await fetch(`/api/postnummer/${nr}`)
        if (response.ok) {
          const data = await response.json()
          userLat = data.lat
          userLon = data.lon
          maxDistance = parseInt(dist)
          postnummerInput.style.borderColor = 'var(--green-main)'
          postnummerInput.title = data.poststed
        } else {
          postnummerInput.style.borderColor = '#dc2626'
          userLat = null
          userLon = null
          maxDistance = null
        }
      } catch {
        postnummerInput.style.borderColor = '#dc2626'
      }
    } else {
      postnummerInput.style.borderColor = ''
      userLat = null
      userLon = null
      maxDistance = null
    }

    applyFilters()
  }

  postnummerInput.addEventListener('input', updateDistanceFilter)
  distanceSelect.addEventListener('change', updateDistanceFilter)
}

// Switch the active filter and re-render
function setActiveFilter(region) {
    activeRegion = region

    // Update which button looks active
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.region === region)
    })

    // Filter the courses and re-render
    const filtered = region === 'all'
        ? allCourses
        : allCourses.filter(c => c.region === region)
    
    renderCourses(filtered)
}

//Build and display course cards
function renderCourses(courses) {
    const grid = document.getElementById('course-grid')

    //Clear whatever is currently in the grid
    grid.innerHTML = ''

    //Build a card for each course
    courses.forEach(course => {
        const card = buildCard(course)
        grid.appendChild(card)
    })
}

// Evaluate status for card - used in colored circle
function getOverallStatus(course) {
  if (!course.status?.courses) return 'yellow'
  const courseList = course.status.courses

  // Only "real" courses count for green status
  // Korthullsbane, puttinggreen, chippinggreen etc. are training areas
  const isRealCourse = (name) => {
    const n = name.toLowerCase()
    return !n.includes('korthull') &&
           !n.includes('putting') &&
           !n.includes('chipping') &&
           !n.includes('treningsgreen') &&
           !n.includes('nærspill') &&
           !n.includes('trening') &&
           !n.includes('øving') &&
           !n.includes('range')
  }

  const realCourses = courseList.filter(c => isRealCourse(c.name))
  const trainingOnly = realCourses.length === 0 && courseList.length > 0

  // Green — at least one REAL course is open
  const anyRealOpen = realCourses.some(c => c.status === 'open')
  if (anyRealOpen) return 'green'

  // Red — all real courses closed AND range closed
  // (or only training facilities exist and range is closed)
  const allRealClosed = realCourses.length > 0 && realCourses.every(c => c.status === 'closed')
  const rangeClosed = course.status.drivingRange === 'closed'
  if ((allRealClosed || trainingOnly) && rangeClosed) return 'red'

  // Yellow — training areas open, range open, or unknown status
  return 'yellow'
}

// Build a single course card element
function buildCard(course) {
  const card = document.createElement('div')
  card.className = 'course-card'
  card.dataset.courseId = course.id

  const overallStatus = getOverallStatus(course)

  // Build course status rows
  const courseRows = course.status?.courses?.length > 0
    ? course.status.courses.map(c => `
        <div class="status-row">
          <span class="status-label">${c.name}</span>
          <span class="badge ${c.status}">${formatStatus(c.status)}</span>
        </div>
      `).join('')
    : `<div class="status-row">
        <span class="status-label">Golfbanen</span>
        <span class="badge unknown">Status ikke tilgjengelig</span>
      </div>`

// Note is a div (not an anchor) to avoid invalid HTML nesting issues.
// A small "read more" link inside opens the clubs website instead
const statusNote = course.status.statusText
        ? `<div class="status-note">
            <span class="status-note-icon">📋</span>
            <div class="status-note-content">
                <p>${course.status.statusText}</p>
                <a href="${course.url}" target="_blank" class="status-note-link">
                    Les mer på klubbens nettside →
                </a>
            </div>
        </div>`
    : ''

const weatherHTML = buildWeatherSection(course.weather)

  card.innerHTML = `
    <div class="course-card-header">
        ${course.logo
            ? `<a href="${course.url}" target="_blank" rel="noopener noreferrer"><img class="course-logo" src="${course.logo}" alt="${course.name} logo" onerror="this.style.display='none'"></a>`
            : ''
        }
        <h2>${course.name}</h2>
        <div class="status-dot ${overallStatus}"></div>
    </div>

    <div class="course-card-body">

      <div class="status-section">
        ${courseRows}
        ${course.status?.drivingRange !== null && course.status?.drivingRange !== undefined ? `
        <div class="status-row">
          <span class="status-label">Driving range:</span>
          <span class="badge ${course.status.drivingRange}">
            ${formatStatus(course.status.drivingRange)}
          </span>
        </div>` : ''}
    </div>

    ${statusNote}

    ${weatherHTML}

    </div>
  `

  return card
}

// Convert wind direction degrees to an arrow pointing the direction wind comes FROM
function getWindArrow(degrees) {
  if (degrees === undefined || degrees === null) return '↑'
  const arrows = ['↓','↙','←','↖','↑','↗','→','↘']
  const index = Math.round(((degrees + 180) % 360) / 45) % 8
  return arrows[index]
}

// Format a date as "I dag – man 6. apr", "I morgen – tir 7. apr", or "ons 8. apr"
function formatWeatherDate(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const formatted = date.toLocaleDateString('nb-NO', {
    timeZone: 'Europe/Oslo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  if (isSameDay(date, today)) return `I dag – ${formatted}`
  if (isSameDay(date, tomorrow)) return `I morgen – ${formatted}`
  return formatted
}

// Group weather entries by date (Oslo timezone), returns { dateStr -> [entries] }
function groupWeatherByDay(weather) {
  const groups = {}
  for (const entry of weather) {
    const dateStr = new Date(entry.time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
    if (!groups[dateStr]) groups[dateStr] = []
    groups[dateStr].push(entry)
  }
  return groups
}

// Build a grid of 4 weather cells for a given set of hourly entries
function buildWeatherGrid(entries) {
  const slots = [
    { label: '08 – 12', fromHour: 8,  toHour: 12 },
    { label: '12 – 16', fromHour: 12, toHour: 16 },
    { label: '16 – 20', fromHour: 16, toHour: 20 },
    { label: '20 – 00', fromHour: 20, toHour: 24 },
  ]

  return slots.map(slot => {
    const midHour = (slot.fromHour + slot.toHour) / 2

    const best = entries.reduce((closest, hour) => {
      const h = new Date(hour.time).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', hour: 'numeric', hour12: false })
      const diff = Math.abs(parseInt(h) - midHour)
      const closestDiff = Math.abs(parseInt(new Date(closest.time).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', hour: 'numeric', hour12: false })) - midHour)
      return diff < closestDiff ? hour : closest
    })

    const iconUrl = `https://cdn.jsdelivr.net/gh/metno/weathericons@main/weather/svg/${best.symbol}.svg`
    const windArrow = getWindArrow(best.windDirection)
    const windColor = best.windSpeed > 8 ? '#dc2626' : best.windSpeed > 5 ? '#d97706' : '#2563eb'

    return `
      <div class="weather-cell">
        <div class="weather-cell-time">${slot.label}</div>
        <div class="weather-cell-main">
          <img src="${iconUrl}" class="weather-cell-icon" alt="${best.symbol}" />
          <span class="weather-cell-temp">${Math.round(best.temperature)}°</span>
        </div>
        <div class="weather-cell-details">
          <span class="weather-cell-wind" style="color:${windColor}">${windArrow} ${best.windSpeed.toFixed(1)} m/s</span>
          <span class="weather-cell-rain" style="color:#0891b2">☔️ ${best.precipitation.toFixed(1)} mm</span>
        </div>
      </div>`
  }).join('')
}

// Build the HTML for weather — one row per day (today + tomorrow)
function buildWeatherSection(weather) {
  if (!weather || weather.length === 0) return ''

  const groups = groupWeatherByDay(weather)
  const days = Object.keys(groups).sort().slice(0, 2)

  const dayRows = days.map(dateStr => {
    const label = formatWeatherDate(groups[dateStr][0].time)
    const grid = buildWeatherGrid(groups[dateStr])
    return `
      <div class="weather-day">
        <div class="weather-date">${label}</div>
        <div class="weather-grid">${grid}</div>
      </div>`
  }).join('')

  return `
    <div class="weather-section">
      <div class="weather-label">Værvarsel</div>
      ${dayRows}
    </div>`
}

// Convert status codes to Norwegian display text
function formatStatus(status) {
    if (status == 'open')       return 'Åpen'
    if (status == 'closed')     return 'Stengt'
    return 'Status ikke tilgjengelig'     
}

// Show or hide the loading indicator
function showLoading(visible) {
    document.getElementById('loading').classList.toggle('hidden', !visible)
}