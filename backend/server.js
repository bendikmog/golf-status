const express = require('express')
const path = require('path')
const cron = require('node-cron')
const courses = require('./courses')
const { scrapeCourse } = require('./scrapers')
const { getWeather} = require('./weather')
const axios = require('axios')
const https = require ('https')
axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false })


const app = express()
const PORT = 3000

// ===================================
// CACHE - store data in server memory
// ===================================

// Puppeteer scrapers are slow - split them from the rest so main cache can be served faster
const PUPPETEER_METHODS = new Set(['sola', 'coursecond-widget'])

// cachedData holds last result from scrape (all courses merged)
let cachedData = null

// cachedTime holds the timestamp of last update
let cachedTime = null

// Tracks whether an update is currently running
let isUpdating = false

// Per-course cache for Puppeteer results so they survive between main updates
let puppeteerCacheById = {}

// =====================================
// SCRAPING - fetches fresh data from a list of courses
// =====================================

async function fetchCoursesData(courseList) {
    return Promise.all(
        courseList.map(async (course) => {
            const [status, weather] = await Promise.all([
                scrapeCourse(course),
                getWeather(course.lat, course.lon),
            ])
            return { ...course, status, weather }
        })
    )
}

// =====================================
// CACHE UPDATE - runs automatically
// =====================================

async function updateCache() {
    // Prevent overlapping updates
    if (isUpdating) return
    isUpdating = true

    try {
        const mainCourses     = courses.filter(c => !PUPPETEER_METHODS.has(c.scrapeMethod))
        const puppeteerCourses = courses.filter(c =>  PUPPETEER_METHODS.has(c.scrapeMethod))

        // --- Step 1: fast scrapers ---
        console.log('Fetching main scrapers...')
        const mainResults = await fetchCoursesData(mainCourses)

        // Build a lookup so we can serve the cache in original course order
        const resultById = {}
        mainResults.forEach(r => { resultById[r.id] = r })

        // Fill in Puppeteer slots with previously cached data (or null placeholder)
        puppeteerCourses.forEach(course => {
            if (puppeteerCacheById[course.id]) {
                resultById[course.id] = { ...course, ...puppeteerCacheById[course.id] }
            } else {
                resultById[course.id] = { ...course, status: null, weather: null }
            }
        })

        // Serve partial cache immediately — users don't wait for Puppeteer
        cachedData = courses.map(c => resultById[c.id]).filter(Boolean)
        cachedTime = Date.now()
        console.log(`Main scrapers done — cache ready at ${new Date().toLocaleTimeString('no-NO')}`)

    } catch (error) {
        console.error('Cache update failed:', error.message)
    } finally {
        isUpdating = false
    }
}

// Full update: main scrapers first, then Puppeteer
async function updateFull() {
    await updateCache()
    await updatePuppeteerCache()
}

// Fetches only Puppeteer courses and merges results into cachedData.
// Can be called standalone (from its own cron) or from updateCache().
async function updatePuppeteerCache() {
    if (isUpdating) return
    isUpdating = true

    try {
        // Rebuild resultById from current cache so we can merge cleanly
        const resultById = {}
        if (cachedData) cachedData.forEach(r => { resultById[r.id] = r })

        await runPuppeteerUpdate(resultById)
    } catch (error) {
        console.error('Puppeteer cache update failed:', error.message)
    } finally {
        isUpdating = false
    }
}

// Shared helper: fetches Puppeteer courses, updates puppeteerCacheById and cachedData
async function runPuppeteerUpdate(resultById) {
    const puppeteerCourses = courses.filter(c => PUPPETEER_METHODS.has(c.scrapeMethod))

    console.log('Fetching Puppeteer scrapers...')
    const puppeteerResults = await fetchCoursesData(puppeteerCourses)

    // Persist results so they survive the next main-only update
    puppeteerResults.forEach(r => {
        puppeteerCacheById[r.id] = { status: r.status, weather: r.weather }
        resultById[r.id] = r
    })

    cachedData = courses.map(c => resultById[c.id]).filter(Boolean)
    cachedTime = Date.now()
    console.log(`Puppeteer scrapers done at ${new Date().toLocaleTimeString('no-NO')}`)
}

// =====================================
// PLANNED UPDATES - cron jobs
// =====================================

// Main scrapers only: 07:00, 09:00, 10:00
cron.schedule('0 7,9,10 * * *', () => {
    console.log('Main update starting...')
    updateCache()
}, { timezone: 'Europe/Oslo' })

// Full update (main + Puppeteer): 08:00 and 23:00
cron.schedule('0 8,23 * * *', () => {
    console.log('Full update starting...')
    updateFull()
}, { timezone: 'Europe/Oslo' })

// =====================================
// RUN - fill cache with data as server starts
// =====================================

// Store the initial update promise so concurrent cold-start requests
// can await it instead of triggering duplicate fetches
const initialUpdatePromise = updateFull()

// =====================================
// MIDDLEWARE - basic setup
// =====================================

app.use(express.json())
// Serves frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')))
// Serves logos from logo folder
app.use('/logos', express.static(path.join(__dirname, '..', 'logos')))

// =====================================
// Endpoints - returns data from cache
// =====================================
app.get('/api/courses', async (_req, res) => {
    try{
        // On cold start: wait for the initial (main) scrapers to finish
        // After that, always return whatever is in cache — never block on Puppeteer
        if (!cachedData) {
            console.log('Cache empty - waiting for initial data...')
            await initialUpdatePromise
        }

        // Add cache-age in response to see age of data
        const cacheAgeSeconds = Math.round((Date.now() - cachedTime) / 1000)

        res.json({
            //The actual data-array
            courses: cachedData,
            //Metadata of cache - good for debugging
            meta: {
                cachedAt: new Date(cachedTime).toISOString(),
                cacheAgeSeconds,
                isUpdating,
            }
        })
    } catch (error) {
        console.error('Error fetching courses:', error.message)
        res.status(500).json({error: 'Failed to fetch course data'})
    }
})

// =====================================
// Endpoints - postal number lookup
// =====================================
app.get('/api/postnummer/:nr', async (req, res) => {
    const nr = req.params.nr.trim()

    // Validate - must be 4 digits
    if (!/^\d{4}$/.test(nr)) {
        return res.status(400).json({error: 'Ugyldig postnummer' })
    }

    try {
        // Use Kartverkets free address search API
        const response = await axios.get(
            `https://ws.geonorge.no/adresser/v1/sok?postnummer=${nr}&treffPerSide=1`,
            { headers: { 'User-Agent': 'golf-status/1.0' } }
        )

        const adresser = response.data?.adresser
        if (!adresser || adresser.length === 0) {
            return res.status(404).json({error: 'Postnummer ikke funnet'})
        }


    const { lat, lon } = adresser[0].representasjonspunkt
    const poststed = adresser[0].poststed

    res.json({ postnummer: nr, poststed, lat, lon})

} catch (error) {
    console.error('Postnummer lookup failed:', error.message)
    res.status(500).json({error: 'Kunne ikke slå opp postnummer' })
    }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log('Planned updates: 07:00, 08:00, 09:00, 10:00, 23:00,')
})
