const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');
const { isAdmin } = require('../utils/permissions');
const { CONTEST_PRIZES } = require('../utils/shop');
const router = express.Router();

// 대회 상태 계산
function contestStatus(c) {
  const now = Date.now();
  const s = new Date(c.start_at).getTime();
  const e = new Date(c.end_at).getTime();
  if (now < s) return { key: 'upcoming', label: '예정' };
  if (now > e) return { key: 'ended', label: '종료' };
  return { key: 'running', label: '진행중' };
}

// 관리자만 통과
function requireAdminUser(req, res, next) {
  if (!req.session.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  const u = db.getUserById(req.session.user.id);
  if (!isAdmin(u)) return res.status(403).render('403');
  next();
}

// 목록
router.get('/contests', (req, res) => {
  const contests = db.getContests().map(c => ({ ...c, status: contestStatus(c) }));
  res.render('contests/list', { contests, isAdmin: isAdmin(db.getUserById((req.session.user || {}).id)) });
});

// 생성 폼 (관리자)
router.get('/contests/new', requireAdminUser, (req, res) => {
  res.render('contests/new', { error: null, problems: db.getProblems() });
});

// 생성 (관리자)
router.post('/contests', requireAdminUser, (req, res) => {
  const { title, description, start_at, end_at } = req.body;
  let problem_ids = req.body.problem_ids || [];
  if (!Array.isArray(problem_ids)) problem_ids = [problem_ids];
  problem_ids = problem_ids.map(Number).filter(Boolean);

  if (!title || !start_at || !end_at)
    return res.render('contests/new', { error: '제목, 시작/종료 시각은 필수입니다.', problems: db.getProblems() });

  const c = db.createContest({ title, description: description || '', start_at, end_at, problem_ids });
  res.redirect('/contests/' + c.id);
});

// 상세
router.get('/contests/:id', (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  const problems = (c.problem_ids || []).map(id => db.getProblemById(id)).filter(Boolean);
  const me = db.getUserById((req.session.user || {}).id);
  res.render('contests/detail', { contest: c, problems, status: contestStatus(c), isAdmin: isAdmin(me) });
});

// 대회 정산 (관리자) — 제출 기록 기반으로 1/2/3등에 코인 지급
router.post('/contests/:id/award', requireAdminUser, (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  if (c.prizes_awarded) return res.redirect('/contests/' + c.id + '?err=already_awarded');

  const start = new Date(c.start_at).getTime();
  const end = new Date(c.end_at).getTime();
  const pidSet = new Set(c.problem_ids || []);

  // 대회 기간 내 AC 제출만 집계
  const allSubs = db.getAllSubmissions(1000000);
  const scores = {}; // userId → { solved: Set, lastTime: number }
  allSubs.forEach(s => {
    const t = new Date(s.created_at).getTime();
    if (s.verdict !== 'AC' || !pidSet.has(s.problem_id) || t < start || t > end) return;
    if (!scores[s.user_id]) scores[s.user_id] = { solved: new Set(), lastTime: 0 };
    if (!scores[s.user_id].solved.has(s.problem_id)) {
      scores[s.user_id].solved.add(s.problem_id);
      scores[s.user_id].lastTime = Math.max(scores[s.user_id].lastTime, t);
    }
  });

  const ranked = Object.entries(scores)
    .map(([uid, sc]) => ({ userId: parseInt(uid), count: sc.solved.size, lastTime: sc.lastTime }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count || a.lastTime - b.lastTime);

  ranked.slice(0, 3).forEach((entry, i) => {
    const prize = CONTEST_PRIZES[i + 1];
    if (prize) db.addCoins(entry.userId, prize);
  });

  db.updateContest(c.id, { prizes_awarded: true });
  res.redirect('/contests/' + c.id + '?awarded=1');
});

// 삭제 (관리자)
router.post('/contests/:id/delete', requireAdminUser, (req, res) => {
  db.deleteContest(parseInt(req.params.id));
  res.redirect('/contests');
});

module.exports = router;
