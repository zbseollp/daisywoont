#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const XML_PATH = path.resolve(ROOT, '../wordpress_export.xml');
const IMAGES_DIR = path.resolve(ROOT, 'public/images');
const BLOG_DIR = path.resolve(ROOT, 'src/content/blog');

function readXml() {
  return fs.readFileSync(XML_PATH, 'utf8');
}

function extractCdata(block, tag) {
  const re = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function extractPlain(block, tag) {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function extractMeta(block, key) {
  const re = new RegExp(
    `<wp:meta_key><!\\[CDATA\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]></wp:meta_key>\\s*<wp:meta_value><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></wp:meta_value>`,
    'i'
  );
  const m = block.match(re);
  return m ? m[1] : '';
}

function extractCategories(block, domain) {
  const re = new RegExp(
    `<category domain="${domain}"[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></category>`,
    'gi'
  );
  const results = [];
  let m;
  while ((m = re.exec(block)) !== null) results.push(m[1]);
  return results;
}

function parseItems(xml) {
  const parts = xml.split('<item>');
  return parts.slice(1).map((p) => p.split('</item>')[0]);
}

function basenameFromUrl(url) {
  try {
    const u = new URL(url);
    return decodeURIComponent(path.basename(u.pathname));
  } catch {
    return path.basename(url);
  }
}

function stripSizeSuffix(filename) {
  return filename.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
}

function localImagePath(url) {
  const base = stripSizeSuffix(basenameFromUrl(url));
  return `/images/${base}`;
}

function replaceMediaUrls(html) {
  return html
    .replace(/https?:\/\/daisywoont\.nl\/wp-content\/uploads\/[^"'\s)>]+/gi, (url) => localImagePath(url))
    .replace(/https?:\/\/www\.daisywoont\.nl\/wp-content\/uploads\/[^"'\s)>]+/gi, (url) => localImagePath(url))
    .replace(/https?:\/\/lifestyledaisy\.nl\/wp-content\/uploads\/[^"'\s)>]+/gi, (url) => localImagePath(url));
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      resolve(false);
      return;
    }
    const proto = url.startsWith('https') ? https : http;
    const request = proto.get(url, { headers: { 'User-Agent': 'AstroMigration/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    });
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

function yamlEscape(str) {
  if (!str) return '""';
  if (/[:#\n"'[\]{}>|*&!%@`]/.test(str) || str.startsWith(' ') || str.endsWith(' ')) {
    return JSON.stringify(str);
  }
  return `"${str.replace(/"/g, '\\"')}"`;
}

function excerptFromHtml(html, maxLen = 200) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

async function main() {
  console.log('Reading WordPress XML...');
  const xml = readXml();
  const items = parseItems(xml);

  const authors = {};
  const authorBlocks = xml.match(/<wp:author>[\s\S]*?<\/wp:author>/g) || [];
  for (const block of authorBlocks) {
    const login = extractCdata(block, 'wp:author_login');
    const display = extractCdata(block, 'wp:author_display_name');
    authors[login] = display || login;
  }

  const attachments = new Map();
  const posts = [];
  const pages = [];
  const menuItems = [];

  // First pass: attachments only (needed for featured images)
  for (const block of items) {
    const postType = extractCdata(block, 'wp:post_type');
    if (postType !== 'attachment') continue;
    const postId = extractPlain(block, 'wp:post_id');
    const url = extractCdata(block, 'wp:attachment_url') || extractCdata(block, 'guid');
    if (url) {
      attachments.set(postId, {
        id: postId,
        url,
        title: extractCdata(block, 'title'),
        localPath: localImagePath(url),
      });
    }
  }

  for (const block of items) {
    const postType = extractCdata(block, 'wp:post_type');
    const status = extractCdata(block, 'wp:status');
    const postId = extractPlain(block, 'wp:post_id');

    if (postType === 'attachment') continue;

    if (postType === 'nav_menu_item' && status === 'publish') {
      menuItems.push({
        id: postId,
        title: extractCdata(block, 'title'),
        order: Number(extractPlain(block, 'wp:menu_order') || 0),
        parent: extractMeta(block, '_menu_item_menu_item_parent'),
        objectId: extractMeta(block, '_menu_item_object_id'),
        object: extractMeta(block, '_menu_item_object'),
        type: extractMeta(block, '_menu_item_type'),
        url: extractMeta(block, '_menu_item_url'),
      });
      continue;
    }

    if (postType === 'post' && status === 'publish') {
      const content = extractCdata(block, 'content:encoded');
      const thumbnailId = extractMeta(block, '_thumbnail_id');
      const thumb = attachments.get(thumbnailId);
      posts.push({
        id: postId,
        slug: extractCdata(block, 'wp:post_name'),
        title: extractCdata(block, 'title'),
        date: extractCdata(block, 'wp:post_date').slice(0, 10),
        author: authors[extractCdata(block, 'dc:creator')] || extractCdata(block, 'dc:creator') || 'admin',
        categories: extractCategories(block, 'category'),
        tags: extractCategories(block, 'post_tag'),
        content,
        featuredImage: thumb?.localPath || '',
        featuredImageUrl: thumb?.url || '',
      });
      continue;
    }

    if (postType === 'page' && status === 'publish') {
      pages.push({
        id: postId,
        slug: extractCdata(block, 'wp:post_name'),
        title: extractCdata(block, 'title'),
        content: extractCdata(block, 'content:encoded'),
      });
    }
  }

  console.log(`Found ${posts.length} posts, ${pages.length} pages, ${attachments.size} attachments, ${menuItems.length} menu items`);

  // Collect all image URLs to download
  const imageUrls = new Set();
  for (const att of attachments.values()) imageUrls.add(att.url);
  for (const post of posts) {
    const matches =
      post.content.match(/https?:\/\/(?:daisywoont|lifestyledaisy)\.nl\/wp-content\/uploads\/[^"'\s)>]+/gi) ||
      [];
    matches.forEach((u) => imageUrls.add(u));
    if (post.featuredImageUrl) imageUrls.add(post.featuredImageUrl);
  }
  for (const page of pages) {
    const matches = page.content.match(/https?:\/\/daisywoont\.nl\/wp-content\/uploads\/[^"'\s)>]+/gi) || [];
    matches.forEach((u) => imageUrls.add(u));
  }

  // Also scan source files for /images/ references and try WP equivalents
  const extraImages = [
    'Group-94.jpg',
    'Frame-233.svg',
    'cropped-Frame-32x32.png',
    'icon-park-outline_double-bed.svg',
    'icon-park-outline_oven.svg',
    'radiator-1.jpg',
    'slaapkamer.jpg',
    'douche.jpg',
    'wasmand.jpg',
    'cleaner.jpg',
    'wasmachine.jpg',
    'hero-woman-thinking.png',
    'hero-woman-round-glasses.png',
    'hero-woman-waist-2.png',
    'listerby-coffee-table-oak-veneer__1022538_pe832796_s5.jpg',
    'listerby-coffee-table-oak-veneer__1022538_pe832796_s56.jpg',
    'listerby-coffee-table-oak-veneer__1022538_pe832796_s57.jpg',
    'pexels-jsalamanca-61129-4.jpg',
    'pexels-achim-bongard-87217-352096.jpg',
    'pexels-heyho-6312362-scaled.jpg',
    'kunststof-kozijn-scaled.jpg',
    'wandsieraad.png',
    '15222-scaled.jpg',
  ];
  for (const name of extraImages) {
    imageUrls.add(`https://daisywoont.nl/wp-content/uploads/2023/02/${name}`);
    imageUrls.add(`https://daisywoont.nl/wp-content/uploads/2023/04/${name}`);
    imageUrls.add(`https://daisywoont.nl/wp-content/uploads/2026/02/${name}`);
    imageUrls.add(`https://daisywoont.nl/wp-content/uploads/2025/07/${name}`);
    imageUrls.add(`https://daisywoont.nl/wp-content/uploads/2025/05/${name}`);
  }

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(BLOG_DIR, { recursive: true });

  console.log(`Downloading ${imageUrls.size} images...`);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedUrls = [];

  for (const url of imageUrls) {
    const filename = stripSizeSuffix(basenameFromUrl(url));
    const dest = path.join(IMAGES_DIR, filename);
    try {
      const wasNew = await downloadFile(url, dest);
      if (wasNew) downloaded++;
      else skipped++;
    } catch {
      failed++;
      failedUrls.push(url);
    }
  }

  console.log(`Images: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);

  // Write blog markdown files
  if (fs.existsSync(BLOG_DIR)) {
    for (const f of fs.readdirSync(BLOG_DIR)) {
      if (f.endsWith('.md')) fs.unlinkSync(path.join(BLOG_DIR, f));
    }
  }

  for (const post of posts) {
    const content = replaceMediaUrls(post.content);
    const description = excerptFromHtml(content);
    const frontmatter = [
      '---',
      `title: ${yamlEscape(post.title)}`,
      `pubDate: ${post.date}`,
      `author: ${yamlEscape(post.author)}`,
      `categories: [${post.categories.map((c) => yamlEscape(c)).join(', ')}]`,
      `tags: [${post.tags.map((t) => yamlEscape(t)).join(', ')}]`,
      `featuredImage: ${yamlEscape(post.featuredImage)}`,
      `description: ${yamlEscape(description)}`,
      '---',
      '',
    ].join('\n');

    const filePath = path.join(BLOG_DIR, `${post.slug}.md`);
    fs.writeFileSync(filePath, frontmatter + content, 'utf8');
  }

  console.log(`Wrote ${posts.length} blog posts to src/content/blog/`);

  // Build page slug map for nav
  const pageById = Object.fromEntries(pages.map((p) => [p.id, p]));

  menuItems.sort((a, b) => a.order - b.order);
  const navTree = [];
  const navById = {};

  for (const item of menuItems) {
    let href = item.url;
    let label = item.title;

    if (item.type === 'post_type' && item.object === 'page') {
      const page = pageById[item.objectId];
      if (page) {
        label = label || page.title;
        href = page.slug === 'home' ? '/' : `/${page.slug}/`;
      }
    }

    const entry = {
      id: item.id,
      label: label || 'Menu',
      href: href || '#',
      parent: item.parent === '0' ? null : item.parent,
      children: [],
    };
    navById[item.id] = entry;
  }

  for (const item of menuItems) {
    const entry = navById[item.id];
    if (item.parent === '0') {
      navTree.push(entry);
    } else if (navById[item.parent]) {
      navById[item.parent].children.push(entry);
    }
  }

  const navOutput = navTree.map(({ label, href, children }) => ({
    label,
    href,
    children: children.length
      ? children.map((c) => ({ label: c.label, href: c.href }))
      : undefined,
  }));

  fs.writeFileSync(
    path.resolve(ROOT, 'src/data/nav-from-wp.json'),
    JSON.stringify(navOutput, null, 2),
    'utf8'
  );

  fs.writeFileSync(
    path.resolve(ROOT, 'src/data/pages-from-wp.json'),
    JSON.stringify(
      pages.map((p) => ({
        slug: p.slug,
        title: p.title,
        content: replaceMediaUrls(p.content),
      })),
      null,
      2
    ),
    'utf8'
  );

  fs.writeFileSync(
    path.resolve(ROOT, 'src/data/migration-summary.json'),
    JSON.stringify(
      {
        posts: posts.length,
        pages: pages.length,
        imagesDownloaded: downloaded,
        imagesSkipped: skipped,
        imagesFailed: failed,
        failedUrls: failedUrls.slice(0, 20),
        postSlugs: posts.map((p) => p.slug),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('Migration data written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
