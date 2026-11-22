const express = require('express');
const session = require('express-session');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { createRouter } = require('./solvex/router');
const { createStore } = require('./solvex/store');
const { db, initDB } = require('./database');
const { getTierInfo, getTierShort } = require('./utils/rating');
const { isAdmin, isSuperAdmin, hasPermission } = require('./utils/permissions');
const { getDailyData } = require('./utils/daily');
const { getDifficultyScore } = require('./utils/rating');

const authRoutes = require('./routes/auth');
const problemRoutes = require('./routes/problems');
const submissionRoutes = require('./routes/submissions');
const rankingRoutes = require('./routes/ranking');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const communityRoutes = require('./routes/community');
const contestRoutes = require('./routes/contests');
const groupRoutes = require('./routes/groups');
const toolsRoutes = require('./routes/tools');
const profileRoutes = require('./routes/profile');
const shopRoutes = require('./routes/shop');

const app = express();
const PORT = process.env.PORT || 3000;
const production = process.env.NODE_ENV === 'production';
if (production && (!process.env.DATABASE_URL || (process.env.SESSION_SECRET || '').length < 32)) {
  throw new Error('Production requires DATABASE_URL and a SESSION_SECRET of at least 32 characters.');
}
const baseUrl = new URL(process.env.APP_BASE_URL || 'https://solveoj.onrender.com').origin;
const reviewStore = createStore(process.env.DATABASE_URL);

app.set('trust proxy', production ? 1 : false);
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/vendor/web-llm-0.2.89.js', (req, res) => {
  res.sendFile(require.resolve('@mlc-ai/web-llm'), { maxAge: '7d', immutable: true });
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  if (/^\/(?:admin|submissions|login|register|settings)(?:\/|$)/i.test(req.path)) {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('Origin');
    const currentOrigin = req.protocol + '://' + req.get('Host');
    if (req.get('Sec-Fetch-Site') === 'cross-site' ||
        (origin && origin !== (production ? baseUrl : currentOrigin))) return res.sendStatus(403);
  }
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.getTierInfo = getTierInfo;
  res.locals.getTierShort = getTierShort;
  // 역할/권한 정보를 모든 뷰에서 사용할 수 있게 노출 (DB에서 최신값 조회)
  const cu = req.session.user ? db.getUserById(req.session.user.id) : null;
  res.locals.currentUser = cu;
  res.locals.isAdmin = isAdmin(cu);
  res.locals.isSuperAdmin = isSuperAdmin(cu);
  res.locals.hasPerm = (p) => hasPermission(cu, p);
  next();
});

function getAIRecommendations(userId, allProblems) {
  const solvedIds = userId ? new Set(db.getSolvedIds(userId)) : new Set();
  const unsolved = allProblems.filter(p => !solvedIds.has(p.id));

  if (solvedIds.size === 0) {
    // 풀이 기록 없음: 정답률 높은 쉬운 문제 추천
    return unsolved
      .filter(p => p.submission_count > 0)
      .sort((a, b) => {
        const ra = a.accepted_count / a.submission_count;
        const rb = b.accepted_count / b.submission_count;
        return rb - ra;
      })
      .slice(0, 3);
  }

  // 태그 빈도 분석
  const tagFreq = {};
  for (const id of solvedIds) {
    const p = db.getProblemById(id);
    if (p) (p.tags || []).forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; });
  }

  // 현재 평균 난이도 → 약간 높은 목표
  const scores = [...solvedIds].map(id => {
    const p = db.getProblemById(id);
    return p ? getDifficultyScore(p.difficulty) : 0;
  }).filter(s => s > 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const target = avg * 1.25;

  return unsolved.map(p => {
    const tagMatch = (p.tags || []).reduce((s, t) => s + (tagFreq[t] || 0), 0);
    const diff = getDifficultyScore(p.difficulty);
    const diffPenalty = Math.abs(diff - target) / Math.max(target, 1) * 30;
    const score = tagMatch * 25 - diffPenalty + (p.accepted_count > 0 ? 3 : 0);
    return { p, score };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 3)
  .map(x => x.p);
}

app.get('/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (reviewStore) await reviewStore.ping();
    res.json({ status: 'ok', database: db.usePg ? 'postgres' : 'local', reviewStorage: Boolean(reviewStore) });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
app.get('/robots.txt', (req, res) => res.type('text').send([
  'User-agent: *', 'Disallow: /admin', 'Disallow: /submissions', 'Disallow: /analysis-history',
  'Sitemap: ' + baseUrl + '/sitemap.xml'
].join('\n')));
app.get('/sitemap.xml', (req, res) => res.type('xml').send(
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  ['/', '/solvex-privacy', '/problems/all'].map(url => '<url><loc>' + baseUrl + url + '</loc></url>').join('') +
  '</urlset>'
));
app.use('/', createRouter({ store: reviewStore, db, baseUrl }));

app.get('/classic', (req, res) => {
  const allProblems = db.getProblems();
  const problems = allProblems.slice(0, 8);
  const topUsers = db.getAllUsers()
    .filter(u => u.role !== 'superadmin' && !u.ranking_banned)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);
  const { daily, doubleCoins } = getDailyData(allProblems);
  const stats = {
    problems: allProblems.length,
    users: db.getAllUsers().length,
    submissions: db.countSubmissions(),
    languages: ['C++17', 'Python 3', 'Java 11']
  };
  const userId = req.session.user ? req.session.user.id : null;
  const aiRecs = getAIRecommendations(userId, allProblems);
  const aiLabel = userId && db.getSolvedIds(userId).length > 0
    ? '풀이 패턴 분석 기반 추천'
    : '인기 문제 추천';
  res.render('index', { problems, topUsers, daily, doubleCoins, stats, aiRecs, aiLabel });
});

app.get('/problems/:id/submit', (req, res) => res.redirect('/lens/code?problem=' + encodeURIComponent(req.params.id)));
app.post('/problems/:id/submit', (req, res) => res.status(503).send('격리 실행 환경을 준비 중입니다. Code Lens에서 정적 분석을 이용할 수 있습니다.'));
app.get('/tools/compiler', (req, res) => res.redirect('/lens/code'));
app.post('/tools/compiler/run', (req, res) => res.status(503).json({ error: '격리 실행 환경을 준비 중입니다.' }));

app.use('/', authRoutes);
app.use('/', problemRoutes);
app.use('/', submissionRoutes);
app.use('/', rankingRoutes);
app.use('/admin', adminRoutes);
app.use('/', communityRoutes);
app.use('/', contestRoutes);
app.use('/', groupRoutes);
app.use('/', toolsRoutes);
app.use('/', profileRoutes);
app.use('/', shopRoutes);
app.use('/', settingsRoutes);

app.use((req, res) => res.status(404).render('404'));

async function start() {
  await initDB();
  if (reviewStore) await reviewStore.init();
  const server = app.listen(PORT, () => console.log('SOLVEX listening on ' + server.address().port));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      setTimeout(() => process.exit(1), 30000).unref();
      server.close(async () => {
        await reviewStore?.close().catch(() => {});
        process.exit(0);
      });
    });
  }
  return server;
}

if (require.main === module) start().catch(() => {
  console.error(JSON.stringify({ event: 'solvex_startup_failed' }));
  process.exit(1);
});

module.exports = { app, start };
