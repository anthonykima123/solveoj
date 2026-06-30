const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vm = require('vm');

const VERDICTS = {
  AC: '맞았습니다!!',
  WA: '틀렸습니다',
  TLE: '시간 초과',
  MLE: '메모리 초과',
  RE: '런타임 에러',
  CE: '컴파일 에러'
};

function runChecker(checkerCode, input, expected, actual) {
  try {
    const ctx = vm.createContext({ input, expected, actual });
    vm.runInContext(checkerCode, ctx, { timeout: 2000 });
    if (typeof ctx.check !== 'function') return false;
    return !!ctx.check(input, expected, actual);
  } catch (_) {
    return false;
  }
}

async function runCode(language, code, testCases, timeLimit = 2000, options = {}) {
  const id = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(os.tmpdir(), `judge_${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Compile step
    const compileResult = await compile(language, code, tmpDir, id);
    if (compileResult.error) {
      return {
        verdict: 'CE',
        verdictText: VERDICTS.CE,
        executionTime: 0,
        errorMessage: compileResult.error
      };
    }

    // Run each test case
    let totalTime = 0;
    for (const tc of testCases) {
      const result = await runTestCase(language, compileResult, tc.input, tmpDir, id, timeLimit);
      totalTime = Math.max(totalTime, result.time);

      if (result.verdict !== 'AC') {
        const expected = normalizeOutput(tc.output);
        const actual = normalizeOutput(result.output || '');
        return {
          verdict: result.verdict,
          verdictText: VERDICTS[result.verdict] || result.verdict,
          executionTime: result.time,
          errorMessage: result.error,
          expected,
          actual
        };
      }

      const rawExpected = tc.output;
      const rawActual = result.output || '';
      const expected = normalizeOutput(rawExpected);
      const actual = normalizeOutput(rawActual);

      const pass = (options.specialJudge && options.checkerCode)
        ? runChecker(options.checkerCode, tc.input, rawExpected, rawActual)
        : expected === actual;

      if (!pass) {
        return {
          verdict: 'WA',
          verdictText: VERDICTS.WA,
          executionTime: result.time,
          expected,
          actual
        };
      }
    }

    return {
      verdict: 'AC',
      verdictText: VERDICTS.AC,
      executionTime: totalTime,
      errorMessage: null
    };

  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function compile(language, code, tmpDir, id) {
  if (language === 'python') {
    const srcFile = path.join(tmpDir, `${id}.py`);
    fs.writeFileSync(srcFile, code, 'utf8');
    return { srcFile, error: null };
  }

  if (language === 'cpp') {
    const srcFile = path.join(tmpDir, `${id}.cpp`);
    const outFile = path.join(tmpDir, process.platform === 'win32' ? `${id}.exe` : id);
    fs.writeFileSync(srcFile, code, 'utf8');
    try {
      execSync(`g++ -O2 -o "${outFile}" "${srcFile}"`, { timeout: 15000, encoding: 'utf8' });
      return { outFile, error: null };
    } catch (e) {
      return { error: (e.stdout || '') + (e.stderr || '') || e.message };
    }
  }

  if (language === 'java') {
    const srcFile = path.join(tmpDir, 'Main.java');
    fs.writeFileSync(srcFile, code, 'utf8');
    try {
      execSync(`javac "${srcFile}"`, { timeout: 15000, encoding: 'utf8', cwd: tmpDir });
      return { classDir: tmpDir, error: null };
    } catch (e) {
      return { error: (e.stdout || '') + (e.stderr || '') || e.message };
    }
  }

  return { error: '지원하지 않는 언어입니다.' };
}

function runTestCase(language, compileResult, input, tmpDir, id, timeLimit) {
  return new Promise((resolve) => {
    let cmd, args;

    if (language === 'python') {
      cmd = process.platform === 'win32' ? 'python' : 'python3';
      args = [compileResult.srcFile];
    } else if (language === 'cpp') {
      cmd = compileResult.outFile;
      args = [];
    } else if (language === 'java') {
      cmd = 'java';
      args = ['-cp', compileResult.classDir, 'Main'];
    }

    const startTime = Date.now();
    let output = '';
    let errorOutput = '';
    let timedOut = false;
    let finished = false;

    let proc;
    try {
      proc = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeLimit + 500
      });
    } catch (e) {
      return resolve({ verdict: 'RE', output: '', time: 0, error: e.message });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGKILL'); } catch (_) {}
    }, timeLimit);

    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { errorOutput += d.toString(); });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const elapsed = Date.now() - startTime;

      if (timedOut || elapsed >= timeLimit) {
        return resolve({ verdict: 'TLE', output: '', time: elapsed, error: null });
      }
      if (code !== 0 && code !== null) {
        return resolve({ verdict: 'RE', output: '', time: elapsed, error: errorOutput });
      }
      resolve({ verdict: 'AC', output, time: elapsed, error: null });
    });

    proc.on('error', (e) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ verdict: 'RE', output: '', time: 0, error: e.message });
    });

    try {
      if (input && input.trim() !== '') {
        proc.stdin.write(input + '\n');
      }
      proc.stdin.end();
    } catch (_) {}
  });
}

function normalizeOutput(s) {
  // 줄 끝 공백과 양끝 빈 줄을 무시한다 (실제 온라인 저지 관행과 동일).
  return s.replace(/\r\n/g, '\n')
          .split('\n')
          .map(line => line.replace(/\s+$/, ''))
          .join('\n')
          .trim();
}

// 테스트 케이스 없이 자유 입력으로 실행 (온라인 컴파일러용)
async function runFreeCode(language, code, stdin = '', timeLimit = 5000) {
  const id = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(os.tmpdir(), `judge_${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const compileResult = await compile(language, code, tmpDir, id);
    if (compileResult.error) {
      return { verdict: 'CE', output: '', error: compileResult.error, time: 0 };
    }
    const result = await runTestCase(language, compileResult, stdin, tmpDir, id, timeLimit);
    return {
      verdict: result.verdict,
      output: result.output || '',
      error: result.error || '',
      time: result.time
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { runCode, runFreeCode, runChecker, VERDICTS };
