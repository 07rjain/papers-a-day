import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 3,
  slug: "03-seq2seq",
  title: "Sequence to Sequence Learning with Neural Networks",
  authors: "Ilya Sutskever, Oriol Vinyals, Quoc V. Le",
  year: 2014,
  url: "https://arxiv.org/abs/1409.3215",
  sent: "2026-11-01",
  hook: "An encoder squeezes a whole sentence into one vector, and a decoder writes the translation one word at a time.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Sequence to Sequence Learning with Neural Networks",
        href: "https://arxiv.org/abs/1409.3215",
      },
      " by Sutskever, Vinyals and Le at Google (2014). Word2vec and GloVe gave every word a vector. This paper goes further and turns a whole sentence into another sentence, like English into French, even when the two are different lengths.",
    ],
    [
      'It works with two networks as a pair. The first, called the encoder, reads the English one word at a time and squeezes the whole sentence into a single list of numbers. The second, called the decoder, starts from that list and writes the French one word at a time until it says "end of sentence". This was the first time a purely neural translator clearly beat the classic statistical systems, scoring 34.8 against 33.3 on a standard translation benchmark. A funny detail: just feeding the English in backwards made it a lot better.',
    ],
    [
      "On your page you can step through the encoder and decoder, see why reversing the input helps, and compare two ways of picking the next word, greedy and beam search. There's a quiz at the end too.",
    ],
  ],
  question:
    "In your own words, why could squeezing a whole sentence into one fixed-size vector be a problem, especially for long sentences?",
  answer:
    "The vector is the same size whether the sentence has 5 words or 50, so it's a bottleneck. In a long sentence, details (especially from the early words) get overwritten or blurred as the encoder reads on, and the decoder can't look back at the original words. Quality drops as sentences get longer, and that's the problem attention was built to fix.",
} satisfies PaperMeta;
