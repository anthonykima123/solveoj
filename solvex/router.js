const express = require('express');
const multer = require('multer');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { gemini } = require('./provider');
const examples = require('./examples');
const { requireSuperAdmin } = require('../middleware/admin');
const { requireLogin } = require('../middleware/auth');

const limit = (name, fallback, max) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 1 ? Math.min(value, max) : fallback;
};
const maxInput = limit('AI_MAX_INPUT_SIZE', 12000, 24000);
const limits = {
  personal: limit('AI_DAILY_USER_LIMIT', 3, 20), daily: limit('AI_DAILY_GLOBAL_LIMIT', 20, 500),
  minute: limit('AI_MINUTE_LIMIT', 4, 20), running: limit('AI_CONCURRENCY_LIMIT', 2, 5)
};
const imageLimit = 1024 * 1024;
const upload = multer({ limits: { fileSize: imageLimit, files: 1, fields: 8, fieldSize: maxInput * 4, parts: 10 } }).single('image');
const languages = ['C++17', 'C++20', 'Python 3', 'Java 11'];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const field = value => typeof value === 'string' ? value.trim() : '';
const errors = {
  paused: '현재 실제 분석이 일시 중지되었습니다.',
  limit: '현재 분석 한도에 도달했습니다. 잠시 후 또는 다음 날 다시 시도해 주세요.',
  duplicate: '같은 입력을 이미 요청했습니다. 잠시 후 분석 기록을 확인해 주세요.',
  provider_quota: 'Gemini 사용량 한도에 도달했습니다. 나중에 다시 시도해 주세요.',
  failed: '분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'
};

function imageType(file) {
  if (!file) return null;
  const data = file.buffer;
  if (file.mimetype === 'image/png' && data.length >= 24 &&
      data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
      data.readUInt32BE(16) > 0 && data.readUInt32BE(16) <= 4096 &&
      data.readUInt32BE(20) > 0 && data.readUInt32BE(20) <= 4096) return 'image/png';
  if (file.mimetype === 'image/jpeg' && data.length > 4 &&
      data.subarray(0, 3).toString('hex') === 'ffd8ff' && data.subarray(-2).toString('hex') === 'ffd9') return 'image/jpeg';
  return null;
}

