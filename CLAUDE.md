# CLAUDE.md — my_homepage

이 저장소(suseong.org)에서 Claude 가 지켜야 할 작업 방식과 제약.

> **SHA 저장소와 분리된 문서다.** 스캐너 자체의 설계 원칙·규칙·교시 기록은
> `/Users/suseong/test/suseong-html-analyzer/CLAUDE.md` 와 `DISCUSSION.md` 에 있다.
> 여기에는 **웹사이트를 작업하는 법**만 적는다.

---

## 1. 무엇인가

개인 포트폴리오 사이트. 정적 페이지 + 자체 API + 보안 스캐너(SHA)를 nginx 뒤에 묶어 Docker Compose 로 띄운다.

```
브라우저 ─443─▶ nginx ─┬─ /            정적 파일 (html/, SSI 로 사이드바 조립)
  (Cloudflare 뒤)      ├─ /api/scan    ▶ sha:8080   (별도 저장소의 이미지)
                       └─ /api/…       ▶ api:8000   (이 저장소의 Go)
```

| 경로 | 역할 |
|---|---|
| `html/index.html` | 홈. 저장소·블로그 카드, README 모달 |
| `html/_sidebar.html` | 사이드바. **SSI 로 모든 페이지에 포함된다** |
| `html/tools/sha/index.html` | SHA 검사 페이지 (URL 입력 · 샘플 5개 · 로그 패널 · 결과 표) |
| `html/assets/style.css` | 전체 스타일 한 파일 |
| `html/assets/main.js` | 홈 — 저장소·블로그 목록, README 모달 |
| `html/assets/scan.js` | SHA 페이지 — 검사 요청, NDJSON 수신, 샘플 모달, 결과 표 |
| `html/assets/nav.js` | 사이드바 활성 표시 (5줄) |
| `html/assets/samples.json` | 악성 샘플 5개 (**데이터로만 나간다** — 아래 4절) |
| `html/assets/vendor/marked.umd.js` | 직접 호스팅 · **18.0.13 고정** |
| `api/` | Go 표준 라이브러리만 쓰는 API (GitHub 저장소 목록 · 티스토리 RSS · README) |
| `nginx/nginx.conf` | 라우팅 · 보안 헤더 · 속도 제한 · Cloudflare real_ip · SSI |
| `docker-compose.yml` | nginx · api · sha |

`nginx/certs/`(비밀키)는 `.gitignore` 에 있다. **이 문서는 커밋한다** — 다른 곳에서 clone 해도 따라오게.

---

## 1-2. 페이지가 어떻게 도는가

### 사이드바는 서버가 붙인다 (SSI)

각 페이지는 `<body>` 바로 아래에 **이 한 줄**만 둔다.

```html
  <!--# include virtual="/_sidebar.html" -->
```

nginx 의 `location /` 에 `ssi on;` 이 있어서, 서버가 응답을 보내기 전에 `_sidebar.html` 을 끼워 넣는다.
**사이드바를 고칠 때는 `_sidebar.html` 한 곳만 고친다.** 페이지마다 복사하지 않는다.

### 어느 메뉴가 켜지는가

두 방식이 나뉘어 있다.

| 메뉴 | 누가 켜나 | 어떻게 |
|---|---|---|
| Info (`/#about` 같은 해시 링크) | `main.js` | `IntersectionObserver` 로 화면에 들어온 `section[id]` 을 보고 표시 |
| Tools (`/tools/sha/` 같은 경로 링크) | `nav.js` | **해시가 없고 `pathname` 이 같은** 링크에 `.active` |

```js
// nav.js — 전부다
for (const a of document.querySelectorAll('nav a')) {
  const u = new URL(a.href);
  if (!u.hash && u.pathname === location.pathname) a.classList.add('active');
}
```

`pathname` 을 **문자 그대로** 비교하므로 **끝 슬래시가 맞아야 한다** — 사이드바에 `/tools/sha` 로
적고 주소가 `/tools/sha/` 면 표시가 안 켜진다.

