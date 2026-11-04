export type Inline = string | { text: string; href: string };

export type PaperMeta = {
  /** Learning-sequence number. Shown on the homepage and in the URL slug. */
  number: number;
  /** Route segment, for example `01-word2vec`. Must match the folder name. */
  slug: string;
  title: string;
  authors: string;
  year: number;
  /** Canonical link to the paper. */
  url: string;
  /** Date the paper was sent, `YYYY-MM-DD`. Homepage order uses this. */
  sent: string;
  /** One line on the homepage. */
  hook: string;
  /** Paragraphs. A string is text; `{ text, href }` is a link. */
  explanation: Inline[][];
  question: string;
  answer: string;
};
