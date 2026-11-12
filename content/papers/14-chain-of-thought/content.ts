import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 14,
  slug: "14-chain-of-thought",
  title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
  authors:
    "Jason Wei, Xuezhi Wang, Dale Schuurmans, Maarten Bosma, Brian Ichter, Fei Xia, Ed H. Chi, Quoc V. Le, Denny Zhou, Google Research",
  year: 2022,
  url: "https://arxiv.org/abs/2201.11903",
  sent: "2026-11-12",
  hook: "Show a few worked examples, and a large enough model writes its own steps before the answer.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
        href: "https://arxiv.org/abs/2201.11903",
      },
      " by Jason Wei, Denny Zhou and others at Google Research (NeurIPS 2022). Remember GPT-3: you show a model a few examples in the prompt and it continues the pattern. That worked for lots of tasks, but multi-step problems like math word problems stayed stubbornly hard, and making models bigger barely helped. The examples only showed a question and its final answer, so the model had to leap straight to the answer.",
    ],
    [
      "The fix is tiny: in the eight examples, write out the working before the answer, like a student would (\"23 − 20 = 3, then 3 + 6 = 9\"). The model copies that style, writes its own steps, and gets far more right. The catch is it only works in very large models (around 100 billion parameters and up); small ones write fluent nonsense. With it, PaLM 540B jumped from 17.9% to 56.9% on GSM8K grade-school math, beating a GPT-3 specially fine-tuned for the job. And a neat test showed the steps must come before the answer: reasoning written after the answer helped not at all.",
    ],
  ],
  question:
    "In your own words: why does showing worked examples help a big model solve multi-step problems, and why do the steps have to come before the answer?",
  answer:
    "The model copies the style of its examples. When the examples show their working, it writes its own small steps, and each step it writes becomes part of the text it reads while producing the next token, so every token only has to do a small bit of the problem instead of the whole thing at once. It only works in big models (~100B+), which can actually produce sensible steps; small ones write fluent nonsense. The ablation shows it's the steps that matter: reasoning written after the answer scored like no reasoning (6.1% vs 6.5% on GSM8K for LaMDA 137B) because by then the answer is already chosen; and dots of the same length (extra compute alone) didn't help either. Steps first means the answer is computed from them.",
} satisfies PaperMeta;