### 홈 (`index.html` + `main.js`)

```
/api/repos  ─▶ 저장소 카드 (4개 + "더 보기")
/api/posts  ─▶ 블로그 카드 (5개 + "더 보기")
카드 클릭 ─▶ /api/repos/{이름}/readme ─▶ marked.parse ─▶ 모달
```

클릭은 카드마다 붙이지 않고 **목록에서 한 번만 듣는다**(`repoBox.addEventListener` + `closest`).
카드에는 `data-name`·`data-url` 만 둔다 — CSP 때문에 `onclick` 을 쓸 수 없다.

### SHA 페이지 (`tools/sha/index.html` + `scan.js`)

```
URL 입력 → submit → normalizeURL()  →  start({url})
샘플 버튼 → 모달 → "이 샘플로 검사"  →  start({html, url})
                                          │
                        runScan(payload) ─┤ POST /api/scan
                                          │ Accept: application/x-ndjson
                                          ▼
                     readLines() ─ 줄마다 ─▶ show(ev)      로그 패널
                                   done ──▶ renderScan()   결과 표
```

- `start()` 하나가 **URL 검사와 샘플 검사를 모두** 처리한다. 다른 것은 보내는 본문과 첫 줄 문구뿐이다.
- 로그 패널(`#engine`)은 진행 상황을, 결과 표(`#scan-result`)는 제목·증거·설명을 맡는다.
- 발견 행을 누르면 그 아래 설명 행이 펼쳐진다(`data.rules` 가 있을 때만).

---

## 2. 작업 방식

### HTML · JS · CSS 는 Claude 가 직접 쓴다

2026-09-22 사용자 결정. 블록으로 제시하고 기다리지 않는다.

- **주석은 최소** — 한 줄 이내, 문서 참조(§번호·교시 번호) 금지. 구역 구분선(`// ── 샘플 ──`)은 유지한다.
- 무엇을 왜 바꿨는지는 **응답 본문에서** 설명한다. 파일 안 주석이 아니다.

### 나머지는 사용자가 친다

`api/*.go` · `nginx/nginx.conf` · `docker-compose.yml` · `Dockerfile` 은 **블록으로 제시**한다.
블록을 줄 때는 파일을 하이퍼링크로 적고, **붙일 자리 바로 위 줄을 함께** 보여 준다.

### 고치기 전에 확인한다

스크래치패드에 복사해 만들고 **브라우저로 눌러 본 뒤** 저장소에 넣는다(5절).
저장소를 실험장으로 쓰지 않는다.

---

## 3. 배포

```bash
# 로컬에서
git add -A && git commit -m "…" && git push

# 서버에서
git pull
docker compose pull sha        # 이미지 태그를 올렸을 때만
docker compose up -d sha
docker compose restart nginx   # nginx.conf 를 고쳤을 때만
```

| 무엇을 고쳤나 | 필요한 것 |
|---|---|
| `html/` 아래 정적 파일 | **`git pull` 만.** 바인드 마운트라 즉시 반영된다 |
| `nginx/nginx.conf` | 바인드 마운트지만 **`restart nginx` 가 필요하다** |
| `api/` | `docker compose build api && up -d api` |
| `sha` 버전 | **이미지가 Docker Hub 에 올라간 것을 확인한 뒤** compose 태그를 올린다 |

> **순서를 지킨다.** 이미지가 없는 상태로 compose 태그를 올려 커밋하면 서버가
> `pull access denied` 로 죽는다(2026-09-22 에 겪음). 반대로 **정적 파일이 먼저
> 올라가는 것은 안전하다** — 그리는 쪽이 옛 응답을 견디게 짜여 있다(4절).

확인은 **강력 새로고침**으로 한다. 브라우저가 옛 `.js`·`.css` 를 물고 있다.

---

## 4. 지켜야 할 규칙

### ① CSP 가 켜져 있다 (Report-Only 아님)

