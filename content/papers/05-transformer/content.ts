import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 5,
  slug: "05-transformer",
  title: "Attention Is All You Need",
  authors:
    "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin",
  year: 2017,
  url: "https://arxiv.org/abs/1706.03762",
  sent: "2026-11-03",
  hook: "Throw away the word-by-word recurrent network and let every word look at every other word at the same time.",
  explanation: [
    [
      "Today's paper is the big one: ",
      { text: "Attention Is All You Need", href: "https://arxiv.org/abs/1706.03762" },
      " by Vaswani and others (2017), the paper that introduced the Transformer.",
    ],
    [
      "Yesterday's Bahdanau model still read the sentence one word at a time with a recurrent network, called an RNN, and added attention on top. This paper asks what happens if the whole model is attention. Each word makes three small vectors: a query (what am I looking for?), a key (what do I contain?) and a value (what do I pass along?). Every word compares its query with every other word's key, softmax turns those scores into weights, and the word's new meaning becomes a weighted mix of everyone's values. The whole sentence does this at once instead of step by step, so training is much faster and words that are far apart can connect directly.",
    ],
    [
      "There are a few extra pieces. Several attention \"heads\" run side by side, so each one can track a different kind of relationship. Sine-wave position signals tell the model the word order, because attention on its own can't see order. And in the decoder, a mask stops the model from peeking at words it hasn't written yet. This is the design behind BERT and GPT, which come next.",
    ],
  ],
  question:
    "In your own words, what do the query, the key and the value each do in self-attention, and why does the Transformer need positional encodings when the RNN didn't?",
  answer:
    "The query says what a word is looking for. Keys say what each word offers and get matched against the query (dot product, scaled by √d, then softmax) to give attention weights. Values are the content that gets mixed using those weights. Attention treats the input as an unordered set: shuffle the words and you get the same result. An RNN reads in order, so it knows positions automatically. The Transformer has to add positional encodings to give it word order.",
} satisfies PaperMeta;
