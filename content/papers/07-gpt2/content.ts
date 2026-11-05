import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 7,
  slug: "07-gpt2",
  title: "Language Models are Unsupervised Multitask Learners",
  authors: "Alec Radford, Jeffrey Wu, Rewon Child, David Luan, Dario Amodei, Ilya Sutskever, OpenAI",
  year: 2019,
  url: "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf",
  sent: "2026-11-05",
  hook: "A big left-to-right language model starts doing tasks from a prompt alone, with no fine-tuning.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Language Models are Unsupervised Multitask Learners",
        href: "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf",
      },
      " by Radford, Wu, Child, Luan, Amodei and Sutskever at OpenAI (2019) — the GPT-2 paper. Yesterday BERT kept the Transformer's encoder and filled in masked words from both sides. GPT-2 takes the other half: the decoder, reading left to right and guessing the next word.",
    ],
    [
      'They trained it on WebText, about 8 million web pages (around 40GB) linked from Reddit posts with at least 3 karma, in four sizes up to 1.5 billion parameters. The claim is that once the model is big enough and the training text is diverse enough, it starts doing downstream tasks from a natural-language prompt alone — no fine-tuning, no new heads. Append "TL;DR:" and it tries to summarise; show a few English–French lines and it continues the pattern; put a document, a question and "A:" and it answers. On CoQA it scored 55 F1 zero-shot, matching or beating 3 of 4 supervised baselines without using the 127k training examples, and it set zero-shot records on 7 of 8 language-modelling datasets. Bigger models did better in a smooth way (LAMBADA accuracy climbed from about 46% at 117M to about 63% at 1.5B). Summarisation with the TL;DR cue stayed only rudimentary.',
    ],
  ],
  question:
    "In your own words, why can a model trained only to predict the next word start answering questions or summarizing just from a prompt, and why does making the model bigger help?",
  answer:
    "The training corpus contains many natural demonstrations of those tasks (Q&A, TL;DR summaries, translation pairs). Predicting the next token on that data presses the model to continue in the same pattern when given a similar prompt (zero-shot task transfer). Larger capacity improves this in a log-linear way across tasks in the paper's plots — small models barely beat trivial baselines; GPT-2 starts to show real zero-shot skill.",
} satisfies PaperMeta;
