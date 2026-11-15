import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 17,
  slug: "17-tree-of-thoughts",
  title: "Tree of Thoughts: Deliberate Problem Solving with Large Language Models",
  authors:
    "Shunyu Yao, Dian Yu, Jeffrey Zhao, Izhak Shafran, Thomas L. Griffiths, Yuan Cao, Karthik Narasimhan, Princeton and Google DeepMind",
  year: 2023,
  url: "https://arxiv.org/abs/2305.10601",
  sent: "2026-11-15",
  hook: "Propose several next steps, grade them, and back up from dead ends instead of committing to one chain.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Tree of Thoughts: Deliberate Problem Solving with Large Language Models",
        href: "https://arxiv.org/abs/2305.10601",
      },
      " by Shunyu Yao and colleagues at Princeton and Google DeepMind (NeurIPS 2023). Chain of thought writes one line of reasoning and never goes back. Self-consistency writes many lines and votes on the finished answers. ReAct lets the model act in the world. Every chain still makes its early choices blindly, and in a puzzle one bad first step dooms everything after it. In the Game of 24, use four numbers and +, −, ×, and ÷ to make 24. About 60% of GPT-4's chain-of-thought attempts were already lost after the first equation.",
    ],
    [
      "Tree of Thoughts turns solving into a search. At each step the model proposes a few possible next moves, then judges each resulting position itself: sure, maybe, or impossible to still reach 24. It keeps the promising branches, drops the hopeless ones, and can back up from dead ends. Same GPT-4, no training: Game of 24 went from 4% with chain of thought to 74% with a breadth of 5, and mini-crossword words from 15.6% to 60%. The price is many more model calls. The code and prompts are at ",
      { text: "princeton-nlp/tree-of-thought-llm", href: "https://github.com/princeton-nlp/tree-of-thought-llm" },
      ".",
    ],
  ],
  question:
    "In your own words, why does exploring a tree of thoughts, with the model grading its own partial steps, beat writing one chain, or even voting over many complete chains, on a puzzle like the Game of 24?",
  answer:
    "A single chain commits to its first step and can never go back, so one bad early choice dooms everything after it. About 60% of GPT-4's chain-of-thought attempts on Game of 24 were already dead after the first equation. Voting only compares finished answers. Every chain still makes its early choices blindly, so most chains fail the same way: self-consistency over 100 samples reached 9%. Tree of Thoughts decides at each step. It lays out several possible next moves, has the model judge which partial states can still work, keeps the promising ones, drops the hopeless ones early, and, in depth-first search, backs up from dead ends. Judging a partial state is often easier than solving the whole puzzle in one go. The result is 4% to 74% at breadth 5, and breadth matters: breadth 1 is 45%. In crosswords, removing pruning or backtracking cuts word accuracy from 60% to 41.5% or 20%. The cost is more model calls, about $0.74 versus $0.47 per puzzle against the best of 100 chain-of-thought samples, and it only helps when the grader is decent.",
} satisfies PaperMeta;
