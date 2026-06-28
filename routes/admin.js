const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { db } = require('../database');
const { requireAdmin, requireSuperAdmin, requirePermission } = require('../middleware/admin');
const { PERMISSIONS, PERMISSION_KEYS } = require('../utils/permissions');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAdmin);

const ALL_TIERS = [
  'Bronze 5','Bronze 4','Bronze 3','Bronze 2','Bronze 1',
  'Silver 5','Silver 4','Silver 3','Silver 2','Silver 1',
  'Gold 5','Gold 4','Gold 3','Gold 2','Gold 1',
  'Platinum 5','Platinum 4','Platinum 3','Platinum 2','Platinum 1',
  'Diamond 5','Diamond 4','Diamond 3','Diamond 2','Diamond 1',
  'Ruby 5','Ruby 4','Ruby 3','Ruby 2','Ruby 1'
];

// 접근 가능한 첫 번째 탭으로 보낸다.
router.get('/', (req, res) => {
  const u = req.adminUser;
  if (u.role === 'superadmin' || (u.permissions || []).includes('problems'))
    return res.redirect('/admin/problems');
  if (u.role === 'superadmin') return res.redirect('/admin/admins');
  if ((u.permissions || []).includes('users')) return res.redirect('/admin/users');
  return res.redirect('/admin/users');
});

// ─────────────────────────── 관리자 관리 (슈퍼 관리자 전용) ───────────────────────────
router.get('/admins', requireSuperAdmin, (req, res) => {
  const all = db.getAllUsers();
  const admins = all.filter(u => u.role === 'superadmin' || u.role === 'admin');
  // 공동 관리자로 임명 가능한 일반 유저 (role이 없는 기존 계정도 포함)
  const candidates = all.filter(u => u.role !== 'superadmin' && u.role !== 'admin');
  res.render('admin/admins', {
    admins, candidates, PERMISSIONS, query: req.query, me: req.adminUser
  });
});

// 역할/권한 부여·수정·해제 — 슈퍼 관리자 전용
router.post('/role', requireSuperAdmin, (req, res) => {
  const id = parseInt(req.body.user_id);
  const target = db.getUserById(id);
  if (!target) return res.redirect('/admin/admins?err=notfound');
  if (target.role === 'superadmin')
    return res.redirect('/admin/admins?err=superadmin');

  const role = req.body.role === 'admin' ? 'admin' : 'user';
  let perms = req.body.perms || [];
  if (!Array.isArray(perms)) perms = [perms];
  perms = perms.filter(p => PERMISSION_KEYS.includes(p));

  if (role === 'admin') {
    db.updateUser(id, { role: 'admin', permissions: perms });
    res.redirect('/admin/admins?roleok=' + encodeURIComponent(target.username));
  } else {
    db.updateUser(id, { role: 'user', permissions: [] });
    res.redirect('/admin/admins?revoked=' + encodeURIComponent(target.username));
  }
});

// ─────────────────────────── 유저 관리 ('users' 권한) ───────────────────────────
router.get('/users', requirePermission('users'), (req, res) => {
  const users = db.getAllUsers();
  res.render('admin/users', { users, query: req.query, me: req.adminUser });
});

// 유저 삭제
router.post('/users/:id/delete', requirePermission('users'), (req, res) => {
  const id = parseInt(req.params.id);
  const target = db.getUserById(id);
  if (!target) return res.status(404).render('404');
  if (target.id === req.adminUser.id)
    return res.redirect('/admin/users?err=self');
  if (target.role === 'superadmin')
    return res.redirect('/admin/users?err=superadmin');
  // 공동 관리자는 다른 관리자를 삭제할 수 없다 (슈퍼 관리자만 가능)
  if (target.role === 'admin' && req.adminUser.role !== 'superadmin')
    return res.redirect('/admin/users?err=noadmin');

  db.deleteUser(id);
  res.redirect('/admin/users?deluser=' + encodeURIComponent(target.username));
});

// 비밀번호 초기화(reset1234)
router.post('/users/:id/reset-password', requirePermission('users'), (req, res) => {
  const id = parseInt(req.params.id);
  const target = db.getUserById(id);
  if (!target) return res.status(404).render('404');
  if (target.role === 'superadmin' && target.id !== req.adminUser.id)
    return res.redirect('/admin/users?err=superadmin');

  db.updateUser(id, { password: bcrypt.hashSync('reset1234', 10) });
  res.redirect('/admin/users?pwreset=' + encodeURIComponent(target.username));
});

// ─────────────────────────── 문제 관리 ('problems' 권한) ───────────────────────────

