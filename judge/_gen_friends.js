// 2026 KOI 1차 중1/고1 "친구" (#12491) - 테스트 케이스 생성기 (node)
// brute O(N^2) 와 fast O(N log N) 교차검증 후 케이스 출력
const fs = require('fs');

function brute(N, K1, K2, X, S) {
  const res = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let c = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const d = Math.abs(X[i] - X[j]);
      if (S[i] === S[j]) { if (d <= K1) c++; }
      else { if (d <= K2) c++; }
    }
    res[i] = c;
  }
  return res;
}

// lower_bound / upper_bound on sorted number array
function lb(a, v) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; }
function ub(a, v) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo; }

function fast(N, K1, K2, X, S) {
  const allx = X.slice().sort((a, b) => a - b);
  const sch = new Map();
  for (let i = 0; i < N; i++) {
    if (!sch.has(S[i])) sch.set(S[i], []);
    sch.get(S[i]).push(X[i]);
  }
  for (const arr of sch.values()) arr.sort((a, b) => a - b);
  const res = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const x = X[i];
    const all_k2 = ub(allx, x + K2) - lb(allx, x - K2);          // incl self
    const arr = sch.get(S[i]);
    const same_k2 = ub(arr, x + K2) - lb(arr, x - K2);           // incl self
    const same_k1 = ub(arr, x + K1) - lb(arr, x - K1);           // incl self
    res[i] = (all_k2 - same_k2) + (same_k1 - 1);
  }
  return res;
}

// 간단한 시드 RNG (재현성)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randint(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function sampleDistinct(rng, lo, hi, k) {
  const set = new Set();
  while (set.size < k) set.add(randint(rng, lo, hi));
  return [...set];
}
function eq(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

// ---- 교차검증 ----
let rng = mulberry32(12491);
for (let t = 0; t < 5000; t++) {
  const N = randint(rng, 2, 8);
  const K1 = randint(rng, 1, 12), K2 = randint(rng, 1, 12);
  const X = sampleDistinct(rng, 1, 29, N);
  const S = Array.from({ length: N }, () => randint(rng, 1, N));
  const b = brute(N, K1, K2, X, S), f = fast(N, K1, K2, X, S);
  if (!eq(b, f)) { console.error('MISMATCH', { N, K1, K2, X, S, b, f }); process.exit(1); }
}
console.log('cross-check OK (5000 random small cases)');

for (let t = 0; t < 50; t++) {
  const N = randint(rng, 50, 400);
  const K1 = randint(rng, 1, 1e9), K2 = randint(rng, 1, 1e9);
  const X = sampleDistinct(rng, 1, 1e9, N);
  const S = Array.from({ length: N }, () => randint(rng, 1, N));
  if (!eq(brute(N, K1, K2, X, S), fast(N, K1, K2, X, S))) { console.error('MED MISMATCH'); process.exit(1); }
}
console.log('cross-check OK (50 medium cases up to N=400)');

// ---- 케이스 빌드 ----
const cases = [];
function add(N, K1, K2, X, S) {
  const lines = [`${N} ${K1} ${K2}`];
  for (let i = 0; i < N; i++) lines.push(`${X[i]} ${S[i]}`);
  cases.push({ input: lines.join('\n'), output: fast(N, K1, K2, X, S).join(' ') });
}

// 1) 제공된 예제 2개
add(7, 3, 5, [9, 1, 14, 6, 17, 4, 8], [2, 1, 3, 2, 3, 1, 1]);
add(12, 8, 5, [31, 10, 49, 23, 62, 18, 40, 14, 55, 27, 45, 36], [1, 1, 3, 2, 3, 1, 2, 2, 2, 3, 1, 3]);

// 2) 엣지 케이스
add(2, 5, 1, [1, 3], [1, 1]);
add(2, 1, 5, [1, 4], [1, 2]);
add(2, 1, 1, [1, 100], [1, 2]);
add(3, 2, 2, [1, 3, 5], [1, 1, 1]);
add(4, 1000000000, 1, [1, 1000000000, 2, 999999999], [1, 1, 2, 2]);
add(5, 100, 1, [1, 2, 3, 50, 51], [1, 1, 2, 1, 2]);     // K1 > K2
add(6, 4, 1, [1, 2, 5, 9, 13, 20], [7, 7, 7, 7, 7, 7]); // 전부 같은 학교
add(6, 1, 6, [1, 3, 5, 7, 9, 11], [1, 2, 3, 4, 5, 6]);  // 전부 다른 학교

// 3) 랜덤 medium/large
function randCase(N, seed) {
  const r = mulberry32(seed);
  const K1 = randint(r, 1, 1e9), K2 = randint(r, 1, 1e9);
  const X = sampleDistinct(r, 1, 1e9, N);
  const S = Array.from({ length: N }, () => randint(r, 1, N));
  add(N, K1, K2, X, S);
}
[20, 80, 300, 1000, 2000, 3000].forEach((N, i) => randCase(N, 1000 + i));

function randCase2(N, seed, ksmall) {
  const r = mulberry32(seed);
  const K1 = ksmall ? randint(r, 1, 5) : 1e9;
  const K2 = ksmall ? randint(r, 1, 5) : 1e9;
  const X = sampleDistinct(r, 1, 1e9, N);
  const S = Array.from({ length: N }, () => randint(r, 1, 3)); // 학교 적게 -> 같은학교 충돌 多
  add(N, K1, K2, X, S);
}
randCase2(1500, 7001, true);
randCase2(1500, 7002, false);

console.log('total cases:', cases.length);
fs.writeFileSync(__dirname + '/_friends_cases.json', JSON.stringify(cases), 'utf8');
console.log('json bytes:', fs.statSync(__dirname + '/_friends_cases.json').size);
