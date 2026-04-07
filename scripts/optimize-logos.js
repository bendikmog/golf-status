/**
 * Logo optimizer — konverterer bilder til WebP og beholder den minste filen.
 * Støttede kildeformater: .png .jpg .jpeg .svg .avif
 *
 * Kjør med:  node scripts/optimize-logos.js
 *
 * For hver fil:
 * - Konverter til WebP
 * - Behold WebP hvis den er mindre → slett original, oppdater courses.js
 * - Behold original hvis den er mindre → slett WebP, la courses.js være
 *
 * Trygt å kjøre flere ganger — hopper over filer uten ubehandlet original.
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const LOGOS_DIR    = path.join(__dirname, '..', 'logos')
const COURSES_FILE = path.join(__dirname, '..', 'backend', 'courses.js')
const WEBP_QUALITY = 85
const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg', '.svg', '.avif']

function toWebpPath(file) {
    const ext = path.extname(file)
    return file.slice(0, -ext.length) + '.webp'
}

async function optimizeLogos() {
    const files = fs.readdirSync(LOGOS_DIR)
        .filter(f => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))

    if (files.length === 0) {
        console.log('Ingen nye filer å behandle.')
        return
    }

    console.log(`Behandler ${files.length} fil(er)...\n`)

    const keptAsOriginal = []
    const convertedToWebp = []

    for (const file of files) {
        const ext        = path.extname(file).toLowerCase()
        const inputPath  = path.join(LOGOS_DIR, file)
        const webpPath   = path.join(LOGOS_DIR, toWebpPath(file))

        try {
            await sharp(inputPath, ext === '.svg' ? { density: 300 } : {})
                .webp({ quality: WEBP_QUALITY })
                .toFile(webpPath)

            const originalSize = fs.statSync(inputPath).size
            const webpSize     = fs.statSync(webpPath).size

            if (webpSize < originalSize) {
                const saved = Math.round((1 - webpSize / originalSize) * 100)
                fs.unlinkSync(inputPath)
                convertedToWebp.push(file)
                console.log(`  ✓ ${file.padEnd(35)} ${kb(originalSize)} → ${kb(webpSize)} WebP (-${saved}%)`)
            } else {
                const larger = Math.round((webpSize / originalSize - 1) * 100)
                fs.unlinkSync(webpPath)
                keptAsOriginal.push(file)
                console.log(`  = ${file.padEnd(35)} beholder original ${kb(originalSize)} (WebP ville vært +${larger}% større)`)
            }
        } catch (err) {
            console.error(`  FEIL: ${file} — ${err.message}`)
        }
    }

    console.log(`\n${convertedToWebp.length} konvertert til WebP, ${keptAsOriginal.length} beholdt som original`)

    if (convertedToWebp.length > 0) {
        updateCoursesJs(convertedToWebp, 'toWebp')
    }
    if (keptAsOriginal.length > 0) {
        updateCoursesJs(keptAsOriginal, 'toOriginal')
    }
}

function updateCoursesJs(files, direction) {
    let source = fs.readFileSync(COURSES_FILE, 'utf8')
    let changeCount = 0

    for (const file of files) {
        const webpName     = toWebpPath(file)
        const [oldPath, newPath] = direction === 'toWebp'
            ? [`/logos/${file}`, `/logos/${webpName}`]
            : [`/logos/${webpName}`, `/logos/${file}`]

        if (source.includes(oldPath)) {
            source = source.replaceAll(oldPath, newPath)
            changeCount++
        }
    }

    if (changeCount > 0) {
        fs.writeFileSync(COURSES_FILE, source, 'utf8')
        console.log(`courses.js oppdatert: ${changeCount} logo-sti(er) endret`)
    }
}

function kb(bytes) {
    return `${Math.round(bytes / 1024)} KB`
}

optimizeLogos().catch(err => {
    console.error('Scriptet krasjet:', err)
    process.exit(1)
})
