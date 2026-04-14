// ============================================
// SENTRY — FEILOVERVÅKNING
// Denne filen må lastes FØRST i server.js (før noe annet), slik at Sentry
// kan fange opp feil som skjer under oppstart.
//
// DSN-en leses fra miljøvariabelen SENTRY_DSN. Hvis den ikke er satt
// (f.eks. i dev uten .env-fil), hopper vi over init og serveren kjører
// som før — uten feilovervåkning, men uten å krasje.
// ============================================

// Les .env-filen lokalt. På Railway kommer variablene fra dashbordet,
// så der er denne kallet en no-op.
require('dotenv').config()

const Sentry = require('@sentry/node')

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,

        // Skill lokal testing fra ekte brukere i Sentry-dashbordet
        environment: process.env.NODE_ENV || 'development',

        // Ikke samle inn IP-adresser, cookies eller brukerdata.
        // Vi rapporterer kun feil fra vår egen kode.
        sendDefaultPii: false,

        // Samples: 100% av feil (vi har lite trafikk og vil se alt)
        tracesSampleRate: 0,
    })
    console.log(`Sentry aktivert (${process.env.NODE_ENV || 'development'})`)
} else {
    console.log('Sentry ikke aktivert (SENTRY_DSN mangler)')
}

module.exports = Sentry
