const express = require('express');
const session = require('express-session');
const path = require('path');
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

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'judge-secret-2024',
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

app.get('/', (req, res) => {
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

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 SolveOJ → http://localhost:${PORT} (${db.usePg ? 'Postgres' : 'local file'})\n`);
    });
  })
  .catch(err => {
    console.error('❌ DB 초기화 실패:', err);
    process.exit(1);
  });
