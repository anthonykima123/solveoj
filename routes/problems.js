const express = require('express');
const { db } = require('../database');
const router = express.Router();

router.get('/problems', (req, res) => {
  const { diff, search, tag } = req.query;
  let problems = db.getProblems({ difficulty: diff, search });
  if (tag) problems = problems.filter(p => (p.tags || []).includes(tag));
  const solvedSet = new Set(req.session.user ? db.getSolvedIds(req.session.user.id) : []);
  const allTags = [...new Set(db.getProblems().flatMap(p => p.tags || []))].sort();
  res.render('problems', { problems, solvedSet, diff: diff || '', search: search || '', tag: tag || '', allTags });
});

router.get('/problems/:id', (req, res) => {
  const problem = db.getProblemById(parseInt(req.params.id));
  if (!problem) return res.status(404).render('404');
  const isSolved = req.session.user ? db.isSolved(req.session.user.id, problem.id) : false;
  const ratingInfo = db.getProblemRating(problem.id);
  const myRating = req.session.user ? db.getRating(req.session.user.id, problem.id) : null;
  res.render('problem', { problem, isSolved, ratingInfo, myRating: myRating?.rating || 0 });
});

router.post('/problems/:id/rate', (req, res) => {
  if (!req.session.user) return res.json({ error: '로그인 필요' });
  const rating = parseInt(req.body.rating);
  if (rating < 1 || rating > 5) return res.json({ error: '잘못된 별점' });
  const pid = parseInt(req.params.id);
  db.setRating(req.session.user.id, pid, rating);
  const info = db.getProblemRating(pid);
  res.json({ ok: true, avg: info.avg, count: info.count });
});

module.exports = router;
