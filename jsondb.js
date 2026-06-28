const fs = require('fs');
const pgstore = require('./pgstore');

const EMPTY_DB = () => ({ users: [], problems: [], submissions: [], solved: [], ratings: [], _seq: { users: 1, submissions: 1 } });

class JsonDB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.usePg = !!process.env.DATABASE_URL;
    this._saveChain = Promise.resolve();
    if (this.usePg) {
      // Postgres 모드: 실제 로드는 비동기 initStore()에서 수행한다.
      this._d = EMPTY_DB();
    } else {
      this._load();
      this._ensure();
    }
  }

  // Postgres 모드 부팅: 테이블 보장 + 저장된 데이터 로드. database.js의 initDB()에서 호출.
  async initStore() {
    if (!this.usePg) return;
    await pgstore.init();
    const data = await pgstore.load();
    if (data) {
      this._d = data;
    } else {
      this._d = EMPTY_DB();
    }
    this._ensure();
    // 새 컬렉션이 추가됐으면 즉시 반영
    await pgstore.save(this._d);
  }

  _load() {
    if (fs.existsSync(this.dbPath)) {
      try { this._d = JSON.parse(fs.readFileSync(this.dbPath, 'utf8')); return; }
      catch (_) {}
    }
    this._d = EMPTY_DB();
  }

  _save() {
    if (this.usePg) {
      // 동기 호출자를 위해 즉시 반환하고, 쓰기는 순서대로 직렬화하여 비동기 처리
      this._saveChain = this._saveChain
        .then(() => pgstore.save(this._d))
        .catch(e => console.error('PG save failed:', e.message));
    } else {
      fs.writeFileSync(this.dbPath, JSON.stringify(this._d));
    }
  }

  // 새 컬렉션들이 없으면 만들어 둔다 (기존 DB 파일 호환)
  _ensure() {
    this._d.posts ??= [];
    this._d.contests ??= [];
    this._d.groups ??= [];
    this._d.steps ??= [];
    this._d._seq.posts ??= 1;
    this._d._seq.comments ??= 1;
    this._d._seq.contests ??= 1;
    this._d._seq.groups ??= 1;
    this._d._seq.steps ??= 1;
  }

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
  getProblems({ difficulty, search, includePrivate = false } = {}) {
    let r = [...this._d.problems];
    if (!includePrivate) r = r.filter(p => !p.is_private);
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

  // ─────────────────────────── 커뮤니티 (게시글/댓글) ───────────────────────────
  getPosts() { return [...(this._d.posts || [])].sort((a, b) => b.id - a.id); }
  getPostById(id) { return (this._d.posts || []).find(p => p.id === id) || null; }
  createPost(data) {
    const post = { id: this._d._seq.posts++, views: 0, comments: [], created_at: new Date().toISOString(), ...data };
    this._d.posts.push(post);
    this._save();
    return post;
  }
  incPostViews(id) {
    const p = this.getPostById(id);
    if (p) { p.views = (p.views || 0) + 1; this._save(); }
  }
  deletePost(id) {
    const before = this._d.posts.length;
    this._d.posts = this._d.posts.filter(p => p.id !== id);
    if (this._d.posts.length !== before) { this._save(); return true; }
    return false;
  }
  addComment(postId, data) {
    const p = this.getPostById(postId);
    if (!p) return null;
    const c = { id: this._d._seq.comments++, created_at: new Date().toISOString(), ...data };
    (p.comments ||= []).push(c);
    this._save();
    return c;
  }
  deleteComment(postId, commentId) {
    const p = this.getPostById(postId);
    if (!p || !p.comments) return false;
    const before = p.comments.length;
    p.comments = p.comments.filter(c => c.id !== commentId);
    if (p.comments.length !== before) { this._save(); return true; }
    return false;
  }

  // ─────────────────────────── 대회 ───────────────────────────
  getContests() { return [...(this._d.contests || [])].sort((a, b) => new Date(b.start_at) - new Date(a.start_at)); }
  getContestById(id) { return (this._d.contests || []).find(c => c.id === id) || null; }
  createContest(data) {
    const c = { id: this._d._seq.contests++, problem_ids: [], created_at: new Date().toISOString(), ...data };
    this._d.contests.push(c);
    this._save();
    return c;
  }
  updateContest(id, updates) {
    const c = this.getContestById(id);
    if (c) { Object.assign(c, updates); this._save(); return true; }
    return false;
  }
  deleteContest(id) {
    const before = this._d.contests.length;
    this._d.contests = this._d.contests.filter(c => c.id !== id);
    if (this._d.contests.length !== before) { this._save(); return true; }
    return false;
  }

  // ─────────────────────────── 그룹 ───────────────────────────
  getGroups() { return [...(this._d.groups || [])].sort((a, b) => b.id - a.id); }
  getGroupById(id) { return (this._d.groups || []).find(g => g.id === id) || null; }
  createGroup(data) {
    const g = { id: this._d._seq.groups++, members: [], created_at: new Date().toISOString(), ...data };
    this._d.groups.push(g);
    this._save();
    return g;
  }
  joinGroup(id, userId) {
    const g = this.getGroupById(id);
    if (g && !g.members.includes(userId)) { g.members.push(userId); this._save(); return true; }
    return false;
  }
  leaveGroup(id, userId) {
    const g = this.getGroupById(id);
    if (g) { g.members = g.members.filter(m => m !== userId); this._save(); return true; }
    return false;
  }
  deleteGroup(id) {
    const before = this._d.groups.length;
    this._d.groups = this._d.groups.filter(g => g.id !== id);
    if (this._d.groups.length !== before) { this._save(); return true; }
    return false;
  }

  // ─────────────────────────── 단계 (단계별 문제) ───────────────────────────
  getSteps() { return [...(this._d.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0)); }
  getStepById(id) { return (this._d.steps || []).find(s => s.id === id) || null; }
  createStep(data) {
    const s = { id: this._d._seq.steps++, problem_ids: [], created_at: new Date().toISOString(), ...data };
    this._d.steps.push(s);
    this._save();
    return s;
  }
  updateStep(id, updates) {
    const s = this.getStepById(id);
    if (s) { Object.assign(s, updates); this._save(); return true; }
    return false;
  }
  deleteStep(id) {
    const before = this._d.steps.length;
    this._d.steps = this._d.steps.filter(s => s.id !== id);
    if (this._d.steps.length !== before) { this._save(); return true; }
    return false;
  }
}

module.exports = JsonDB;
