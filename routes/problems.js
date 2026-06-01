const express = require('express');
const { db } = require('../database');
const { getDifficultyScore } = require('../utils/rating');
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
  const diffScore = getDifficultyScore(problem.difficulty);
  res.render('problem', { problem, isSolved, diffScore });
});


module.exports = router;
