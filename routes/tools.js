const express = require('express');
const router = express.Router();

router.get('/tools', (req, res) => res.render('tools/index'));
router.get('/tools/notes', (req, res) => res.render('tools/notes'));
router.get('/tools/paint', (req, res) => res.render('tools/paint'));

module.exports = router;
