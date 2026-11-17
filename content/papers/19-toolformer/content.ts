import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 19,
  slug: "19-toolformer",
  title: "Toolformer: Language Models Can Teach Themselves to Use Tools",
  authors:
    "Timo Schick, Jane Dwivedi-Yu, Roberto Dessì, Roberta Raileanu, Maria Lomeli, Luke Zettlemoyer, Nicola Cancedda, Thomas Scialom, Meta AI, and Universitat Pompeu Fabra",
  year: 2023,
  url: "https://arxiv.org/abs/2302.04761",
  sent: "2026-11-17",
  hook: "The model writes its own tool calls, keeps the ones that make the next words easier, and fine-tunes on those.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Toolformer: Language Models Can Teach Themselves to Use Tools",
        href: "https://arxiv.org/abs/2302.04761",
      },
      " by Timo Schick and colleagues at Meta AI (NeurIPS 2023). ReAct and Reflexion got models to use tools by prompting: show a big model a few examples of searching, and it copies the pattern. Nothing inside the model learns what tools are for. Meanwhile, language models are oddly bad at what a calculator or a search box does easily: exact arithmetic, looking up facts, knowing today's date. Teaching them to call tools usually takes lots of human-written examples.",
    ],
    [
      "Toolformer lets the model write its own lessons. From a few examples per tool, GPT-J (6.7B) goes through ordinary web text and suggests calls where they might help, like \"[Calculator(400 / 1400) → 0.29]\" just before \"29%\". Each call is actually run, and one test decides whether it stays: with the call and its answer in front of it, does the model predict the next words better? Only calls that clearly help are kept. The model is fine-tuned on that text and then calls tools by itself as it writes. It beat the 25 times larger GPT-3 on math word problems (40.4 vs 14.0 on ASDiv) and fact completion, and got no worse at ordinary language. The limits: it can't chain tools together or refine a search. The authors did not release official code.",
    ],
  ],
  question:
    "In your own words, how does Toolformer decide which API calls are worth keeping in its training data, and why does that let the model learn tool use without humans labeling examples?",
  answer:
    "The model proposes calls in ordinary text itself, from a few demonstrations in a prompt. Every call is executed, and a call is kept only if the call plus its result lowers the model's loss on the next few tokens by at least τf (1.0) versus both no call and the call without its result. Useful is measured by the model's own prediction loss on text that already contains the answer, so no human labels where a tool helps or what to ask. Fine-tuning on the kept calls, the same texts plus the calls, teaches when to call, which tool, and what input, without losing language skill (perplexity 10.5 versus 10.5). A 6.7B Toolformer beats 175B GPT-3 on math (ASDiv 40.4 versus 14.0, calculator used on 97.9%) and on LAMA (T-REx 53.5 versus 39.8). The filter is noisy, the method is sample-inefficient, and because calls are sampled independently it cannot chain tools or search interactively.",
} satisfies PaperMeta;