```
default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data: https:; connect-src 'self';
object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

따라서 **전부 금지**다 — 인라인 `<script>` · `onclick=` 같은 속성 · `style="…"` 속성 · 외부 스크립트.

- 이벤트는 `addEventListener` 로, 목록은 **위임**(`closest`)으로 붙인다.
- 스타일은 `el.style.x = …` 로 준다 — **CSSOM 은 CSP 가 막지 않는다.**
- 외부 라이브러리는 **받아서 `assets/vendor/` 에 두고 버전을 고정**한다.
  고정 안 한 CDN 주소는 조용히 다른 판으로 떨어진다(`marked` 가 18.x → 15.0.12 로 떨어져 있었다).
- `img-src` 만 `https:` 로 넓다 — README 배지가 여러 호스트에서 오고, 이미지는 실행되지 않는다.

### ② 스캔 결과는 남의 페이지에서 온 문자열이다

`evidence` · `title` · `url` · `notes` 는 **공격자가 고른 값**이다.

- **`textContent` · `createElement` 만.** `innerHTML` 과 템플릿 리터럴 금지.
- 예외는 README 모달의 `marked.parse` 한 곳뿐이다(자기 저장소 데이터).
- 등급은 **목록에서만 고른다** — 응답의 `severity` 를 클래스 이름에 그대로 넣지 않는다.
- 대상 URL 을 **클릭 가능한 링크로 만들지 않는다.**
- `notes` 가 있으면 "발견 없음"을 "안전"으로 보여주지 않는다(SPA 셸일 수 있다).

### ③ 악성 샘플은 페이지가 아니라 데이터로 나간다

`samples.json` 의 표본 5개는 의도적으로 이렇게 되어 있다.

| | |
|---|---|
| 정적 `.html` 로 두지 않는다 | 크롤러가 따라갈 **악성 페이지 주소가 없어야** 한다 (세이프브라우징) |
| 실제 시그니처를 담지 않는다 | 구조로만 발동시킨다. 주소는 `example.*` 과 `203.0.113.0/24` 뿐 |
| 페이지에 인라인하지 않는다 | 그러면 **이 사이트 자체가** 악성 마크업을 담은 페이지가 된다 |

**검사를 피하려고 조각내거나 인코딩하지 않는다.** 찾는 것이 되지 않을 뿐, 숨지 않는다.

### ④ 서버가 없을 때를 견딘다

정적 파일과 `sha` 이미지는 따로 배포된다. 페이지가 먼저 올라가면 옛 서버가 응답한다.
새 필드는 **없을 수 있다고 보고 그린다** — `data.rules?.[code]` 처럼.

---

## 4-2. Tool 을 하나 더 붙이려면

다섯 단계다. `tools/sha/` 가 그대로 본보기다.

### ① 페이지 — `html/tools/<이름>/index.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><이름> — suseong.org</title>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>

  <!--# include virtual="/_sidebar.html" -->

  <main>
    <section id="<이름>">
      <div class="section-label">Tools</div>
      <h2><이름></h2>
      <p class="scan-desc">한두 줄 설명.</p>

      <!-- 여기에 화면 -->
    </section>
  </main>

  <script src="/assets/<이름>.js"></script>
</body>
</html>
```

`<style>` · `<script>` 본문 · `onclick` 은 **쓸 수 없다**(CSP). 4절을 먼저 읽는다.

### ② 사이드바 — `html/_sidebar.html` 의 Tools 묶음에 한 줄

```html
    <nav class="nav-group">
      <div class="nav-label">Tools</div>
      <a href="/tools/sha/">SHA</a>
      <a href="/tools/<이름>/"><이름></a>
    </nav>
