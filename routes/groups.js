const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');
const { isAdmin } = require('../utils/permissions');
const router = express.Router();

// 목록
router.get('/groups', (req, res) => {
  const groups = db.getGroups();
  res.render('groups/list', { groups, query: req.query });
});

// 생성 폼
router.get('/groups/new', requireLogin, (req, res) => {
  res.render('groups/new', { error: null });
});

// 생성
router.post('/groups', requireLogin, (req, res) => {
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  if (!name)
    return res.render('groups/new', { error: '그룹 이름을 입력하세요.' });

  const g = db.createGroup({
    name, description,
    owner_id: req.session.user.id,
    owner_name: req.session.user.username,
    members: [req.session.user.id]
  });
  res.redirect('/groups/' + g.id);
});

// 상세
router.get('/groups/:id', (req, res) => {
  const g = db.getGroupById(parseInt(req.params.id));
  if (!g) return res.status(404).render('404');
  const members = (g.members || []).map(id => db.getUserById(id)).filter(Boolean);
  const meId = (req.session.user || {}).id;
  res.render('groups/detail', {
    group: g, members,
    isMember: (g.members || []).includes(meId),
    isOwner: g.owner_id === meId,
    query: req.query
  });
});

// 가입
router.post('/groups/:id/join', requireLogin, (req, res) => {
  const g = db.getGroupById(parseInt(req.params.id));
  if (!g) return res.status(404).render('404');
  db.joinGroup(g.id, req.session.user.id);
  res.redirect('/groups/' + g.id);
});

// 탈퇴
router.post('/groups/:id/leave', requireLogin, (req, res) => {
  const g = db.getGroupById(parseInt(req.params.id));
  if (!g) return res.status(404).render('404');
  if (g.owner_id === req.session.user.id)
    return res.redirect('/groups/' + g.id + '?err=owner');
  db.leaveGroup(g.id, req.session.user.id);
  res.redirect('/groups/' + g.id);
});

// 삭제 (그룹장 또는 관리자)
router.post('/groups/:id/delete', requireLogin, (req, res) => {
  const g = db.getGroupById(parseInt(req.params.id));
  if (!g) return res.status(404).render('404');
  const me = db.getUserById(req.session.user.id);
  if (g.owner_id !== me.id && !isAdmin(me))
    return res.status(403).render('403');
  db.deleteGroup(g.id);
  res.redirect('/groups');
});

module.exports = router;
