// 오늘 날짜 기반으로 일일 문제 / 코인 2배 문제를 결정론적으로 뽑는다 (KST)
function kstDaySeed() {
  return Math.floor((Date.now() + 9 * 3600000) / 86400000);
}

function lcg(s) {
  return ((Math.imul(s, 1664525) + 1013904223) >>> 0);
}

function pickProblems(problems, seed, count) {
  if (!problems.length) return [];
  const result = [], used = new Set();
  let s = seed >>> 0;
  while (result.length < Math.min(count, problems.length)) {
    s = lcg(s);
    const idx = s % problems.length;
    if (!used.has(idx)) { used.add(idx); result.push(problems[idx]); }
  }
  return result;
}

function getDailyData(allPublicProblems) {
  const day = kstDaySeed();
  const daily = pickProblems(allPublicProblems, day, 1);
  const dailyIds = new Set(daily.map(p => p.id));
  const rest = allPublicProblems.filter(p => !dailyIds.has(p.id));
  const doubleCoins = pickProblems(rest, day ^ 0xdeadbeef, 2);
  const doubleCoinIds = new Set(doubleCoins.map(p => p.id));
  return { daily, doubleCoins, doubleCoinIds };
}

module.exports = { getDailyData, kstDaySeed };