```

**끝 슬래시를 반드시 붙인다.** `nav.js` 가 `pathname` 을 문자 그대로 비교하므로,
없으면 그 페이지에서 메뉴 표시가 안 켜진다.

### ③ 스크립트 · 스타일

- 스크립트는 `html/assets/<이름>.js` 로 **파일을 따로** 둔다.
- 스타일은 **`style.css` 에 이어 붙인다**(파일 하나 원칙). 이름은 `.<이름>-…` 으로 시작해
  다른 화면과 섞이지 않게 한다 — 맨 클래스 이름은 샌다(6절).

### ④ 백엔드가 필요하면

**필요 없으면 하지 않는다.** 브라우저 안에서 끝나는 도구가 제일 싸고 안전하다.

필요하다면 `docker-compose.yml` 에 서비스를 더하고(`expose` 만, `ports` 금지),
`nginx.conf` 에 경로를 더한다.

```nginx
    location = /api/<이름>
    {
        client_max_body_size 4k;      # 필요한 만큼만
        limit_req zone=scan burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://<서비스>:<포트>;
    }
```

> **`location` 순서에 주의한다.** 정확 일치(`location = /api/x`)가 접두사(`location /api/`)보다
> 먼저 잡힌다. 새 경로에 `=` 를 빼면 **기존 `api` 서비스로 흘러간다.**
>
> 속도 제한을 새로 나누려면 `limit_req_zone` 을 파일 맨 위에 하나 더 만든다.
> `rate` 는 지속 속도, `burst` 는 사람이 연달아 누르는 횟수다(6절).

### ⑤ CSP 를 넓히기 전에 멈춘다

새 도구가 외부 자원을 쓴다면, **정책을 넓히는 것이 마지막 수단**이다.

1. 받아서 `assets/vendor/` 에 두고 버전을 고정할 수 있는가 → 그렇게 한다
2. 서버(우리 API)가 대신 받아 올 수 있는가 → 그렇게 한다
3. 그래도 안 되면 그때 `nginx.conf` 의 CSP 에 **그 출처만** 더한다

### 확인 목록

```
□ 사이드바가 보인다            (SSI — location / 의 ssi on 이 먹는다)
□ 그 메뉴에 표시가 켜진다       (nav.js — 끝 슬래시)
□ CSP 위반 0건                (헤드리스 Chrome, 5절)
□ 좁은 화면에서 안 깨진다       (사이드바가 고정폭이다)
□ 남의 데이터를 그린다면 textContent 만  (4절 ②)
```

---

## 5. 확인 방법

### 브라우저로 본다

**jsdom 은 CSP 를 강제하지 않는다.** 헤드리스 Chrome 이어야 한다.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --user-data-dir=<임시> \
  --enable-logging=stderr --v=1 --virtual-time-budget=20000 \
  --dump-dom <주소> > dom.html 2> err.txt
grep -ciE "content security policy|refused to" err.txt    # CSP 위반 수
```

- Chrome 이 **DOM 을 찍고도 종료하지 않는 일이 잦다.** 파일이 생기면 `pkill -f dump-dom` 로 세운다.
- `--virtual-time-budget` 은 **가상 시간**이다. 바깥 네트워크를 기다리는 확인에는 맞지 않는다.
- 상호작용(클릭)을 확인하려면 스크래치패드 사본에 **임시 하네스 페이지**를 만들어 자동 클릭시키고
  결과를 DOM 에 적게 한다. 운영에서는 CSP 가 인라인을 막아 이 방법을 쓸 수 없다.

### 로컬 스택

정적 서버(SSI 흉내 + `/api/scan` 프록시) + `cmd/webscan` 바이너리를 띄우면
운영과 같은 경로로 눌러 볼 수 있다. 바깥 사이트를 스캔하는 확인은 삼간다.

### 운영 확인

```bash
# 배포된 자산이 로컬과 같은가
curl -s https://suseong.org/assets/scan.js | shasum -a 256

# API 가 새 필드를 보내는가
curl -s -X POST https://suseong.org/api/scan -H 'Content-Type: application/json' \
  -d '{"html":"…","url":"https://a.example/"}'
```

### 대조군을 둔다

