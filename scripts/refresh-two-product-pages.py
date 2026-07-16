#!/usr/bin/env python3
"""Refresh two product pages from live HTML and download remote product images."""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "public" / "images"
DATA = ROOT / "src" / "data" / "product-pages-from-wp.json"
TMP = ROOT / "tmp" / "pages"

SLUGS = [
    "beste-kledingkast-kinderkamer",
    "beste-kapstok-met-schoenenrek",
]


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        return
    print(f"GET {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 DaisyWoontMigration"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())
    print(f"  -> {dest.name} ({dest.stat().st_size})")


def localImagePathFromUpload(url: str) -> str:
    filename = url.split("/")[-1].split("?")[0]
    elementor_match = re.match(r"^(.+)-[a-z0-9]{20,}(\.[a-z0-9]+)$", filename, re.I)
    if elementor_match:
        base = f"{elementor_match.group(1)}{elementor_match.group(2)}"
    else:
        base = re.sub(r"-\d+x\d+(\.[a-z0-9]+)$", r"\1", filename, flags=re.I)
    return f"/images/{base}"


def clean_wp_html(html: str) -> str:
    content = html
    page_start = re.search(r'<div[^>]*data-elementor-type=["\']wp-page["\']', content, re.I)
    if page_start:
        start = page_start.start()
        end = len(content)
        for pat in [
            r'data-elementor-type=["\']footer["\']',
            r"<footer",
            r"</body>",
        ]:
            m = re.search(pat, content[start:], re.I)
            if m:
                end = min(end, start + m.start())
        content = content[start:end].trim() if False else content[start:end].strip()

    content = re.sub(r"<footer[\s\S]*$", "", content, flags=re.I).strip()
    content = re.sub(r"<script[\s\S]*?</script>", "", content, flags=re.I)
    content = re.sub(
        r"https?://(?:www\.)?daisywoont\.nl/wp-content/uploads/[^\"'\s)>]+",
        lambda m: localImagePathFromUpload(m.group(0)),
        content,
        flags=re.I,
    )
    content = re.sub(
        r"/wp-content/uploads/[^\"'\s)>]+",
        lambda m: localImagePathFromUpload(m.group(0)),
        content,
        flags=re.I,
    )
    content = re.sub(r"\bddd\b", "", content)
    content = re.sub(r"\[zb_mp_[^\]]*\]", "", content)
    content = re.sub(r'\shref="#"', "", content)
    content = re.sub(r'\ssrc=""', "", content)
    content = re.sub(
        r"https?://(?:www\.)?daisywoont\.nl(/[^\"'\s)>]*)",
        lambda m: m.group(1) if m.group(1).endswith("/") else f"{m.group(1)}/",
        content,
        flags=re.I,
    )

    # Download and localize myfreeimagehost product images
    def repl_remote_img(m: re.Match[str]) -> str:
        url = m.group(1)
        name = url.rstrip("/").split("/")[-1]
        if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            name = f"{name}.jpg"
        dest = IMAGES / name
        try:
            download(url, dest)
            return f'src="/images/{name}"'
        except Exception as e:
            print(f"  fail {url}: {e}")
            return m.group(0)

    content = re.sub(
        r'src="(https://images\.myfreeimagehost\.com/[^"]+)"',
        repl_remote_img,
        content,
    )

    return content


def extract_title(html: str, fallback: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    if not m:
        return fallback
    title = re.sub(r"\s+", " ", m.group(1)).strip()
    title = re.sub(r"\s*\|\s*.*$", "", title)
    return title or fallback


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by_slug = {p["slug"]: i for i, p in enumerate(data)}

    for slug in SLUGS:
        html_path = TMP / f"{slug.split('-', 1)[-1] if False else ''}"
        # use known filenames
        file_map = {
            "beste-kledingkast-kinderkamer": TMP / "kledingkast.html",
            "beste-kapstok-met-schoenenrek": TMP / "kapstok.html",
        }
        html = file_map[slug].read_text(encoding="utf-8", errors="replace")
        cleaned = clean_wp_html(html)
        title = extract_title(html, data[by_slug[slug]]["title"])
        # Prefer shorter WP title from JSON if live title is long SEO title
        # Live titles are like "Top 10 kledingkast kinderkamer | BESTE ..."
        # Keep title closer to H1 / existing
        h1 = re.search(r'<h1[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>(.*?)</h1>', cleaned, re.I | re.S)
        if h1:
            # Don't use H1 as title - H1 is "Top 10 beste ... van 2026"
            pass
        data[by_slug[slug]] = {
            "slug": slug,
            "title": data[by_slug[slug]]["title"],  # keep existing short title
            "content": cleaned,
        }
        print(f"Updated {slug}: content {len(cleaned)} chars")

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Saved", DATA)


if __name__ == "__main__":
    main()
