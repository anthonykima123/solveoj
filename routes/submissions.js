const express = require('express');
const { db } = require('../database');
const { runCode } = require('../judge/runner');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

const LANG_LABELS = { cpp: 'C++17', python: 'Python 3', java: 'Java 11' };

router.get('/problems/:id/submit', requireLogin, (req, res) => {
  const problem = db.getProblemById(parseInt(req.params.id));
  if (!problem) return res.status(404).render('404');
  res.render('submit', { problem, error: null });
});

router.post('/problems/:id/submit', requireLogin, async (req, res) => {
  const { language, code } = req.body;
  const problemId = parseInt(req.params.id);
  const userId = req.session.user.id;

  const problem = db.getProblemById(problemId);
  if (!problem) return res.status(404).render('404');

  if (!['cpp', 'python', 'java'].includes(language))
    return res.render('submit', { problem, error: '지원하지 않는 언어입니다.' });
  if (!code || code.trim().length === 0)
    return res.render('submit', { problem, error: '코드를 입력하세요.' });

  const testCases = JSON.parse(problem.test_cases);
  let judgeResult;
  try {
    judgeResult = await runCode(language, code, testCases, problem.time_limit);
  } catch (e) {
    judgeResult = { verdict: 'RE', verdictText: '런타임 에러', executionTime: 0, errorMessage: e.message };
  }

  const sub = db.createSubmission({
    user_id: userId, problem_id: problemId, language, code,
    verdict: judgeResult.verdict, execution_time: judgeResult.executionTime || 0,
    error_message: judgeResult.errorMessage || null
  });

  db.incProblem(problemId, 'submission_count');
  db.incUser(userId, 'submission_count');

  if (judgeResult.verdict === 'AC') {
    db.incProblem(problemId, 'accepted_count');
    if (db.addSolved(userId, problemId)) {
      db.incUser(userId, 'solved_count');
    }
  }

  res.redirect(`/submissions/${sub.id}`);
});

router.get('/submissions', requireLogin, (req, res) => {
  const subs = db.getSubmissionsByUser(req.session.user.id);
  const enriched = subs.map(s => {
    const p = db.getProblemById(s.problem_id);
    return { ...s, problem_title: p ? p.title : '?', problem_id: s.problem_id };
  });
  res.render('submissions', { submissions: enriched, LANG_LABELS });
});

router.get('/submissions/:id', (req, res) => {
  const sub = db.getSubmissionById(parseInt(req.params.id));
  if (!sub) return res.status(404).render('404');

  const problem = db.getProblemById(sub.problem_id);
  const author = db.getUserById(sub.user_id);
  const enriched = {
    ...sub,
    problem_title: problem ? problem.title : '?',
    username: author ? author.username : '?',
    code: req.session.user?.id === sub.user_id ? sub.code : null
  };

  res.render('result', { sub: enriched, LANG_LABELS });
});

router.get('/status', (req, res) => {
  const subs = db.getAllSubmissions(100).map(s => {
    const p = db.getProblemById(s.problem_id);
    const u = db.getUserById(s.user_id);
    return { ...s, problem_title: p?.title || '?', username: u?.username || '?' };
  });
  res.render('status', { submissions: subs, LANG_LABELS });
});

module.exports = router;