*"요소가 안 만들어졌다"* 는 **대조군이 요소를 만들어야** 뜻을 갖는다.
같은 문자열을 `innerHTML` 로 넣어 몇 개가 생기는지 함께 센다.

---

## 6. 반복해서 만난 함정

| 증상 | 원인 |
|---|---|
| **로컬은 CSP 위반 0인데 운영에서만 1건** | **앞단(Cloudflare)이 지나가는 HTML 을 고친다.** Web Analytics 비컨을 `Accept: text/html` 인 요청에만 끼워 넣어 **맨 `curl` 로는 안 보인다.** 운영 확인은 브라우저처럼 보이는 요청(`-A` + `Accept`)으로 한다 |
| `hidden` 을 붙였는데 보인다 | 작성자 규칙의 `display:` 가 브라우저 기본값 `[hidden]{display:none}` 을 **이긴다.** `display` 를 주는 클래스에는 `[hidden]` 규칙을 함께 적는다 |
| 엉뚱한 곳에 색이 깔린다 | **맨 클래스 선택자가 샌다.** 표의 알약용 `.sev-low{background}` 가 로그 줄(`lv sev-low`)까지 칠했다 → `.sev.sev-low` 로 좁힌다 |
| `grep -c` 결과가 눈에 보이는 수와 다르다 | `-c` 는 **일치한 줄 수**다. `--dump-dom` 은 한 줄이라 카드 4개가 `1` 로 나온다 — 개수는 `grep -o … \| wc -l` |
| 흘려받기가 한 번에 도착한다 | nginx 의 `proxy_buffering` 이 켜져 있다. `/api/scan` 에만 끄고 `proxy_http_version 1.1` 을 함께 준다 |
| 속도 제한이 너무 빨리 걸린다 | `rate` 가 아니라 **`burst`** 를 본다. `rate` 는 지속 속도, `burst` 는 사람이 몰아 누르는 것을 흡수한다. 화면에 버튼이 늘면 `burst` 도 늘려야 한다 |
| 서버가 `pull access denied` 로 죽는다 | 이미지가 올라가기 전에 compose 태그를 올렸다 (3절) |
| nginx 설정을 고쳤는데 그대로다 | 바인드 마운트라도 **`docker compose restart nginx`** 가 필요하다 |
| `ms` 가 `undefined` 로 찍힌다 | 서버가 0 을 `omitempty` 로 지운다. `ev.ms ?? 0` 으로 받는다 |
| 이름이 겹쳐 헷갈린다 | `scan.js` 에 `note` 라는 반복 변수가 이미 있다. 모듈 수준 함수 이름을 지을 때 확인한다 |

---

## 7. SHA 연동

**API 계약은 이 저장소가 아니라 SHA 저장소가 소유한다.**

- 계약 문서: `suseong-html-analyzer/docs/INTEGRATION.md`
  (요청·응답 모양, 오류 코드, NDJSON 줄, 그리는 쪽 보안 규칙, compose·nginx 예시, 검증 기록)
- 계약이 바뀌면 그쪽에서 갱신하고, 이 저장소는 **버전 태그만** 따라 올린다.

요약만 적어 둔다.

```
POST /api/scan   Content-Type: application/json
{"url": "https://…"}                     가져와서 검사
{"html": "<!DOCTYPE…>", "url": "https://…"}   받은 것을 검사 (가져오지 않는다)

Accept: application/x-ndjson 을 주면 진행 상황이 줄 단위로 온다.
  html 을 보냈으면 fetch 단계는 아예 오지 않는다.
```

- 본문 상한 **4KB**(nginx `client_max_body_size` 와 Go 쪽이 같은 값이어야 한다)
- 거절(415 · 400 · 503 · 413 · 429)은 흘리기 전이라 **상태 코드**로, 흘리기 시작한 뒤의 실패는 **`error` 줄**로 온다
- 응답의 `rules` 는 **나온 규칙의 설명만** 담는다. 없을 수 있다(4절 ④)
