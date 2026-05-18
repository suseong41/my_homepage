import base64
import httpx
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://suseong.org", "https://www.suseong.org"],
    allow_methods=["GET"],
)

RSS_URL    = "https://suseong.tistory.com/rss"
GITHUB_API = "https://api.github.com"
GITHUB_USER = "suseong41"


def format_date(rss_date: str) -> str:
    try:
        return parsedate_to_datetime(rss_date).strftime("%Y.%m.%d")
    except Exception:
        return rss_date


@app.get("/api/posts")
async def get_posts():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(RSS_URL)
            resp.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail="RSS 피드를 가져올 수 없습니다.")

    root = ET.fromstring(resp.text)
    posts = []
    for item in root.find("channel").findall("item"):
        posts.append({
            "title":    item.findtext("title", ""),
            "link":     item.findtext("link", ""),
            "pubDate":  format_date(item.findtext("pubDate", "")),
            "category": item.findtext("category", ""),
        })
    return {"posts": posts}


@app.get("/api/repos")
async def get_repos():
    url = f"{GITHUB_API}/users/{GITHUB_USER}/repos?sort=updated&per_page=20"
    try:
        async with httpx.AsyncClient(timeout=10, headers={"Accept": "application/vnd.github+json"}) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail="GitHub API를 가져올 수 없습니다.")

    repos = []
    for r in resp.json():
        if r.get("fork"):
            continue
        repos.append({
            "name":        r["name"],
            "description": r.get("description") or "",
            "language":    r.get("language") or "",
            "stars":       r.get("stargazers_count", 0),
            "url":         r["html_url"],
            "updated_at":  r["updated_at"][:10].replace("-", "."),
        })
    return {"repos": repos}


@app.get("/api/repos/{repo_name}/readme")
async def get_readme(repo_name: str):
    url = f"{GITHUB_API}/repos/{GITHUB_USER}/{repo_name}/readme"
    try:
        async with httpx.AsyncClient(timeout=10, headers={"Accept": "application/vnd.github+json"}) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return {"content": "README가 없습니다."}
            resp.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail="README를 가져올 수 없습니다.")

    content = base64.b64decode(resp.json()["content"]).decode("utf-8")
    return {"content": content}
