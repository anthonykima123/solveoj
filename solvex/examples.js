module.exports = {
  math: {
    problem: '임의의 자연수 n에 대해 n(n+1)이 짝수임을 증명하시오.',
    answer: 'n=1이면 1×2=2, n=2이면 2×3=6이다. 따라서 모든 자연수에서 성립한다.',
    max: 7,
    result: { min: 1, max: 2, summary: '두 예시를 올바르게 계산했지만 모든 자연수에 대한 결론은 아직 증명되지 않았습니다.', strengths: '작은 값으로 명제의 의미를 확인했습니다.', issues: [{ location: '마지막 문장', type: '일반화 오류', reason: '유한한 예시만으로 모든 자연수에 대한 명제를 증명할 수 없습니다.', fix: 'n의 홀짝에 따라 어느 인수가 짝수인지 설명하세요.' }], hints: ['결론 직전의 근거를 확인하세요.', '연속한 두 정수의 홀짝을 생각해 보세요.', 'n이 짝수인 경우와 홀수인 경우로 나누세요.', 'n이 짝수면 n이, 홀수면 n+1이 짝수이므로 곱은 짝수입니다.'], uncertainty: 'SOLVEX 자체 기준을 사용한 고정 예시입니다.', complexity: '', counterexample: '', transcription: '' }
  },
  code: {
    problem: '정수 N개 중 최댓값을 출력하세요. 모든 원소가 음수일 수 있습니다.',
    answer: 'int best = 0;\nfor (int x : values) {\n  if (x > best) best = x;\n}\ncout << best;',
    result: { min: 0, max: 0, summary: '모든 원소가 음수이면 최댓값이 0으로 남습니다.', strengths: '배열을 한 번 순회합니다.', issues: [{ location: '1행', type: '초기화 오류', reason: '0은 입력에 없는 값일 수 있습니다.', fix: '배열이 비어 있지 않다면 첫 원소로 시작하세요.' }], hints: ['1행의 초깃값을 보세요.', '음수만 있는 배열을 생각해 보세요.', '첫 원소와 최댓값 후보의 관계를 확인하세요.'], uncertainty: '고정 예시이며 코드를 실행하지 않았습니다.', complexity: '시간 O(N), 추가 공간 O(1)', counterexample: '입력 배열 [-5, -2, -8] → 예상 정답 -2, 코드 추정 출력 0', transcription: '' }
  }
};
