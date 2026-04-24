/**
 * Henter scraper-feil fra Sentry og skriver ut en oversikt over
 * hvilke baner som har feilet mest de siste N dagene.
 *
 * Bruk:
 *   node scripts/failing-courses.js                 (siste 14 dager — default)
 *   node scripts/failing-courses.js --period=24h    (siste 24 timer)
 *   node scripts/failing-courses.js --period=14d    (siste 14 dager)
 *
 * Merk: Sentry begrenser gyldige perioder på Issues-API til '24h' og '14d'.
 *
 * Krever i .env:
 *   SENTRY_AUTH_TOKEN — auth token fra Sentry (Settings → Auth Tokens)
 *   SENTRY_ORG        — org-slug (f.eks. banestatus)
 *   SENTRY_PROJECT    — project-slug (f.eks. node)
 *   SENTRY_REGION     — valgfri host for Sentry API. Default: sentry.io
 */

require('dotenv').config()

const {
    SENTRY_AUTH_TOKEN,
    SENTRY_ORG,
    SENTRY_PROJECT,
    SENTRY_REGION = 'sentry.io',
} = process.env

if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
    console.error('Mangler SENTRY_AUTH_TOKEN, SENTRY_ORG eller SENTRY_PROJECT i .env')
    process.exit(1)
}

const API_BASE = `https://${SENTRY_REGION}/api/0`
const HEADERS = { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` }

// Parse --period=24h|14d, default 14d
const VALID_PERIODS = ['24h', '14d']
const periodArg = process.argv.find(a => a.startsWith('--period='))
const statsPeriod = periodArg ? periodArg.split('=')[1] : '14d'

if (!VALID_PERIODS.includes(statsPeriod)) {
    console.error(`Ugyldig periode: "${statsPeriod}". Gyldige valg: ${VALID_PERIODS.join(', ')}`)
    process.exit(1)
}

// ----- Sentry API calls -----

async function fetchIssues() {
    // Henter scraper-relaterte feilgrupper, sortert etter hyppighet.
    // 'kind:scraper' = unntak fanget under scraping (ofte timeouts)
    // 'kind:scraper-empty' = scraperen returnerte tomt resultat (HTML-endring?)
    const query = 'kind:[scraper,scraper-empty]'
    const url = `${API_BASE}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`
        + `?query=${encodeURIComponent(query)}`
        + `&statsPeriod=${statsPeriod}`
        + `&sort=freq`
        + `&limit=100`

    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) {
        throw new Error(`Sentry issues API: ${res.status} ${await res.text()}`)
    }
    return res.json()
}

async function fetchIssueTags(issueId) {
    // Issues-endepunktet gir ikke tags direkte, så vi henter dem per issue.
    // Returnerer et flatt objekt: { courseId: 'alta', method: 'glfr', kind: 'scraper' }
    const res = await fetch(`${API_BASE}/issues/${issueId}/tags/`, { headers: HEADERS })
    if (!res.ok) return {}

    const tagsArray = await res.json()
    const tags = {}
    for (const tag of tagsArray) {
        if (tag.topValues && tag.topValues.length > 0) {
            tags[tag.key] = tag.topValues[0].value
        }
    }
    return tags
}

// ----- Formatting helpers -----

function formatRelativeDate(isoDate) {
    const diffMs = Date.now() - new Date(isoDate).getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'nå nylig'
    if (diffHours < 24) return `${diffHours}t siden`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'i går'
    return `${diffDays}d siden`
}

function printTable(rows, totalIssues) {
    console.log(`\nTopp ${rows.length} feilende baner siste ${statsPeriod}:\n`)
    const header = `${'#'.padStart(3)}  ${'Bane'.padEnd(22)} ${'Metode'.padEnd(22)} ${'Antall'.padStart(6)}  ${'Type'.padEnd(24)} Sist sett`
    console.log(header)
    console.log('-'.repeat(header.length))

    rows.forEach(([courseId, data], i) => {
        const rank    = (i + 1).toString().padStart(3)
        const name    = courseId.padEnd(22)
        const method  = data.method.padEnd(22)
        const count   = data.count.toString().padStart(6)
        const kinds   = [...data.kinds].join(', ').padEnd(24)
        const lastSeen = formatRelativeDate(data.lastSeen)
        console.log(`${rank}  ${name} ${method} ${count}  ${kinds} ${lastSeen}`)
    })

    console.log(`\nHentet ${totalIssues} feilgrupper totalt fra Sentry.`)
}

// ----- Main -----

async function main() {
    console.log(`Henter scraper-feil fra Sentry (siste ${statsPeriod})...`)

    const issues = await fetchIssues()

    if (issues.length === 0) {
        console.log('\nIngen scraper-feil funnet. 🎉')
        return
    }

    console.log(`Fant ${issues.length} feilgrupper. Henter tags for hver...\n`)

    // Slå opp tags for hver issue og grupper etter courseId
    const byCourse = {}
    for (const issue of issues) {
        const tags = await fetchIssueTags(issue.id)
        const courseId = tags.courseId
        if (!courseId) continue

        const count = parseInt(issue.count, 10)
        if (!byCourse[courseId]) {
            byCourse[courseId] = {
                count: 0,
                method: tags.method || '?',
                lastSeen: issue.lastSeen,
                kinds: new Set(),
            }
        }
        byCourse[courseId].count += count
        if (issue.lastSeen > byCourse[courseId].lastSeen) {
            byCourse[courseId].lastSeen = issue.lastSeen
        }
        byCourse[courseId].kinds.add(tags.kind || '?')
    }

    const rows = Object.entries(byCourse)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)

    if (rows.length === 0) {
        console.log('Ingen courseId-tagger funnet. Sjekk at scraperne tagger feil med courseId.')
        return
    }

    printTable(rows, issues.length)
}

main().catch(err => {
    console.error('\nFeil:', err.message)
    process.exit(1)
})
