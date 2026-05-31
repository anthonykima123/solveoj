const express = require('express');
const session = require('express-session');
const path = require('path');
const { db, initDB } = require('./database');

const authRoutes = require('./routes/auth');
const problemRoutes = require('./routes/problems');
const submissionRoutes = require('./routes/submissions');
const rankingRoutes = require('./routes/ranking');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');

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
  next();
});

app.get('/', (req, res) => {
  const problems = db.getProblems().slice(0, 8);
  const topUsers = db.getAllUsers().slice(0, 5);
  res.render('index', { problems, topUsers });
});

app.use('/', authRoutes);
app.use('/', problemRoutes);
app.use('/', submissionRoutes);
app.use('/', rankingRoutes);
app.use('/admin', adminRoutes);
app.use('/', settingsRoutes);

app.use((req, res) => res.status(404).render('404'));

initDB();

app.listen(PORT, () => {
  console.log(`\n🚀 SolveOJ → http://localhost:${PORT}\n`);
});
