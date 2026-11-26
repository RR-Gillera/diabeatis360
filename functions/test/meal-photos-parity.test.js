'use strict'
// The server picks a sample meal photo by key and the app shows the matching bundled file (DECISIONS.md D60). If the two
// lists drift apart, a meal would point at a photo the app does not have. This checks they hold exactly the same keys,
// that every photo file exists, and that every photo has a credit (CC BY and CC BY-SA photos must name the author).
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const { MEAL_PHOTOS, MEAL_PHOTO_KEYS } = require('../lib/meal-photos')

const mobile = path.join(__dirname, '../../diabeatis360-mobile')
const appList = fs.readFileSync(path.join(mobile, 'src/features/ai/meal-photos.ts'), 'utf8')
// One line per photo: `  key: { source: require('@/assets/images/meals/key.jpg'), credit: '...' },`
const appEntries = [...appList.matchAll(/^\s+(\w+): \{ source: require\('@\/assets\/images\/meals\/(\w+)\.jpg'\), credit: '([^']*)' \},?\s*$/gm)]

test('the app has a photo for exactly the keys the server lets Gemini pick', () => {
  assert.deepEqual(appEntries.map((entry) => entry[1]), MEAL_PHOTO_KEYS)
  for (const [, key, file] of appEntries) assert.equal(file, key, `${key} must load ${key}.jpg`)
})

test('every photo file exists, is a JPEG, and is small enough to ship in the app', () => {
  for (const key of MEAL_PHOTO_KEYS) {
    const file = path.join(mobile, 'assets/images/meals', `${key}.jpg`)
    assert.ok(fs.existsSync(file), `missing ${file}`)
    const bytes = fs.readFileSync(file)
    assert.equal(bytes.readUInt16BE(0), 0xffd8, `${key}.jpg is not a JPEG`)
    assert.ok(bytes.length < 250 * 1024, `${key}.jpg is ${Math.round(bytes.length / 1024)} KB`)
  }
})

test('every photo has a credit in the app and in CREDITS.md', () => {
  const credits = fs.readFileSync(path.join(mobile, 'assets/images/meals/CREDITS.md'), 'utf8')
  for (const [, key, , credit] of appEntries) {
    assert.ok(credit.trim().length > 0, `${key} has no credit`)
    assert.match(credits, new RegExp(`\\b${key}\\.jpg\\b`), `${key}.jpg is not in CREDITS.md`)
  }
})

test('every photo says what it stands for and what it shows', () => {
  for (const [key, photo] of Object.entries(MEAL_PHOTOS)) {
    assert.ok(photo.describes.length > 5, key)
    assert.ok(Array.isArray(photo.shows), key)
    for (const word of photo.shows) assert.equal(word, word.toLowerCase(), `${key}: ${word}`)
  }
  assert.ok(MEAL_PHOTOS.rice_plate, 'the prompt tells Gemini to fall back to rice_plate')
})
