const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null, next: req.query.next || '/' });
});

router.post('/login', (req, res) => {
  const { username, password, next } = req.body;
  const redirect = next || '/';
  if (!username || !password)
    return res.render('login', { error: '아이디와 비밀번호를 입력하세요.', next: redirect });

  const user = db.getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.render('login', { error: '아이디 또는 비밀번호가 잘못되었습니다.', next: redirect });

  req.session.user = { id: user.id, username: user.username, rating: user.rating || 0 };
  res.redirect(redirect);
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { username, email, password, password2 } = req.body;
  if (!username || !email || !password)
    return res.render('register', { error: '모든 필드를 입력하세요.' });
  if (password !== password2)
    return res.render('register', { error: '비밀번호가 일치하지 않습니다.' });
  if (username.length < 3 || username.length > 20)
    return res.render('register', { error: '아이디는 3~20자여야 합니다.' });
  if (password.length < 6)
    return res.render('register', { error: '비밀번호는 6자 이상이어야 합니다.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.render('register', { error: '아이디는 영문, 숫자, _만 사용 가능합니다.' });

  if (db.getUserByUsernameOrEmail(username, email))
    return res.render('register', { error: '이미 사용 중인 아이디 또는 이메일입니다.' });

  const hash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ username, email, password: hash });
  req.session.user = { id: user.id, username: user.username, rating: 0 };
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
