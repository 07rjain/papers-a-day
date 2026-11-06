import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 8,
  slug: "08-gpt3",
  title: "Language Models are Few-Shot Learners",
  authors: "Tom B. Brown et al., OpenAI",
  year: 2020,
  url: "https://arxiv.org/abs/2005.14165",
  sent: "2026-11-06",
  hook: "Paste a few examples into the prompt, and a 175-billion-parameter model often rivals fine-tuning.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Language Models are Few-Shot Learners",
        href: "https://arxiv.org/abs/2005.14165",
      },
      " by Brown and others at OpenAI (2020) — the GPT-3 paper. It follows yesterday's GPT-2 idea: a big decoder language model that predicts the next word. GPT-3 turns the dial way up to 175 billion parameters and asks a simple question: what if, instead of fine-tuning, you just paste a few examples into the prompt?",
    ],
    [
      "That is zero-shot, one-shot and few-shot learning: how many worked examples you put in the context (none, one, or a handful), with the model's weights left completely frozen. No new training run. On many tasks, few-shot GPT-3 comes surprisingly close to models that were fine-tuned on thousands of labeled examples — and as the model gets bigger, those in-prompt examples help more, not less.",
    ],
  ],
  question:
    "In your own words, what is the difference between fine-tuning and few-shot (in-context) learning in this paper, and why might a bigger model be better at learning from just a few examples in the prompt?",
  answer:
    "Fine-tuning updates the model's weights on thousands of labeled examples for one task. Few-shot / in-context learning leaves the weights frozen: you put a few demos (and maybe an instruction) in the prompt and the model continues by next-token prediction. Bigger models absorb more skills in pretraining and use in-context demos more efficiently (steeper in-context learning curves in the paper), so the gap between zero-shot and few-shot often grows with size.",
} satisfies PaperMeta;
