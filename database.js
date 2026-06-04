const JsonDB = require('./jsondb');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { getDifficultyScore } = require('./utils/rating');

const db = new JsonDB(path.join(__dirname, 'judge.db.json'));

const TAGS = {
  1000:  ['수학', '구현', '사칙연산'],
  1001:  ['수학', '구현', '사칙연산'],
  2557:  ['구현'],
  2562:  ['구현', '배열'],
  1152:  ['구현', '문자열'],
  1929:  ['수학', '소수 판정', '에라토스테네스의 체'],
  10870: ['수학', '다이나믹 프로그래밍'],
  2309:  ['브루트포스 알고리즘', '구현'],
  1463:  ['다이나믹 프로그래밍'],
  9461:  ['수학', '다이나믹 프로그래밍'],
  1904:  ['다이나믹 프로그래밍'],
  2579:  ['다이나믹 프로그래밍'],
  1932:  ['다이나믹 프로그래밍'],
  11053: ['다이나믹 프로그래밍'],
  1697:  ['너비 우선 탐색', '그래프 이론'],
  2178:  ['너비 우선 탐색', '그래프 이론'],
  1520:  ['다이나믹 프로그래밍', '깊이 우선 탐색'],
  7576:  ['너비 우선 탐색', '그래프 이론'],
  1753:  ['최단 경로', '다익스트라', '그래프 이론'],
  11404: ['최단 경로', '플로이드-워셜', '그래프 이론'],
  1655:  ['자료 구조', '우선순위 큐'],
  2357:  ['자료 구조', '세그먼트 트리'],
  10986: ['수학', '누적 합', '정수론'],
  1208:  ['분할 정복', '이분 탐색', '비트마스킹'],
  2261:  ['분할 정복', '기하학', '정렬'],
};

// 2309 일곱 난쟁이 — 원본(아홉 난쟁이, 합 100) 정식 데이터.
// 시드와 교정 마이그레이션에서 공통으로 사용한다.
const P2309 = {
  title: '일곱 난쟁이', difficulty: 'Bronze 3', time_limit: 2000, memory_limit: 256,
  description: '아홉 명의 난쟁이가 모여 있다. 이들 중 일곱 난쟁이의 키의 합이 정확히 100이 된다.\n아홉 난쟁이의 키가 주어졌을 때, 키의 합이 100이 되는 일곱 난쟁이를 찾아 키를 오름차순으로 출력하는 프로그램을 작성하시오.\n\n(일곱 난쟁이를 찾을 수 없는 경우는 없으며, 답이 여러 개인 경우도 없다.)',
  input_desc: '아홉 개의 줄에 걸쳐 난쟁이들의 키가 주어진다. 주어지는 키는 100을 넘지 않는 자연수이며, 아홉 난쟁이의 키는 모두 다르다.',
  output_desc: '일곱 난쟁이의 키를 오름차순으로 한 줄에 하나씩 출력한다.',
  sample_input: '20\n7\n23\n19\n10\n15\n25\n8\n13',
  sample_output: '7\n8\n10\n13\n19\n20\n23',
  constraints: '난쟁이는 9명, 모든 키 ≤ 100, 키는 서로 다름',
  test_cases: JSON.stringify([
    { input: '20\n7\n23\n19\n10\n15\n25\n8\n13', output: '7\n8\n10\n13\n19\n20\n23' },
    { input: '1\n2\n3\n4\n5\n6\n79\n50\n60', output: '1\n2\n3\n4\n5\n6\n79' },
    { input: '10\n11\n12\n13\n14\n15\n25\n1\n99', output: '10\n11\n12\n13\n14\n15\n25' }
  ])
};

// 단계별 문제 — 정올(jungol) 커리큘럼 구조의 5단계.
const STEP_DEFS = [
  { name: 'Start',     order: 1, description: '입문 · 기초', tiers: ['Bronze'] },
  { name: 'Build',     order: 2, description: '중급',        tiers: ['Silver'] },
  { name: 'Solve',     order: 3, description: '고급',        tiers: ['Gold'] },
  { name: 'Master',    order: 4, description: '전문',        tiers: ['Platinum'] },
  { name: 'Challenge', order: 5, description: '최상급',      tiers: ['Diamond', 'Ruby'] },
];

// 단계 설명을 STEP_DEFS와 동기화 (이미 생성된 단계의 옛 설명을 갱신)
function syncStepDescriptions() {
  db.getSteps().forEach(s => {
    const def = STEP_DEFS.find(d => d.name === s.name);
    if (def && s.description !== def.description) db.updateStep(s.id, { description: def.description });
  });
}

function seedSteps() {
  if (db.getSteps().length > 0) return;
  STEP_DEFS.forEach(d => db.createStep({ name: d.name, order: d.order, description: d.description }));
  console.log('✅ 5 steps seeded (Start ~ Challenge)');
}

