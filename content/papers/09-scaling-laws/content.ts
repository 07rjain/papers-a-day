import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 9,
  slug: "09-scaling-laws",
  title: "Scaling Laws for Neural Language Models",
  authors:
    "Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child, Scott Gray, Alec Radford, Jeffrey Wu, Dario Amodei, OpenAI / Johns Hopkins",
  year: 2020,
  url: "https://arxiv.org/abs/2001.08361",
  sent: "2026-11-07",
  hook: "Loss falls on a predictable power law as you scale parameters, data, and compute, so you can forecast a bigger model before you build it.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Scaling Laws for Neural Language Models",
        href: "https://arxiv.org/abs/2001.08361",
      },
      " by Kaplan and others at OpenAI (2020). GPT-2 and GPT-3 kept getting better as they got bigger. This paper asks exactly how much better, and what you should make bigger. The team trained hundreds of Transformer language models, from tiny up to 1.5 billion parameters, and measured how the loss (how surprised the model is by the next word) changes.",
    ],
    [
      "The answer is tidy: loss falls along a smooth power law as you grow the model, the data, or the compute, as long as the other two aren't holding it back. Each 10x bigger model has about 16% lower loss, and the network's shape (deep vs wide) barely matters. Bigger models also learn more from each example, so with a fixed budget the best move is to train a very big model and stop before it fully converges. That gave OpenAI a measured reason to bet on a 175B GPT-3.",
    ],
  ],
  question:
    "In your own words, if someone gave you 10x more compute to train a language model, how would this paper tell you to spend it, and why?",
  answer:
    "Mostly on a bigger model. The compute-optimal model size grows as C^0.73 (about 5x per 10x of compute), the data processed grows only about 2x, and serial training steps barely grow (C^0.03). The reason is sample efficiency: larger models reach the same loss with fewer tokens and steps, so it is cheaper to train a big model short of convergence than a small one to convergence. You still need enough data to avoid overfitting (the penalty depends on N^0.74 / D, so 8x bigger needs about 5x more data). Later work (Chinchilla, 2022) argued for a more even split between model size and data.",
} satisfies PaperMeta;
