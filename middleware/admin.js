function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  if (req.session.user.username !== 'admin') return res.status(403).render('403');
  next();
}

module.exports = { requireAdmin };
