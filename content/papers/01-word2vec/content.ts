import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 1,
  slug: "01-word2vec",
  title: "Efficient Estimation of Word Representations in Vector Space",
  authors: "Tomas Mikolov, Kai Chen, Greg Corrado, Jeffrey Dean",
  year: 2013,
  url: "https://arxiv.org/abs/1301.3781",
  sent: "2026-10-28",
  hook: "Words that show up in similar places end up with similar vectors, which is why king − man + woman lands near queen.",
  explanation: [
    [
      "The reading path starts with ",
      {
        text: "Efficient Estimation of Word Representations in Vector Space",
        href: "https://arxiv.org/abs/1301.3781",
      },
      " by Mikolov and others, from 2013. It's short, the idea is simple, and a lot of modern AI, including ChatGPT, builds on it.",
    ],
    [
      'The paper shows that a computer can learn what a word means just from the words that tend to appear near it. Each word becomes a list of numbers, called a vector, and words used in similar places end up with similar numbers. The best-known example is that "king" minus "man" plus "woman" comes out very close to "queen".',
    ],
    ["When you have time, skim the abstract and Section 3."],
  ],
  question:
    'Why would "dog" and "puppy" end up with similar vectors when nobody ever told the model they\'re related? Put it in your own words.',
  answer:
    'Both words show up around the same neighbouring words ("bark", "walk", "pet", "leash", "cute"). Training pushes each word\'s vector to predict its neighbours, so words with similar neighbours get pushed towards similar vectors. Their similarity comes from shared context and nobody labels it ("you shall know a word by the company it keeps").',
} satisfies PaperMeta;
