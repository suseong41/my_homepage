package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// 골든 파일은 **파이썬 판이 실제로 내놓은 응답**이다.
// testdata/upstream 의 표본(진짜 티스토리 RSS · GitHub API 응답)을 먹여서 받아 두었다.
// 표본은 갈래를 채우려고 두 곳만 손봤다 — 포크 하나(fork=true) · 별 있는 저장소 하나.
//
// 비교는 바이트가 아니라 **값**으로 한다. JSON 키 순서는 계약이 아니다.

// upstream(): 표본 파일을 돌려주는 가짜 상류. 없는 저장소는 404 를 준다.
func upstream(t *testing.T) *httptest.Server {
	t.Helper()
	file := func(name string) []byte {
		b, err := os.ReadFile(filepath.Join("testdata", "upstream", name))
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	rss, repos, readme := file("rss.xml"), file("repos.json"), file("readme.json")

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/rss":
			w.Header().Set("Content-Type", "application/xml; charset=utf-8")
			w.Write(rss)
		case strings.Contains(r.URL.Path, "/없는저장소/readme"): // 음성
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"message":"Not Found"}`))
		case strings.HasSuffix(r.URL.Path, "/readme"):
			w.Header().Set("Content-Type", "application/json")
			w.Write(readme)
		default:
			w.Header().Set("Content-Type", "application/json")
			w.Write(repos)
		}
	}))
}

// serve(): 가짜 상류를 보게 해 두고 라우터를 통째로 태움 — 경로 패턴까지 시험한다.
func serve(t *testing.T, base string) http.Handler {
	t.Helper()
	oldRSS, oldAPI := rssURL, githubAPI
	rssURL, githubAPI = base+"/rss", base
	t.Cleanup(func() { rssURL, githubAPI = oldRSS, oldAPI })
	return routes()
}

// callAPI(): 경로 하나를 호출해 상태와 본문을 받음.
func callAPI(t *testing.T, h http.Handler, path string) (int, []byte) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Code, rec.Body.Bytes()
}

// sameJSON(): 값으로 비교 — 키 순서와 끝의 줄바꿈은 계약이 아니다.
func sameJSON(t *testing.T, got []byte, goldenName string) {
	t.Helper()
	want, err := os.ReadFile(filepath.Join("testdata", "golden", goldenName))
	if err != nil {
		t.Fatal(err)
	}
	var g, w any
	if err := json.Unmarshal(got, &g); err != nil {
		t.Fatalf("응답이 JSON 이 아니다: %s", firstBytes(got))
	}
	if err := json.Unmarshal(want, &w); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(g, w) {
		t.Errorf("파이썬 판과 응답이 다르다 (golden/%s)\n받음: %s\n기대: %s",
			goldenName, firstBytes(got), firstBytes(want))
	}
}

func firstBytes(b []byte) string {
	if len(b) > 300 {
		return string(b[:300]) + "…"
	}
	return string(b)
}

// 세 경로가 파이썬 판과 같은 값을 내놓는지 — 이 테스트가 이전의 계약이다.
func TestSameAsPython(t *testing.T) {
	up := upstream(t)
	defer up.Close()
	h := serve(t, up.URL)

	cases := []struct {
		path   string
		golden string
	}{
		{"/api/posts", "posts.json"},                   // 글 3개 · pubDate 가 2026.09.12 형식
		{"/api/repos", "repos.json"},                   // 20개 중 포크 1개를 뺀 19개
		{"/api/repos/sha/readme", "readme.json"},       // base64 를 풀어 본문으로
		{"/api/repos/없는저장소/readme", "readme_404.json"}, // 404 는 오류가 아니라 안내
	}
	for _, c := range cases {
		t.Run(c.path, func(t *testing.T) {
			code, body := callAPI(t, h, c.path)
			if code != http.StatusOK {
				t.Fatalf("상태 %d, want 200 — 본문: %s", code, firstBytes(body))
			}
			sameJSON(t, body, c.golden)
		})
	}
}

// 포크는 빼고, 빈 설명·빈 언어는 빈 문자열로, 별 개수는 그대로.
func TestRepoFields(t *testing.T) {
	up := upstream(t)
	defer up.Close()
	h := serve(t, up.URL)

	_, body := callAPI(t, h, "/api/repos")
	var out struct {
		Repos []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Language    string `json:"language"`
			Stars       int    `json:"stars"`
			UpdatedAt   string `json:"updated_at"`
		} `json:"repos"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}

	if len(out.Repos) != 19 {
		t.Errorf("저장소 %d개, want 19 — 포크를 빼지 않았나", len(out.Repos))
	}
	for _, r := range out.Repos {
		if strings.HasSuffix(r.Name, "-fork") {
			t.Errorf("포크가 섞여 있다: %s", r.Name)
		}
		if strings.Count(r.UpdatedAt, ".") != 2 || len(r.UpdatedAt) != 10 {
			t.Errorf("%s 의 updated_at = %q — 2026.09.21 형식이어야 함", r.Name, r.UpdatedAt)
		}
	}
	var stars int
	for _, r := range out.Repos {
		stars += r.Stars
	}
	if stars != 7 {
		t.Errorf("별 합계 %d, want 7 — 별 개수를 옮기지 않았나", stars)
	}
}

// 상류가 죽으면 502 와 {"detail": …} — 원인은 밖으로 흘리지 않는다.
func TestUpstreamDown(t *testing.T) {
	up := upstream(t)
	up.Close() // 닫아 두고 그 주소를 보게 한다
	h := serve(t, up.URL)

	for _, p := range []string{"/api/posts", "/api/repos", "/api/repos/sha/readme"} {
		code, body := callAPI(t, h, p)
		if code != http.StatusBadGateway {
			t.Errorf("%s → 상태 %d, want 502", p, code)
		}
		var out map[string]string
		if err := json.Unmarshal(body, &out); err != nil || out["detail"] == "" {
			t.Errorf("%s → 본문 %s — {\"detail\": …} 이어야 함", p, firstBytes(body))
		}
	}
}

// CORS 는 허용 목록에 있는 Origin 에만 붙는다.
func TestCORS(t *testing.T) {
	up := upstream(t)
	defer up.Close()
	h := serve(t, up.URL)

	cases := []struct {
		origin string
		want   string
	}{
		{"https://suseong.org", "https://suseong.org"},         // 양성
		{"https://www.suseong.org", "https://www.suseong.org"}, // 양성
		{"https://evil.example", ""},                           // 음성
		{"", ""},                                               // 음성 — Origin 없음
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/posts", nil)
		if c.origin != "" {
			req.Header.Set("Origin", c.origin)
		}
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != c.want {
			t.Errorf("Origin %q → %q, want %q", c.origin, got, c.want)
		}
	}
}

// 읽기 전용 API 다 — GET 아닌 것과 없는 경로는 받지 않는다.
func TestMethodsAndPaths(t *testing.T) {
	up := upstream(t)
	defer up.Close()
	h := serve(t, up.URL)

	cases := []struct {
		method, path string
		want         int
	}{
		{http.MethodGet, "/api/posts", http.StatusOK},                        // 양성
		{http.MethodPost, "/api/posts", http.StatusMethodNotAllowed},         // 음성
		{http.MethodDelete, "/api/repos", http.StatusMethodNotAllowed},       // 음성
		{http.MethodGet, "/api/nope", http.StatusNotFound},                   // 음성
		{http.MethodGet, "/api/repos/sha/readme/extra", http.StatusNotFound}, // 음성
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, nil))
		if rec.Code != c.want {
			t.Errorf("%s %s → %d, want %d", c.method, c.path, rec.Code, c.want)
		}
	}
}
