import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * One client page per paper. Keys must match `PaperMeta.slug`.
 * `next/dynamic` keeps each demo in its own bundle.
 */
export const interactives: Record<string, ComponentType> = {
  "01-word2vec": dynamic(() => import("@/content/papers/01-word2vec/interactive")),
  "02-glove": dynamic(() => import("@/content/papers/02-glove/interactive")),
  "03-seq2seq": dynamic(() => import("@/content/papers/03-seq2seq/interactive")),
  "04-bahdanau-attention": dynamic(() => import("@/content/papers/04-bahdanau-attention/interactive")),
  "05-transformer": dynamic(() => import("@/content/papers/05-transformer/interactive")),
};
