(() => {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('solvex-theme');
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch {}
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const syncTheme = () => themeToggle?.setAttribute('aria-pressed', String(root.dataset.theme === 'light'));
  syncTheme();
  themeToggle?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    syncTheme();
    try { localStorage.setItem('solvex-theme', root.dataset.theme); } catch {}
  });
  for (const menu of document.querySelectorAll('.sx-menu')) {
    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }
  const form = document.querySelector('[data-lens]');
  if (!form) return;
  const fields = ['problem', 'answer', 'context'].map(name => form.elements.namedItem(name));
  const count = form.querySelector('[data-count]');
  const updateCount = () => {
    const length = fields.reduce((total, input) => total + input.value.trim().length, 0);
    count.textContent = length + ' / ' + form.dataset.max + '자';
    return length;
  };
  form.addEventListener('input', updateCount);
  updateCount();
  const image = form.elements.namedItem('image');
  const drop = form.querySelector('[data-drop]');
  const photo = form.querySelector('[data-photo]');
  let preview;
  if (image) {
    const showPhoto = file => {
      if (preview) URL.revokeObjectURL(preview);
      photo.hidden = true;
      const valid = file && ['image/png', 'image/jpeg'].includes(file.type) && file.size <= 1048576;
      form.querySelector('[data-file]').textContent = valid ? file.name : file ? '1MB 이하의 PNG 또는 JPEG를 선택하세요.' : '';
      if (!valid) {
        image.value = '';
        return;
      }
      preview = URL.createObjectURL(file);
      photo.src = preview;
      photo.hidden = false;
    };
    const attach = files => {
      const selected = new DataTransfer();
      selected.items.add(files[0]);
      image.files = selected.files;
      showPhoto(files[0]);
    };
    image.addEventListener('change', () => showPhoto(image.files[0]));
    drop.addEventListener('dragover', event => event.preventDefault());
    drop.addEventListener('drop', event => {
      event.preventDefault();
      if (event.dataTransfer.files.length) attach(event.dataTransfer.files);
    });
    form.addEventListener('paste', event => {
      const files = event.clipboardData.files;
      if (files.length && files[0].type.startsWith('image/')) {
        event.preventDefault();
        attach(files);
      }
    });
  }
  const status = form.querySelector('[data-status]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!status) return;
    if (updateCount() > Number(form.dataset.max)) {
      status.textContent = '입력 길이를 줄여 주세요.';
      return;
    }
    const button = form.querySelector('button[type=submit]');
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = '풀이를 분석하고 있습니다…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'X-Solvex-Token': form.dataset.token } });
      const payload = await response.json();
      if (!response.ok) {
        status.textContent = payload.error;
      } else {
        window.location.assign(payload.url);
      }
    } catch {
      status.textContent = '요청에 실패했습니다. 다시 로그인하거나 잠시 후 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });
})();
