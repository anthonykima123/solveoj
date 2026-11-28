(() => {
  const form = document.querySelector('[data-qwen-form]');
  if (!form) return;
  const button = form.querySelector('button[type=submit]');
  const status = form.querySelector('[data-qwen-status]');
  const result = document.querySelector('[data-qwen-result]');
  const headings = { error: '논리적 오류 후보', no_error_found: '검토 범위에서 오류를 찾지 못함', uncertain: '판단하기 어려움' };
  function line(tag, value) {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    const data = new URLSearchParams(new FormData(form));
    if (data.get('problem').trim().length + data.get('answer').trim().length > 4000) {
      status.textContent = '문제와 풀이 합계는 4,000자 이내여야 합니다.';
      return;
    }
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    result.hidden = true;
    status.textContent = 'Qwen이 풀이를 검토하고 있어요…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (response.redirected || response.status === 403) {
        status.replaceChildren('로그인하거나 페이지를 새로고침한 뒤 다시 시도해 주세요. ',
          Object.assign(line('a', '로그인'), { href: '/login?next=%2Flens%2Fmath%2Fqwen' }));
        return;
      }
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('unexpected_response');
      const payload = await response.json();
      if (!response.ok) {
        status.textContent = payload.error;
        return;
      }
      const review = payload.result;
      result.replaceChildren(line('h2', headings[review.status]));
      if (review.location) result.append(line('p', review.location));
      result.append(line('p', review.reason));
      result.hidden = false;
      result.focus();
      status.textContent = '';
    } catch {
      status.textContent = '검토 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
    } finally {
      form.removeAttribute('aria-busy');
      button.disabled = false;
    }
  });
})();
