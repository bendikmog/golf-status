const axios = require('axios')

// The base URL for the YR.no API
const YR_API = 'https://api.met.no/weatherapi/locationforecast/2.0/compact'

// YR.no requires a User-Agent header indetfigying the app
const HEADERS = {
    'User-Agent': 'golf-status-app/1.0 (bendik.mogensen@gmail.com)',
}

// Midtpunkt-timer for slots 08-12, 12-16, 16-20 og 20-00. Frontend viser
// bare disse 4 slotene per dag (× 2 dager = 8 entries per bane), så vi
// plukker dem serverside i stedet for å sende alle timene og la frontend
// kaste bort ~75% av dataen.
const TARGET_HOURS = [10, 14, 18, 22]

// Henter time-verdi i Oslo-tid fra et ISO-tidsstempel. Brukes både ved
// filtrering og ved valg av nærmeste entry.
function osloHour(isoTime) {
    return parseInt(
        new Date(isoTime).toLocaleString('nb-NO', {
            timeZone: 'Europe/Oslo',
            hour: 'numeric',
            hour12: false,
        })
    )
}

function osloDate(isoTime) {
    return new Date(isoTime).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
}

// Plukker entryen som er nærmest en gitt time.
// Hvis timeseries for i dag starter kl. 15 (fordi tidligere timer er i
// fortiden), vil slot-en for 08-12 peke på 15:00 — samme oppførsel som
// frontend hadde før.
function pickClosestHour(entries, targetHour) {
    return entries.reduce((closest, entry) => {
        const entryDiff = Math.abs(osloHour(entry.time) - targetHour)
        const closestDiff = Math.abs(osloHour(closest.time) - targetHour)
        return entryDiff < closestDiff ? entry : closest
    })
}

function toSlotEntry(entry) {
    const details = entry.data.instant.details
    return {
        time: entry.time,
        temperature: details.air_temperature,
        windSpeed: details.wind_speed,
        windDirection: details.wind_from_direction,
        precipitation: entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
        symbol: entry.data.next_1_hours?.summary?.symbol_code,
    }
}

async function getWeather(lat, lon) {
    try {
        const response = await axios.get(YR_API, {
            params: { lat, lon },
            headers: HEADERS,
        })

        const timeseries = response.data.properties.timeseries

        const now = new Date()
        const todayStr = osloDate(now.toISOString())
        const tomorrowDate = new Date(now)
        tomorrowDate.setDate(tomorrowDate.getDate() + 1)
        const tomorrowStr = osloDate(tomorrowDate.toISOString())

        const result = []
        for (const dateStr of [todayStr, tomorrowStr]) {
            const dayEntries = timeseries.filter(e => osloDate(e.time) === dateStr)
            if (dayEntries.length === 0) continue

            for (const targetHour of TARGET_HOURS) {
                result.push(toSlotEntry(pickClosestHour(dayEntries, targetHour)))
            }
        }

        return result
    } catch (error) {
        console.error(`Weather fetch failed for lat:${lat} lon:${lon}:`, error.message)
        // Tom array ved feil — resten av appen fungerer, bare uten værmelding
        return []
    }
}

module.exports = { getWeather }