function createRouter({ store, db, provider, baseUrl }) {
  const router = express.Router();
  const model = process.env.GEMINI_MODEL;
  const reviewers = new Set((process.env.GEMINI_REVIEWER_IDS || '').split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id)));
  const providerConfigured = process.env.AI_ENABLED === 'true' && process.env.GEMINI_PRIVATE_REVIEW === 'true' &&
    new URL(baseUrl).hostname !== 'solveoj.onrender.com' && reviewers.size && process.env.GEMINI_API_KEY && model;
  const service = provider || (providerConfigured && /^[a-z0-9][a-z0-9.-]{1,100}$/.test(model)
    ? gemini({ key: process.env.GEMINI_API_KEY, model }) : null);
  const ready = Boolean(service && store);
  const canAnalyze = user => Boolean(ready && user && (provider || reviewers.has(String(user.id))));
  const hashKey = process.env.SESSION_SECRET || randomBytes(32);
  const render = (res, page, data = {}) => res.render(`solvex/${page}`, { baseUrl, ready, ...data });
  const validKind = kind => kind === 'math' || kind === 'code';
  const privatePage = (req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' });
    next();
  };
  const guarded = handler => async (req, res) => {
    const requestId = randomUUID();
    try {
      await handler(req, res);
    } catch {
      console.error(JSON.stringify({ event: 'solvex_request_failed', requestId }));
      if (!res.headersSent) render(res.status(503), 'notice', { title: '일시적으로 사용할 수 없습니다', message: '요청 번호 ' + requestId });
    }
  };
  const token = req => req.session.solvexToken ||= randomBytes(32).toString('hex');
  const csrf = (req, res, next) => {
    if (!req.session.solvexToken || req.body?.csrf !== req.session.solvexToken) {
      return render(res.status(403), 'notice', { title: '요청을 확인할 수 없습니다', message: '페이지를 새로고침한 뒤 다시 시도해 주세요.' });
    }
    next();
  };
  router.get('/', (req, res) => render(res, 'home', { examples }));
  router.get('/lens', (req, res) => res.redirect('/lens/math'));
  router.get('/lens/:kind', privatePage, (req, res, next) => {
    const kind = req.params.kind;
    if (!validKind(kind)) return next();
    const example = req.query.example === '1' ? examples[kind] : null;
    const id = /^\d{1,9}$/.test(req.query.problem || '') ? Number(req.query.problem) : 0;
    const problem = kind === 'code' && id ? db.getProblemById(id) : null;
    const prefill = problem && !problem.is_private
      ? [problem.title, problem.description, problem.input_desc, problem.output_desc, problem.constraints].filter(Boolean).join('\n\n').slice(0, maxInput)
      : '';
    render(res, 'lens', { kind, example, prefill, maxInput,
      ready: canAnalyze(res.locals.currentUser), csrfToken: canAnalyze(res.locals.currentUser) ? token(req) : '' });
  });
  router.post('/lens/:kind', privatePage, requireLogin, (req, res, next) => {
    if (!canAnalyze(res.locals.currentUser) || !validKind(req.params.kind)) {
      return render(res.status(403), 'notice', { title: '실제 분석을 사용할 수 없습니다', message: '고정 예시는 분석실에서 열 수 있습니다.' });
    }
    // Checking the session token before buffering the multipart request bounds cross-site uploads.
    if (!req.session.solvexToken || req.get('X-Solvex-Token') !== req.session.solvexToken) {
      return res.status(403).json({ error: '페이지를 새로고침한 뒤 다시 시도해 주세요.' });
    }
    upload(req, res, error => error ? res.status(400).json({ error: '사진은 1MB 이하의 PNG 또는 JPEG 한 장으로 첨부해 주세요.' }) : next());
  }, async (req, res) => {
    const kind = req.params.kind;
    const owner = String(res.locals.currentUser.id);
    const body = req.body || {};
    const input = { kind, problem: field(body.problem), answer: field(body.answer), context: field(body.context) };
    if (kind === 'math') input.max = Number(body.max);
    else input.language = field(body.language);
    const mime = imageType(req.file);
    if (body.consent !== 'yes' || (req.file && (kind !== 'math' || !mime)) ||
        (!input.problem && !mime) || (!input.answer && !mime) ||
        input.problem.length + input.answer.length + input.context.length > maxInput ||
        (kind === 'math' && (!Number.isInteger(input.max) || input.max < 1 || input.max > 100)) ||
        (kind === 'code' && !languages.includes(input.language))) {
      return res.status(400).json({ error: '문제, 풀이, 입력 길이, 배점과 전송 동의를 확인해 주세요. 사진은 1MB 이하의 PNG 또는 JPEG를 지원합니다.' });
    }
    const hash = createHmac('sha256', hashKey).update(JSON.stringify(input));
    if (req.file) hash.update(req.file.buffer);
    let id;
    let outcome = 'failed';
    try {
      const reservation = await store.reserve(owner, kind, hash.digest('hex'), limits);
      if (!reservation.id) return res.status(429).json({ error: errors[reservation.reason] || errors.limit });
      id = reservation.id;
      const result = await service.analyze(input, mime ? { mime, buffer: req.file.buffer } : null);
      await store.save(id, { input, result });
      return res.json({ url: '/analysis-history/' + id });
    } catch (error) {
      outcome = error.message === 'provider_quota' ? 'provider_quota' : 'failed';
      const requestId = id || randomUUID();
      console.error(JSON.stringify({ event: 'solvex_analysis_failed', requestId, outcome }));
      if (id) await store.finish(id, outcome).catch(() => {});
      return res.status(outcome === 'provider_quota' ? 429 : 503).json({ error: (errors[outcome] || errors.failed) + ' 요청 번호 ' + requestId });
    }
  });
  router.use(['/analysis-history', '/admin/solvex'], privatePage);
  router.get('/analysis-history', requireLogin, guarded(async (req, res) => {
    const owner = res.locals.currentUser?.id;
    if (owner == null) return res.redirect('/login');
    render(res, 'history', { reviews: store ? await store.history(String(owner)) : [] });
  }));
  router.get('/analysis-history/:id', requireLogin, guarded(async (req, res) => {
    const review = store && res.locals.currentUser && uuid.test(req.params.id)
      ? await store.get(String(res.locals.currentUser.id), req.params.id) : null;
    if (!review) return res.status(404).render('404');
    render(res, 'review', { review, id: req.params.id, csrfToken: token(req) });
  }));
  router.post('/analysis-history/:id/delete', requireLogin, csrf, guarded(async (req, res) => {
    if (store && res.locals.currentUser && uuid.test(req.params.id)) await store.remove(String(res.locals.currentUser.id), req.params.id);
    res.redirect(303, '/analysis-history');
  }));
  router.get('/admin/solvex', requireSuperAdmin, guarded(async (req, res) => {
    render(res, 'admin', { stats: store ? await store.stats() : null, model: ready ? model : '', limits, csrfToken: token(req) });
  }));
  router.post('/admin/solvex', requireSuperAdmin, csrf, guarded(async (req, res) => {
    if (store && ['pause', 'resume'].includes(req.body.action)) await store.pause(req.body.action === 'pause');
    res.redirect(303, '/admin/solvex');
  }));
  router.get('/solvex-privacy', (req, res) => render(res, 'privacy'));
  return router;
}

module.exports = { createRouter, imageType };
