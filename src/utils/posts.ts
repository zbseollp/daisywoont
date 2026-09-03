import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Every listing/route/related-posts/sitemap call site must use this instead
 * of a raw getCollection('blog') call, so that draft posts never leak
 * online (own route, listing, sitemap, related posts, etc).
 */
export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
  return getCollection('blog', ({ data }) => !data.draft);
}
