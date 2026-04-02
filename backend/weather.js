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

        //Grab every other hour for the next 12 hours 
        const next6Hours = timeseries
            .filter((entry, index) => index % 2 == 0)
            .slice(0, 6)
            .map((entry) => {

            //Pull out the bits we actually care about from each hour
            const time = entry.time
            const details = entry.data.instant.details
            const symbol = entry.data.next_1_hours?.summary?.symbol_code

            return {
                //Thee time of this forecast period
                time,
                // Temperature in celsius
                temperature: details.air_temperature,
                // Wind speed in meters per second
                windSpeed: details.wind_speed,
                windDirection: details.wind_from_direction,
                // Chance of precipitation (rain/snow) as a percentage
                precipitation: entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
                // A short code describing the weather, e.g. "cloudy", "clearsky_day"
                symbol,
            }
        })

        return next6Hours
    
    } catch (error) {
        console.error(`Weather fetch failed for lat:${lat} lon:${lon}:`, error.message)
        // Return an empty array if weather fails - the app still works, but no forecast
        return[]
    }
}

module.exports = { getWeather }