const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');
const { isAdmin } = require('../utils/permissions');
const { CONTEST_PRIZES } = require('../utils/shop');
const router = express.Router();

// datetime-local 입력(KST)을 UTC ISO 문자열로 변환
function kstToUtc(dtLocal) {
  return new Date(dtLocal + '+09:00').toISOString();
}

// UTC ISO → KST 표시용 문자열
function fmtKST(isoStr) {
  return new Date(isoStr).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function contestStatus(c) {
  const now = Date.now();
  const s = new Date(c.start_at).getTime();
  const e = new Date(c.end_at).getTime();
  if (now < s) return { key: 'upcoming', label: '예정' };
  if (now > e) return { key: 'ended', label: '종료' };
  return { key: 'running', label: '진행중' };
}

function requireAdminUser(req, res, next) {
  if (!req.session.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  const u = db.getUserById(req.session.user.id);
  if (!isAdmin(u)) return res.status(403).render('403');
  next();
}

// 스코어보드 데이터 계산 (공통)
function buildScoreboard(c) {
  const start = new Date(c.start_at).getTime();
  const end   = new Date(c.end_at).getTime();
  const pidList = c.problem_ids || [];
  const pidSet  = new Set(pidList);
  const regSet  = new Set(c.registrations || []);

  // 대회 기간 내 등록 참가자의 제출만 수집
  const allSubs = db.getAllSubmissions(10000000);
  const contestSubs = allSubs.filter(s => {
    const t = new Date(s.created_at).getTime();
    return pidSet.has(s.problem_id) && t >= start && t <= end && regSet.has(s.user_id);
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // 참가자별 문제별 집계
  // entry[uid][pid] = { waCount, acTime(ms from start), score }
  const byUser = {};
  for (const uid of regSet) byUser[uid] = {};

  for (const s of contestSubs) {
    const uid = s.user_id;
    const pid = s.problem_id;
    if (!byUser[uid]) byUser[uid] = {};
    if (!byUser[uid][pid]) byUser[uid][pid] = { waCount: 0, acTime: null, subs: [] };
    const cell = byUser[uid][pid];
    const elapsed = new Date(s.created_at).getTime() - start; // ms
    cell.subs.push({ verdict: s.verdict, elapsed });
    if (cell.acTime !== null) continue; // 이미 AC
    if (s.verdict === 'AC') {
      cell.acTime = elapsed;
    } else {
      cell.waCount++;
    }
  }

  // 참가자 행 구성
  const rows = [];
  for (const uid of regSet) {
    const user = db.getUserById(uid);
    if (!user) continue;
    const cells = {};
    let totalScore = 0;
    let totalPenalty = 0; // ICPC: solve time + 20min per WA
    for (const pid of pidList) {
      const cell = byUser[uid][pid] || { waCount: 0, acTime: null, subs: [] };
      cells[pid] = cell;
      if (cell.acTime !== null) {
        totalScore++;
        totalPenalty += Math.floor(cell.acTime / 60000) + cell.waCount * 20;
      }
    }
    rows.push({ user, cells, totalScore, totalPenalty });
  }

  rows.sort((a, b) => b.totalScore - a.totalScore || a.totalPenalty - b.totalPenalty);

  const duration = end - start; // ms
  return { rows, pidList, duration, start };
}

// 목록
router.get('/contests', (req, res) => {
  const contests = db.getContests().map(c => ({ ...c, status: contestStatus(c) }));
  res.render('contests/list', { contests, isAdmin: isAdmin(db.getUserById((req.session.user || {}).id)), fmtKST });
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
  const startUtc = kstToUtc(start_at);
  const endUtc   = kstToUtc(end_at);
  if (new Date(endUtc) <= new Date(startUtc))
    return res.render('contests/new', { error: '종료 시각이 시작 시각보다 늦어야 합니다.', problems: db.getProblems() });

  const c = db.createContest({ title, description: description || '', start_at: startUtc, end_at: endUtc, problem_ids, registrations: [] });
  res.redirect('/contests/' + c.id);
});

// 스코어보드 (별도 페이지)
router.get('/contests/:id/scoreboard', (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  const status = contestStatus(c);
  if (status.key === 'upcoming') return res.redirect('/contests/' + c.id);
  const problems = (c.problem_ids || []).map(id => db.getProblemById(id)).filter(Boolean);
  const sb = buildScoreboard(c);
  const me = db.getUserById((req.session.user || {}).id);
  res.render('contests/scoreboard', {
    contest: c, status, problems,
    rows: sb.rows, pidList: sb.pidList, duration: sb.duration, startMs: sb.start,
    isAdmin: isAdmin(me), fmtKST
  });
});

// 상세
router.get('/contests/:id', (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  const problems = (c.problem_ids || []).map(id => db.getProblemById(id)).filter(Boolean);
  const me = db.getUserById((req.session.user || {}).id);
  const myId = me ? me.id : null;
  const registered = myId ? db.isRegisteredContest(c.id, myId) : false;
  const regCount = (c.registrations || []).length;
  const status = contestStatus(c);

  res.render('contests/detail', {
    contest: c, problems, status,
    isAdmin: isAdmin(me), registered, regCount,
    fmtKST,
    awarded: req.query.awarded === '1',
    awardErr: req.query.err || null
  });
});

// 참가 신청
router.post('/contests/:id/register', requireLogin, (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  if (contestStatus(c).key === 'ended') return res.redirect('/contests/' + c.id);
  db.registerContest(c.id, req.session.user.id);
  res.redirect('/contests/' + c.id);
});

// 참가 취소
router.post('/contests/:id/unregister', requireLogin, (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  if (contestStatus(c).key !== 'upcoming') return res.redirect('/contests/' + c.id);
  db.unregisterContest(c.id, req.session.user.id);
  res.redirect('/contests/' + c.id);
});

// 대회 정산 (관리자)
router.post('/contests/:id/award', requireAdminUser, (req, res) => {
  const c = db.getContestById(parseInt(req.params.id));
  if (!c) return res.status(404).render('404');
  if (c.prizes_awarded) return res.redirect('/contests/' + c.id + '?err=already_awarded');

  const sb = buildScoreboard(c);
  sb.rows.slice(0, 3).forEach((row, i) => {
    const prize = CONTEST_PRIZES[i + 1];
    if (prize) db.addCoins(row.user.id, prize);
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
