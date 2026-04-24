// The URL of the backend API
const API_URL = '/api/courses'

// Feature flag — set to false to revert to original non-collapsible cards
const COLLAPSIBLE_CARDS = true

// ============================================
// XSS-beskyttelse
// All tekst fra scraping/eksterne kilder MÅ gjennom esc() før den
// interpoleres inn i en innerHTML-streng. URL-er skal gjennom safeUrl()
// for å blokkere "javascript:"-lenker o.l.
// ============================================
function esc(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeUrl(url) {
  if (!url) return ''
  const trimmed = String(url).trim()
  // Kun http(s) og relative stier er lov
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return esc(trimmed)
  }
  return ''
}

// Keep track of all courses and the active filter
let allCourses = []
let activeRegion = 'all'
let userLat = null
let userLon = null
let maxDistance = null

// Run this as soon as the page loads
document.addEventListener('DOMContentLoaded',() => {
    fetchCourses()
    initScrollBehaviour()
})

// Hide search bar on scroll down, reveal on scroll up
function initScrollBehaviour() {
    const searchBar = document.getElementById('search-bar')
    let lastScrollY = window.scrollY

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY
        const scrollingDown = currentScrollY > lastScrollY
        const pastThreshold = currentScrollY > 80

        searchBar.classList.toggle('scroll-hidden', scrollingDown && pastThreshold)
        lastScrollY = currentScrollY
    }, { passive: true })
}

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

  // Debug-modus: låses opp med ?debug=1 i URL-en. Viser en ekstra filter-knapp
  // for "Ingen info"-baner slik at Bendik raskt kan se hvilke scrapere som
  // muligens trenger vedlikehold. Skjult for vanlige brukere.
  const isDebug = new URLSearchParams(location.search).has('debug')

  filterContainer.innerHTML = `
    <div class="filter-box">
      <span class="filter-label">Status</span>
      <div class="filter-group">
        <button class="filter-btn filter-btn--open-only" data-filter="status" data-value="green" data-exclusive="true"><span class="filter-btn-dot"></span>Bare åpne</button>
        <button class="filter-btn active" data-filter="status" data-value="all">Alle</button>
        <button class="filter-btn" data-filter="status" data-value="green">🟢 Åpen</button>
        <button class="filter-btn" data-filter="status" data-value="yellow">🟡 Delvis åpen</button>
        <button class="filter-btn" data-filter="status" data-value="red">🔴 Stengt</button>
        ${isDebug ? `<button class="filter-btn" data-filter="status" data-value="gray">⚪ Ingen info</button>` : ''}
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
  let show18HolesOnly = false

  function applyFilters() {
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase().trim() || ''
    let visibleCount = 0

    document.querySelectorAll('.course-card').forEach(card => {
      const id = card.dataset.courseId
      const course = courses.find(c => c.id === id)
      if (!course) return

      const overallStatus = getOverallStatus(course)
      const statusMatch = activeStatuses.has('all') || activeStatuses.has(overallStatus)
      const countyMatch = activeCounties.has('all') || activeCounties.has(course.county)
      const searchMatch = searchQuery === '' || course.name.toLowerCase().includes(searchQuery)
      const holesMatch = !show18HolesOnly || course.holes === 18

      // Distance filter
      const distanceMatch = !userLat || !maxDistance
      ? true
      : haversineDistance(userLat, userLon, course.lat, course.lon) <= maxDistance

      const visible = statusMatch && countyMatch && searchMatch && holesMatch && distanceMatch
      card.style.display = visible ? '' : 'none'
      if (visible) visibleCount++
    })

    // Vis "ingen treff"-meldingen hvis alle kort er filtrert bort
    const noResults = document.getElementById('no-results')
    if (noResults) noResults.classList.toggle('hidden', visibleCount > 0)
  }

  function handleFilterClick(e) {
    const btn = e.target.closest('[data-filter]')
    if (!btn) return

    const filter = btn.dataset.filter
    const value = btn.dataset.value
    const activeSet = filter === 'status' ? activeStatuses : activeCounties
    const groupSelector = `[data-filter="${filter}"]`

    if (btn.dataset.exclusive === 'true') {
      // Snarveisknapp (f.eks. "Bare åpne"): sett kun denne verdien aktiv,
      // overstyrer evt. multi-seleksjon i chip-raden.
      activeSet.clear()
      activeSet.add(value)
    } else if (value === 'all') {
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

    // Update button active states. Eksklusive knapper er kun "aktive" når
    // settet inneholder nøyaktig deres verdi — ellers ville de lyst opp
    // hver gang chip-raden hadde den samme verdien i multi-seleksjon.
    document.querySelectorAll(groupSelector).forEach(b => {
      const isExclusive = b.dataset.exclusive === 'true'
      const active = isExclusive
        ? activeSet.size === 1 && activeSet.has(b.dataset.value)
        : activeSet.has(b.dataset.value)
      b.classList.toggle('active', active)
    })

    applyFilters()
  }

  filterContainer.addEventListener('click', handleFilterClick)

  document.getElementById('holes-toggle').addEventListener('click', () => {
    show18HolesOnly = !show18HolesOnly
    document.getElementById('holes-toggle').classList.toggle('holes-toggle-active', show18HolesOnly)
    applyFilters()
  })
  document.getElementById('search-input').addEventListener('input', e => {
    applyFilters()
  })

  // Distance filter
  const postnummerInput = document.getElementById('postnummer-input')
  const distanceSelect = document.getElementById('distance-select')
  const geoBtn = document.getElementById('geo-btn')

  // Hvilken kilde posisjonen kommer fra: 'postnummer', 'geo', eller null.
  // Dette gjør at vi kan skille "bruker har skrevet postnummer" fra
  // "bruker har tillatt geolokasjon" — viktig fordi handlerne for de to
  // inputene ellers ville overskrevet hverandre.
  let positionSource = null

  async function updateDistanceFilter() {
    const nr = postnummerInput.value.trim()
    const dist = distanceSelect.value

    // Hvis brukeren begynner å skrive et postnummer, overstyrer det en
    // eventuell aktiv geolokasjon.
    if (nr.length > 0 && positionSource === 'geo') {
      positionSource = null
      geoBtn.classList.remove('geo-btn-active')
    }

    if (nr.length === 4 && dist) {
      // --- Postnummer-modus ---
      try {
        postnummerInput.style.borderColor = '#d97706' // loading indicator
        const response = await fetch(`/api/postnummer/${nr}`)
        if (response.ok) {
          const data = await response.json()
          userLat = data.lat
          userLon = data.lon
          maxDistance = parseInt(dist)
          positionSource = 'postnummer'
          postnummerInput.style.borderColor = 'var(--green-main)'
          postnummerInput.title = data.poststed
        } else {
          postnummerInput.style.borderColor = '#dc2626'
          userLat = null
          userLon = null
          maxDistance = null
          positionSource = null
        }
      } catch {
        postnummerInput.style.borderColor = '#dc2626'
      }
    } else if (positionSource === 'geo' && dist) {
      // --- Geo-modus: bruk eksisterende koordinater, bare oppdater avstand ---
      maxDistance = parseInt(dist)
    } else if (positionSource !== 'geo') {
      // Verken gyldig postnummer eller aktiv geo → nullstill alt
      postnummerInput.style.borderColor = ''
      userLat = null
      userLon = null
      maxDistance = null
      positionSource = null
    }

    applyFilters()
  }

  postnummerInput.addEventListener('input', updateDistanceFilter)
  distanceSelect.addEventListener('change', updateDistanceFilter)

  // --- Geolocation ---
  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      geoBtn.classList.add('geo-btn-error')
      geoBtn.title = 'Nettleseren din støtter ikke posisjon. Bruk postnummer i stedet.'
      return
    }

    geoBtn.classList.remove('geo-btn-error', 'geo-btn-active')
    geoBtn.classList.add('geo-btn-loading')

    navigator.geolocation.getCurrentPosition(
      // Suksess
      (position) => {
        userLat = position.coords.latitude
        userLon = position.coords.longitude
        positionSource = 'geo'

        // Tøm postnummer-feltet så det er tydelig hvilken kilde som er aktiv
        postnummerInput.value = ''
        postnummerInput.style.borderColor = ''
        postnummerInput.title = ''

        geoBtn.classList.remove('geo-btn-loading')
        geoBtn.classList.add('geo-btn-active')
        geoBtn.title = 'Posisjonen din er aktiv'

        // Hvis avstand allerede er valgt, aktiver filteret med en gang
        const dist = distanceSelect.value
        if (dist) maxDistance = parseInt(dist)

        applyFilters()
      },
      // Feil (avslått, timeout, ikke tilgjengelig)
      (error) => {
        geoBtn.classList.remove('geo-btn-loading')
        geoBtn.classList.add('geo-btn-error')

        // error.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        // title-attributtet vises ikke på mobil, så vi bruker alert() for å
        // faktisk kommunisere hva som gikk galt.
        let message
        if (error.code === 1) {
          message = 'Posisjon er blokkert for denne siden.\n\niPhone: Innstillinger → Personvern → Stedstjenester → Safari-nettsteder → Tillat.\n\nDu kan bruke postnummer i stedet.'
        } else if (error.code === 2) {
          message = 'Kunne ikke finne posisjonen din. Sjekk at stedstjenester er på, eller bruk postnummer i stedet.'
        } else if (error.code === 3) {
          message = 'Det tok for lang tid å hente posisjonen. Prøv igjen, eller bruk postnummer i stedet.'
        } else {
          message = 'Kunne ikke hente posisjon. Bruk postnummer i stedet.'
        }
        geoBtn.title = message
        alert(message)
      },
      {
        enableHighAccuracy: false,  // ~100m holder for km-filter; raskere + mindre batteri
        timeout: 10000,
        maximumAge: 300000,         // bruk cachet posisjon hvis < 5 min gammel
      }
    )
  })

  // Nullstill-knappen: tømmer alle filtre og tekstfelt i én operasjon.
  // Bruker samme state som resten av filter-logikken fordi vi er inne i
  // samme closure (buildFilterButtons).
  const resetBtn = document.getElementById('reset-filters-btn')
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Reset status + område
      activeStatuses.clear()
      activeStatuses.add('all')
      activeCounties.clear()
      activeCounties.add('all')
      show18HolesOnly = false

      // Reset inputs
      document.getElementById('search-input').value = ''
      postnummerInput.value = ''
      postnummerInput.style.borderColor = ''
      postnummerInput.title = ''
      distanceSelect.value = ''
      userLat = null
      userLon = null
      maxDistance = null
      positionSource = null
      geoBtn.classList.remove('geo-btn-active', 'geo-btn-loading', 'geo-btn-error')
      geoBtn.title = 'Bruk min posisjon'

      // Reset knappetilstander: "Alle" aktiv, resten ikke
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === 'all')
      })
      document.getElementById('holes-toggle').classList.remove('holes-toggle-active')

      applyFilters()
    })
  }
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
    grid.innerHTML = ''

    // Første batch rendres synkront så det brukeren ser over folden dukker opp
    // umiddelbart etter at data har kommet inn. Resten rendres i neste
    // animation frame slik at nettleseren rekker å paint-e første batch før
    // vi blokkerer main thread med de resterende kortene.
    const FIRST_BATCH = 12

    const renderBatch = (subset) => {
        const fragment = document.createDocumentFragment()
        subset.forEach(course => fragment.appendChild(buildCard(course)))
        grid.appendChild(fragment)
    }

    renderBatch(courses.slice(0, FIRST_BATCH))

    if (courses.length > FIRST_BATCH) {
        requestAnimationFrame(() => renderBatch(courses.slice(FIRST_BATCH)))
    }
}

// Returns true for real courses (18- or 9-hole), false for training areas
function isRealCourse(name) {
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

// Evaluate status for card - used in the status pill.
// Returns 'green' | 'yellow' | 'red' | 'gray'.
// - green: minst én hovedbane er åpen
// - yellow: "noe kan fortsatt brukes" — enten fordi range er åpen (eller ukjent
//   mens hovedbanen er stengt, slik at range kanskje er et alternativ), eller
//   fordi et treningsområde er bekreftet åpent
// - red: alle hovedbaner er bekreftet stengt OG range er bekreftet stengt
// - gray: ingen bekreftet "open" eller "closed" på hovedbanen, og ingenting annet åpent
function getOverallStatus(course) {
  const courseList = course.status?.courses
  if (!courseList || courseList.length === 0) return 'gray'

  const realCourses = courseList.filter(c => isRealCourse(c.name))
  const trainingAreas = courseList.filter(c => !isRealCourse(c.name))
  const range = course.status.drivingRange

  // 🟢 Hovedbanen er åpen
  if (realCourses.some(c => c.status === 'open')) return 'green'

  // Alle hovedbaner bekreftet stengt
  const allRealClosed = realCourses.length > 0 && realCourses.every(c => c.status === 'closed')
  if (allRealClosed) {
    if (range === 'closed') return 'red'
    // Range åpen ELLER ukjent → gul: range kan fortsatt være et alternativ
    return 'yellow'
  }

  // Klubben har bare treningsområder (ingen "ekte" hovedbane)
  const trainingOnly = realCourses.length === 0 && courseList.length > 0
  if (trainingOnly) {
    if (range === 'closed') return 'red'
    return 'yellow'
  }

  // Hovedbanen er ukjent. Noe annet bekreftet åpent → gul
  if (range === 'open') return 'yellow'
  if (trainingAreas.some(c => c.status === 'open')) return 'yellow'

  // ⚪ Ingen bekreftet åpent, hovedbane ukjent
  return 'gray'
}

// Build a single course card element
function buildCard(course) {
  const card = document.createElement('div')
  card.className = 'course-card'
  card.dataset.courseId = course.id

  const overallStatus = getOverallStatus(course)

  // Tekstlig ekvivalent av statusfargen — brukes av skjermlesere og som tooltip.
  // Dette er tilgjengelighet (a11y): fargeblinde og blinde brukere får
  // ikke informasjon fra en ren farget prikk.
  const statusTexts = {
    green:  { label: 'Banen er åpen',            pill: 'Åpen' },
    red:    { label: 'Banen er stengt',          pill: 'Stengt' },
    yellow: { label: 'Delvis åpen',              pill: 'Delvis' },
    gray:   { label: 'Status ikke tilgjengelig', pill: 'Ingen info' },
  }
  const statusLabel = statusTexts[overallStatus].label
  const statusPillText = statusTexts[overallStatus].pill

  const allCourseStatuses = course.status?.courses || []

  const buildRow = c => {
    const override = course.coursesHoles?.find(r => c.name.toLowerCase().includes(r.match.toLowerCase()))
    const holes = override?.holes ?? course.holes
    const displayName = override?.displayName ?? c.name
    const needsHullSuffix = holes && isRealCourse(c.name) && !/hull/i.test(displayName)
    const label = needsHullSuffix ? `${displayName} (${holes} hull)` : displayName
    return `
    <div class="status-row">
      <span class="status-label">${esc(label)}</span>
      <span class="badge ${esc(c.status)}">${formatStatus(c.status)}</span>
    </div>`
  }

  // All course rows + driving range always visible
  const courseRows = allCourseStatuses.length > 0
    ? allCourseStatuses.map(buildRow).join('')
    : `<div class="status-row">
        <span class="status-label">Golfbanen</span>
        <span class="badge unknown">Status ikke tilgjengelig</span>
      </div>`

  const drivingRangeRow = course.status?.drivingRange !== null && course.status?.drivingRange !== undefined
    ? `<div class="status-row">
        <span class="status-label">Driving range:</span>
        <span class="badge ${esc(course.status.drivingRange)}">
          ${formatStatus(course.status.drivingRange)}
        </span>
      </div>`
    : ''

  // Note is a div (not an anchor) to avoid invalid HTML nesting issues.
  // A small "read more" link inside opens the clubs website instead
  const allUnknown = allCourseStatuses.every(c => c.status === 'unknown')
    && (course.status?.drivingRange === 'unknown' || course.status?.drivingRange == null)
  const isFacebook = course.url && course.url.includes('facebook.com')
  const noStatusInfo = allUnknown && !course.status?.statusText
  const statusNoteText = course.status?.statusText
    || (isFacebook && allUnknown
        ? (course.facebookNote
            ? `For hyppigere oppdateringer, følg klubben på Facebook.`
            : `Finner ingen hjemmeside for ${course.name} — følg dem på Facebook for oppdateringer om banestatus.`)
        : noStatusInfo ? 'Finner ingen informasjon om banestatus på klubbens nettside.' : null)
  const statusNoteLink = course.url
    ? `<a href="${safeUrl(course.url)}" target="_blank" rel="noopener noreferrer" class="status-note-link">
            ${isFacebook ? 'Gå til Facebook-siden →' : noStatusInfo ? 'Besøk klubbens nettside →' : 'Les mer på klubbens nettside →'}
          </a>`
    : ''
  const statusNote = statusNoteText
    ? `<div class="status-note">
        <span class="status-note-icon">📋</span>
        <div class="status-note-content">
          <p>${esc(statusNoteText)}</p>
          ${statusNoteLink}
        </div>
      </div>`
    : ''

  const weatherHTML = buildWeatherSection(course.weather)

  const quickLinksHTML = buildQuickLinksSection(course)

  // Only note and weather are collapsible
  const hasExpandableContent = statusNote || weatherHTML

  // Collapsible only on mobile
  const isMobile = COLLAPSIBLE_CARDS && window.matchMedia('(max-width: 640px)').matches
  const startCollapsed = isMobile && hasExpandableContent
  if (startCollapsed) card.classList.add('collapsed')

  const toggleBtn = isMobile && hasExpandableContent
    ? `<button class="card-toggle-btn" aria-expanded="${!startCollapsed}">
        <span class="card-toggle-label">${startCollapsed ? 'Vis mer' : 'Vis mindre'}</span>
        <span class="card-toggle-icon"></span>
      </button>`
    : ''

  card.innerHTML = `
    <div class="course-card-header">
      ${course.logo
        ? `<a href="${safeUrl(course.url)}" target="_blank" rel="noopener noreferrer"><img class="course-logo" src="${safeUrl(course.logo)}" alt="${esc(course.name)} logo" loading="lazy" onerror="this.style.display='none'"></a>`
        : ''
      }
      <h2>${esc(course.name)}</h2>
      <div class="status-pill ${esc(overallStatus)}" role="img" aria-label="${esc(statusLabel)}" title="${esc(statusLabel)}">${esc(statusPillText)}</div>
    </div>

    <div class="course-card-body">
      <div class="status-section">
        ${courseRows}
        ${drivingRangeRow}
      </div>

      <div class="card-details-wrapper">
        <div class="card-details">
          ${statusNote}
          ${quickLinksHTML}
          ${weatherHTML}
        </div>
      </div>

      ${toggleBtn}
    </div>
  `

  if (isMobile && hasExpandableContent) {
    card.querySelector('.card-toggle-btn').addEventListener('click', () => {
      const isCollapsed = card.classList.toggle('collapsed')
      const btn = card.querySelector('.card-toggle-btn')
      btn.setAttribute('aria-expanded', String(!isCollapsed))
      btn.querySelector('.card-toggle-label').textContent = isCollapsed ? 'Vis mer' : 'Vis mindre'
    })
  }

  return card
}

// Build the two quick-link boxes: Golfbox booking + Google Maps directions
function buildQuickLinksSection(course) {
  const mapsQuery = course.mapsCoordOnly
    ? `${course.lat},${course.lon}`
    : encodeURIComponent(course.mapsName ?? course.name)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}&center=${course.lat},${course.lon}`

  return `
    <div class="quick-links">
      <a class="quick-link-btn" href="https://golfbox.golf/#/" target="_blank" rel="noopener noreferrer">
        <img src="/img/golfbox.png" alt="Golfbox" class="quick-link-golfbox-logo">
        <span>Golfbox</span>
      </a>
      <a class="quick-link-btn" href="${safeUrl(mapsUrl)}" target="_blank" rel="noopener noreferrer">
        <svg class="quick-link-map-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ea4335"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
        <span>Veibeskrivelse</span>
      </a>
    </div>`
}

// Convert wind direction degrees to an arrow pointing the direction wind comes FROM
function getWindArrow(degrees) {
  if (degrees === undefined || degrees === null) return '↑'
  const arrows = ['↓\uFE0E','↙\uFE0E','←\uFE0E','↖\uFE0E','↑\uFE0E','↗\uFE0E','→\uFE0E','↘\uFE0E']
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

    // Værsymbolet fra met.no er alltid et enkelt ord (f.eks. "clearsky_day"),
    // men vi sanitizer det før vi bygger URL og bruker det som alt-tekst.
    const safeSymbol = esc(best.symbol ?? '')
    const iconUrl = `https://cdn.jsdelivr.net/gh/metno/weathericons@main/weather/svg/${safeSymbol}.svg`
    const windArrow = getWindArrow(best.windDirection)
    const windColor = best.windSpeed > 8 ? '#dc2626' : best.windSpeed > 5 ? '#d97706' : '#2563eb'

    return `
      <div class="weather-cell">
        <div class="weather-cell-time">${slot.label}</div>
        <div class="weather-cell-main">
          <img src="${iconUrl}" class="weather-cell-icon" alt="${safeSymbol}" loading="lazy" decoding="async" />
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