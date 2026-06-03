const fs = require('fs');

class JsonDB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this._load();
  }

  _load() {
    if (fs.existsSync(this.dbPath)) {
      try { this._d = JSON.parse(fs.readFileSync(this.dbPath, 'utf8')); return; }
      catch (_) {}
    }
    this._d = { users: [], problems: [], submissions: [], solved: [], ratings: [], _seq: { users: 1, submissions: 1 } };
  }

  _save() { fs.writeFileSync(this.dbPath, JSON.stringify(this._d)); }

  // Users
  getUserById(id) { return this._d.users.find(u => u.id === id) || null; }
  getUserByUsername(u) { return this._d.users.find(x => x.username === u) || null; }
  getUserByUsernameOrEmail(u, e) { return this._d.users.find(x => x.username === u || x.email === e) || null; }
  getAllUsers() { return [...this._d.users].sort((a, b) => b.solved_count - a.solved_count); }
  createUser(data) {
    const user = { id: this._d._seq.users++, role: 'user', permissions: [], solved_count: 0, submission_count: 0, created_at: new Date().toISOString(), ...data };
    this._d.users.push(user);
    this._save();
    return user;
  }
  updateUser(id, updates) {
    const u = this._d.users.find(u => u.id === id);
    if (u) { Object.assign(u, updates); this._save(); return true; }
    return false;
  }
  incUser(id, field, by = 1) {
    const u = this._d.users.find(u => u.id === id);
    if (u) { u[field] = (u[field] || 0) + by; this._save(); }
  }
  deleteUser(id) {
    const before = this._d.users.length;
    this._d.users = this._d.users.filter(u => u.id !== id);
    if (this._d.users.length !== before) {
      // 해당 유저의 제출/해결 기록도 함께 정리
      this._d.submissions = this._d.submissions.filter(s => s.user_id !== id);
      this._d.solved = this._d.solved.filter(s => s.user_id !== id);
      this._save();
      return true;
    }
    return false;
  }
  getAdmins() { return this._d.users.filter(u => u.role === 'superadmin' || u.role === 'admin'); }

  // Problems
  getProblemById(id) { return this._d.problems.find(p => p.id === id) || null; }
  incProblem(id, field, by = 1) {
    const p = this._d.problems.find(p => p.id === id);
    if (p) { p[field] = (p[field] || 0) + by; this._save(); }
  }
  insertProblem(p) { this._d.problems.push(p); this._save(); }
  updateProblem(id, updates) {
    const idx = this._d.problems.findIndex(p => p.id === id);
    if (idx !== -1) { Object.assign(this._d.problems[idx], updates); this._save(); return true; }
    return false;
  }
  deleteProblem(id) {
    const before = this._d.problems.length;
    this._d.problems = this._d.problems.filter(p => p.id !== id);
    if (this._d.problems.length !== before) { this._save(); return true; }
    return false;
  }
  getProblems({ difficulty, search } = {}) {
    let r = [...this._d.problems];
    if (difficulty) r = r.filter(p => p.difficulty.startsWith(difficulty));
    if (search) r = r.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
    return r.sort((a, b) => a.id - b.id);
  }

  // Submissions
  getSubmissionById(id) { return this._d.submissions.find(s => s.id === id) || null; }
  getSubmissionsByUser(userId, limit = 50) {
    return this._d.submissions.filter(s => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  }
  getAllSubmissions(limit = 100) {
    return [...this._d.submissions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  }
  createSubmission(data) {
    const sub = { id: this._d._seq.submissions++, created_at: new Date().toISOString(), ...data };
    this._d.submissions.push(sub);
    this._save();
    return sub;
  }
  deleteSubmission(id) {
    const before = this._d.submissions.length;
    this._d.submissions = this._d.submissions.filter(s => s.id !== id);
    if (this._d.submissions.length !== before) { this._save(); return true; }
    return false;
  }

  // Solved
  isSolved(uid, pid) { return this._d.solved.some(s => s.user_id === uid && s.problem_id === pid); }
  addSolved(uid, pid) {
    if (!this.isSolved(uid, pid)) { this._d.solved.push({ user_id: uid, problem_id: pid }); this._save(); return true; }
    return false;
  }
  getSolvedIds(uid) { return this._d.solved.filter(s => s.user_id === uid).map(s => s.problem_id); }
}

module.exports = JsonDB;
