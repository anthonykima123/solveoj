const express = require('express');
const { db } = require('../database');
const { requireAdmin } = require('../middleware/admin');
const router = express.Router();

router.use(requireAdmin);

const ALL_TIERS = [
  'Bronze 5','Bronze 4','Bronze 3','Bronze 2','Bronze 1',
  'Silver 5','Silver 4','Silver 3','Silver 2','Silver 1',
  'Gold 5','Gold 4','Gold 3','Gold 2','Gold 1',
  'Platinum 5','Platinum 4','Platinum 3','Platinum 2','Platinum 1',
  'Diamond 5','Diamond 4','Diamond 3','Diamond 2','Diamond 1',
  'Ruby 5','Ruby 4','Ruby 3','Ruby 2','Ruby 1'
];

// Admin dashboard
router.get('/', (req, res) => {
  const problems = db.getProblems();
  res.render('admin/index', { problems, query: req.query });
});

// New problem form
router.get('/problems/new', (req, res) => {
  res.render('admin/problem-form', { problem: null, tiers: ALL_TIERS, error: null });
});

// Create problem
router.post('/problems/new', (req, res) => {
  const { id, title, difficulty, time_limit, memory_limit,
          description, input_desc, output_desc, sample_input,
          sample_output, constraints, test_cases_raw } = req.body;

  const pid = parseInt(id);
  if (!pid || !title || !difficulty || !description) {
    return res.render('admin/problem-form', {
      problem: req.body, tiers: ALL_TIERS, error: '필수 항목을 모두 입력하세요.'
    });
  }
  if (db.getProblemById(pid)) {
    return res.render('admin/problem-form', {
      problem: req.body, tiers: ALL_TIERS, error: `문제 번호 ${pid}가 이미 존재합니다.`
    });
  }

  let test_cases;
  try {
    test_cases = JSON.stringify(JSON.parse(test_cases_raw || '[]'));
  } catch (e) {
    return res.render('admin/problem-form', {
      problem: req.body, tiers: ALL_TIERS, error: '테스트 케이스 JSON 형식이 올바르지 않습니다.'
    });
  }

  db.insertProblem({
    id: pid, title, difficulty,
    time_limit: parseInt(time_limit) || 1000,
    memory_limit: parseInt(memory_limit) || 256,
    description, input_desc, output_desc,
    sample_input, sample_output, constraints,
    test_cases, submission_count: 0, accepted_count: 0
  });

  res.redirect(`/admin?created=${pid}`);
});

// Edit problem form
router.get('/problems/:id/edit', (req, res) => {
  const problem = db.getProblemById(parseInt(req.params.id));
  if (!problem) return res.status(404).render('404');
  res.render('admin/problem-form', { problem, tiers: ALL_TIERS, error: null });
});

// Update problem
router.post('/problems/:id/edit', (req, res) => {
  const pid = parseInt(req.params.id);
  const problem = db.getProblemById(pid);
  if (!problem) return res.status(404).render('404');

  const { title, difficulty, time_limit, memory_limit,
          description, input_desc, output_desc, sample_input,
          sample_output, constraints, test_cases_raw } = req.body;

  if (!title || !difficulty || !description) {
    return res.render('admin/problem-form', {
      problem: { ...problem, ...req.body, id: pid }, tiers: ALL_TIERS, error: '필수 항목을 모두 입력하세요.'
    });
  }

  let test_cases;
  try {
    test_cases = JSON.stringify(JSON.parse(test_cases_raw || '[]'));
  } catch (e) {
    return res.render('admin/problem-form', {
      problem: { ...problem, ...req.body, id: pid }, tiers: ALL_TIERS, error: '테스트 케이스 JSON 형식이 올바르지 않습니다.'
    });
  }

  db.updateProblem(pid, {
    title, difficulty,
    time_limit: parseInt(time_limit) || 1000,
    memory_limit: parseInt(memory_limit) || 256,
    description, input_desc, output_desc,
    sample_input, sample_output, constraints, test_cases
  });

  res.redirect(`/admin?updated=${pid}`);
});

// Delete problem
router.post('/problems/:id/delete', (req, res) => {
  db.deleteProblem(parseInt(req.params.id));
  res.redirect('/admin?deleted=1');
});

module.exports = router;
