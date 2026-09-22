// 지금 보고 있는 페이지의 메뉴 항목을 표시한다.
for (const a of document.querySelectorAll('nav a')) {
  const u = new URL(a.href);
  if (!u.hash && u.pathname === location.pathname) a.classList.add('active');
}
