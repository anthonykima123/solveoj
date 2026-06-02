const { db } = require('../database');
const { isAdmin, isSuperAdmin, hasPermission } = require('../utils/permissions');

// 세션의 id로 DB에서 최신 유저(역할·권한 포함)를 가져온다.
function loadUser(req) {
  if (!req.session.user) return null;
  return db.getUserById(req.session.user.id);
}

function notLoggedIn(req, res) {
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

// 공동 관리자 이상(슈퍼 관리자 또는 공동 관리자)
function requireAdmin(req, res, next) {
  if (!req.session.user) return notLoggedIn(req, res);
  const u = loadUser(req);
  if (!isAdmin(u)) return res.status(403).render('403');
  req.adminUser = u;
  next();
}

// 슈퍼 관리자 전용 (역할/권한 부여 등)
function requireSuperAdmin(req, res, next) {
  if (!req.session.user) return notLoggedIn(req, res);
  const u = loadUser(req);
  if (!isSuperAdmin(u)) return res.status(403).render('403');
  req.adminUser = u;
  next();
}

// 특정 세분화 권한 필요 (예: 'problems', 'users', 'submissions')
function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.session.user) return notLoggedIn(req, res);
    const u = req.adminUser || loadUser(req);
    if (!hasPermission(u, perm)) return res.status(403).render('403');
    req.adminUser = u;
    next();
  };
}

module.exports = { requireAdmin, requireSuperAdmin, requirePermission };
