const express = require('express');
const { db } = require('../database');
const { getDifficultyScore } = require('../utils/rating');
const router = express.Router();

// 기출문제 분류 (대회별)
const CONTESTS = { jungol: '정올', koi: 'KOI', icpc: 'ICPC', usaco: 'USACO' };

function listByContest(key) {
  return (req, res) => {
    const { diff, search, tag } = req.query;
    let problems = db.getProblems({ difficulty: diff, search }).filter(p => p.contest === key);
    if (tag) problems = problems.filter(p => (p.tags || []).includes(tag));
    const solvedSet = new Set(req.session.user ? db.getSolvedIds(req.session.user.id) : []);
    const allTags = [...new Set(db.getProblems().filter(p => p.contest === key).flatMap(p => p.tags || []))].sort();
    res.render('problems', {
      problems, solvedSet, diff: diff || '', search: search || '', tag: tag || '',
      allTags, contest: key, contestLabel: CONTESTS[key]
    });
  };
}

// /problems → 기본 분류(정올)로 보낸다.
router.get('/problems', (req, res) => res.redirect('/problems/jungol'));
router.get('/problems/jungol', listByContest('jungol'));
router.get('/problems/koi', listByContest('koi'));
router.get('/problems/icpc', listByContest('icpc'));
router.get('/problems/usaco', listByContest('usaco'));

// 단계별 문제: 단계(step) 목록과 각 단계에 속한 문제들
router.get('/problems/steps', (req, res) => {
  const steps = db.getSteps();
  const solvedSet = new Set(req.session.user ? db.getSolvedIds(req.session.user.id) : []);
  const byStep = steps.map(s => {
    // step에 problem_ids가 지정돼 있으면 그것을, 아니면 problem.step === s.id 인 문제들을 사용
    let probs = (s.problem_ids && s.problem_ids.length)
      ? s.problem_ids.map(id => db.getProblemById(id)).filter(Boolean)
      : db.getProblems().filter(p => p.step === s.id);
    return { step: s, problems: probs };
  });
  res.render('problems-steps', { byStep, solvedSet });
});

router.get('/problems/:id', (req, res) => {
  const problem = db.getProblemById(parseInt(req.params.id));
  if (!problem) return res.status(404).render('404');
  const isSolved = req.session.user ? db.isSolved(req.session.user.id, problem.id) : false;
  const diffScore = getDifficultyScore(problem.difficulty);
  res.render('problem', { problem, isSolved, diffScore });
});


module.exports = router;
