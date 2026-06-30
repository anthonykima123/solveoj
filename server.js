const express = require('express');
const session = require('express-session');
const path = require('path');
const { db, initDB } = require('./database');
const { getTierInfo, getTierShort } = require('./utils/rating');
const { isAdmin, isSuperAdmin, hasPermission } = require('./utils/permissions');

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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: 'judge-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
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

app.get('/', (req, res) => {
  const problems = db.getProblems().slice(0, 8);
  const topUsers = db.getAllUsers()
    .filter(u => u.role !== 'superadmin' && !u.ranking_banned)
    .slice(0, 5);
  res.render('index', { problems, topUsers });
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
