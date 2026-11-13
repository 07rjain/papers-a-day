import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 15,
  slug: "15-self-consistency",
  title: "Self-Consistency Improves Chain of Thought Reasoning in Language Models",
  authors:
    "Xuezhi Wang, Jason Wei, Dale Schuurmans, Quoc Le, Ed H. Chi, Sharan Narang, Aakanksha Chowdhery, Denny Zhou, Google Research",
  year: 2023,
  url: "https://arxiv.org/abs/2203.11171",
  sent: "2026-11-13",
  hook: "Sample many reasoning paths from the same prompt, then keep the answer they agree on.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Self-Consistency Improves Chain of Thought Reasoning in Language Models",
        href: "https://arxiv.org/abs/2203.11171",
      },
      " by Xuezhi Wang, Jason Wei, Denny Zhou and others at Google Research (ICLR 2023). Chain-of-thought prompting got big models to write out their working, but the model still wrote just one chain, always picking the most likely next word. One early slip and the whole answer is wrong.",
    ],
    [
      "Self-consistency asks the same model the same question many times with a bit of randomness turned on, so it writes different chains, then ignores the chains and counts the final answers. There are many ways to reason to the right answer, but mistakes scatter in different directions, so the right answer usually gets the most votes. No training and no extra model: PaLM 540B went from 56.5% to 74.4% on GSM8K math, and a plain vote worked as well as fancier weighting.",
    ],
  ],
  question:
    "In your own words: why can the most common answer across many sampled reasoning paths be right even when fewer than half of the paths are right, and when would voting stop helping?",
  answer:
    "Correct reasoning paths, however different, all land on the same answer, but mistakes are varied, so wrong paths split their votes across many different wrong answers. The right answer only needs more votes than any single wrong answer, not more than half (for example 40% right while wrong paths split 25/20/15). Voting stops helping when the wrong paths make the same mistake and clump on one wrong answer, when the model almost never gets it right (UL2 20B scores 0% on 4-word last letters either way), or when the outputs aren't diverse (beam search, or short equation-only chains, gained much less). The share of paths agreeing also works as a confidence signal, and simple counting matched probability-weighted voting (74.4 vs 74.1 on PaLM 540B GSM8K).",
} satisfies PaperMeta;