// 기존 문제를 난이도에 따라 단계에 배치한다. (problem.step 미지정인 것만 → 관리자 수정 보존)
function assignProblemSteps() {
  const steps = db.getSteps();
  if (!steps.length) return;
  const tierToStepId = {};
  STEP_DEFS.forEach(d => {
    const s = steps.find(x => x.name === d.name);
    if (s) d.tiers.forEach(t => tierToStepId[t] = s.id);
  });
  let changed = 0;
  db._d.problems.forEach(p => {
    if (p.step || p.contest) return; // 기출(대회) 분류 문제는 단계에 자동 배치하지 않음
    const tier = (p.difficulty || '').split(' ')[0];
    if (tierToStepId[tier]) { p.step = tierToStepId[tier]; changed++; }
  });
  if (changed) { db._save(); console.log(`✅ ${changed} problems assigned to steps by difficulty`); }
}

// 01타일(1904) — n=1000000 정답이 1345로 잘못 저장된 경우 7871로 교정.
function fixProblem1904() {
  const p = db.getProblemById(1904);
  if (!p) return;
  let tcs; try { tcs = JSON.parse(p.test_cases); } catch (_) { return; }
  const bad = tcs.find(tc => tc.input.trim() === '1000000' && tc.output === '1345');
  if (!bad) return;
  bad.output = '7871';
  db.updateProblem(1904, { test_cases: JSON.stringify(tcs) });
  console.log('✅ Problem 1904 (01타일) test data fixed (1345 → 7871)');
}

// 최솟값과 최댓값(2357) — 구간 6~9 최댓값이 52로 잘못 저장된 경우 81로 교정.
function fixProblem2357() {
  const p = db.getProblemById(2357);
  if (!p) return;
  const BAD = '5 100\n38 100\n20 52\n5 81';
  const GOOD = '5 100\n38 100\n20 81\n5 81';
  const updates = {};
  if (p.sample_output === BAD) updates.sample_output = GOOD;
  let tcs; try { tcs = JSON.parse(p.test_cases); } catch (_) { tcs = null; }
  if (tcs) {
    let ch = false;
    for (const tc of tcs) if (tc.output === BAD) { tc.output = GOOD; ch = true; }
    if (ch) updates.test_cases = JSON.stringify(tcs);
  }
  if (Object.keys(updates).length) {
    db.updateProblem(2357, updates);
    console.log('✅ Problem 2357 (최솟값과 최댓값) test data fixed');
  }
}

// 토마토(7576) — '-1' 벽이 있는 테스트의 정답이 8로 잘못 저장된 경우 7로 교정.
function fixProblem7576() {
  const p = db.getProblemById(7576);
  if (!p) return;
  let tcs; try { tcs = JSON.parse(p.test_cases); } catch (_) { return; }
  const bad = tcs.find(tc => tc.input.includes('-1 0 0 0 0 0') && tc.output === '8');
  if (!bad) return;
  bad.output = '7';
  db.updateProblem(7576, { test_cases: JSON.stringify(tcs) });
  console.log('✅ Problem 7576 (토마토) test data fixed (8 → 7)');
}

// 플로이드(11404) — 입력과 맞지 않는 잘못된 정답 행렬을 교정.
function fixProblem11404() {
  const p = db.getProblemById(11404);
  if (!p) return;
  const BAD = '0 4 2 6\n1 0 3 7\n2 3 0 4\n4 7 5 0';
  const GOOD = '0 4 2 6\n1 0 3 7\n2 6 0 4\n4 3 6 0';
  const updates = {};
  if (p.sample_output === BAD) updates.sample_output = GOOD;
  let tcs; try { tcs = JSON.parse(p.test_cases); } catch (_) { tcs = null; }
  if (tcs) {
    let changed = false;
    for (const tc of tcs) if (tc.output === BAD) { tc.output = GOOD; changed = true; }
    if (changed) updates.test_cases = JSON.stringify(tcs);
  }
  if (Object.keys(updates).length) {
    db.updateProblem(11404, updates);
    console.log('✅ Problem 11404 (플로이드) test data fixed');
  }
}

// 기존 DB에 깨진 2309(난쟁이 8명) 데이터가 있으면 원본으로 교정한다.
function migrateProblem2309() {
  const p = db.getProblemById(2309);
  if (!p) return;
  const lines = (p.sample_input || '').split('\n').filter(s => s.trim() !== '');
  if (lines.length === 9) return; // 이미 교정됨 → 관리자 수정 보존
  db.updateProblem(2309, P2309);
  console.log('✅ Problem 2309 data fixed (original 9-dwarf version)');
}

