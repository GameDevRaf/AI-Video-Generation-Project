import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const docsSchema = z.object({
  links: z.array(z.object({
    label: z.string(),
    icon: z.string(),
    to: z.string(),
    target: z.string().optional(),
  })).optional(),
  config: z.record(z.unknown()).optional(),
}).passthrough()

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: {
        include: '**',
        prefix: '/',
        exclude: ['index.md'],
      },
      schema: docsSchema,
    }),
    landing: defineCollection({
      type: 'page',
      source: {
        include: 'index.md',
      },
    }),
  },
})
