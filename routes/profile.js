const express = require('express');
const { db } = require('../database');
const { getTierInfo, getNextThreshold, getTierShort } = require('../utils/rating');
const router = express.Router();

const LANG_LABELS = { cpp: 'C++17', python: 'Python 3', java: 'Java 11' };
const VERDICT_LABELS = {
  AC: '맞았습니다!!', WA: '틀렸습니다', TLE: '시간 초과',
  MLE: '메모리 초과', RE: '런타임 에러', CE: '컴파일 에러'
};
const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'ruby'];

router.get('/user/:username', (req, res) => {
  const profileUser = db.getUserByUsername(req.params.username);
  if (!profileUser) return res.status(404).render('404');

  const rating = profileUser.rating || 0;
  const tier = getTierInfo(rating);
  const next = getNextThreshold(rating);
  const floor = tier.min;
  const progress = next ? Math.min(100, Math.round((rating - floor) / (next - floor) * 100)) : 100;

  // 랭크 (레이팅 내림차순)
  const all = db.getAllUsers().slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const rank = all.findIndex(u => u.id === profileUser.id) + 1;

  // 푼 문제 (문제 번호 오름차순)
  const solvedProblems = db.getSolvedIds(profileUser.id)
    .map(id => db.getProblemById(id)).filter(Boolean)
    .sort((a, b) => a.id - b.id);

  // 티어별 분포
  const dist = Object.fromEntries(TIERS.map(t => [t, 0]));
  solvedProblems.forEach(p => {
    const c = p.difficulty.split(' ')[0].toLowerCase();
    if (dist[c] !== undefined) dist[c]++;
  });
  const maxDist = Math.max(1, ...Object.values(dist));

  // 제출 통계 + 최근 제출
  const allSubs = db.getSubmissionsByUser(profileUser.id, 100000);
  const acCount = allSubs.filter(s => s.verdict === 'AC').length;
  const acRate = allSubs.length ? Math.round(acCount / allSubs.length * 100) : 0;
  const recent = allSubs.slice(0, 15).map(s => ({
    ...s, problem_title: (db.getProblemById(s.problem_id) || {}).title || '?'
  }));

  // 티어 약칭 (Gold 3 → G3, Unrated → U)
  const emblem = getTierShort(tier.tier);

  res.render('profile', {
    profileUser, rating, tier, next, floor, progress, rank,
    totalUsers: all.length, solvedProblems, dist, TIERS, maxDist,
    acRate, totalSubs: allSubs.length, recent, emblem,
    LANG_LABELS, VERDICT_LABELS
  });
});

module.exports = router;