// 초기에 잘못 넣었던 정올 더미 문제(30001~30024) 정리.
function removeOldJungol() {
  const oldIds = [];
  for (let id = 30001; id <= 30024; id++) oldIds.push(id);
  let removed = 0;
  oldIds.forEach(id => { if (db.getProblemById(id)) { db.deleteProblem(id); removed++; } });
  const beforeS = db._d.solved.length, beforeSub = db._d.submissions.length;
  db._d.solved = db._d.solved.filter(s => !oldIds.includes(s.problem_id));
  db._d.submissions = db._d.submissions.filter(s => !oldIds.includes(s.problem_id));
  if (removed || db._d.solved.length !== beforeS || db._d.submissions.length !== beforeSub) {
    db._save();
    console.log(`🧹 removed ${removed} old jungol dummy problem(s)`);
  }
}

async function initDB() {
  await db.initStore(); // Postgres 모드면 저장된 데이터를 먼저 로드
  seedProblems();
  seedExternalProblems();
  removeOldJungol();
  migrateTags();
  migrateProblem2309();
  fixProblem1904();
  fixProblem2357();
  fixProblem7576();
  fixProblem11404();
  seedSteps();
  syncStepDescriptions();
  assignProblemSteps();
  if (db._d.users.length === 0) seedUsers();
  migrateRoles();
  autoSolveAllForAdmin();
}

// admin 계정이 아직 풀지 않은 모든 문제를 AC 처리한다. (요청에 의한 일괄 제출)
// 멱등: 이미 푼 문제는 건너뛰므로, 새 문제 추가 시 다음 부팅에 자동으로 포함된다.
function autoSolveAllForAdmin() {
  const admin = db.getUserByUsername('admin');
  if (!admin) return;
  let n = 0;
  for (const p of db._d.problems) {
    if (db.isSolved(admin.id, p.id)) continue;
    db.createSubmission({
      user_id: admin.id, problem_id: p.id, language: 'cpp',
      code: '// auto-submitted (admin)', verdict: 'AC',
      execution_time: 0, error_message: null
    });
    db.incProblem(p.id, 'submission_count');
    db.incProblem(p.id, 'accepted_count');
    db.incUser(admin.id, 'submission_count');
    db.addSolved(admin.id, p.id);
    n++;
  }
  // solved_count / rating 을 실제 푼 문제 기준으로 재계산 (시드의 가짜 기본값 보정)
  const solvedIds = db.getSolvedIds(admin.id);
  const rating = solvedIds.reduce((s, id) => s + getDifficultyScore((db.getProblemById(id) || {}).difficulty || ''), 0);
  db.updateUser(admin.id, { solved_count: solvedIds.length, rating });
  if (n) console.log(`✅ admin auto-solved ${n} problem(s); total ${solvedIds.length}, rating ${rating}`);
}

// problems/ 폴더의 JSON 문제 파일들을 읽어 DB에 없으면 추가한다.
// (정올 등 외부 문제를 파일로 관리 — 파일 하나 = 문제 하나)
function seedExternalProblems() {
  const dir = path.join(__dirname, 'problems');
  if (!fs.existsSync(dir)) return;

  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith('.json')) files.push(fp);
    }
  })(dir);

  let added = 0;
  for (const fp of files) {
    let p;
    try { p = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (e) { console.error('문제 파일 파싱 실패:', fp, e.message); continue; }
    if (!p || !p.id || db.getProblemById(p.id)) continue;

    const test_cases = Array.isArray(p.test_cases)
      ? JSON.stringify(p.test_cases)
      : (p.test_cases || '[]');

    db.insertProblem({
      id: p.id, title: p.title, difficulty: p.difficulty,
      time_limit: p.time_limit || 1000, memory_limit: p.memory_limit || 256,
      description: p.description || '', input_desc: p.input_desc || '',
      output_desc: p.output_desc || '', sample_input: p.sample_input || '',
      sample_output: p.sample_output || '', constraints: p.constraints || '',
      tags: p.tags || [], source: p.source || null, contest: p.contest || null,
      test_cases, submission_count: 0, accepted_count: 0
    });
    added++;
  }
  if (added > 0) console.log(`✅ ${added} external problem(s) loaded`);
}

// 기존 유저들에게 역할(role) 필드를 부여한다.
// 'admin' 계정은 슈퍼 관리자로, 나머지는 일반 유저로 초기화.
function migrateRoles() {
  let changed = false;
  db._d.users.forEach(u => {
    if (!u.role) {
      u.role = (u.username === 'admin') ? 'superadmin' : 'user';
      changed = true;
    }
    if (u.role === 'admin' && !Array.isArray(u.permissions)) {
      u.permissions = [];
      changed = true;
    }
  });
  if (changed) db._save();
}

function migrateTags() {
  let changed = false;
  db._d.problems.forEach(p => {
    const tags = TAGS[p.id];
    if (tags && (!p.tags || p.tags.length === 0)) {
      p.tags = tags;
      changed = true;
    }
  });
  if (changed) db._save();
}

