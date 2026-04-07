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
  'bamble':                require('./bamble.js'),
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

async function scrapeCourse(course) {
  const strategy = strategies[course.scrapeMethod]

  if (!strategy) {
    console.warn(`No scraper found for method: ${course.scrapeMethod}`)
    return { course: 'unknown', drivingRange: 'unknown' }
  }

  const result = await strategy.scrape(course.url)

  if (Array.isArray(result.courses) && result.courses.length > 1) {
    result.courses.sort((a, b) => mainCourseScore(a.name) - mainCourseScore(b.name))
  }

  return result
}

module.exports = { scrapeCourse }