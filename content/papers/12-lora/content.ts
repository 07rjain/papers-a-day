import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 12,
  slug: "12-lora",
  title: "LoRA: Low-Rank Adaptation of Large Language Models",
  authors:
    "Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen, Microsoft",
  year: 2021,
  url: "https://arxiv.org/abs/2106.09685",
  sent: "2026-11-10",
  hook: "Freeze the giant model and learn only a small low-rank update, then fold it back in so the model runs just as fast.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "LoRA: Low-Rank Adaptation of Large Language Models",
        href: "https://arxiv.org/abs/2106.09685",
      },
      " by Hu and others at Microsoft (2021). Remember InstructGPT: to teach GPT-3 new behaviour, it kept training all 175 billion numbers. That works, but every fine-tuned copy is another giant model, and training needs huge amounts of GPU memory to track every one of those numbers. Want a separate model for each task? That means a separate 350GB copy each time.",
    ],
    [
      "LoRA's bet is that the change fine-tuning makes is simple, even though the model is huge. So it freezes the original weights and learns the change as two skinny matrices multiplied together, B times A, which together can only push things in a few directions (a low \"rank\"). For GPT-3 that is about 4.7 million trainable numbers instead of 175 billion, using about 3x less GPU memory, and it matches or beats full fine-tuning. When training is done you just add B·A into the original weights, so the model is the same size and runs just as fast. Switching tasks means swapping a file of a few megabytes.",
    ],
  ],
  question:
    "In your own words, why can LoRA fine-tune a huge model by training only two small matrices, and why does it add no extra delay when the model is used?",
  answer:
    "The change fine-tuning needs has a very low \"intrinsic rank\": it only matters in a few directions. So instead of learning a full d × d change, LoRA learns B (d × r) times A (r × d) with a tiny r (even 1 or 2 works on GPT-3) while the original weights stay frozen. That is 2·d·r numbers instead of d², and no gradients or optimizer state for the frozen weights (trainable parameters down up to 10,000x, training memory 1.2TB → 350GB), with quality on par with or better than full fine-tuning. No extra delay because B·A has the same shape as W0: after training you merge W = W0 + B·A once and the model does exactly the same computation as before. Adapters instead add extra layers that run in sequence, which the paper measured as up to about 30% slower at batch size 1.",
} satisfies PaperMeta;
