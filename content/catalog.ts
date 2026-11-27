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
import { meta as cot } from "@/content/papers/14-chain-of-thought/content";
import { meta as selfConsistency } from "@/content/papers/15-self-consistency/content";
import { meta as react } from "@/content/papers/16-react/content";
import { meta as tot } from "@/content/papers/17-tree-of-thoughts/content";
import { meta as reflexion } from "@/content/papers/18-reflexion/content";
import { meta as toolformer } from "@/content/papers/19-toolformer/content";
import { meta as rag } from "@/content/papers/20-rag/content";
import { meta as cai } from "@/content/papers/21-constitutional-ai/content";
import { meta as mixtral } from "@/content/papers/22-mixtral/content";
import { meta as deepseekR1 } from "@/content/papers/23-deepseek-r1/content";
import { meta as llama2 } from "@/content/papers/24-llama-2/content";
import { meta as flashAttention } from "@/content/papers/25-flashattention/content";
import { meta as mamba } from "@/content/papers/26-mamba/content";

/**
 * Every paper's metadata. Interactive demos are registered separately in
 * `content/interactives.tsx` so the homepage does not load them.
 * Adding a paper: see README, "Adding a new paper".
 */
export const papers: PaperMeta[] = [word2vec, glove, seq2seq, attention, transformer, bert, gpt2, gpt3, scaling, instruct, chinchilla, lora, dpo, cot, selfConsistency, react, tot, reflexion, toolformer, rag, cai, mixtral, deepseekR1, llama2, flashAttention, mamba];

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
