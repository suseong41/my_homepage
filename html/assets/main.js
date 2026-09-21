// 홈 화면 — 저장소 · 블로그 목록과 README 모달.
// CSP 를 켜기 위해 인라인 스크립트와 onclick 을 걷어내고 DOM API 로 그린다.

const LANG_COLORS = {
  'C++': '#f34b7d', 'C': '#555555', 'Python': '#3572A5',
  'JavaScript': '#f1e05a', 'TypeScript': '#3178c6',
  'Go': '#00ADD8', 'Rust': '#dea584', 'Java': '#b07219',
  'Shell': '#89e051', 'HTML': '#e34c26', 'CSS': '#563d7c',
};

const CATEGORY_COLORS = [
  { bg: '#eff6ff', color: '#1d4ed8' },
  { bg: '#f0fdf4', color: '#15803d' },
  { bg: '#fdf4ff', color: '#7e22ce' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#fdf2f8', color: '#be185d' },
  { bg: '#f0fdfa', color: '#0f766e' },
];

const categoryColorMap = {};
let colorIndex = 0;

function getCategoryStyle(category) {
  if (!category) return { bg: '#f1f5f9', color: '#475569' };
  if (!categoryColorMap[category]) {
    categoryColorMap[category] = CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length];
    colorIndex++;
  }
  return categoryColorMap[category];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function message(container, text) {
  container.replaceChildren(el('p', 'loading', text));
}

// 스크롤에 따라 사이드바 항목을 표시한다.
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a');

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    navLinks.forEach(a => a.classList.remove('active'));
    const active = document.querySelector(`nav a[href="/#${entry.target.id}"]`);
    if (active) active.classList.add('active');
  }
}, { threshold: 0.4 });

sections.forEach(s => observer.observe(s));

function expandBar(onExpand, onCollapse) {
  const bar = el('div', 'expand-bar', '+ 더 보기');
  let expanded = false;
  bar.addEventListener('click', () => {
    if (expanded) {
      onCollapse();
      bar.textContent = '+ 더 보기';
    } else {
      onExpand();
      bar.textContent = '- 접기';
    }
    expanded = !expanded;
  });
  return bar;
}

// ── 저장소 ─────────────────────────────

function repoCard(repo, extra) {
  const card = el('div', extra ? 'repo-card repo-extra' : 'repo-card');
  card.dataset.name = repo.name;   // 클릭은 목록에서 한 번만 듣는다
  card.dataset.url = repo.url;

  card.append(el('div', 'repo-name', repo.name));
  card.append(el('div', 'repo-desc', repo.description || '설명 없음'));

  const meta = el('div', 'repo-meta');
  if (repo.language) {
    const lang = el('span', 'repo-lang');
    const dot = el('span', 'lang-dot');
    dot.style.background = LANG_COLORS[repo.language] || '#94a3b8'; // 속성이 아니라 CSSOM
    lang.append(dot, document.createTextNode(repo.language));
    meta.append(lang);
  }
  if (repo.stars > 0) meta.append(el('span', 'repo-stars', `★ ${repo.stars}`));
  meta.append(el('span', 'repo-updated', repo.updated_at));

  card.append(meta);
  return card;
}

const repoBox = document.getElementById('repos');

repoBox.addEventListener('click', e => {
  const card = e.target.closest('.repo-card');
  if (card) openReadme(card.dataset.name, card.dataset.url);
});

fetch('/api/repos')
  .then(r => r.json())
  .then(data => {
    const repos = data.repos;
    if (!repos.length) return message(repoBox, '레포지토리가 없습니다.');

    const limit = 4;
    repoBox.replaceChildren(...repos.slice(0, limit).map(r => repoCard(r, false)));
    if (repos.length <= limit) return;

    const bar = expandBar(
      () => bar.before(...repos.slice(limit).map(r => repoCard(r, true))),
      () => repoBox.querySelectorAll('.repo-extra').forEach(n => n.remove()),
    );
    repoBox.append(bar);
  })
  .catch(() => message(repoBox, '불러오지 못했습니다.'));

// ── README 모달 ────────────────────────

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalLink = document.getElementById('modal-link');
const modalBody = document.getElementById('modal-body');

function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function openReadme(name, url) {
  modalTitle.textContent = name;
  modalLink.href = url;
  message(modalBody, 'README를 불러오는 중...');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  fetch(`/api/repos/${encodeURIComponent(name)}/readme`)
    .then(r => r.json())
    .then(data => { modalBody.innerHTML = marked.parse(data.content); })
    .catch(() => message(modalBody, 'README를 불러오지 못했습니다.'));
}

document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── 블로그 ─────────────────────────────

function postCard(post, extra) {
  const card = el('a', extra ? 'post-card post-extra' : 'post-card');
  card.href = post.link;
  card.target = '_blank';
  card.rel = 'noopener';

  const { bg, color } = getCategoryStyle(post.category);
  const tag = el('span', 'post-category', post.category || '기타');
  tag.style.background = bg;
  tag.style.color = color;

  card.append(tag, el('span', 'post-title', post.title), el('span', 'post-date', post.pubDate));
  return card;
}

const postBox = document.getElementById('posts');

fetch('/api/posts')
  .then(r => r.json())
  .then(data => {
    const posts = data.posts;
    if (!posts.length) return message(postBox, '글이 없습니다.');

    const limit = 5;
    postBox.replaceChildren(...posts.slice(0, limit).map(p => postCard(p, false)));
    if (posts.length <= limit) return;

    const bar = expandBar(
      () => bar.before(...posts.slice(limit).map(p => postCard(p, true))),
      () => postBox.querySelectorAll('.post-extra').forEach(n => n.remove()),
    );
    postBox.append(bar);
  })
  .catch(() => message(postBox, '글을 불러오지 못했습니다.'));
