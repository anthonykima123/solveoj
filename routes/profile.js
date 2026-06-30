const express = require('express');
const { db } = require('../database');
const { getTierInfo, getNextThreshold, getTierShort, getDifficultyScore } = require('../utils/rating');
const { getBannerById } = require('../utils/shop');
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
  const nextTier = next ? getTierInfo(next) : null;

  const all = db.getAllUsers().filter(u => !u.ranking_banned).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const rank = all.findIndex(u => u.id === profileUser.id) + 1;

  const solvedProblems = db.getSolvedIds(profileUser.id)
    .map(id => db.getProblemById(id)).filter(Boolean)
    .sort((a, b) => a.id - b.id);

  const dist = Object.fromEntries(TIERS.map(t => [t, 0]));
  solvedProblems.forEach(p => {
    const c = p.difficulty.split(' ')[0].toLowerCase();
    if (dist[c] !== undefined) dist[c]++;
  });
  const maxDist = Math.max(1, ...Object.values(dist));

  const allSubs = db.getSubmissionsByUser(profileUser.id, 100000);
  const acCount = allSubs.filter(s => s.verdict === 'AC').length;
  const acRate = allSubs.length ? Math.round(acCount / allSubs.length * 100) : 0;
  const recent = allSubs.slice(0, 15).map(s => ({
    ...s, problem_title: (db.getProblemById(s.problem_id) || {}).title || '?'
  }));

  const emblem = getTierShort(tier.tier);

  // Top 100 difficulty score
  const solvedSorted = solvedProblems.slice().sort((a, b) => getDifficultyScore(b.difficulty) - getDifficultyScore(a.difficulty));
  const top100Score = solvedSorted.slice(0, 100).reduce((s, p) => s + getDifficultyScore(p.difficulty), 0);

  // Solved badges (difficulty desc, for grid display)
  const solvedBadges = solvedSorted.map(p => {
    const parts = p.difficulty.split(' ');
    return { id: p.id, cls: (parts[0] || '').toLowerCase(), level: parts[1] || '', title: p.title, difficulty: p.difficulty };
  });

  // Submission heatmap (all submissions per day, KST)
  const heatmapMap = {};
  allSubs.forEach(s => {
    const kst = new Date(new Date(s.created_at).getTime() + 9 * 3600000);
    const key = kst.toISOString().slice(0, 10);
    heatmapMap[key] = (heatmapMap[key] || 0) + 1;
  });

  // Current streak
  const nowKST = new Date(Date.now() + 9 * 3600000);
  const todayStr = nowKST.toISOString().slice(0, 10);
  let streak = 0;
  const startOffset = heatmapMap[todayStr] ? 0 : 1;
  for (let i = startOffset; i < 730; i++) {
    const key = new Date(nowKST.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (heatmapMap[key]) streak++;
    else break;
  }

  // Max streak (past year)
  let maxStreak = 0, curRun = 0;
  for (let i = 364; i >= 0; i--) {
    const key = new Date(nowKST.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (heatmapMap[key]) { curRun++; if (curRun > maxStreak) maxStreak = curRun; }
    else curRun = 0;
  }

  // Heatmap grid: ~53 columns x 7 rows (Sun–Sat), past 364 days
  const startTs = nowKST.getTime() - 364 * 86400000;
  const startDow = new Date(startTs).getUTCDay();
  const gridStart = new Date(startTs - startDow * 86400000);

  const heatmapGrid = [];
  const heatmapMonths = [];
  let lastMonth = -1;

  for (let col = 0; ; col++) {
    const colStart = new Date(gridStart.getTime() + col * 7 * 86400000);
    if (colStart > nowKST) break;
    const cells = [];
    for (let row = 0; row < 7; row++) {
      const day = new Date(colStart.getTime() + row * 86400000);
      if (day > nowKST) { cells.push(null); continue; }
      const key = day.toISOString().slice(0, 10);
      const count = heatmapMap[key] || 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
      cells.push({ key, count, level });
    }
    const first = cells.find(c => c);
    if (first) {
      const m = parseInt(first.key.slice(5, 7));
      const dom = parseInt(first.key.slice(8, 10));
      if (m !== lastMonth && dom <= 7) { heatmapMonths.push({ col, label: m + '월' }); lastMonth = m; }
    }
    heatmapGrid.push(cells);
  }

  const bannerItem = profileUser.equipped_banner ? getBannerById(profileUser.equipped_banner) : null;
  const bannerCss = bannerItem ? bannerItem.css : null;

  res.render('profile', {
    profileUser, rating, tier, next, nextTier, floor, progress, rank,
    totalUsers: all.length, solvedProblems, solvedBadges, dist, TIERS, maxDist,
    acRate, totalSubs: allSubs.length, recent, emblem,
    LANG_LABELS, VERDICT_LABELS,
    top100Score, streak, maxStreak, heatmapGrid, heatmapMonths, bannerCss
  });
});

module.exports = router;
