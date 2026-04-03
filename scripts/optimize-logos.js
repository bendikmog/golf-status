/**
 * Logo optimizer — konverterer PNG-logoer til komprimert WebP.
 *
 * Kjør med:  node scripts/optimize-logos.js
 *
 * Scriptet er trygt å kjøre flere ganger:
 * - Hopper over filer som allerede er konvertert (samme navn, .webp-endelse)
 * - Behandler kun nye PNG-filer som mangler tilsvarende .webp
 * - De originale PNG-filene beholdes uendret
 *
 * Etter konvertering oppdateres courses.js automatisk til å bruke .webp-stier.
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const LOGOS_DIR = path.join(__dirname, '..', 'logos')
const COURSES_FILE = path.join(__dirname, '..', 'backend', 'courses.js')
const WEBP_QUALITY = 85

async function optimizeLogos() {
    const files = fs.readdirSync(LOGOS_DIR).filter(f => f.endsWith('.png'))

    const newFiles = files.filter(f => {
        const webpPath = path.join(LOGOS_DIR, f.replace('.png', '.webp'))
        return !fs.existsSync(webpPath)
    })

    if (newFiles.length === 0) {
        console.log('Ingen nye PNG-filer å konvertere.')
        return
    }

    console.log(`Konverterer ${newFiles.length} fil(er) til WebP...\n`)

    let totalSavedBytes = 0

    for (const file of newFiles) {
        const inputPath  = path.join(LOGOS_DIR, file)
        const outputPath = path.join(LOGOS_DIR, file.replace('.png', '.webp'))

        try {
            await sharp(inputPath)
                .webp({ quality: WEBP_QUALITY })
                .toFile(outputPath)

            const originalSize = fs.statSync(inputPath).size
            const newSize      = fs.statSync(outputPath).size
            const savedPct     = Math.round((1 - newSize / originalSize) * 100)
            totalSavedBytes   += (originalSize - newSize)

            console.log(`  ${file.padEnd(30)} ${kb(originalSize)} → ${kb(newSize)} (-${savedPct}%)`)
        } catch (err) {
            console.error(`  FEIL: ${file} — ${err.message}`)
        }
    }

    console.log(`\nTotalt spart: ${kb(totalSavedBytes)} på ${newFiles.length} fil(er)`)

    updateCoursesJs(newFiles)
}

// Replaces /logos/xxx.png with /logos/xxx.webp for converted files in courses.js
function updateCoursesJs(convertedFiles) {
    let source = fs.readFileSync(COURSES_FILE, 'utf8')
    let changeCount = 0

    for (const file of convertedFiles) {
        const oldPath = `/logos/${file}`
        const newPath = `/logos/${file.replace('.png', '.webp')}`

        if (source.includes(oldPath)) {
            source = source.replaceAll(oldPath, newPath)
            changeCount++
        }
    }

    if (changeCount > 0) {
        fs.writeFileSync(COURSES_FILE, source, 'utf8')
        console.log(`\ncourses.js oppdatert: ${changeCount} logo-sti(er) byttet til .webp`)
    }
}

function kb(bytes) {
    return `${Math.round(bytes / 1024)} KB`
}

optimizeLogos().catch(err => {
    console.error('Scriptet krasjet:', err)
    process.exit(1)
})
