const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');
const { isAdmin } = require('../utils/permissions');
const router = express.Router();

// 목록
router.get('/community', (req, res) => {
  const posts = db.getPosts();
  res.render('community/list', { posts, query: req.query });
});

// 글쓰기 폼
router.get('/community/new', requireLogin, (req, res) => {
  res.render('community/new', { error: null });
});

// 글 작성
router.post('/community', requireLogin, (req, res) => {
  const me = db.getUserById(req.session.user.id);
  if (me && me.community_banned)
    return res.render('community/new', { error: '커뮤니티 이용이 제한된 계정입니다.' });

  const title = (req.body.title || '').trim();
  const content = (req.body.content || '').trim();
  if (!title || !content)
    return res.render('community/new', { error: '제목과 내용을 모두 입력하세요.' });

  const post = db.createPost({
    title, content,
    author_id: req.session.user.id,
    author_name: req.session.user.username
  });
  res.redirect('/community/' + post.id);
});

// 글 보기
router.get('/community/:id', (req, res) => {
  const post = db.getPostById(parseInt(req.params.id));
  if (!post) return res.status(404).render('404');
  db.incPostViews(post.id);
  res.render('community/post', { post, query: req.query });  // query.err === 'banned' 처리
});

// 댓글 작성
router.post('/community/:id/comment', requireLogin, (req, res) => {
  const post = db.getPostById(parseInt(req.params.id));
  if (!post) return res.status(404).render('404');
  const me = db.getUserById(req.session.user.id);
  if (me && me.community_banned)
    return res.redirect('/community/' + post.id + '?err=banned');
  const content = (req.body.content || '').trim();
  if (content) {
    db.addComment(post.id, {
      content,
      author_id: req.session.user.id,
      author_name: req.session.user.username
    });
  }
  res.redirect('/community/' + post.id);
});

// 댓글 삭제 (작성자 또는 관리자)
router.post('/community/:id/comment/:cid/delete', requireLogin, (req, res) => {
  const post = db.getPostById(parseInt(req.params.id));
  if (!post) return res.status(404).render('404');
  const c = (post.comments || []).find(x => x.id === parseInt(req.params.cid));
  const me = db.getUserById(req.session.user.id);
  if (c && (c.author_id === me.id || isAdmin(me)))
    db.deleteComment(post.id, c.id);
  res.redirect('/community/' + post.id);
});

// 글 삭제 (작성자 또는 관리자)
router.post('/community/:id/delete', requireLogin, (req, res) => {
  const post = db.getPostById(parseInt(req.params.id));
  if (!post) return res.status(404).render('404');
  const me = db.getUserById(req.session.user.id);
  if (post.author_id !== me.id && !isAdmin(me))
    return res.status(403).render('403');
  db.deletePost(post.id);
  res.redirect('/community');
});

module.exports = router;
