import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 21,
  slug: "21-constitutional-ai",
  title: "Constitutional AI: Harmlessness from AI Feedback",
  authors:
    "Yuntao Bai, Saurav Kadavath, Sandipan Kundu, Amanda Askell, Jackson Kernion, and colleagues through Jared Kaplan, Anthropic",
  year: 2022,
  url: "https://arxiv.org/abs/2212.08073",
  sent: "2026-11-19",
  hook: "A short written constitution replaces human harmlessness labels. The model critiques itself, then an AI ranks the answers.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Constitutional AI: Harmlessness from AI Feedback",
        href: "https://arxiv.org/abs/2212.08073",
      },
      " by Yuntao Bai, Jared Kaplan, and colleagues at Anthropic (2022). InstructGPT taught models to be helpful with RLHF: people compare pairs of answers and the model learns what they prefer. Doing the same for harmlessness means people spend their days baiting a model into saying awful things and labeling the results. It is slow, nobody can read what tens of thousands of labels actually taught the model, and the labels rewarded dodging: the careful assistant often just said it could not answer.",
    ],
    [
      "Constitutional AI swaps those labels for a constitution: 16 short principles in plain English, such as choosing the response that a wise, ethical, polite, and friendly person would more likely say. First, the model answers a provocative prompt, critiques its own answer against a randomly drawn principle, and rewrites it. It is then fine-tuned on the rewrites. Then the model writes two answers and an AI, not a person, picks the less harmful one by a principle. Those AI labels, 182,831 of them, train the preference model, and reinforcement learning proceeds just as in RLHF. With no human labels for harm, the 52 billion parameter model was judged more harmless than the human-feedback version at the same helpfulness, and it explains why it will not help instead of shutting down. Helpfulness still used human labels, the principles were chosen ad hoc, and over-training made it preachy, with boilerplate such as \"you are valid, valued, and cared for\". Prompts, principles, and samples are at ",
      { text: "ConstitutionalHarmlessnessPaper", href: "https://github.com/anthropics/ConstitutionalHarmlessnessPaper" },
      ". No model weights were released.",
    ],
  ],
  question:
    "In your own words, how does Constitutional AI teach a model to be harmless without humans labeling harmful answers, and why does that lead to an assistant that explains its objections instead of just refusing?",
  answer:
    "Humans write only a short list of principles, 16 of them, plus a few examples. In the supervised stage, a helpful-only model answers red-team prompts, critiques its own answer against a randomly sampled principle, and revises it up to four times. A pretrained model is fine-tuned on those revisions plus helpful answers. In the reinforcement-learning stage, that model writes two answers. A feedback model answers a multiple-choice question, which response is less harmful, under a sampled principle. Its normalized probabilities for the two options become soft labels: 182,831 AI harmlessness comparisons mixed with 135,296 human helpfulness comparisons. A preference model is trained on those labels, and reinforcement learning against it proceeds as in RLHF. Chain-of-thought labels are clamped to 40–60% so the policy does not learn extreme answers. The assistant explains instead of refusing because the older harmlessness labels had rewarded flat refusals, the revisions explain the problem, some principles warn against being preachy, and the helpfulness reward is still in the preference model. The result is more harmless at similar helpfulness, and virtually never evasive. Helpfulness is still human-labeled, the principles are ad hoc, and over-training produces boilerplate.",
} satisfies PaperMeta;
