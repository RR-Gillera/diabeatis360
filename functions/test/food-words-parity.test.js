'use strict'
// The server and the app keep the same food lists (DECISIONS.md D40): the app's search offers them and the server's
// safety check reads their other names. This loads the app's copy and checks the two are identical.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { test } = require('node:test')

const server = require('../lib/food-words')

test('the app offers exactly the foods, names and other names the server checks', async () => {
  const app = await import(pathToFileURL(path.join(__dirname, '../../diabeatis360-mobile/src/constants/food-words.ts')).href)
  assert.deepEqual(app.FOODS, server.FOODS)
  assert.deepEqual([...app.ALLERGY_CHOICES], server.ALLERGY_CHOICES)
  assert.deepEqual([...app.INGREDIENT_CHOICES], server.INGREDIENT_CHOICES)
})

test('every offered choice is in the list, and every word is lower case', () => {
  for (const name of [...server.ALLERGY_CHOICES, ...server.INGREDIENT_CHOICES]) assert.ok(server.FOODS[name], name)
  for (const [name, food] of Object.entries(server.FOODS)) {
    assert.ok(food.fil && food.words.length, name)
    for (const word of food.words) assert.equal(word, word.toLowerCase(), `${name}: ${word}`)
  }
})
