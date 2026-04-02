const axios = require('axios')

// The base URL for the YR.no API
const YR_API = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'

// YR.no requires a User-Agent header indetfigying the app
const HEADERS = {
    'User-Agent': 'golf-status-app/1.0 (bendik.mogensen@gmail.com)',
}

async function getWeather(lat, lon) {
    try {
        //fetch the forcast for these coordinates
        const response = await axios.get(YR_API, {
            params: { lat, lon },
            headers: HEADERS,
        })

        // The actual forcast data is buried a few levels deep in the response
        const timeseries = response.data.properties.timeseries

        const now = new Date()
        const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
        const tomorrowDate = new Date(now)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        const tomorrowStr = tomorrowDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })

        // Keep hourly entries for today and tomorrow, only daytime hours (08-23)
        const hours = timeseries
            .filter(entry => {
                const d = new Date(entry.time)
                const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
                const hour = parseInt(d.toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', hour: 'numeric', hour12: false }))
                return (dateStr === todayStr || dateStr === tomorrowStr) && hour >= 8
            })
            .map(entry => {
                const details = entry.data.instant.details
                const symbol = entry.data.next_1_hours?.summary?.symbol_code
                return {
                    time: entry.time,
                    temperature: details.air_temperature,
                    windSpeed: details.wind_speed,
                    windDirection: details.wind_from_direction,
                    precipitation: entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
                    symbol,
                }
            })

        return hours
    
    } catch (error) {
        console.error(`Weather fetch failed for lat:${lat} lon:${lon}:`, error.message)
        // Return an empty array if weather fails - the app still works, but no forecast
        return[]
    }
}

module.exports = { getWeather }