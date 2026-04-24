const strategies = {
  // New combined Clubsite strategy - check table first, then widget
  'clubsite':              require('./clubsite.js'),
  'krokhol-sidebar':       require('./krokhol-sidebar.js'),
  'norefjell-status-page': require('./norefjell-status-page'),
  'coursecond-widget':     require('./coursecond-widget'),
  'wordpress-banestatus':  require('./wordpress-banestatus'),
  'gronmo-status':         require('./gronmo-status.js'),
  'squarespace-news':      require('./squarespace-news.js'),
  'sandnes':               require('./sandnes.js'),
  'oslogk':                require('./oslogk'),
  'shopify-blog':          require('./shopify-blog'),
  'borregaard':            require('./borregaard.js'),
  'halden':                require('./halden.js'),
  'holtsmark':             require('./holtsmark.js'),
  'eiker':                 require('./eiker.js'),
  'tyrifjord':             require('./tyrifjord.js'),
  'atlungstad':            require('./atlungstad.js'),
  'groruddalen':           require('./groruddalen.js'),
  'generic':               require('./generic.js'),
  'bamble':                require('./generic.js'), // legacy alias
  'notteroy':              require('./notteroy.js'),
  'sandefjord':            require('./sandefjord.js'),
  'hallingdal':            require('./hallingdal.js'),
  'hemsedal':              require('./hemsedal.js'),
  'hof':                   require('./hof.js'),
  'kongsberg':             require('./kongsberg.js'),
  'nesbyen':               require('./nesbyen.js'),
  'norsjo':                require('./norsjo.js'),
  'ringerike':             require('./ringerike'),
  'rjukan':                require('./rjukan.js'),
  'tjome':                 require('./tjome.js'),
  'kongsvinger':           require('./kongsvinger.js'),
  'sola':                  require('./sola.js'),
  'solum':                 require('./solum.js'),
  'sgk':                   require('./sgk.js'),
  'egersund':              require('./egersund.js'),
  'haugesund':             require('./haugesund.js'),
  'mandal':                require('./mandal.js'),
  'sirdal':                require('./sirdal.js'),
  'haugaland':             require('./haugaland.js'),
  'jaeren':                require('./jaeren.js'),
  'karmoy':                require('./karmoy.js'),
  'nordvegen':             require('./nordvegen.js'),
  'ogna':                  require('./ogna.js'),
  'prgk':                  require('./prgk.js'),
  'randaberg':             require('./randaberg.js'),
  'sauda':                 require('./sauda.js'),
  'elverum':               require('./elverum.js'),
  'randsfjord':            require('./randsfjord.js'),
  'sorknes':               require('./sorknes.js'),
  'valdres':               require('./valdres.js'),
  'bergen':                require('./bergen.js'),
  'bjornefjorden':         require('./bjornefjorden.js'),
  'hardanger':             require('./hardanger.js'),
  'herdla':                require('./herdla.js'),
  'kvinnherad':            require('./kvinnherad.js'),
  'meland':                require('./meland.js'),
  'nordfjord':             require('./nordfjord.js'),
  'sandane':               require('./sandane.js'),
  'selje':                 require('./selje.js'),
  'stord':                 require('./stord.js'),
  'sunnfjord':             require('./sunnfjord.js'),
  'tysnes':                require('./tysnes.js'),
  'voss':                  require('./voss.js'),
  'ekholt':               require('./ekholt.js'),
  'trysil':               require('./trysil.js'),
  'tingvoll':             require('./tingvoll.js'),
  'byneset':              require('./byneset.js'),
  'hitra':                require('./hitra.js'),
  'klabu':                require('./klabu.js'),
  'oppdal':               require('./oppdal.js'),
  'roros':                require('./roros.js'),
  'trondheim-gk':         require('./trondheim-gk.js'),
  'tromso':               require('./tromso.js'),


  
  //Legacy strategies - kept for backwards compatibility
  'clubsite-status-table': require('./clubsite-status-table.js'),
  'news-keywords':         require('./news-keywords'),
  'clubsite-status-text':  require('./clubsite-status-text'),

}

// Lower score = higher in the list. Main/real courses first, training areas last.
function mainCourseScore(name) {
  const n = name.toLowerCase()
  if (n.includes('hoved'))   return 0
  if (n.includes('18'))      return 1
  if (n.includes('banen') || n === 'golfbanen') return 2
  if (n.includes('bane'))    return 3
  if (n.includes('9'))       return 4
  return 10
}

const { scrapeGlfr } = require('./glfr.js')
const Sentry = require('@sentry/node')

// En scraper "lykkes" teknisk sett selv om den ikke fikk ut noe data,
// fordi hver scraper har sin egen try/catch som returnerer et tomt resultat.
// Denne hjelperen oppdager slike stille feil så vi kan rapportere dem til Sentry.
function isEmptyResult(result) {
  if (!result) return true
  const noCourses = !Array.isArray(result.courses) || result.courses.length === 0
  const noDrivingRange = !result.drivingRange || result.drivingRange === 'unknown'
  const noStatusText = !result.statusText
  return noCourses && noDrivingRange && noStatusText
}

async function scrapeCourse(course) {
  if (course.scrapeMethod === 'none') {
    return {
      courses: [{ name: 'Golfbanen', status: 'unknown' }],
      drivingRange: 'unknown',
      statusText: course.statusTextOverride || null,
    }
  }

  if (course.scrapeMethod === 'glfr') {
    const result = await scrapeGlfr(course.glfrSlug)
    if (course.statusTextOverride) result.statusText = course.statusTextOverride
    return result
  }

  const strategy = strategies[course.scrapeMethod]

  if (!strategy) {
    console.warn(`No scraper found for method: ${course.scrapeMethod}`)
    return { course: 'unknown', drivingRange: 'unknown' }
  }

  const result = await strategy.scrape(course.url)

  // Hvis scraperen returnerte tomt (fordi dens interne try/catch svelget en feil),
  // rapporter det til Sentry med nok kontekst til å finne ut hvilken bane og metode.
  // Selve feilmeldingen ligger fortsatt i Railway-loggen via console.error i scraperen.
  if (isEmptyResult(result)) {
    Sentry.captureMessage(`Scraper returned empty result for ${course.id}`, {
      level: 'warning',
      tags: { kind: 'scraper-empty', courseId: course.id, method: course.scrapeMethod },
      extra: { url: course.url },
    })
  }

  if (Array.isArray(result.courses) && result.courses.length > 1) {
    result.courses.sort((a, b) => mainCourseScore(a.name) - mainCourseScore(b.name))
  }

  if (course.statusTextOverride) {
    result.statusText = course.statusTextOverride
  }

  return result
}

module.exports = { scrapeCourse }