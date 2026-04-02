const axios = require('axios')
const cheerio = require('cheerio')

async function test() {
  const url = 'https://romerikegk.no/blogs/banestatus'
  const response = await axios.get(url)
  const $ = cheerio.load(response.data)

  const urlPath = new URL(url).pathname
  console.log('urlPath:', urlPath)

  console.log('\nAll matching links:')
  $(`a[href*="${urlPath}/"]`).each((i, el) => {
    const href = $(el).attr('href')
    const text = $(el).text().trim()
    const isTagged = href.includes('/tagged/')
    console.log(`  [${i}] tagged:${isTagged} text:"${text}" href:"${href}"`)
  })
}

test()