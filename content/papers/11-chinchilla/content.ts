import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 11,
  slug: "11-chinchilla",
  title: "Training Compute-Optimal Large Language Models",
  authors: "Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch et al., DeepMind",
  year: 2022,
  url: "https://arxiv.org/abs/2203.15556",
  sent: "2026-11-09",
  hook: "For a fixed compute budget, grow the model and the data together — about 20 tokens per parameter — and a 4× smaller model beats the giant.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Training Compute-Optimal Large Language Models",
        href: "https://arxiv.org/abs/2203.15556",
      },
      " by Hoffmann and others at DeepMind (2022), better known as Chinchilla. It goes back to the scaling-laws question from paper #9: if you have a fixed compute budget, how big should the model be, and how much text should it read? Kaplan's answer was \"mostly make the model bigger,\" so GPT-3, Gopher and friends grew huge while all reading about the same 300 billion tokens.",
    ],
    [
      "DeepMind trained over 400 models and found the opposite balance: model size and data should grow together, roughly 20 training tokens per parameter. By that rule the giants were undertrained. To prove it they trained Chinchilla with the same compute as their 280B Gopher, but only 70B parameters on 1.4 trillion tokens, and it beat Gopher, GPT-3 and the 530B MT-NLG on nearly everything (67.5% vs 60.0% on the MMLU exam benchmark). Bonus: a 4x smaller model is much cheaper to run every time someone uses it.",
    ],
  ],
  question:
    "In your own words, Gopher and Chinchilla used the same compute, so why did the smaller model win, and why does that matter even after training is done?",
  answer:
    "Compute is about 6 × parameters × tokens, so one budget can buy a big model that sees little data or a smaller one that sees much more. Loss has a \"model too small\" part and a \"too little data\" part; Gopher (280B on 300B tokens) paid a big data penalty while Chinchilla (70B on 1.4T) balanced both, giving lower loss and better benchmarks. After training, every use of the model costs roughly in proportion to its size, so a 4x smaller and better model is much cheaper to serve and fine-tune.",
} satisfies PaperMeta;
