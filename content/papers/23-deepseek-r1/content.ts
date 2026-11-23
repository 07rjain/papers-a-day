import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 23,
  slug: "23-deepseek-r1",
  title: "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning",
  authors: "DeepSeek-AI, about 200 contributors listed in the paper's appendix",
  year: 2025,
  url: "https://arxiv.org/abs/2501.12948",
  sent: "2026-11-23",
  hook: "Reward only a checkable final answer. Long reasoning, including an \"aha\" check, shows up without worked examples.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning",
        href: "https://arxiv.org/abs/2501.12948",
      },
      " by DeepSeek-AI (2025). Chain-of-thought showed that models answer better when they write out their reasoning, but teaching a model to reason well usually meant feeding it piles of worked examples written by people, then tuning it with human feedback. OpenAI's o1 had shown that a model that thinks longer gets much better at maths and code, but not how it was trained.",
    ],
    [
      "DeepSeek tried the bluntest possible version: skip the worked examples. Their base model gets maths and coding problems, writes several attempts at each (\"think, then answer\"), and a simple program checks the final answers. GRPO, the reinforcement-learning method, compares each attempt with the average of its own group and makes the better-than-average ones more likely. That model, R1-Zero, went from 15.6% to 71.0% on the AIME 2024 maths exam (86.7% with majority voting), and on its own learned to think longer, re-check its work, and even write \"Wait, wait. Wait. That's an aha moment I can flag here.\" Its thinking was messy, though: hard to read, with languages mixed together. So DeepSeek-R1 adds a few thousand readable examples first, then the same reinforcement learning, plus more fine-tuning and a final round. It performs about as well as OpenAI's o1 on reasoning tests, and its outputs taught small open models to reason better than reinforcement learning on those small models could. Code and weights are at ",
      { text: "deepseek-ai/DeepSeek-R1", href: "https://github.com/deepseek-ai/DeepSeek-R1" },
      ".",
    ],
  ],
  question:
    "In your own words, how does DeepSeek-R1-Zero learn to reason with reinforcement learning without any human-written reasoning examples, and what does GRPO compare each answer against?",
  answer:
    "R1-Zero starts from DeepSeek-V3-Base, a 671 billion parameter mixture of experts with 37 billion active, and no supervised fine-tuning. A template only asks for a think block and then an answer. Nothing says how to reason. For each maths or code question, GRPO samples a group of answers, and simple rules score them: an accuracy reward if the boxed answer matches or the tests pass, plus a format reward for the tags. There is no neural reward model and no human grader. Each answer is compared with its own group: advantage is (reward − group mean) / group standard deviation. Above-average answers become more likely and below-average ones less likely, with a clipped update and a KL penalty to a reference model. If the whole group gets the same reward, every advantage is 0 and that question teaches nothing. Over thousands of steps, habits that lead to right answers are reinforced. AIME 2024 pass@1 rose from 15.6% to 71.0%, and to 86.7% with majority voting. Answers grew from hundreds to thousands of tokens, and reflection showed up, including the quoted aha line. Readability and language mixing led R1 to add a cold start, a language-consistency reward, rejection-sampling fine-tuning on about 800,000 samples, and a final reinforcement-learning stage. R1 is close to OpenAI-o1-1217 on AIME (79.8% versus 79.2%) and MATH-500 (97.3% versus 96.4%). Distilling R1 into Qwen-32B beat running the same RL on that small model, 72.6% versus 47.0% on AIME.",
} satisfies PaperMeta;
