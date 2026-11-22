const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const router = express.Router();
const destination = value => typeof value === 'string' && /^\/(?![\/\\])[^\\\u0000-\u001f\u007f]*$/.test(value) ? value : '/';
const startSession = (req, res, user, redirect) => {
  req.session.regenerate(error => {
    if (error) return res.sendStatus(503);
    req.session.user = { id: user.id, username: user.username, rating: user.rating || 0 };
    req.session.save(saveError => saveError ? res.sendStatus(503) : res.redirect(redirect));
  });
};

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  const next = req.query.next;
  const safeNext = destination(next);
  res.render('login', { error: null, next: safeNext });
});

router.post('/login', (req, res) => {
  const { username, password, next } = req.body;
  const redirect = destination(next);
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || password.length > 128)
    return res.render('login', { error: '아이디와 비밀번호를 입력하세요.', next: redirect });

  const user = db.getUserByUsername(username);
  if (process.env.NODE_ENV === 'production' && user?.username === 'admin' && password === 'password123')
    return res.render('login', { error: '관리자 비밀번호를 재설정해 주세요.', next: redirect });
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.render('login', { error: '아이디 또는 비밀번호가 잘못되었습니다.', next: redirect });

  startSession(req, res, user, redirect);
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { username, email, password, password2 } = req.body;
  if (![username, email, password, password2].every(value => typeof value === 'string' && value))
    return res.render('register', { error: '모든 필드를 입력하세요.' });
  if (password !== password2)
    return res.render('register', { error: '비밀번호가 일치하지 않습니다.' });
  if (username.length < 3 || username.length > 20)
    return res.render('register', { error: '아이디는 3~20자여야 합니다.' });
  if (password.length < 8 || Buffer.byteLength(password) > 72)
    return res.render('register', { error: '비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 합니다.' });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.render('register', { error: '이메일 주소를 확인하세요.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.render('register', { error: '아이디는 영문, 숫자, _만 사용 가능합니다.' });

  if (db.getUserByUsernameOrEmail(username, email))
    return res.render('register', { error: '이미 사용 중인 아이디 또는 이메일입니다.' });

  const hash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ username, email, password: hash });
  startSession(req, res, user, '/');
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
