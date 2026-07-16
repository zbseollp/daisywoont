#!/usr/bin/env python3
"""Download Elementor CSS/assets needed for product pages and localize URLs."""
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLES = ROOT / "public" / "styles" / "elementor"
IMAGES = ROOT / "public" / "images"
STYLES.mkdir(parents=True, exist_ok=True)
IMAGES.mkdir(parents=True, exist_ok=True)

CSS_URLS = {
    "frontend.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/css/frontend.min.css?ver=4.1.4",
    "widget-image.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/css/widget-image.min.css?ver=4.1.4",
    "widget-heading.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/css/widget-heading.min.css?ver=4.1.4",
    "widget-star-rating.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/css/widget-star-rating.min.css?ver=4.1.4",
    "widget-accordion.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/css/widget-accordion.min.css?ver=4.1.4",
    "widget-spacer.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/css/widget-spacer.min.css?ver=4.1.4",
    "widget-breadcrumbs.min.css": "https://daisywoont.nl/wp-content/plugins/elementor-pro/assets/css/widget-breadcrumbs.min.css?ver=4.1.2",
    "widget-table-of-contents.min.css": "https://daisywoont.nl/wp-content/plugins/elementor-pro/assets/css/widget-table-of-contents.min.css?ver=4.1.2",
    "elementor-icons.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/lib/eicons/css/elementor-icons.min.css?ver=5.50.0",
    "fontawesome.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/lib/font-awesome/css/fontawesome.min.css?ver=5.15.3",
    "solid.min.css": "https://daisywoont.nl/wp-content/plugins/elementor/assets/lib/font-awesome/css/solid.min.css?ver=5.15.3",
    "post-131.css": "https://daisywoont.nl/wp-content/uploads/elementor/css/post-131.css?ver=1784128167",
    "post-335.css": "https://daisywoont.nl/wp-content/uploads/elementor/css/post-335.css?ver=1784127369",
    "epilogue.css": "https://daisywoont.nl/wp-content/uploads/elementor/google-fonts/css/epilogue.css?ver=1744145754",
    "poppins.css": "https://daisywoont.nl/wp-content/uploads/elementor/google-fonts/css/poppins.css?ver=1744145791",
}

IMAGES_URLS = {
    "Group-96.jpg": "https://daisywoont.nl/wp-content/uploads/2023/02/Group-96.jpg",
}


def download(url: str, dest: Path) -> bytes:
    print(f"GET {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 DaisyWoontMigration"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f"  -> {dest} ({len(data)} bytes)")
    return data


def localize_css(css: str, css_path: Path) -> str:
    """Rewrite remote daisywoont / elementor asset URLs to local paths where possible."""

    def repl_upload(match: re.Match[str]) -> str:
        url = match.group(0)
        # background images in uploads
        name = url.rstrip("/").split("/")[-1].split("?")[0]
        local = IMAGES / name
        if not local.exists() and "wp-content/uploads" in url:
            try:
                download(url.split(")")[0], local)
            except Exception as e:
                print(f"  skip image {url}: {e}")
        if local.exists():
            return f"/images/{name}"
        return url

    css = re.sub(
        r"https://daisywoont\.nl/wp-content/uploads/[^\s\"')]+",
        repl_upload,
        css,
    )

    # Font Awesome / eicons webfonts: keep remote OR download later
    # For now rewrite eicons fonts relative path
    css = css.replace("../fonts/", "https://daisywoont.nl/wp-content/plugins/elementor/assets/lib/eicons/fonts/")
    css = css.replace(
        "../webfonts/",
        "https://daisywoont.nl/wp-content/plugins/elementor/assets/lib/font-awesome/webfonts/",
    )

    return css


def main() -> None:
    for name, url in CSS_URLS.items():
        dest = STYLES / name
        data = download(url, dest)
        text = data.decode("utf-8", errors="replace")
        text = localize_css(text, dest)
        dest.write_text(text, encoding="utf-8")

    for name, url in IMAGES_URLS.items():
        dest = IMAGES / name
        if not dest.exists():
            download(url, dest)

    # Also copy fresh post-131 into public/images for any legacy refs, and styles
    src131 = STYLES / "post-131.css"
    (IMAGES / "post-131.css").write_text(src131.read_text(encoding="utf-8"), encoding="utf-8")
    print("Done.")


if __name__ == "__main__":
    main()
