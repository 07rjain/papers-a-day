import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 10,
  slug: "10-instructgpt",
  title: "Training language models to follow instructions with human feedback",
  authors:
    "Long Ouyang, Jeff Wu, Xu Jiang, Diogo Almeida, Carroll L. Wainwright, Pamela Mishkin et al., OpenAI",
  year: 2022,
  url: "https://arxiv.org/abs/2203.02155",
  sent: "2026-11-08",
  hook: "Ask people which answers they like, then train GPT-3 to match that taste — a 1.3B model beats 175B GPT-3.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Training language models to follow instructions with human feedback",
        href: "https://arxiv.org/abs/2203.02155",
      },
      " by Ouyang and others at OpenAI (2022), the InstructGPT paper. GPT-3 was trained to continue internet text, so asking it a question often got you more questions, a ramble, or something made up. Predicting the next word just isn't the same goal as being helpful.",
    ],
    [
      "The fix has three steps. People wrote good answers and GPT-3 was fine-tuned to copy them. Then people ranked several model answers from best to worst, and a separate reward model learned to score answers the way they would. Finally the model practiced with reinforcement learning (PPO) to earn high scores from that reward model, with a leash (a KL penalty) so it couldn't drift into weird answers that just fool the scorer. The result: labelers preferred a 1.3B InstructGPT over the 175B GPT-3, a model 100x bigger. This recipe, RLHF, is what ChatGPT was built on.",
    ],
  ],
  question:
    "In your own words, why does InstructGPT need a separate reward model instead of just asking humans to score every answer during training, and what would go wrong if the PPO step had no KL penalty?",
  answer:
    "RL needs a reward for a huge number of sampled answers; humans can't score them all live, so a reward model learns their preferences from a limited set of rankings and then scores any answer instantly (rankings are also easier and more consistent than absolute scores). Without the KL penalty the policy over-optimizes the imperfect reward model, drifting into odd outputs it overrates (reward hacking) and losing the SFT model's fluency and knowledge.",
} satisfies PaperMeta;
