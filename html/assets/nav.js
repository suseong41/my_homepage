// 지금 보고 있는 페이지의 메뉴 항목을 표시한다.
// 홈의 #링크는 건너뛴다 — 경로가 모두 "/" 라 전부 켜져 버린다.
for (const a of document.querySelectorAll('nav a')) {
  const u = new URL(a.href);
  if (!u.hash && u.pathname === location.pathname) a.classList.add('active');
}
