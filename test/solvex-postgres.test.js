const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createStore } = require('../solvex/store');

test('Postgres serializes quota and keeps reports private', { skip: !process.env.SOLVEX_TEST_DATABASE_URL }, async t => {
  const store = createStore(process.env.SOLVEX_TEST_DATABASE_URL);
  t.after(async () => {
    await store.pause(false);
    await store.close();
  });
  await store.init();
  const owner = randomUUID();
  const limits = { daily: 500, personal: 1, minute: 500, running: 500 };
  const attempts = await Promise.all([
    store.reserve(owner, 'math', randomUUID(), limits),
    store.reserve(owner, 'math', randomUUID(), limits),
  ]);
  assert.equal(attempts.filter(item => item.id).length, 1);
  assert.equal(attempts.filter(item => item.reason === 'limit').length, 1);
  const id = attempts.find(item => item.id).id;
  await store.save(id, { valid: true });
  assert.equal((await store.get(owner, id)).report.valid, true);
  assert.equal(await store.get(randomUUID(), id), undefined);
  assert.equal((await store.history(owner))[0].id, id);
  await store.remove(owner, id);
  assert.equal(await store.get(owner, id), undefined);
  await store.pause(true);
  assert.equal((await store.reserve(randomUUID(), 'code', randomUUID(), limits)).reason, 'paused');
});
