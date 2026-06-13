import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/docs",
});

export const blog = defineDocs({
  dir: "content/blog",
  docs: {
    schema: frontmatterSchema.extend({
      date: z.string(),
      author: z.string().default("Better Media"),
      tags: z.array(z.string()).default([]),
      readingTime: z.number().optional(),
      image: z.string().optional(),
    }),
  },
});

export default defineConfig();
