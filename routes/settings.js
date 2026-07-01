const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.use(requireLogin);

router.get('/settings', (req, res) => {
  res.render('settings', { success: null, error: null });
});

router.post('/settings/username', (req, res) => {
  const { username } = req.body;
  const userId = req.session.user.id;

  if (!username || username.length < 3 || username.length > 20)
    return res.render('settings', { error: '아이디는 3~20자여야 합니다.', success: null });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.render('settings', { error: '아이디는 영문, 숫자, _만 사용 가능합니다.', success: null });

  const existing = db.getUserByUsername(username);
  if (existing && existing.id !== userId)
    return res.render('settings', { error: '이미 사용 중인 아이디입니다.', success: null });

  db.updateUser(userId, { username });
  req.session.user.username = username;
  res.render('settings', { success: '아이디가 변경되었습니다.', error: null });
});

// 아바타 이미지만 저장 (배너는 코인 샵에서 착용)
const MAX_IMG = 1500000;
function validImg(v) {
  if (typeof v !== 'string') return false;
  if (v.startsWith('data:image/')) return v.length <= MAX_IMG;
  if (/^https?:\/\//.test(v)) return v.length <= 2000;
  return false;
}
router.post('/settings/images', (req, res) => {
  const userId = req.session.user.id;
  const { avatar } = req.body;
  const updates = {};
  if (avatar !== undefined) {
    if (avatar === '') updates.avatar_url = null;
    else if (validImg(avatar)) updates.avatar_url = avatar;
    else return res.render('settings', { error: '프로필 이미지가 너무 크거나 형식이 올바르지 않습니다.', success: null });
  }
  db.updateUser(userId, updates);
  res.render('settings', { success: '프로필 이미지가 저장되었습니다.', error: null });
});

router.post('/settings/external-accounts', (req, res) => {
  const userId = req.session.user.id;
  let { solvedac_handle, jungol_handle } = req.body;
  solvedac_handle = (solvedac_handle || '').trim();
  jungol_handle = (jungol_handle || '').trim();

  if (solvedac_handle && !/^[a-zA-Z0-9_]{1,40}$/.test(solvedac_handle))
    return res.render('settings', { error: 'solved.ac 아이디 형식이 올바르지 않습니다.', success: null });
  if (jungol_handle && !/^[a-zA-Z0-9_]{1,40}$/.test(jungol_handle))
    return res.render('settings', { error: '정올 아이디 형식이 올바르지 않습니다.', success: null });

  db.updateUser(userId, {
    solvedac_handle: solvedac_handle || null,
    jungol_handle: jungol_handle || null
  });
  res.render('settings', { success: '외부 계정 연동이 저장되었습니다.', error: null });
});

router.post('/settings/password', (req, res) => {
  const { current_password, new_password, new_password2 } = req.body;
  const userId = req.session.user.id;

  if (!current_password || !new_password || !new_password2)
    return res.render('settings', { error: '모든 항목을 입력하세요.', success: null });
  if (new_password !== new_password2)
    return res.render('settings', { error: '새 비밀번호가 일치하지 않습니다.', success: null });
  if (new_password.length < 6)
    return res.render('settings', { error: '비밀번호는 6자 이상이어야 합니다.', success: null });

  const user = db.getUserById(userId);
  if (!bcrypt.compareSync(current_password, user.password))
    return res.render('settings', { error: '현재 비밀번호가 틀렸습니다.', success: null });

  db.updateUser(userId, { password: bcrypt.hashSync(new_password, 10) });
  res.render('settings', { success: '비밀번호가 변경되었습니다.', error: null });
});

module.exports = router;
