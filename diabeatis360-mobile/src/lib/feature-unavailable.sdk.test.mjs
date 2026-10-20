// Contract test: does the REAL Firebase SDK report a missing function / bucket in the shape feature-unavailable.ts
// expects? It points the SDK the app uses at a tiny local server that answers like the live Spark project does
// (HTTP 404), so it needs no internet, no emulator and no Firebase project. If a Firebase upgrade ever changes how
// these errors look, this fails here instead of the app silently showing the wrong message.
// Run with: npm test
import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';

import { deleteApp, initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectStorageEmulator, getStorage, list, ref, uploadBytes } from 'firebase/storage';

import { isFunctionMissing, isStorageMissing } from './feature-unavailable.ts';

let counter = 0;

/** Runs `check` with a Firebase app whose Functions and Storage both talk to a local server using `reply`. */
async function withFakeFirebase(reply, check) {
  const server = http.createServer(reply);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const app = initializeApp({ apiKey: 'test', projectId: 'demo-contract', storageBucket: 'demo-contract.firebasestorage.app' }, `contract-${counter++}`);
  const functions = getFunctions(app, 'asia-southeast1');
  connectFunctionsEmulator(functions, '127.0.0.1', port);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', port);
  try {
    await check({ functions, storage });
  } finally {
    await deleteApp(app);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function failureOf(promise) {
  try { await promise; } catch (error) { return error; }
  return assert.fail('expected the call to fail');
}

const notFoundPage = (req, res) => {
  // What Google returns today for a function that was never deployed, and for a bucket that does not exist.
  if (req.url.startsWith('/v0/b/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":{"code":404,"message":"Not Found."}}');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><title>404 Page not found</title></html>');
  }
};

test('SDK: a function that is not deployed is recognised as missing', async () => {
  await withFakeFirebase(notFoundPage, async ({ functions }) => {
    const error = await failureOf(httpsCallable(functions, 'generateRecommendations')({ kind: 'meal' }));
    assert.equal(error.code, 'functions/not-found');
    assert.equal(isFunctionMissing(error), true);
  });
});

test('SDK: a deployed function that reports "unavailable" is NOT recognised as missing', async () => {
  const busy = (req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end('{"error":{"status":"UNAVAILABLE","message":"The AI service is busy"}}');
  };
  await withFakeFirebase(busy, async ({ functions }) => {
    const error = await failureOf(httpsCallable(functions, 'generateRecommendations')({ kind: 'meal' }));
    assert.equal(error.code, 'functions/unavailable');
    assert.equal(isFunctionMissing(error), false);
  });
});

test('SDK: a Storage bucket that does not exist is recognised as missing, for listing and for uploading', async () => {
  await withFakeFirebase(notFoundPage, async ({ storage }) => {
    const listing = await failureOf(list(ref(storage, 'guardian_ids'), { maxResults: 1 }));
    assert.equal(isStorageMissing(listing), true);
    const upload = await failureOf(uploadBytes(ref(storage, 'guardian_ids/someone/id.jpg'), new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' }));
    assert.equal(isStorageMissing(upload), true);
  });
});

test('SDK: a bucket that exists but refuses (HTTP 403) is NOT recognised as missing', async () => {
  const forbidden = (req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end('{"error":{"code":403,"message":"Permission denied. Could not perform this operation"}}');
  };
  await withFakeFirebase(forbidden, async ({ storage }) => {
    const listing = await failureOf(list(ref(storage, 'guardian_ids'), { maxResults: 1 }));
    assert.equal(listing.code, 'storage/unauthorized');
    assert.equal(isStorageMissing(listing), false);
  });
});
