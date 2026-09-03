import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    author: z.string(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    // Payload can send featuredImage as a plain path/URL string, or as a
    // media object ({ url, filename, alt, ... }). Accept both and normalize
    // to a plain string so the rest of the app never has to care.
    featuredImage: z
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
      }),
    description: z.string().default(''),
    // Payload sends draft as a real boolean, but some pipelines write it as
    // the string "true"/"false". Normalize to a boolean either way.
    draft: z
      .union([z.boolean(), z.string()])
      .optional()
      .default(false)
      .transform((val) => val === true || val === 'true'),
  }),
});

export const collections = { blog };