// 테스트 케이스 파일 파싱 (JSON / ZIP)
router.post('/problems/parse-testcases', requirePermission('problems'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });
  const name = req.file.originalname.toLowerCase();

  if (name.endsWith('.json')) {
    try {
      const parsed = JSON.parse(req.file.buffer.toString('utf8'));
      if (!Array.isArray(parsed)) return res.status(400).json({ error: 'JSON 배열이 아닙니다.' });
      return res.json({ testCases: parsed });
    } catch (e) {
      return res.status(400).json({ error: 'JSON 파싱 실패: ' + e.message });
    }
  }

  if (name.endsWith('.zip')) {
    try {
      const zip = new AdmZip(req.file.buffer);
      const inputs = {}, outputs = {};
      for (const entry of zip.getEntries()) {
        const base = entry.entryName.replace(/.*\//, '');
        const inM = base.match(/^(\d+)\.in$/i) || base.match(/^input(\d+)\.txt$/i);
        const outM = base.match(/^(\d+)\.out$/i) || base.match(/^output(\d+)\.txt$/i);
        if (inM) inputs[+inM[1]] = entry.getData().toString('utf8').replace(/\r\n/g, '\n').trim();
        if (outM) outputs[+outM[1]] = entry.getData().toString('utf8').replace(/\r\n/g, '\n').trim();
      }
      const nums = [...new Set([...Object.keys(inputs), ...Object.keys(outputs)].map(Number))].sort((a, b) => a - b);
      const testCases = nums
        .filter(n => inputs[n] !== undefined && outputs[n] !== undefined)
        .map(n => ({ input: inputs[n], output: outputs[n] }));
      if (!testCases.length) return res.status(400).json({ error: 'ZIP에서 케이스를 찾을 수 없습니다. (1.in/1.out 또는 input1.txt/output1.txt 형식)' });
      return res.json({ testCases });
    } catch (e) {
      return res.status(400).json({ error: 'ZIP 파싱 실패: ' + e.message });
    }
  }

  return res.status(400).json({ error: '.json 또는 .zip 파일만 지원합니다.' });
});

router.get('/problems', requirePermission('problems'), (req, res) => {
  const problems = db.getProblems({ includePrivate: true });
  res.render('admin/problems', { problems, query: req.query });
});

router.get('/problems/new', requirePermission('problems'), (req, res) => {
  res.render('admin/problem-form', { problem: null, tiers: ALL_TIERS, steps: db.getSteps(), error: null });
});

router.post('/problems/new', requirePermission('problems'), (req, res) => {
  const { id, title, difficulty, time_limit, memory_limit,
          description, input_desc, output_desc, sample_input,
          sample_output, constraints, test_cases_raw, step, contest, visibility,
          special_judge, checker_code } = req.body;

  const pid = parseInt(id);
  if (!pid || !title || !difficulty || !description) {
    return res.render('admin/problem-form', {
      problem: req.body, tiers: ALL_TIERS, steps: db.getSteps(), error: '필수 항목을 모두 입력하세요.'
    });
  }
  if (db.getProblemById(pid)) {
    return res.render('admin/problem-form', {
      problem: req.body, tiers: ALL_TIERS, steps: db.getSteps(), error: `문제 번호 ${pid}가 이미 존재합니다.`
    });
  }

  let test_cases;
  try {
    test_cases = JSON.stringify(JSON.parse(test_cases_raw || '[]'));
  } catch (e) {
    return res.render('admin/problem-form', {
      problem: req.body, tiers: ALL_TIERS, steps: db.getSteps(), error: '테스트 케이스 JSON 형식이 올바르지 않습니다.'
    });
  }

  const isSpecialJudge = special_judge === 'on';
  db.insertProblem({
    id: pid, title, difficulty,
    time_limit: parseInt(time_limit) || 1000,
    memory_limit: parseInt(memory_limit) || 256,
    description, input_desc, output_desc,
    sample_input, sample_output, constraints,
    step: parseInt(step) || null,
    contest: ['jungol', 'koi', 'icpc', 'usaco'].includes(contest) ? contest : null,
    is_private: visibility === 'private',
    special_judge: isSpecialJudge,
    checker_code: isSpecialJudge ? (checker_code || '') : '',
    test_cases, submission_count: 0, accepted_count: 0
  });

  res.redirect(`/admin/problems?created=${pid}`);
});

router.get('/problems/:id/edit', requirePermission('problems'), (req, res) => {
  const problem = db.getProblemById(parseInt(req.params.id));
  if (!problem) return res.status(404).render('404');
  res.render('admin/problem-form', { problem, tiers: ALL_TIERS, steps: db.getSteps(), error: null });
});

router.post('/problems/:id/edit', requirePermission('problems'), (req, res) => {
  const pid = parseInt(req.params.id);
  const problem = db.getProblemById(pid);
  if (!problem) return res.status(404).render('404');

  const { title, difficulty, time_limit, memory_limit,
          description, input_desc, output_desc, sample_input,
          sample_output, constraints, test_cases_raw, step, contest, visibility,
          special_judge, checker_code } = req.body;

  if (!title || !difficulty || !description) {
    return res.render('admin/problem-form', {
      problem: { ...problem, ...req.body, id: pid }, tiers: ALL_TIERS, steps: db.getSteps(), error: '필수 항목을 모두 입력하세요.'
    });
  }

  let test_cases;
  try {
    test_cases = JSON.stringify(JSON.parse(test_cases_raw || '[]'));
  } catch (e) {
    return res.render('admin/problem-form', {
      problem: { ...problem, ...req.body, id: pid }, tiers: ALL_TIERS, steps: db.getSteps(), error: '테스트 케이스 JSON 형식이 올바르지 않습니다.'
    });
  }

  const isSpecialJudge = special_judge === 'on';
  db.updateProblem(pid, {
    title, difficulty,
    time_limit: parseInt(time_limit) || 1000,
    memory_limit: parseInt(memory_limit) || 256,
    description, input_desc, output_desc,
    sample_input, sample_output, constraints,
    step: parseInt(step) || null,
    contest: ['jungol', 'koi', 'icpc', 'usaco'].includes(contest) ? contest : null,
    is_private: visibility === 'private',
    special_judge: isSpecialJudge,
    checker_code: isSpecialJudge ? (checker_code || '') : '',
    test_cases
  });

  res.redirect(`/admin/problems?updated=${pid}`);
});

router.post('/problems/:id/delete', requirePermission('problems'), (req, res) => {
  db.deleteProblem(parseInt(req.params.id));
  res.redirect('/admin/problems?deleted=1');
});

module.exports = router;
