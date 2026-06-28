const express = require('express');
const { db } = require('../database');
const router = express.Router();

router.get('/ranking', (req, res) => {
  const users = db.getAllUsers()
    .filter(u => u.role !== 'superadmin' && !u.ranking_banned)
    .slice(0, 100);
  res.render('ranking', { users });
});

module.exports = router;
