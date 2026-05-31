const express = require('express');
const { db } = require('../database');
const router = express.Router();

router.get('/problems', (req, res) => {
  const { diff, search } = req.query;
  const problems = db.getProblems({ difficulty: diff, search });
  const solvedSet = new Set(req.session.user ? db.getSolvedIds(req.session.user.id) : []);
  res.render('problems', { problems, solvedSet, diff: diff || '', search: search || '' });
});

router.get('/problems/:id', (req, res) => {
  const problem = db.getProblemById(parseInt(req.params.id));
  if (!problem) return res.status(404).render('404');
  const isSolved = req.session.user ? db.isSolved(req.session.user.id, problem.id) : false;
  res.render('problem', { problem, isSolved });
});

module.exports = router;
