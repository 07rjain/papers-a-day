import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 4,
  slug: "04-bahdanau-attention",
  title: "Neural Machine Translation by Jointly Learning to Align and Translate",
  authors: "Dzmitry Bahdanau, Kyunghyun Cho, Yoshua Bengio",
  year: 2014,
  url: "https://arxiv.org/abs/1409.0473",
  sent: "2026-11-02",
  hook: "Each output word gets its own look back at the input, instead of one fixed vector for the whole sentence.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Neural Machine Translation by Jointly Learning to Align and Translate",
        href: "https://arxiv.org/abs/1409.0473",
      },
      ' by Bahdanau, Cho and Bengio (2014). It picks up right where yesterday\'s seq2seq left off, and it\'s where "attention" comes from.',
    ],
    [
      'Seq2seq had to squeeze a whole sentence into one vector before writing the translation, so long sentences fell apart. This paper keeps a separate vector for every input word instead. Each time the decoder is about to write a word, it scores how relevant each input word is at that moment and turns those scores into weights that add up to 1. Then it blends the word vectors using those weights. So when it writes "zone" it mostly looks at "Area", and when it writes "la" it glances at both "the" and "Area". In the paper\'s tests, the old model got much worse on long sentences, while the attention model held steady even past 50 words.',
    ],
  ],
  question:
    'In your own words, how is the "context vector" here different from the single vector in seq2seq, and why does that help with long sentences?',
  answer:
    "In seq2seq there's one fixed vector for the whole sentence, used for every output word. Here a fresh context vector is built for each output word: a weighted average of all the input words' vectors, with weights (summing to 1) chosen for that step. The decoder can look straight back at the relevant input words, so nothing has to fit into a single bottleneck, and long sentences don't lose information.",
} satisfies PaperMeta;
