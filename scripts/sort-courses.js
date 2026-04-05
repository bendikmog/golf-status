/**
 * Sorterer courses-arrayen i courses.js alfabetisk etter name-feltet.
 * Bruker norsk locale (nb) for korrekt sortering av Æ, Ø, Å.
 *
 * Kjør med:  node scripts/sort-courses.js
 */

const fs = require('fs')
const path = require('path')

const COURSES_FILE = path.join(__dirname, '..', 'backend', 'courses.js')

const courses = require(COURSES_FILE)

const sorted = [...courses].sort((a, b) =>
    a.name.localeCompare(b.name, 'nb')
)

function formatCourse(course) {
    const lines = Object.entries(course).map(([key, value]) => {
        const val = typeof value === 'string' ? `'${value}'` : value
        return `        ${key}: ${val},`
    })
    return `    {\n${lines.join('\n')}\n    },`
}

const output = `const courses = [\n${sorted.map(formatCourse).join('\n')}\n]\n\nmodule.exports = courses\n`

fs.writeFileSync(COURSES_FILE, output, 'utf8')
console.log(`courses.js sortert — ${sorted.length} baner i alfabetisk rekkefølge.`)
