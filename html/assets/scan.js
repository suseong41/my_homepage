// 스캔 결과는 남의 페이지에서 온 문자열이다 — 전부 textContent 로만 넣는다.

const SEV_CLASS = { HIGH: 'sev-high', MEDIUM: 'sev-medium', LOW: 'sev-low', INFO: 'sev-info' };
const STAGE_NAME = { fetch: '가져오기', scan: '파싱 · 규칙' };

// naver.com -> https://naver.com
function normalizeURL(raw) {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s;
  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.href;
}

function line(container, text, className) {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  container.appendChild(p);
  return p;
}

// ── 로그 패널 ─────────────────────────────

const engine = {
  box: document.getElementById('engine'),
  lines: document.getElementById('engine-lines'),
  status: document.getElementById('engine-status'),

  reset() {
    this.lines.replaceChildren();
    this.box.hidden = false;
    this.setStatus('RUNNING', '');
    this.cursor = line(this.lines, '');
    this.cursor.appendChild(document.createElement('span')).className = 'cursor';
  },
  add(text, className = 'tag', label) {
    const p = line(this.lines, text, className);
    if (label) p.dataset.label = label; // [HIGH] 처럼 앞에 붙는다

    this.lines.insertBefore(this.cursor, null); // 커서를 늘 맨 아래로
    this.lines.scrollTop = this.lines.scrollHeight;
    return p;
  },
  setStatus(text, className) {
    this.status.textContent = text;
    this.status.className = `engine-status ${className}`;
  },
  end(text, className) {
    this.cursor.remove();
    this.setStatus(text, className);
  },
};

// ── 결과 표 ───────────────────────────────

// 표는 자세한 내용(제목·증거)만 맡는다. 무엇을 찾았는지는 터미널이 말한다.
function renderScan(container, data) {
  container.replaceChildren();
  if (data.findings.length === 0) return;

  const table = document.createElement('table');
  table.className = 'scan-table';
  for (const f of data.findings) {
    const row = table.insertRow();

    const sev = document.createElement('span');
    sev.className = `sev ${SEV_CLASS[f.severity] ?? 'sev-info'}`; // 등급은 목록에서만 고른다
    sev.textContent = f.severity;
    row.insertCell().appendChild(sev);

    row.insertCell().textContent = `${f.line}:${f.col}`;
    row.cells[1].className = 'where';
    row.insertCell().textContent = f.code;
    row.cells[2].className = 'code';

    const what = row.insertCell();
    what.textContent = f.title;
    const ev = document.createElement('div');
    ev.className = 'code';
    ev.textContent = f.evidence;
    what.appendChild(ev);
  }
  container.appendChild(table);
}

// ── 흘려받기 ───────────────────────────────

function show(ev, startText) {
  const name = STAGE_NAME[ev.name] ?? ev.name;
  switch (ev.t) {
    case 'start':
      engine.add(startText ?? `요청 — ${ev.url}`);
      if (startText && ev.url) engine.add(`출처로 삼은 주소 — ${ev.url}`);
      break;
    case 'begin':
      engine.add(`===== ${name} =====`, 'head');
      break;
    case 'end':
      engine.add(`${ev.text} · ${ev.ms ?? 0} ms`);
      if (ev.final && ev.final !== ev.url) engine.add(`최종 주소 ${ev.final}`);
      break;
    case 'done':
      showResult(ev.result);
      engine.add(`완료 — 전체 ${ev.ms ?? 0} ms`);
      break;
    case 'error':
      engine.add(ev.text, 'bad');
      break;
  }
}

// 발견과 참고를 로그에 찍는다 — 등급·위치·규칙까지만, 증거는 표가 맡는다.
function showResult(result) {
  engine.add('===== 결과 =====', 'head');
  for (const note of result.notes) engine.add(note, 'note');

  if (result.findings.length === 0) {
    engine.add(result.notes.length > 0
      ? '발견 없음 — 다만 위 참고 때문에 이 결과가 페이지 전체를 대표하지 않습니다'
      : '발견 없음');
    return;
  }
  for (const f of result.findings) {
    engine.add(`${f.line}:${f.col}  ${f.code}`, `lv ${SEV_CLASS[f.severity] ?? 'sev-info'}`, f.severity);
  }
}

// 줄 단위 JSON 을 받아 하나씩 넘긴다.
async function readLines(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const raw = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (raw) onEvent(JSON.parse(raw));
    }
  }
}

async function runScan(payload, onEvent) {
  let res;
  try {
    res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/x-ndjson' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: '서버에 연결하지 못했습니다.' };
  }

  // 거절은 흘리기 전에 오므로 평소 JSON 이다.
  if (!res.ok) {
    const isJSON = (res.headers.get('Content-Type') || '').startsWith('application/json');
    const body = isJSON ? await res.json().catch(() => null) : null;
    const byStatus = {
      413: '요청이 너무 큽니다.',
      429: '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.',
      502: '그 주소를 가져오지 못했습니다.',
      503: '지금 검사 중인 요청이 많습니다. 잠시 후 다시 시도하세요.',
    };
    return { ok: false, message: body?.error ?? byStatus[res.status] ?? `요청이 실패했습니다 (${res.status}).` };
  }

  let result = null;
  let failed = null;
  await readLines(res, (ev) => {
    onEvent(ev);
    if (ev.t === 'done') result = ev.result;
    if (ev.t === 'error') failed = ev.text;
  });
  if (failed) return { ok: false, message: failed };
  if (!result) return { ok: false, message: '응답이 중간에 끊겼습니다.' };
  return { ok: true, data: result };
}

async function start(payload, startText) {
  const button = document.getElementById('scan-button');
  const result = document.getElementById('scan-result');

  result.replaceChildren();
  button.disabled = true;
  engine.reset();

  const out = await runScan(payload, (ev) => show(ev, startText));
  if (out.ok) {
    engine.end('DONE', 'done');
    renderScan(result, out.data);
  } else {
    engine.end('FAILED', 'bad');
    line(result, out.message, 'scan-note');
  }
  button.disabled = false;
}

document.getElementById('scan-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = normalizeURL(document.getElementById('scan-url').value);
  if (!url) {
    const result = document.getElementById('scan-result');
    result.replaceChildren();
    line(result, 'http 또는 https 주소를 넣어 주세요.', 'scan-note');
    return;
  }
  start({ url });
});

// ── 샘플 ──────────────────────────────────

const sample = {
  box: document.getElementById('sample-modal'),
  title: document.getElementById('sample-title'),
  body: document.getElementById('sample-body'),
  current: null,

  open(s) {
    this.current = s;
    this.title.textContent = s.title;
    const pre = document.createElement('pre');
    pre.appendChild(document.createElement('code')).textContent = s.html.join('\n');
    this.body.replaceChildren(pre);
    this.box.classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  close() {
    this.box.classList.remove('open');
    document.body.style.overflow = '';
  },
};

document.getElementById('sample-close').addEventListener('click', () => sample.close());
sample.box.addEventListener('click', (e) => { if (e.target === sample.box) sample.close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') sample.close(); });

document.getElementById('sample-run').addEventListener('click', () => {
  const s = sample.current;
  sample.close();
  start({ html: s.html.join('\n'), url: s.url }, `샘플 — ${s.title}`);
});

fetch('/assets/samples.json')
  .then((r) => r.json())
  .then(({ samples }) => {
    const row = document.getElementById('sample-row');
    samples.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `샘플 ${i + 1}`;
      b.addEventListener('click', () => sample.open(s));
      row.appendChild(b);
    });
    row.hidden = false;
  })
  .catch(() => {});
