const express = require('express');
const { db } = require('../database');
const router = express.Router();

router.get('/ranking', (req, res) => {
  const users = db.getAllUsers().slice(0, 100);
  res.render('ranking', { users });
});

module.exports = router;
