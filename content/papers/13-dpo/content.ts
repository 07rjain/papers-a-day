import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 13,
  slug: "13-dpo",
  title: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model",
  authors:
    "Rafael Rafailov, Archit Sharma, Eric Mitchell, Stefano Ermon, Christopher D. Manning, Chelsea Finn, Stanford",
  year: 2023,
  url: "https://arxiv.org/abs/2305.18290",
  sent: "2026-11-11",
  hook: "Skip the reward model and the RL loop: train directly on which answer people preferred, with β as the leash.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model",
        href: "https://arxiv.org/abs/2305.18290",
      },
      " by Rafailov, Sharma, Mitchell (equal contribution) and others at Stanford (NeurIPS 2023), better known as DPO. Remember InstructGPT: people compare pairs of answers, a separate reward model learns to score answers the way they would, and then reinforcement learning (PPO) pushes the model toward high scores, with a leash so it doesn't drift too far from where it started. It works, but it's a fiddly machine with extra models, sampling during training, and a reputation for being unstable.",
    ],
    [
      "DPO's trick is a bit of math: for that exact goal, the best possible model is just the starting model re-weighted by the reward. Flip that around and the reward can be read straight off the model itself, as how much more likely it makes an answer than the frozen starting model did. So you skip the reward model and the RL entirely and train on the preference pairs directly: make the chosen answer more likely and the rejected one less likely, with a loss as simple as a yes/no classifier. On Reddit summaries it won about 61% of the time against human-written summaries versus 57% for PPO, and human raters preferred it over PPO 58% of the time.",
    ],
  ],
  question:
    "In your own words: how can DPO learn from human preferences without ever training a separate reward model, and what job does β do?",
  answer:
    "For RLHF's goal (maximize reward but stay close to the reference model), the best possible model is just the reference re-weighted by exp(reward/β). Reversing that, any model defines a reward: β × log(its probability of an answer ÷ the reference's probability). So the language model itself acts as the reward model, and training it with a logistic (classification-style) loss to give the chosen answer a higher implicit reward than the rejected one solves the same problem as reward-model-plus-PPO, with no sampling or RL. β is the leash: it sets how strongly the model is tied to the reference; small β lets it move further to satisfy preferences, large β keeps it close (like InstructGPT's KL penalty), and it also scales the reward so the loss stops pushing once pairs are clearly separated.",
} satisfies PaperMeta;
