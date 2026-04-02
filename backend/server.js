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

// cachedData holds last result from scrape
let cachedData = null

// cachedTime holds the timestamp of last update
let cachedTime = null

// =====================================
// SCRAPING - fetches fresh data from all courses
// =====================================

async function fetchAllCourses() {
    console.log('Fetching data from all courses...')

    const results = await Promise.all(
        courses.map(async (course) => {
            const [status, weather] = await Promise.all([
                scrapeCourse(course),
                getWeather(course.lat, course.lon),
            ])

            return {
                ...course,
                status,
                weather,
            }
        })
    )

    console.log('Fetched all courses!')
    return results
    
}

// =====================================
// CACHE UPDATE - runs automatically
// =====================================

async function updateCache() {
    try {
        // Fetch fresh data
        const freshData = await fetchAllCourses()

        // Store in cache with timestamp
        cachedData = freshData
        cachedTime = Date.now()

        console.log(`Cache updated at ${new Date().toLocaleTimeString('no-NO')}`)
    } catch (error) {
        console.error('Cache update failed:', error.message)
    }
}

// =====================================
// PLANNED UPDATES - cron jobs
// =====================================

// Update at 23:00 every night
cron.schedule('0 23 * * *', () => {
    console.log('Nightly update starting...')
    updateCache()
}, {timezone: 'Europe/Oslo' })

// Update at 07:00, 08:00, 09:00, 10:00, every morning
cron.schedule('0 7-10 * * *', () => {
    console.log('Morning at 07 update starting...')
    updateCache()
}, {timezone: 'Europe/Oslo' })

// =====================================
// RUN - fill cache with data as server starts
// =====================================

updateCache()

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
app.get('/api/courses', async (req, res) => {
    try{
        // If cache is empty (first update not ready yet)
        // - wait for data
        if (!cachedData) {
            console.log('Cache empty - fetching data now...')
            await updateCache()
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