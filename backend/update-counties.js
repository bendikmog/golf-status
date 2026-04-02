#!/usr/bin/env node
// Engangsscript: oppdaterer county-feltet i courses.js via Kartverkets API
// Kjøres med: node update-counties.js

const courses = require('./courses');
const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchCounty(lat, lon) {
    return new Promise((resolve) => {
        const url = `https://api.kartverket.no/kommuneinfo/v1/punkt?nord=${lat}&ost=${lon}&koordsys=4258`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.fylkesnavn || null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const updated = [];

    for (const course of courses) {
        const fylke = await fetchCounty(course.lat, course.lon);
        const old = course.county;
        if (!fylke) {
            console.warn(`⚠️  ${course.name}: API-feil for (${course.lat}, ${course.lon}) — beholder "${old}"`);
            updated.push({ ...course });
        } else if (old !== fylke) {
            console.log(`${course.name}: "${old}" → "${fylke}"`);
            updated.push({ ...course, county: fylke });
        } else {
            console.log(`${course.name}: OK (${fylke})`);
            updated.push({ ...course });
        }
        await sleep(100); // ikke overbelast API-et
    }

    // Generer ny courses.js
    let out = 'const courses = [\n';
    for (const c of updated) {
        out += '    {\n';
        for (const [k, v] of Object.entries(c)) {
            if (typeof v === 'string') {
                out += `        ${k}: '${v}',\n`;
            } else {
                out += `        ${k}: ${v},\n`;
            }
        }
        out += '    },\n';
    }
    out += ']\n\nmodule.exports = courses\n';

    const outPath = path.join(__dirname, 'courses.js');
    fs.writeFileSync(outPath, out, 'utf8');
    console.log(`\nFerdig! courses.js oppdatert.`);
}

main().catch(console.error);
