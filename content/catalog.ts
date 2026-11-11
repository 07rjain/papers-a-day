import type { PaperMeta } from "@/content/types";
import { meta as word2vec } from "@/content/papers/01-word2vec/content";
import { meta as glove } from "@/content/papers/02-glove/content";
import { meta as seq2seq } from "@/content/papers/03-seq2seq/content";
import { meta as attention } from "@/content/papers/04-bahdanau-attention/content";
import { meta as transformer } from "@/content/papers/05-transformer/content";
import { meta as bert } from "@/content/papers/06-bert/content";
import { meta as gpt2 } from "@/content/papers/07-gpt2/content";
import { meta as gpt3 } from "@/content/papers/08-gpt3/content";
import { meta as scaling } from "@/content/papers/09-scaling-laws/content";
import { meta as instruct } from "@/content/papers/10-instructgpt/content";
import { meta as chinchilla } from "@/content/papers/11-chinchilla/content";
import { meta as lora } from "@/content/papers/12-lora/content";
import { meta as dpo } from "@/content/papers/13-dpo/content";

/**
 * Every paper's metadata. Interactive demos are registered separately in
 * `content/interactives.tsx` so the homepage does not load them.
 * Adding a paper: see README, "Adding a new paper".
 */
export const papers: PaperMeta[] = [word2vec, glove, seq2seq, attention, transformer, bert, gpt2, gpt3, scaling, instruct, chinchilla, lora, dpo];

export function learningOrder(): PaperMeta[] {
  return [...papers].sort((a, b) => a.sent.localeCompare(b.sent) || a.number - b.number);
}

export function papersNewestFirst(): PaperMeta[] {
  return [...learningOrder()].reverse();
}

export function getPaper(slug: string): PaperMeta | undefined {
  return papers.find((paper) => paper.slug === slug);
}

export function paperNeighbors(slug: string): { prev: PaperMeta | null; next: PaperMeta | null } {
  const order = learningOrder();
  const index = order.findIndex((paper) => paper.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? order[index - 1] : null,
    next: index < order.length - 1 ? order[index + 1] : null,
  };
}
