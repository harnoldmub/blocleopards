import { defineCollection, z } from "astro:content";

const news = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional()
  })
});

const events = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    time: z.string(),
    location: z.string(),
    cta: z.string(),
    map: z.string().optional(),
    image: z.string().optional()
  })
});

const campaigns = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hashtag: z.string(),
    status: z.string(),
    image: z.string().optional()
  })
});

const matches = defineCollection({
  type: "content",
  schema: z.object({
    opponent: z.string(),
    date: z.string(),
    time: z.string(),
    location: z.string(),
    callToAction: z.string()
  })
});

export const collections = { news, events, campaigns, matches };
