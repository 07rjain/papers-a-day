import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 6,
  slug: "06-bert",
  title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
  authors: "Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova",
  year: 2018,
  url: "https://arxiv.org/abs/1810.04805",
  sent: "2026-11-04",
  hook: "Hide words and guess them from both sides, then reuse that one encoder for almost any language task.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        href: "https://arxiv.org/abs/1810.04805",
      },
      " by Devlin, Chang, Lee and Toutanova (2018). It takes yesterday's Transformer and keeps only the encoder half.",
    ],
    [
      'Older language models read left to right and guessed the next word, so they only used the words before a gap. BERT wants both sides: "The man went to the ___ to buy milk" is easy once you see "to buy milk". But if every word can see both sides, a word-guessing model could just peek at the answer. So BERT plays fill-in-the-blank instead: it hides about 15% of the words (mostly with a [MASK] token, sometimes a random word, sometimes leaving it alone) and learns to recover them from everything around them. It also learns to tell whether sentence B really came after sentence A.',
    ],
    [
      "After pre-training on about 3.3 billion words of books and Wikipedia, the same model is fine-tuned for each task by adding one tiny output layer and training a little more. That one recipe set new records on 11 language tasks, including GLUE and the SQuAD question-answering benchmark.",
    ],
  ],
  question:
    "In your own words, why does BERT hide words with [MASK] instead of just predicting the next word like a normal language model?",
  answer:
    "Next-word prediction only lets a model use the left side of the sentence. BERT wants every word's representation to use both sides, but in a bidirectional model each position can see the word it's meant to predict, so the task would be trivial. Masking hides the target word so the model has to work it out from the context on both sides. (The 80/10/10 mix of [MASK], random and unchanged words avoids a mismatch, since [MASK] never appears during fine-tuning.)",
} satisfies PaperMeta;
