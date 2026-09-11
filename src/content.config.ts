import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Payload sync can omit or reshape fields that this schema used to require
 * (author, categories as a string, featuredImage as a media object). One
 * incomplete post must not abort `astro build` for the whole site.
 */

const stringList = z.preprocess((value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.includes(',')
      ? value.split(',').map((part) => part.trim()).filter(Boolean)
      : [value.trim()];
  }
  return [];
}, z.array(z.string()));

const authorSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return 'Redactie';
}, z.string());

const pubDateSchema = z.preprocess((value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value == null || value === '') return new Date();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}, z.date());

const featuredImageSchema = z
  .union([
    z.string(),
    z
      .object({
        url: z.string().optional(),
        filename: z.string().optional(),
        alt: z.string().optional(),
      })
      .passthrough(),
  ])
  .optional()
  .default('')
  .transform((val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.url ?? '';
  });

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z
    .object({
      title: z.preprocess((value) => {
        if (value == null || value === '') return 'Untitled';
        return String(value);
      }, z.string()),
      pubDate: pubDateSchema,
      author: authorSchema,
      categories: stringList.default([]),
      tags: stringList.default([]),
      featuredImage: featuredImageSchema,
      description: z.preprocess((value) => {
        if (value == null) return '';
        return String(value);
      }, z.string()).default(''),
      excerpt: z.string().optional(),
      draft: z
        .union([z.boolean(), z.string()])
        .optional()
        .default(false)
        .transform((val) => val === true || val === 'true'),
      _status: z.string().optional(),
    })
    .passthrough(),
});

export const collections = { blog };
