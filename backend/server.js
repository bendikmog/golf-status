// VIKTIG: instrument.js MÅ lastes aller først, før alt annet.
// Sentry hooker seg inn i Node.js sine interne mekanismer, og det må skje
// før andre pakker lastes for at feil-fangingen skal være komplett.
require('./instrument')
const Sentry = require('@sentry/node')

const express = require('express')
const compression = require('compression')
const helmet = require('helmet')
const path = require('path')
const cron = require('node-cron')
const courses = require('./courses')
const { scrapeCourse } = require('./scrapers')
const { getWeather} = require('./weather')
const axios = require('axios')

// Merk: Vi slår IKKE av TLS-validering globalt her. Hvis en enkelt scraper
// må snakke med en klubbside med utløpt/selvsignert sertifikat, skal den
// lage sin egen lokale httpsAgent — se backend/scrapers/generic.js for
// et eksempel på mønsteret.

const app = express()
const PORT = 3000

// ===================================
// CACHE - store data in server memory
// ===================================

// Puppeteer scrapers are slow - split them from the rest so main cache can be served faster
const PUPPETEER_METHODS = new Set(['sola', 'coursecond-widget', 'solum'])

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
            // Kjør scraper og vær-henting i parallell. Hvis noen av dem feiler,
            // rapporterer vi til Sentry med kontekst om hvilken klubb det gjelder,
            // og returnerer trygge fallback-verdier så resten av appen ikke krasjer.
            const [statusResult, weatherResult] = await Promise.allSettled([
                scrapeCourse(course),
                getWeather(course.lat, course.lon),
            ])

            let status = null
            if (statusResult.status === 'fulfilled') {
                status = statusResult.value
            } else {
                Sentry.captureException(statusResult.reason, {
                    tags: { kind: 'scraper', courseId: course.id, method: course.scrapeMethod },
                    extra: { url: course.url },
                })
            }

            let weather = []
            if (weatherResult.status === 'fulfilled') {
                weather = weatherResult.value
            } else {
                Sentry.captureException(weatherResult.reason, {
                    tags: { kind: 'weather', courseId: course.id },
                    extra: { lat: course.lat, lon: course.lon },
                })
            }

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
// Wait only for the fast scrapers on cold start — users get data as soon as possible.
// Puppeteer scrapers run in the background and update the cache when ready.
const initialUpdatePromise = updateCache()
initialUpdatePromise.then(() => updatePuppeteerCache())

// =====================================
// MIDDLEWARE - basic setup
// =====================================

// ============================================
// SIKKERHETSHEADERE
// Helmet setter en rekke HTTP-headere som gjør vanlige angrep vanskeligere.
// Content Security Policy (CSP) er den viktigste: den sier til nettleseren
// hvilke kilder som er lov å laste scripts, stiler, bilder osv. fra.
// Hvis en angriper klarer å smugle inn <script> i sidens HTML, vil CSP
// hindre at det faktisk kjøres.
// ============================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Scripts: egen server + Google Analytics (inkl. regionale subdomener)
            scriptSrc: [
                "'self'",
                "https://www.googletagmanager.com",
                "https://*.google-analytics.com",
            ],
            // Stiler: egen server + Google Fonts CSS
            // 'unsafe-inline' trengs for inline style="..."-attributter vi
            // bruker i kortene (f.eks. style="color:${windColor}")
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
            ],
            // Fonter: Google Fonts leverer selve font-filene fra gstatic
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            // Bilder: egen server + værikoner fra jsdelivr + GA-pixels + data:-URLer
            imgSrc: [
                "'self'",
                "data:",
                "https://cdn.jsdelivr.net",
                "https://*.google-analytics.com",
                "https://www.googletagmanager.com",
            ],
            // Forbindelser (fetch/XHR): egen server + GA
            // *.google-analytics.com dekker region1, region2 osv. som GA bruker
            // for å sende målingsdata.
            connectSrc: [
                "'self'",
                "https://*.google-analytics.com",
                "https://*.analytics.google.com",
                "https://www.googletagmanager.com",
            ],
            // Ikke tillat at siden bygges inn i iframe på andre domener
            frameAncestors: ["'none'"],
            // Blokker gamle plugins (Flash osv.)
            objectSrc: ["'none'"],
        },
    },
    // Tillat cross-origin-bilder (værikoner fra jsdelivr)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(compression())
app.use(express.json())
// Serves frontend files — cache in browser for 1 hour. Ingen hash-et filnavn
// ennå, så en deploy blir først synlig når cachen utløper (eller ved hard refresh).
app.use(express.static(path.join(__dirname, '..', 'frontend'), { maxAge: '1h' }))
// Serves logos from logo folder — cache in browser for 7 days
app.use('/logos', express.static(path.join(__dirname, '..', 'logos'), { maxAge: '7d' }))

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

        // Cache-headere:
        // - max-age=300: nettleseren bruker lokal kopi uten å spørre i 5 min
        // - stale-while-revalidate=900: etter 5 min serveres stale instant
        //   mens en bakgrunns-forespørsel fornyer cachen. Gir null opplevd
        //   latency ved refresh i opptil 20 min.
        // Last-Modified speiler når serverside-cachen sist ble oppdatert, så
        // betingede GET-er (If-Modified-Since) kan svare 304 uten payload.
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900')
        res.set('Last-Modified', new Date(cachedTime).toUTCString())

        // Responsen må være stabil mellom cache-oppdateringer så nettleserens
        // ETag/Last-Modified-sjekk kan gi 304. Derfor ingen felt som endres
        // hvert sekund (cacheAgeSeconds, isUpdating) — frontend beregner
        // cache-alder fra cachedAt selv ved behov.
        res.json({
            courses: cachedData,
            meta: {
                cachedAt: new Date(cachedTime).toISOString(),
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

// Sentry Express-feilhåndtering — MÅ registreres etter alle routes,
// men før andre error-middleware. Fanger uventede feil i handlers.
Sentry.setupExpressErrorHandler(app)

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log('Planned updates: 07:00, 08:00, 09:00, 10:00, 23:00,')
})
