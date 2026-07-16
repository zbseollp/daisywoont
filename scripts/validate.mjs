#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xml = fs.readFileSync(path.resolve(ROOT, '../wordpress_export.xml'), 'utf8');
const items = xml.split('<item>').slice(1).map((p) => p.split('</item>')[0]);

const wpPosts = [];
for (const block of items) {
  const type = (block.match(/<wp:post_type><!\[CDATA\[([^\]]+)\]\]><\/wp:post_type>/) || [])[1];
  const status = (block.match(/<wp:status><!\[CDATA\[([^\]]+)\]\]><\/wp:status>/) || [])[1];
  const slug = (block.match(/<wp:post_name><!\[CDATA\[([^\]]+)\]\]><\/wp:post_name>/) || [])[1];
  if (type === 'post' && status === 'publish' && slug) wpPosts.push(slug);
}

const blogDir = path.join(ROOT, 'src/content/blog');
const astroPosts = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
const missing = wpPosts.filter((s) => !astroPosts.includes(s));
const extra = astroPosts.filter((s) => !wpPosts.includes(s));

console.log('=== Blog slugs ===');
console.log(`WP: ${wpPosts.length}, Astro: ${astroPosts.length}`);
if (missing.length) console.log('Missing:', missing);
if (extra.length) console.log('Extra:', extra);
if (!missing.length && !extra.length) console.log('All slugs match');

const images = new Set(fs.readdirSync(path.join(ROOT, 'public/images')));
const hotlinks = [];
const broken = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const m of content.matchAll(/src=["']([^"']+)["']/g)) {
    const src = m[1];
    if (src.startsWith('http')) hotlinks.push({ file: filePath, src });
    else if (src.startsWith('/images/')) {
      const base = path.basename(src);
      if (!images.has(base)) broken.push({ file: filePath, src });
    }
  }
}

for (const file of fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
  scanFile(path.join(blogDir, file));
}

for (const jsonFile of ['src/data/pages-from-wp.json', 'src/data/product-pages-from-wp.json']) {
  scanFile(path.join(ROOT, jsonFile));
}

scanFile(path.join(ROOT, 'src/data/site.ts'));

console.log('\n=== Images ===');
console.log(`Hotlinks: ${hotlinks.length}`);
hotlinks.forEach((h) => console.log(`  ${path.relative(ROOT, h.file)}: ${h.src}`));
console.log(`Broken local refs: ${broken.length}`);
broken.forEach((b) => console.log(`  ${path.relative(ROOT, b.file)}: ${b.src}`));

const wpHotlinks = [];
for (const jsonFile of ['src/data/pages-from-wp.json', 'src/data/product-pages-from-wp.json']) {
  const content = fs.readFileSync(path.join(ROOT, jsonFile), 'utf8');
  const matches = content.match(/https:\/\/daisywoont\.nl\/wp-content[^"'\\]+/g) || [];
  wpHotlinks.push(...matches);
}
console.log(`WP content hotlinks in JSON: ${wpHotlinks.length}`);

const nav = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/nav-from-wp.json'), 'utf8'));
const allPages = new Set(['/', '/blogs/', '/contact/', '/over-ons/']);
for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages-from-wp.json'), 'utf8'))) {
  allPages.add(`/${p.slug}/`);
}
for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/product-pages-from-wp.json'), 'utf8'))) {
  allPages.add(`/${p.slug}/`);
}

function normalizeHref(href) {
  if (href.startsWith('https://daisywoont.nl/')) {
    const p = href.replace('https://daisywoont.nl', '');
    return p.endsWith('/') ? p : `${p}/`;
  }
  return href;
}

const badNav = [];
for (const item of nav) {
  const href = item.label === 'Blogs' ? '/blogs/' : normalizeHref(item.href);
  if (!allPages.has(href) && href !== '/') badNav.push(href);
  for (const child of item.children || []) {
    const chref = normalizeHref(child.href);
    if (!allPages.has(chref)) badNav.push(chref);
  }
}
console.log('\n=== Nav ===');
console.log(`Invalid nav links: ${badNav.length}`);
badNav.forEach((l) => console.log(`  ${l}`));

const failed = missing.length + extra.length + hotlinks.length + broken.length + wpHotlinks.length + badNav.length;
process.exit(failed > 0 ? 1 : 0);