function seedProblems() {
  const problems = [
    { id: 1000, title: 'A+B', difficulty: 'Bronze 5', time_limit: 1000, memory_limit: 256,
      description: '두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.',
      input_desc: '첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)',
      output_desc: '첫째 줄에 A+B를 출력한다.',
      sample_input: '1 2', sample_output: '3',
      constraints: '0 < A, B < 10',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '1 2', output: '3' }, { input: '3 4', output: '7' },
        { input: '5 5', output: '10' }, { input: '9 1', output: '10' }
      ])
    },
    { id: 1001, title: 'A-B', difficulty: 'Bronze 5', time_limit: 1000, memory_limit: 256,
      description: '두 정수 A와 B를 입력받은 다음, A-B를 출력하는 프로그램을 작성하시오.',
      input_desc: '첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)',
      output_desc: '첫째 줄에 A-B를 출력한다.',
      sample_input: '3 2', sample_output: '1',
      constraints: '0 < A, B < 10',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '3 2', output: '1' }, { input: '5 3', output: '2' },
        { input: '9 1', output: '8' }, { input: '7 4', output: '3' }
      ])
    },
    { id: 2557, title: 'Hello World', difficulty: 'Bronze 5', time_limit: 1000, memory_limit: 256,
      description: 'Hello World!를 출력하시오.',
      input_desc: '없음', output_desc: 'Hello World!를 출력하시오.',
      sample_input: '', sample_output: 'Hello World!',
      constraints: '없음',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([{ input: '', output: 'Hello World!' }])
    },
    { id: 2562, title: '최댓값', difficulty: 'Bronze 3', time_limit: 1000, memory_limit: 256,
      description: '9개의 서로 다른 자연수가 주어질 때, 이들 중 최댓값을 찾고 그 최댓값이 몇 번째 수인지를 구하는 프로그램을 작성하시오.',
      input_desc: '9개의 자연수가 각각 한 줄씩 주어진다. 주어지는 자연수는 100보다 작다.',
      output_desc: '첫째 줄에 최댓값을 출력하고, 둘째 줄에 최댓값이 몇 번째 수인지 출력한다.',
      sample_input: '3\n29\n38\n12\n57\n74\n40\n85\n61', sample_output: '85\n8',
      constraints: '자연수는 100보다 작다',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '3\n29\n38\n12\n57\n74\n40\n85\n61', output: '85\n8' },
        { input: '10\n20\n30\n40\n50\n60\n70\n80\n90', output: '90\n9' }
      ])
    },
    { id: 1152, title: '단어의 개수', difficulty: 'Silver 5', time_limit: 2000, memory_limit: 256,
      description: '영어 대소문자와 공백으로 이루어진 문자열이 주어진다. 이 문자열에는 몇 개의 단어가 있을까?',
      input_desc: '첫 줄에 영어 대소문자와 공백으로 이루어진 문자열이 주어진다.',
      output_desc: '첫째 줄에 단어의 개수를 출력한다.',
      sample_input: 'The quick brown fox jumps over the lazy dog', sample_output: '9',
      constraints: '문자열 길이 <= 1,000,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: 'The quick brown fox jumps over the lazy dog', output: '9' },
        { input: 'Hello World', output: '2' },
        { input: ' Hello World ', output: '2' }
      ])
    },
    { id: 1929, title: '소수 구하기', difficulty: 'Silver 3', time_limit: 2000, memory_limit: 256,
      description: 'M이상 N이하의 소수를 모두 출력하는 프로그램을 작성하시오.',
      input_desc: '첫째 줄에 자연수 M과 N이 주어진다. (1 ≤ M ≤ N ≤ 1,000,000)',
      output_desc: '한 줄에 하나씩, 증가하는 순서대로 소수를 출력한다.',
      sample_input: '3 16', sample_output: '3\n5\n7\n11\n13',
      constraints: '1 ≤ M ≤ N ≤ 1,000,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '3 16', output: '3\n5\n7\n11\n13' },
        { input: '1 10', output: '2\n3\n5\n7' }
      ])
    },
    { id: 10870, title: '피보나치 수 5', difficulty: 'Bronze 5', time_limit: 1000, memory_limit: 256,
      description: 'n번째 피보나치 수를 구하는 프로그램을 작성하시오. (피보나치: 0, 1, 1, 2, 3, 5, 8, ...)',
      input_desc: '첫째 줄에 n이 주어진다. (0 ≤ n ≤ 20)',
      output_desc: '첫째 줄에 n번째 피보나치 수를 출력한다.',
      sample_input: '10', sample_output: '55',
      constraints: '0 ≤ n ≤ 20',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '0', output: '0' }, { input: '1', output: '1' },
        { input: '5', output: '5' }, { input: '10', output: '55' },
        { input: '20', output: '6765' }
      ])
    },
    { id: 2309, ...P2309, submission_count: 0, accepted_count: 0 },
    // ───── Silver DP ─────
    { id: 1463, title: '1로 만들기', difficulty: 'Silver 3', time_limit: 2000, memory_limit: 256,
      description: '정수 X에 사용할 수 있는 연산은 다음 세 가지이다.\n\n1. X가 3으로 나누어 떨어지면, 3으로 나눈다.\n2. X가 2로 나누어 떨어지면, 2로 나눈다.\n3. 1을 뺀다.\n\n정수 N이 주어졌을 때, 위 연산을 사용해 1을 만들기 위한 연산 횟수의 최솟값을 출력하시오.',
      input_desc: '첫째 줄에 1보다 크거나 같고 10^6보다 작거나 같은 정수 N이 주어진다.',
      output_desc: '첫째 줄에 연산 횟수의 최솟값을 출력한다.',
      sample_input: '10', sample_output: '3',
      constraints: '1 ≤ N ≤ 1,000,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '1', output: '0' },
        { input: '2', output: '1' },
        { input: '10', output: '3' },
        { input: '100', output: '7' }
      ])
    },
    { id: 9461, title: '파도반 수열', difficulty: 'Silver 3', time_limit: 1000, memory_limit: 256,
      description: '나선 모양의 정삼각형 배열에서 파도반 수열 P(N)을 구하시오.\nP(1)=1, P(2)=1, P(3)=1이고 N≥4이면 P(N) = P(N-2) + P(N-3)이다.',
      input_desc: '첫째 줄에 T가 주어진다. 각 테스트 케이스마다 N이 주어진다. (1 ≤ N ≤ 100)',
      output_desc: '각 테스트 케이스마다 P(N)을 출력한다.',
      sample_input: '2\n6\n12', sample_output: '3\n16',
      constraints: '1 ≤ N ≤ 100',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '2\n6\n12', output: '3\n16' },
        { input: '1\n1', output: '1' },
        { input: '3\n1\n5\n10', output: '1\n2\n9' }
      ])
    },
    { id: 1904, title: '01타일', difficulty: 'Silver 3', time_limit: 1000, memory_limit: 256,
      description: '길이가 N인 0과 1로 이루어진 수열을 만들려 한다. 타일 규칙:\n- 00은 항상 붙어서 사용해야 한다.\n- 1은 하나씩 사용할 수 있다.\n가능한 수열의 수를 15746으로 나눈 나머지를 출력하시오.',
      input_desc: '첫 번째 줄에 N이 주어진다. (1 ≤ N ≤ 1,000,000)',
      output_desc: '첫 번째 줄에 가능한 수열의 개수를 15746으로 나눈 나머지를 출력한다.',
      sample_input: '4', sample_output: '5',
      constraints: '1 ≤ N ≤ 1,000,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '1', output: '1' },
        { input: '2', output: '2' },
        { input: '4', output: '5' },
        { input: '10', output: '89' },
        { input: '1000000', output: '7871' }
      ])
    },
    { id: 2579, title: '계단 오르기', difficulty: 'Silver 3', time_limit: 1000, memory_limit: 256,
      description: '계단 오르기 게임에서 계단에는 각각 점수가 적혀 있다. 다음 규칙에 따라 계단을 올라야 한다.\n\n1. 계단은 한 번에 한 계단 또는 두 계단씩 오를 수 있다.\n2. 연속된 세 계단을 모두 밟아서는 안 된다.\n3. 마지막 도착 계단은 반드시 밟아야 한다.\n\n각 계단에 적힌 점수의 합의 최댓값을 구하시오.',
      input_desc: '첫째 줄에 계단의 개수가 주어지고, 각 계단의 점수가 주어진다. (1 ≤ 계단 수 ≤ 300, 1 ≤ 점수 ≤ 10000)',
      output_desc: '첫째 줄에 최대로 얻을 수 있는 점수를 출력한다.',
      sample_input: '6\n10\n20\n15\n25\n10\n20', sample_output: '75',
      constraints: '1 ≤ N ≤ 300, 1 ≤ 각 점수 ≤ 10000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '6\n10\n20\n15\n25\n10\n20', output: '75' },
        { input: '1\n100', output: '100' },
        { input: '2\n100\n100', output: '200' }
      ])
    },
    { id: 1932, title: '정수 삼각형', difficulty: 'Silver 1', time_limit: 2000, memory_limit: 256,
      description: '삼각형의 꼭대기에서 바닥까지 이어지는 경로 중, 거쳐간 숫자의 합이 가장 큰 경우를 구하시오.\n각 칸에서 아래 두 칸 중 하나로만 이동할 수 있다.',
      input_desc: '첫째 줄에 삼각형의 크기 N이 주어진다. (1 ≤ N ≤ 500) 이후 삼각형이 주어진다.',
      output_desc: '첫째 줄에 합의 최댓값을 출력한다.',
      sample_input: '5\n7\n3 8\n8 1 0\n2 7 4 4\n4 5 2 6 5', sample_output: '30',
      constraints: '1 ≤ N ≤ 500, 0 ≤ 값 ≤ 9999',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '5\n7\n3 8\n8 1 0\n2 7 4 4\n4 5 2 6 5', output: '30' },
        { input: '1\n5', output: '5' },
        { input: '3\n1\n2 3\n4 5 6', output: '10' }
      ])
    },
    { id: 11053, title: '가장 긴 증가하는 부분 수열', difficulty: 'Silver 2', time_limit: 1000, memory_limit: 256,
      description: '수열 A가 주어졌을 때, 가장 긴 증가하는 부분 수열(LIS)의 길이를 구하시오.\n예를 들어, 수열 A = {10, 20, 10, 30, 20, 50}에서 LIS는 {10, 20, 30, 50}이고 길이는 4이다.',
      input_desc: '첫째 줄에 수열 A의 크기 N (1 ≤ N ≤ 1,000), 둘째 줄에 수열이 주어진다. (1 ≤ A[i] ≤ 1,000)',
      output_desc: '첫째 줄에 LIS의 길이를 출력한다.',
      sample_input: '6\n10 20 10 30 20 50', sample_output: '4',
      constraints: '1 ≤ N ≤ 1,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '6\n10 20 10 30 20 50', output: '4' },
        { input: '1\n1', output: '1' },
        { input: '5\n5 4 3 2 1', output: '1' },
        { input: '5\n1 2 3 4 5', output: '5' }
      ])
    },
    // ───── Silver BFS ─────
    { id: 1697, title: '숨바꼭질', difficulty: 'Silver 1', time_limit: 2000, memory_limit: 128,
      description: '수빈이는 동생과 숨바꼭질을 하고 있다. 수빈이는 위치 N, 동생은 위치 K에 있다.\n수빈이가 걸을 경우 1초 후 N-1 또는 N+1로, 순간이동하면 1초 후 2*N으로 이동할 수 있다.\n수빈이가 동생을 찾는 최소 시간을 구하시오.',
      input_desc: '첫 번째 줄에 수빈이의 위치 N과 동생의 위치 K가 주어진다. (0 ≤ N, K ≤ 100,000)',
      output_desc: '수빈이가 동생을 찾는 가장 빠른 시간을 출력한다.',
      sample_input: '5 17', sample_output: '4',
      constraints: '0 ≤ N, K ≤ 100,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '5 17', output: '4' },
        { input: '0 0', output: '0' },
        { input: '5 5', output: '0' },
        { input: '1 2', output: '1' }
      ])
    },
    { id: 2178, title: '미로 탐색', difficulty: 'Silver 1', time_limit: 2000, memory_limit: 192,
      description: 'N×M 크기의 배열로 표현된 미로가 있다. 1은 이동할 수 있는 칸, 0은 이동할 수 없는 칸이다.\n(1,1)에서 출발하여 (N,M)까지 이동할 때, 지나야 하는 최소 칸 수를 구하시오.',
      input_desc: '첫째 줄에 N, M이 주어진다. (2 ≤ N, M ≤ 100) 이후 미로가 주어진다.',
      output_desc: '첫째 줄에 지나야 하는 최소 칸 수를 출력한다.',
      sample_input: '4 6\n101111\n101010\n101011\n111011', sample_output: '15',
      constraints: '2 ≤ N, M ≤ 100',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '4 6\n101111\n101010\n101011\n111011', output: '15' },
        { input: '2 2\n11\n11', output: '3' },
        { input: '2 25\n1111111111111111111111111\n1111111111111111111111111', output: '26' }
      ])
    },
    // ───── Gold ─────
    { id: 1520, title: '내리막 길', difficulty: 'Gold 3', time_limit: 2000, memory_limit: 256,
      description: 'M×N 행렬의 지도에서 (1,1)에서 (M,N)까지 이동하는 경로의 수를 구하시오.\n인접한 네 방향 중 현재보다 고도가 낮은 곳으로만 이동할 수 있다.',
      input_desc: '첫째 줄에 M과 N (1 ≤ M, N ≤ 500), 이후 행렬이 주어진다. (0 ≤ 값 ≤ 10000)',
      output_desc: '첫째 줄에 이동 가능한 경로의 수를 출력한다.',
      sample_input: '4 5\n50 45 37 32 30\n35 50 40 20 25\n30 30 25 17 28\n27 24 22 15 10', sample_output: '3',
      constraints: '1 ≤ M, N ≤ 500',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '4 5\n50 45 37 32 30\n35 50 40 20 25\n30 30 25 17 28\n27 24 22 15 10', output: '3' },
        { input: '1 1\n1', output: '1' }
      ])
    },
    { id: 7576, title: '토마토', difficulty: 'Gold 5', time_limit: 1000, memory_limit: 512,
      description: 'M×N 크기의 창고에 토마토가 저장되어 있다. 익은 토마토(1)는 인접한 익지 않은 토마토(0)를 하루 만에 익힌다. 상자(−1)에는 토마토가 없다.\n토마토가 모두 익을 때까지 걸리는 최소 일수를 구하시오. 불가능하면 −1을 출력한다.',
      input_desc: '첫째 줄에 M과 N (2 ≤ M, N ≤ 1000), 이후 창고 상태가 주어진다.',
      output_desc: '토마토가 모두 익을 때까지의 최소 날짜 수를 출력한다.',
      sample_input: '6 4\n0 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 1', sample_output: '8',
      constraints: '2 ≤ M, N ≤ 1000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '6 4\n0 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 1', output: '8' },
        { input: '6 4\n-1 0 0 0 0 0\n-1 0 0 0 0 0\n-1 0 0 0 0 0\n-1 0 0 0 0 1', output: '7' },
        { input: '2 2\n1 1\n1 1', output: '0' },
        { input: '2 2\n-1 1\n1 0', output: '1' }
      ])
    },
    // ───── Gold (그래프) ─────
    { id: 1753, title: '최단경로', difficulty: 'Gold 4', time_limit: 1000, memory_limit: 256,
      description: '방향그래프가 주어지면 주어진 시작점에서 다른 모든 정점으로의 최단 경로를 구하시오. (다익스트라 알고리즘)\n단, 모든 간선의 가중치는 10 이하의 자연수이다.',
      input_desc: '첫째 줄에 정점 V와 간선 E가 주어진다. (1 ≤ V ≤ 20,000, 1 ≤ E ≤ 300,000)\n둘째 줄에 시작 정점 번호 K, 이후 E개의 줄에 u v w(간선)가 주어진다.',
      output_desc: 'V개의 줄에 걸쳐 i번 정점으로의 최단 경로 값을 출력한다. 도달 불가능하면 INF를 출력한다.',
      sample_input: '5 6\n1\n5 1 1\n1 2 2\n1 3 3\n2 3 4\n2 4 5\n3 4 6', sample_output: '0\n2\n3\n7\nINF',
      constraints: '1 ≤ V ≤ 20,000, 1 ≤ E ≤ 300,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '5 6\n1\n5 1 1\n1 2 2\n1 3 3\n2 3 4\n2 4 5\n3 4 6', output: '0\n2\n3\n7\nINF' },
        { input: '1 0\n1', output: '0' }
      ])
    },
    { id: 11404, title: '플로이드', difficulty: 'Gold 4', time_limit: 1000, memory_limit: 256,
      description: 'n개의 도시와 m개의 버스 노선이 있다. 모든 도시 쌍 (A,B)에 대해 A에서 B로 가는 최소 비용을 구하시오. (플로이드-워셜 알고리즘)',
      input_desc: '첫째 줄에 도시 수 n (1 ≤ n ≤ 100), 둘째 줄에 버스 수 m, 이후 m개의 줄에 a b c가 주어진다.',
      output_desc: 'n개의 줄에 n개의 값을 출력한다. 도달 불가능하면 0을 출력한다.',
      sample_input: '4\n8\n1 2 4\n1 3 2\n1 4 7\n2 1 1\n2 3 5\n3 1 2\n3 4 4\n4 2 3', sample_output: '0 4 2 6\n1 0 3 7\n2 6 0 4\n4 3 6 0',
      constraints: '1 ≤ n ≤ 100, 1 ≤ m ≤ 100,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '4\n8\n1 2 4\n1 3 2\n1 4 7\n2 1 1\n2 3 5\n3 1 2\n3 4 4\n4 2 3', output: '0 4 2 6\n1 0 3 7\n2 6 0 4\n4 3 6 0' },
        { input: '1\n0', output: '0' }
      ])
    },
    // ───── Platinum ─────
    { id: 1655, title: '가운데를 말해요', difficulty: 'Platinum 5', time_limit: 500, memory_limit: 256,
      description: '수빈이는 동생에게 숫자를 하나씩 말하고, 동생은 지금까지 들은 숫자 중 중앙값을 말해야 한다.\n숫자 개수가 짝수이면 작은 중앙값을 출력한다. 최대 힙과 최소 힙을 활용하시오.',
      input_desc: '첫째 줄에 N (1 ≤ N ≤ 100,000), 이후 N개의 줄에 정수가 주어진다. (-10,000 ≤ 값 ≤ 10,000)',
      output_desc: '각 수를 받을 때마다 현재까지의 중앙값을 출력한다.',
      sample_input: '7\n1\n5\n2\n10\n-99\n7\n5', sample_output: '1\n1\n2\n2\n2\n2\n5',
      constraints: '1 ≤ N ≤ 100,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '7\n1\n5\n2\n10\n-99\n7\n5', output: '1\n1\n2\n2\n2\n2\n5' },
        { input: '1\n1', output: '1' },
        { input: '3\n3\n1\n2', output: '3\n1\n2' }
      ])
    },
    { id: 2357, title: '최솟값과 최댓값', difficulty: 'Platinum 4', time_limit: 2000, memory_limit: 128,
      description: 'N개의 정수로 이루어진 배열이 있다. M개의 쿼리 (a, b)에 대해 a번째 수부터 b번째 수까지의 최솟값과 최댓값을 구하시오. (세그먼트 트리)',
      input_desc: '첫째 줄에 N, M (1 ≤ N, M ≤ 100,000), 이후 N개의 정수, M개의 쿼리가 주어진다.',
      output_desc: '각 쿼리에 대해 최솟값과 최댓값을 공백으로 구분하여 출력한다.',
      sample_input: '10 4\n75 30 100 38 50 51 52 20 81 5\n1 10\n3 5\n6 9\n8 10', sample_output: '5 100\n38 100\n20 81\n5 81',
      constraints: '1 ≤ N, M ≤ 100,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '10 4\n75 30 100 38 50 51 52 20 81 5\n1 10\n3 5\n6 9\n8 10', output: '5 100\n38 100\n20 81\n5 81' },
        { input: '3 2\n1 2 3\n1 3\n2 2', output: '1 3\n2 2' }
      ])
    },
    { id: 10986, title: '나머지 합', difficulty: 'Platinum 3', time_limit: 3000, memory_limit: 512,
      description: 'N개의 수 A1, A2, ..., AN이 주어질 때 연속된 부분 구간의 합이 M으로 나누어 떨어지는 구간의 개수를 구하시오.\n누적 합과 비둘기집 원리를 활용하시오.',
      input_desc: '첫째 줄에 N, M (1 ≤ N ≤ 10^6, 2 ≤ M ≤ 10^3), 둘째 줄에 N개의 수가 주어진다.',
      output_desc: '조건을 만족하는 구간의 개수를 출력한다.',
      sample_input: '5 3\n1 2 3 1 2', sample_output: '7',
      constraints: '1 ≤ N ≤ 1,000,000, 2 ≤ M ≤ 1,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '5 3\n1 2 3 1 2', output: '7' },
        { input: '1 1\n0', output: '1' },
        { input: '4 2\n2 4 6 8', output: '10' }
      ])
    },
    // ───── Diamond ─────
    { id: 1208, title: '부분수열의 합 2', difficulty: 'Diamond 5', time_limit: 1000, memory_limit: 256,
      description: 'N개의 정수로 이루어진 수열이 있을 때, 크기가 양수인 부분수열 중에서 그 수열의 원소를 다 더한 값이 S가 되는 경우의 수를 구하시오.\n반드시 Meet in the Middle 기법을 사용해야 시간 내에 해결할 수 있다.',
      input_desc: '첫째 줄에 N (1 ≤ N ≤ 40)과 S (-10^12 ≤ S ≤ 10^12), 둘째 줄에 N개의 정수가 주어진다.',
      output_desc: '합이 S가 되는 부분수열의 개수를 출력한다.',
      sample_input: '5 0\n-7 -3 -2 5 8', sample_output: '1',
      constraints: '1 ≤ N ≤ 40, -10^12 ≤ S ≤ 10^12',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '5 0\n-7 -3 -2 5 8', output: '1' },
        { input: '4 5\n1 2 3 4', output: '2' },
        { input: '1 1\n1', output: '1' }
      ])
    },
    { id: 2261, title: '가장 가까운 두 점', difficulty: 'Diamond 4', time_limit: 10000, memory_limit: 256,
      description: '2차원 평면 위에 n개의 점이 주어질 때, 거리가 가장 가까운 두 점을 구하시오. 거리의 제곱을 출력한다.\n분할 정복 또는 스위핑 알고리즘을 사용해야 한다. O(n log n)이 요구된다.',
      input_desc: '첫째 줄에 n (2 ≤ n ≤ 100,000), 이후 n개의 줄에 두 정수 x, y가 주어진다. (-10,000 ≤ x, y ≤ 10,000)',
      output_desc: '가장 가까운 두 점의 거리의 제곱을 출력한다.',
      sample_input: '4\n0 0\n1 0\n3 0\n4 0', sample_output: '1',
      constraints: '2 ≤ n ≤ 100,000',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '4\n0 0\n1 0\n3 0\n4 0', output: '1' },
        { input: '2\n0 0\n3 4', output: '25' },
        { input: '3\n0 0\n0 1\n100 100', output: '1' }
      ])
    }
  ];
  let added = 0;
  problems.forEach(p => {
    if (!db.getProblemById(p.id)) { db.insertProblem(p); added++; }
  });
  if (added > 0) console.log(`✅ ${added} problems added`);
}

function seedUsers() {
  const hash = bcrypt.hashSync('password123', 10);
  db.createUser({ username: 'admin', email: 'admin@judge.kr', password: hash, solved_count: 5, role: 'superadmin', permissions: [] });
  db.createUser({ username: 'testuser', email: 'test@judge.kr', password: hash, solved_count: 3, role: 'user', permissions: [] });
  console.log('✅ Users seeded (password: password123)');
}

module.exports = { db, initDB };
