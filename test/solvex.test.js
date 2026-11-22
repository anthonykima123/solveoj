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

test('public application routes share the SOLVEX shell', async () => {
  for (const [url, status] of [['/login', 200], ['/register', 200], ['/contests', 200], ['/groups', 200],
    ['/problems/all', 200], ['/community', 200], ['/ranking', 200], ['/status', 200], ['/tools', 200],
    ['/classic', 200], ['/problems/987654321', 404]]) {
    const response = await fetch(origin + url);
    assert.equal(response.status, status, url);
    const html = await response.text();
    assert.match(html, /class="sx-header"/, url);
    assert.match(html, /href="\/css\/solvex.css"/, url);
    assert.match(html, /data-theme-toggle/, url);
    assert.match(html, /개인정보 및 이용 안내/, url);
    assert.doesNotMatch(html, /class="site-header"|SolveOJ &copy;/, url);
  }
});

test('public Lens loads local inference without an analysis POST', async () => {
  for (const kind of ['math', 'code']) {
    const html = await (await fetch(origin + '/lens/' + kind)).text();
    assert.match(html, new RegExp('data-local-review="' + kind + '"'));
    assert.match(html, /method="dialog"/);
    assert.match(html, /data-local-start/);
    assert.doesNotMatch(html, /name="consent"|name="image"|method="post" enctype="multipart\/form-data"/);
  }
  const worker = await fetch(origin + '/js/local-ai-worker.mjs');
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get('content-type'), /javascript/);
  assert.match(await worker.text(), /WebWorkerMLCEngineHandler/);
  const runtime = await fetch(origin + '/vendor/web-llm-0.2.89.js');
  assert.equal(runtime.status, 200);
  assert.match(runtime.headers.get('content-type'), /javascript/);
  assert.match(await runtime.text(), /Qwen2\.5-1\.5B-Instruct-q4f32_1-MLC/);
});

test('local AI prompts use entered content and reject invalid model feedback', async () => {
  const { reviewRequest, parseReview } = await import('../public/js/local-review.mjs');
  const input = { kind: 'math', max: 7, problem: '나눗셈의 성질', answer: '검증할 풀이' };
  const request = reviewRequest(input);
  assert.equal(JSON.parse(request.messages[1].content).answer, input.answer);
  assert.equal(JSON.parse(request.response_format.schema).properties.score.maximum, 7);
  const report = { summary: '일반화 근거를 보완해야 합니다.', score: 2, findings: [], hint: '', counterexample: '' };
  const reply = value => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
  assert.equal(parseReview(reply(report), input).score, 2);
  assert.throws(() => parseReview(reply({ ...report, score: 8 }), input), /invalid_review/);
  assert.throws(() => parseReview({ choices: [{ finish_reason: 'length' }] }, input), /invalid_review/);
  assert.doesNotMatch(reviewRequest({ kind: 'code' }).response_format.schema, /"score"/);
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

test('OpenAI analysis requires an allowlisted account and consent, then saves a private report', async t => {
  const isolated = express();
  isolated.set('view engine', 'ejs');
  isolated.set('views', join(__dirname, '..', 'views'));
  isolated.use(express.urlencoded({ extended: false }));
  isolated.use((req, res, next) => {
    const id = req.get('X-Test-Account') || '1';
    req.session = { user: { id }, solvexToken: 'test-token' };
    res.locals.currentUser = req.session.user;
    res.locals.isAdmin = false;
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
  let calls = 0;
  isolated.use(createRouter({
    db, store, baseUrl: 'https://solveoj.onrender.com',
    env: { AI_PROVIDER: 'openai', AI_ENABLED: 'true', OPENAI_API_KEY: 'test-only', OPENAI_REVIEWER_IDS: '1' },
    async providerRequest(url, options) {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      const payload = JSON.parse(options.body);
      assert.equal(payload.model, 'gpt-6.2-sol');
      assert.equal(payload.store, false);
      assert.match(payload.safety_identifier, /^[a-f0-9]{64}$/);
      assert.equal(payload.text.format.strict, true);
      assert.equal(payload.text.format.schema.properties.issues.items.additionalProperties, false);
      const content = payload.input[0].content;
      assert.equal(content.length, 1);
      assert.equal(content[0].type, 'input_text');
      assert.equal(JSON.parse(content[0].text).answer, '풀이');
      return Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify(examples.math.result) }] }] });
    }
  }));
  isolated.use((req, res) => res.sendStatus(404));
  isolated.use((error, req, res, next) => res.sendStatus(404));
  const instance = isolated.listen(0, '127.0.0.1');
  await once(instance, 'listening');
  t.after(() => new Promise(resolve => instance.close(resolve)));
  const host = 'http://127.0.0.1:' + instance.address().port;
  function analyze({ token = 'test-token', consent = 'openai', account = '1', image = false } = {}) {
    const body = new FormData();
    for (const [key, value] of Object.entries({ problem: '증명 문제', answer: '풀이', max: '7', consent })) body.set(key, value);
    if (image) body.set('image', new Blob(['test image'], { type: 'image/jpeg' }), 'test.jpg');
    return fetch(host + '/lens/math', { method: 'POST', headers: { 'X-Solvex-Token': token, 'X-Test-Account': account }, body });
  }
  const allowedPage = await (await fetch(host + '/lens/math')).text();
  assert.match(allowedPage, /OpenAI로 분석/);
  assert.doesNotMatch(allowedPage, /name="image"|test-only/);
  assert.match(await (await fetch(host + '/lens/math', { headers: { 'X-Test-Account': '2' } })).text(), /data-local-review="math"/);
  assert.equal((await analyze({ account: '2' })).status, 403);
  assert.equal((await analyze({ token: 'bad' })).status, 403);
  assert.equal((await analyze({ consent: '' })).status, 400);
  assert.equal((await analyze({ consent: 'yes' })).status, 400);
  assert.equal((await analyze({ image: true })).status, 400);
  assert.equal(calls, 0);
  const accepted = await analyze();
  assert.equal(accepted.status, 200);
  const { url } = await accepted.json();
  const review = await (await fetch(host + url)).text();
  assert.match(review, /일반화 오류/);
  assert.match(review, /OpenAI \/ 분석 결과/);
  assert.equal((await fetch(host + url, { headers: { 'X-Test-Account': '2' } })).status, 404);
  assert.equal((await analyze()).status, 429);
  assert.equal((await fetch(host + url + '/delete', {
    method: 'POST', body: new URLSearchParams({ csrf: 'test-token' }), redirect: 'manual'
  })).status, 303);
  assert.equal((await fetch(host + url)).status, 404);
  assert.equal(calls, 1);
});
