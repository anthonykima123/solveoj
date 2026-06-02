// 공동 관리자(co-admin)에게 부여할 수 있는 세분화된 권한 정의
const PERMISSIONS = [
  { key: 'problems', label: '문제 관리', desc: '문제 추가 · 수정 · 삭제' },
  { key: 'users',    label: '유저 관리', desc: '유저 삭제 · 비밀번호 초기화' },
];

const PERMISSION_KEYS = PERMISSIONS.map(p => p.key);

// 역할: 'superadmin'(슈퍼 관리자) > 'admin'(공동 관리자) > 'user'(일반)
function isSuperAdmin(user) {
  return !!user && user.role === 'superadmin';
}

function isAdmin(user) {
  return !!user && (user.role === 'superadmin' || user.role === 'admin');
}

function hasPermission(user, perm) {
  if (!user) return false;
  if (user.role === 'superadmin') return true; // 슈퍼 관리자는 모든 권한 보유
  if (user.role === 'admin') return Array.isArray(user.permissions) && user.permissions.includes(perm);
  return false;
}

module.exports = { PERMISSIONS, PERMISSION_KEYS, isSuperAdmin, isAdmin, hasPermission };
