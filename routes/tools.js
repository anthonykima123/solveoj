const express = require('express');
const { runFreeCode } = require('../judge/runner');
const router = express.Router();

router.get('/tools', (req, res) => res.render('tools/index'));
router.get('/tools/notes', (req, res) => res.render('tools/notes'));
router.get('/tools/paint', (req, res) => res.render('tools/paint'));
router.get('/tools/compiler', (req, res) => res.render('tools/compiler'));

router.post('/tools/compiler/run', async (req, res) => {
  const { language, code, stdin } = req.body;
  if (!['cpp', 'python', 'java'].includes(language))
    return res.json({ verdict: 'CE', output: '', error: '지원하지 않는 언어입니다.', time: 0 });
  if (!code || !code.trim())
    return res.json({ verdict: 'CE', output: '', error: '코드를 입력하세요.', time: 0 });
  try {
    const result = await runFreeCode(language, code, stdin || '', 5000);
    res.json(result);
  } catch (e) {
    res.json({ verdict: 'RE', output: '', error: e.message, time: 0 });
  }
});

module.exports = router;
