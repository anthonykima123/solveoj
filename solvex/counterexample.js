const problem = '모든 음이 아닌 정수 n에 대해 n²+n+41은 소수라는 주장에 반례를 제시하세요. 값이 합성수임을 두 인수의 곱으로 증명하세요.';

function checkCounterexample(fields = {}) {
  const values = ['n', 'first', 'second'].map(key => typeof fields[key] === 'string' ? fields[key].trim() : '');
  if (!values.every(value => /^-?\d{1,18}$/.test(value))) {
    return { valid: false, status: 'input', location: '제출 값', reason: '각 칸에 18자리 이내의 정수를 입력하세요.' };
  }
  const [n, first, second] = values.map(BigInt);
  if (n < 0n) return { valid: false, status: 'check', location: 'n', reason: 'n은 음이 아닌 정수여야 합니다.' };
  if (first <= 1n || second <= 1n) {
    return { valid: false, status: 'check', location: '두 인수', reason: '두 인수가 모두 1보다 커야 이 값이 합성수임을 보일 수 있습니다.' };
  }
  const value = n * n + n + 41n;
  if (first * second !== value) {
    return { valid: false, status: 'check', location: '인수의 곱', reason: '입력한 두 인수의 곱이 n²+n+41의 값과 일치하지 않습니다.' };
  }
  return { valid: true, status: 'check', location: '반례 확인', reason: '입력한 두 인수의 곱이 계산값과 같고 두 인수가 1보다 크므로, 모든 n에서 소수라는 주장에 대한 반례가 맞습니다.' };
}

module.exports = { problem, checkCounterexample };
