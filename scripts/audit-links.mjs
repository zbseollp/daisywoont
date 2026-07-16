#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.AUDIT_PORT || 4325);
const BASE = `http://localhost:${PORT}`;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function toRoute(file) {
  const rel = path.relative(DIST, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/index\.html$/, '')}`;
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      })
      .on('error', () => resolve(0));
  });
}

function extractLinks(html, pageRoute) {
  const links = new Set();
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const raw = match[1];
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      if (!raw.includes('daisywoont.nl') && !raw.includes('facebook.com') && !raw.includes('instagram.com') && !raw.includes('twitter.com') && !raw.includes('youtube.com') && !raw.includes('daisykookt.nl') && !raw.includes('daisybeautytips.nl') && !raw.includes('daisytuiniert.nl') && !raw.includes('outdoordaisy.nl') && !raw.includes('daisyverbouwt.nl') && !raw.includes('lifestyledaisy.nl')) {
        links.add(raw);
      }
      continue;
    }
    if (raw.startsWith('/images/')) {
      links.add(raw);
      continue;
    }
    if (raw.startsWith('/')) links.add(raw.endsWith('/') ? raw : `${raw}/`);
  }
  return [...links];
}

async function main() {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    else if (reqPath.endsWith('/')) reqPath += 'index.html';
    else if (!path.extname(reqPath)) reqPath += '/index.html';

    const filePath = path.normalize(path.join(DIST, reqPath.replace(/^\//, '')));
    if (!filePath.startsWith(path.normalize(DIST)) || !fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    res.end(fs.readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(PORT, resolve));

  const htmlFiles = walk(DIST);
  const routes = new Set(htmlFiles.map(toRoute));
  const broken = [];
  const checked = new Set();

  const priority = [
    '/',
    '/blogs/',
    '/over-ons/',
    '/contact/',
    '/sitemap/',
    '/beste-mobiele-airco-slaapkamer/',
    '/beste-infrarood-verwarming/',
    '/beste-bovenlader-wasmachine/',
    '/beste-kleine-houtkachel/',
    '/beste-hangstoel-binnen/',
    '/stijlhanger-ophangen-praktische-tips-en-inspiratie/',
    '/elektrowarmer-gebruiken-efficiente-verwarming/',
  ];

  const allLinks = new Set();
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const route = toRoute(file);
    for (const link of extractLinks(html, route)) allLinks.add(link);
  }

  for (const link of [...priority, ...allLinks]) {
    if (checked.has(link)) continue;
    checked.add(link);
    if (link.startsWith('/images/')) {
      const imgPath = path.join(DIST, link.replace(/^\//, ''));
      if (!fs.existsSync(imgPath)) broken.push({ link, status: 'missing image' });
      continue;
    }
    if (link.startsWith('/_astro/')) continue;
    if (!link.startsWith('/')) continue;
    const status = await fetchUrl(`${BASE}${link}`);
    if (status !== 200) broken.push({ link, status });
  }

  server.close();
  console.log(`Pages built: ${htmlFiles.length}`);
  console.log(`Links checked: ${checked.size}`);
  console.log(`Broken: ${broken.length}`);
  broken.slice(0, 30).forEach((b) => console.log(`  ${b.link} -> ${b.status}`));
  process.exit(broken.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
