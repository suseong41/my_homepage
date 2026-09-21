package main

import (
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"io"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"
)

var (
	rssURL     = env("RSS_URL", "https://suseong.tistory.com/rss")
	githubAPI  = env("GITHUB_API", "https://api.github.com")
	githubUser = env("GITHUB_USER", "suseong41")
	origins    = map[string]bool{"https://suseong.org": true, "https://www.suseong.org": true}
	client     = &http.Client{Timeout: 10 * time.Second}
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

type post struct {
	Title    string `json:"title"`
	Link     string `json:"link"`
	PubDate  string `json:"pubDate"`
	Category string `json:"category"`
}

type repo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Stars       int    `json:"stars"`
	URL         string `json:"url"`
	UpdatedAt   string `json:"updated_at"`
}

type ghRepo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Stars       int    `json:"stargazers_count"`
	HTMLURL     string `json:"html_url"`
	UpdatedAt   string `json:"updated_at"`
	Fork        bool   `json:"fork"`
}

type rssFeed struct {
	Items []struct {
		Title    string `xml:"title"`
		Link     string `xml:"link"`
		PubDate  string `xml:"pubDate"`
		Category string `xml:"category"`
	} `xml:"channel>item"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, msg string) {
	writeJSON(w, http.StatusBadGateway, map[string]string{"detail": msg})
}

func get(url, accept string) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	if accept != "" {
		req.Header.Set("Accept", accept)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	return body, resp.StatusCode, err
}

func formatDate(s string) string {
	t, err := mail.ParseDate(s)
	if err != nil {
		return s
	}
	return t.Format("2006.01.02")
}

func posts(w http.ResponseWriter, r *http.Request) {
	body, code, err := get(rssURL, "")
	if err != nil || 400 <= code {
		fail(w, "RSS 피드를 가져올 수 없습니다.")
		return
	}
	var feed rssFeed
	if xml.Unmarshal(body, &feed) != nil {
		fail(w, "RSS 피드를 가져올 수 없습니다.")
		return
	}
	out := []post{}
	for _, it := range feed.Items {
		out = append(out, post{it.Title, it.Link, formatDate(it.PubDate), it.Category})
	}
	writeJSON(w, http.StatusOK, map[string][]post{"posts": out})
}

func repos(w http.ResponseWriter, r *http.Request) {
	body, code, err := get(githubAPI+"/users/"+githubUser+"/repos?sort=updated&per_page=20", "application/vnd.github+json")
	if err != nil || 400 <= code {
		fail(w, "GitHub API를 가져올 수 없습니다.")
		return
	}
	var list []ghRepo
	if json.Unmarshal(body, &list) != nil {
		fail(w, "GitHub API를 가져올 수 없습니다.")
		return
	}
	out := []repo{}
	for _, g := range list {
		if g.Fork {
			continue
		}
		date := g.UpdatedAt
		if 10 <= len(date) {
			date = strings.ReplaceAll(date[:10], "-", ".")
		}
		out = append(out, repo{g.Name, g.Description, g.Language, g.Stars, g.HTMLURL, date})
	}
	writeJSON(w, http.StatusOK, map[string][]repo{"repos": out})
}

func readme(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	body, code, err := get(githubAPI+"/repos/"+githubUser+"/"+name+"/readme", "application/vnd.github+json")
	if code == http.StatusNotFound {
		writeJSON(w, http.StatusOK, map[string]string{"content": "README가 없습니다."})
		return
	}
	if err != nil || 400 <= code {
		fail(w, "README를 가져올 수 없습니다.")
		return
	}
	var got struct {
		Content string `json:"content"`
	}
	if json.Unmarshal(body, &got) != nil {
		fail(w, "README를 가져올 수 없습니다.")
		return
	}
	text, err := base64.StdEncoding.DecodeString(got.Content)
	if err != nil {
		fail(w, "README를 가져올 수 없습니다.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": string(text)})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if o := r.Header.Get("Origin"); origins[o] {
			w.Header().Set("Access-Control-Allow-Origin", o)
			w.Header().Set("Access-Control-Allow-Methods", "GET")
			w.Header().Set("Vary", "Origin")
		}
		next.ServeHTTP(w, r)
	})
}

func routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/posts", posts)
	mux.HandleFunc("GET /api/repos", repos)
	mux.HandleFunc("GET /api/repos/{name}/readme", readme)
	return cors(mux)
}

func main() {
	srv := &http.Server{
		Addr:              ":8000",
		Handler:           routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	srv.ListenAndServe()
}
