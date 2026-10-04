'use strict'
// The server keeps its own copy of the D4 thresholds. This test loads the mobile app's version and checks that the two
// give the same answer for every reading from 0 to 500 in both meal contexts, so they can never silently drift apart.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { test } = require('node:test')

const { interpretGlucose } = require('../lib/glucose')

test('server thresholds equal the mobile constants/glucose.ts for every reading', async () => {
  const mobile = await import(pathToFileURL(path.join(__dirname, '../../diabeatis360-mobile/src/constants/glucose.ts')).href)
  for (const context of ['before_meal', 'after_meal']) {
    for (let value = 0; value <= 500; value += 1) {
      assert.equal(interpretGlucose(value, context), mobile.interpretGlucose(value, context), `${value} mg/dL ${context}`)
    }
  }
})
