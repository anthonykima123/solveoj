import { prepareCpuReview } from './cpu-review.mjs';
import { reviewRequest, parseReview } from './local-review.mjs';

const MODEL = 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC';
const form = document.querySelector('[data-local-review]');
const start = form.querySelector('[data-local-start]');
const cancel = form.querySelector('[data-local-cancel]');
const status = form.querySelector('[data-status]');
const progress = form.querySelector('[data-local-progress]');
const output = document.querySelector('[data-local-result]');
let engine;
let worker;
let active;
let cpuClient;
let completeCpu;
const compatible = Boolean(window.Worker && window.WebAssembly);

function readInput() {
  const fields = new FormData(form);
  const input = {
    kind: form.dataset.localReview,
    problem: fields.get('problem').trim(),
    answer: fields.get('answer').trim(),
    context: fields.get('context').trim()
  };
  if (input.kind === 'math') input.max = Number(fields.get('max'));
  else input.language = fields.get('language');
  if (!input.problem || !input.answer ||
      input.problem.length + input.answer.length + input.context.length > Number(form.dataset.max) ||
      (input.kind === 'math' && (!Number.isInteger(input.max) || input.max < 1 || input.max > 100))) {
    return null;
  }
  return input;
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function renderReview(result, input) {
  output.replaceChildren(element('p', completeCpu ? '브라우저 AI · Qwen3 (CPU)' : '브라우저 AI · Qwen2.5', 'sx-kicker'),
    element('h2', '풀이 피드백'), element('p', result.summary));
  if (input.kind === 'math') {
    output.append(element('p', '예상 점수 ' + result.score + ' / ' + input.max + '점 · 검토용', 'sx-muted'));
  } else output.append(element('p', '정적 분석 · 코드 실행 없음', 'sx-muted'));
  for (const issue of result.findings) {
    const card = element('div', '', 'sx-callout');
    card.append(element('strong', issue.where), element('p', issue.reason));
    output.append(card);
  }
  output.append(element('p', 'AI의 설명과 점수는 틀릴 수 있습니다. 중요한 판단은 원문과 직접 대조하세요.', 'sx-muted'));
  output.hidden = false;
  output.focus();
}

function resetEngine() {
  worker?.terminate();
  worker = undefined;
  engine = undefined;
  completeCpu = undefined;
  const client = cpuClient;
  cpuClient = undefined;
  void client?.exit().catch(() => {});
}

async function prepare(signal) {
  if (engine || completeCpu) return;
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
  if (!adapter) {
    completeCpu = await prepareCpuReview(signal, ratio => {
      if (signal.aborted) return;
      progress.value = Math.min(1, Math.max(0, ratio));
      status.textContent = 'CPU 모델 준비 중 · ' + Math.round(progress.value * 100) + '%';
    }, client => { cpuClient = client; });
    return;
  }
  if (signal.aborted) throw signal.reason;
  const { CreateWebWorkerMLCEngine } = await import('/vendor/web-llm-0.2.89.js');
  if (signal.aborted) throw signal.reason;
  worker = new Worker(new URL('./local-ai-worker.mjs', import.meta.url), { type: 'module' });
  const failed = new Promise((resolve, reject) => {
    worker.addEventListener('error', () => reject(new Error('worker_failed')), { once: true });
  });
  const prepared = await Promise.race([failed, CreateWebWorkerMLCEngine(worker, MODEL, {
    initProgressCallback(report) {
      if (!signal.aborted && Number.isFinite(report.progress)) {
        progress.value = Math.min(1, Math.max(0, report.progress));
        status.textContent = '모델 준비 중 · ' + Math.round(progress.value * 100) + '%';
      }
    }
  }, { context_window_size: 4096 })]);
  if (signal.aborted) throw signal.reason;
  engine = prepared;
}

if (!compatible) {
  status.textContent = '이 브라우저에서는 로컬 AI를 실행할 수 없습니다. 위 반례 검증 문제는 바로 사용할 수 있습니다.';
} else {
  start.disabled = false;
}

cancel.addEventListener('click', () => active?.abort('cancelled'));
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!compatible || active) return;
  const input = readInput();
  if (!input) {
    status.textContent = '문제와 풀이를 입력하고 전체 글자 수 및 배점을 확인해 주세요.';
    return;
  }
  const controller = new AbortController();
  const { signal } = controller;
  active = controller;
  const stopped = new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error(signal.reason)), { once: true });
  });
  const timer = setTimeout(() => controller.abort('timeout'), 600000);
  output.hidden = true;
  start.disabled = true;
  cancel.hidden = false;
  progress.hidden = Boolean(engine || completeCpu);
  progress.removeAttribute('value');
  status.textContent = '기기에서 모델을 준비하고 있습니다…';
  try {
    await Promise.race([stopped, prepare(signal)]);
    progress.hidden = true;
    status.textContent = '입력한 풀이를 브라우저에서 분석하고 있습니다…';
    const reply = await Promise.race([stopped, completeCpu ? completeCpu(reviewRequest(input), signal) : engine.chat.completions.create(reviewRequest(input))]);
    renderReview(parseReview(reply, input), input);
    status.textContent = '분석이 완료되었습니다.';
  } catch (error) {
    const messages = {
      cancelled: '분석을 취소했습니다.',
      timeout: '모델 준비 또는 분석에 시간이 너무 오래 걸렸습니다. 연결 상태를 확인하고 다시 시도해 주세요.',
      invalid_review: '모델 응답을 읽을 수 없습니다. 풀이를 짧게 줄여 다시 시도해 주세요.'
    };
    status.textContent = messages[error.message] || '기기에서 AI를 실행하지 못했습니다. 위 반례 검증 문제는 모델 다운로드 없이 사용할 수 있습니다.';
    resetEngine();
  } finally {
    clearTimeout(timer);
    active = undefined;
    start.disabled = false;
    cancel.hidden = true;
    progress.hidden = true;
  }
});
