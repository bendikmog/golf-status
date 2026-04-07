// Bærheim Golfpark (Sandnes Golfklubb): 18-hulls Golfbanen, Korthullsbanen og Driving range.
// Klubben publiserer ikke åpen/stengt-status på nettsiden.

async function scrape(_url) {
  // Bærheim Golfpark does not publish open/closed status on their website.
  return {
    courses: [
      { name: 'Golfbanen', status: 'unknown' },
      { name: 'Korthullsbanen', status: 'unknown' },
    ],
    drivingRange: 'unknown',
    statusText: null,
  }
}

module.exports = { scrape }
