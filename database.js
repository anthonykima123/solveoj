const JsonDB = require('./jsondb');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new JsonDB(path.join(__dirname, 'judge.db.json'));

function initDB() {
  if (db._d.problems.length === 0) seedProblems();
  if (db._d.users.length === 0) seedUsers();
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
    { id: 2309, title: '일곱 난쟁이', difficulty: 'Bronze 3', time_limit: 2000, memory_limit: 256,
      description: '8명 중 키의 합이 100이 되는 7명을 찾아 오름차순으로 출력하시오.',
      input_desc: '여덟 난쟁이의 키가 각각 한 줄씩 주어진다. (모든 키 ≤ 100)',
      output_desc: '일곱 난쟁이의 키를 오름차순으로 출력한다.',
      sample_input: '20\n7\n23\n19\n10\n15\n25\n30', sample_output: '7\n10\n15\n19\n20\n23\n25',
      constraints: '모든 키 ≤ 100',
      submission_count: 0, accepted_count: 0,
      test_cases: JSON.stringify([
        { input: '20\n7\n23\n19\n10\n15\n25\n30', output: '7\n10\n15\n19\n20\n23\n25' }
      ])
    },
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
        { input: '1000000', output: '1345' }
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
        { input: '6 4\n-1 0 0 0 0 0\n-1 0 0 0 0 0\n-1 0 0 0 0 0\n-1 0 0 0 0 1', output: '8' },
        { input: '2 2\n1 1\n1 1', output: '0' },
        { input: '2 2\n-1 1\n1 0', output: '1' }
      ])
    }
  ];
  problems.forEach(p => db.insertProblem(p));
  console.log('✅ Problems seeded');
}

function seedUsers() {
  const hash = bcrypt.hashSync('password123', 10);
  db.createUser({ username: 'admin', email: 'admin@judge.kr', password: hash, solved_count: 5 });
  db.createUser({ username: 'testuser', email: 'test@judge.kr', password: hash, solved_count: 3 });
  console.log('✅ Users seeded (password: password123)');
}

module.exports = { db, initDB };
