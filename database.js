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
