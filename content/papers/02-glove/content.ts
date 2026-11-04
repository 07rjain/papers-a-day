import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 2,
  slug: "02-glove",
  title: "GloVe: Global Vectors for Word Representation",
  authors: "Jeffrey Pennington, Richard Socher, Christopher D. Manning",
  year: 2014,
  url: "https://aclanthology.org/D14-1162/",
  sent: "2026-10-31",
  hook: "Count how often words appear together, then use ratios — not raw counts — to see which words actually separate two meanings.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "GloVe: Global Vectors for Word Representation",
        href: "https://aclanthology.org/D14-1162/",
      },
      " by Pennington, Socher and Manning (Stanford, 2014). It's a natural next step after word2vec.",
    ],
    [
      "Word2vec learned word vectors by sliding a small window over text and making one tiny guess at a time. GloVe goes about it differently. First it counts, across all the text, how often every pair of words appears near each other. Then it learns vectors so that multiplying two words' vectors together predicts how often those words show up together. You end up with the same kind of word map, with similar words close together, but it's learned from the overall counts rather than one window at a time.",
    ],
    [
      'The clever part is comparing words through ratios. Take ice and steam. "Solid" appears far more often near ice than near steam, and "gas" is the other way round. "Water" is common around both, so its ratio comes out close to 1. GloVe gets its meaning from those ratios.',
    ],
  ],
  question:
    'In your own words, why does the ratio for "water" come out close to 1, and what does that tell us about whether water helps tell ice and steam apart?',
  answer:
    "Water appears often near both ice and steam, so P(water|ice) ≈ P(water|steam) and the ratio ≈ 1. A ratio near 1 means that word carries no information that separates the two. It's related to both (or to neither, like \"fashion\"). Words with ratios far from 1, like solid (large) or gas (small), are the ones that tell ice and steam apart.",
} satisfies PaperMeta;
