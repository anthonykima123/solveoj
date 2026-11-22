const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { randomUUID } = require('node:crypto');
const temp = mkdtempSync(join(tmpdir(), 'solvex-test-'));
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.LOCAL_DB_FILE = join(temp, 'test.json');
const { app } = require('../server');
const { db } = require('../database');
const { createRouter, imageType } = require('../solvex/router');
const { gemini, validate } = require('../solvex/provider');
const examples = require('../solvex/examples');
let server;
let origin;
let studentCookie;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temp, { recursive: true, force: true });
});

test('homepage, fixed examples, SEO and health work without provider', async () => {
  for (const [url, expected] of [['/', /Beyond the/], ['/lens/math?example=1', /일반화 오류/],
    ['/lens/code?example=1', /반례 후보 · 미검증/], ['/solvex-privacy', /Google Gemini/],
    ['/health', /"status":"ok"/], ['/sitemap.xml', /https:\/\/solveoj.onrender.com/]]) {
    const response = await fetch(origin + url);
    assert.equal(response.status, 200, url);
    assert.match(await response.text(), expected);
  }
});

test('register, login, redirect guard and private pages', async () => {
  const post = (url, fields) => fetch(origin + url, { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });
  const password = 'test-pass-123';
  const register = await post('/register', { username: 'demo_student', email: 'demo@example.com', password, password2: password });
  assert.equal(register.status, 302);
  studentCookie = register.headers.get('set-cookie').split(';')[0];
  const login = await post('/login', { username: 'demo_student', password, next: '/\\example.com' });
  assert.equal(login.headers.get('location'), '/');
  assert.equal((await fetch(origin + '/analysis-history', { redirect: 'manual' })).status, 302);
  const history = await fetch(origin + '/analysis-history', { headers: { cookie: studentCookie } });
  assert.equal(history.status, 200);
  assert.equal(history.headers.get('cache-control'), 'private, no-store');
  assert.equal((await fetch(origin + '/admin/solvex', { headers: { cookie: studentCookie } })).status, 403);
  assert.equal((await fetch(origin + '/lens/math', { method: 'POST', headers: { cookie: studentCookie } })).status, 403);
  assert.equal((await fetch(origin + '/logout', { method: 'POST', headers: { origin: 'https://unrelated.example' } })).status, 403);
});

test('legacy execution is disabled and existing code visibility stays restricted', async () => {
  const viewer = db.getUserByUsername('demo_student');
  db._d.problems.push({ id: 8888, title: 'Test fixture' });
  const submission = db.createSubmission({
    user_id: 7000, problem_id: 8888, verdict: 'CE', execution_time: 0, language: 'cpp',
    code: 'MARKED_TEST_SOURCE', error_message: 'MARKED_SOURCE_IN_DIAGNOSTIC'
  });
  const url = origin + '/submissions/' + submission.id;
  const request = () => fetch(url, { headers: { cookie: studentCookie } }).then(response => response.text());
  assert.doesNotMatch(await request(), /MARKED_TEST_SOURCE|MARKED_SOURCE_IN_DIAGNOSTIC/);
  db.addSolved(viewer.id, 8888);
  assert.match(await request(), /MARKED_TEST_SOURCE/);
  assert.equal((await fetch(origin + '/problems/8888/submit', { method: 'POST' })).status, 503);
  assert.equal((await fetch(origin + '/tools/compiler/run', { method: 'POST' })).status, 503);
});

test('Gemini adapter sends separate instructions and validates structured output', async () => {
  const provider = gemini({ key: 'test-only', model: 'test-model', async request(url, options) {
    assert.match(url, /models\/test-model:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'], 'test-only');
    const body = JSON.parse(options.body);
    assert.match(body.systemInstruction.parts[0].text, /분석 자료/);
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(examples.math.result) }] } }] }));
  } });
  const result = await provider.analyze({ kind: 'math', max: 7 }, { mime: 'image/png', buffer: Buffer.from('test') });
  assert.equal(result.min, 1);
  assert.throws(() => validate({ ...result, max: 8 }, 7), /invalid_response/);
  assert.throws(() => validate({ ...result, issues: null }, 7), /invalid_response/);
  assert.equal(imageType({ mimetype: 'image/png', buffer: Buffer.from('not a png') }), null);
});

test('analysis POST handles CSRF, consent, mock quota, report ownership and deletion', async t => {
  const isolated = express();
  isolated.set('view engine', 'ejs');
  isolated.set('views', join(__dirname, '..', 'views'));
  isolated.use(express.urlencoded({ extended: false }));
  isolated.use((req, res, next) => {
    const id = req.get('X-Test-Account') || 'one';
    req.session = { user: { id }, solvexToken: 'test-token' };
    res.locals.currentUser = req.session.user;
    res.locals.isSuperAdmin = false;
    next();
  });
  const reports = new Map();
  const store = {
    async reserve(user, kind) {
      if (reports.size) return { reason: 'limit' };
      const id = randomUUID();
      reports.set(id, { user, kind });
      return { id };
    },
    async save(id, report) { reports.get(id).report = report; },
    async get(user, id) { const item = reports.get(id); return item?.user === user ? item : null; },
    async remove(user, id) { if (reports.get(id)?.user === user) reports.delete(id); }
  };
  isolated.use(createRouter({ db, store, baseUrl: origin, provider: { async analyze() { return examples.math.result; } } }));
  isolated.use((req, res) => res.sendStatus(404));
  isolated.use((error, req, res, next) => res.sendStatus(404));
  const instance = isolated.listen(0, '127.0.0.1');
  await once(instance, 'listening');
  t.after(() => new Promise(resolve => instance.close(resolve)));
  const host = 'http://127.0.0.1:' + instance.address().port;
  function analyze({ token = 'test-token', consent = 'yes' } = {}) {
    const body = new FormData();
    for (const [key, value] of Object.entries({ problem: '증명 문제', answer: '풀이', max: '7', consent })) body.set(key, value);
    return fetch(host + '/lens/math', { method: 'POST', headers: { 'X-Solvex-Token': token }, body });
  }
  assert.equal((await analyze({ token: 'bad' })).status, 403);
  assert.equal((await analyze({ consent: '' })).status, 400);
  const accepted = await analyze();
  assert.equal(accepted.status, 200);
  const { url } = await accepted.json();
  assert.match(await (await fetch(host + url)).text(), /일반화 오류/);
  assert.equal((await fetch(host + url, { headers: { 'X-Test-Account': 'two' } })).status, 404);
  assert.equal((await analyze()).status, 429);
  assert.equal((await fetch(host + url + '/delete', {
    method: 'POST', body: new URLSearchParams({ csrf: 'test-token' }), redirect: 'manual'
  })).status, 303);
  assert.equal((await fetch(host + url)).status, 404);
});
