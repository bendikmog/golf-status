/**
 * Finner nærmeste <time datetime="..."> innenfor samme artikkel/post-container.
 * Returnerer Date-objekt hvis funnet, null ellers.
 */
function getNearbyDate($, el) {
  const container = $(el).closest('article, .post, .entry, .news-item, .news-post, li')
  if (container.length === 0) return null
  const timeEl = container.find('time[datetime]').first()
  if (timeEl.length === 0) return null
  const date = new Date(timeEl.attr('datetime'))
  return isNaN(date.getTime()) ? null : date
}

/**
 * Sjekker om en tekst fra et element er relevant å vise som statusnotat.
 * - Ingen date funnet: vis alltid (eksisterende oppførsel)
 * - Date funnet: vis kun hvis innenfor de siste 2 månedene
 */
function isRelevantStatusText($, el) {
  const date = getNearbyDate($, el)
  if (date === null) return true
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  return date >= twoMonthsAgo
}

module.exports = { isRelevantStatusText }
