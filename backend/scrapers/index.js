const strategies = {
  // New combined Clubsite strategy - check table first, then widget
  'clubsite':              require('./clubsite.js'),
  'krokhol-sidebar':       require('./krokhol-sidebar.js'),
  'norefjell-status-page': require('./norefjell-status-page'),
  'coursecond-widget':     require('./coursecond-widget'),
  'wordpress-banestatus':  require('./wordpress-banestatus'),
  'gronmo-status':         require('./gronmo-status.js'),
  'squarespace-news':      require('./squarespace-news.js'),
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
  'elverum':               require('./elverum.js'),
  'randsfjord':            require('./randsfjord.js'),
  'sorknes':               require('./sorknes.js'),
  'valdres':               require('./valdres.js'),


  
  //Legacy strategies - kept for backwards compatibility
  'clubsite-status-table': require('./clubsite-status-table.js'),
  'news-keywords':         require('./news-keywords'),
  'clubsite-status-text':  require('./clubsite-status-text'),

}

async function scrapeCourse(course) {
  const strategy = strategies[course.scrapeMethod]

  if (!strategy) {
    console.warn(`No scraper found for method: ${course.scrapeMethod}`)
    return { course: 'unknown', drivingRange: 'unknown' }
  }

  return strategy.scrape(course.url)
}

module.exports = { scrapeCourse }