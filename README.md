# Papers a Day

A static reading site for learning one AI research paper a day. Each paper has a plain-English explanation, the original interactive demos and quiz, a question for the day, and a collapsible answer key.

A public study site at [papers-a-day.subdomain.wtf](https://papers-a-day.subdomain.wtf). Next.js App Router, TypeScript, no extra Vercel config: `npm run build` produces the static pages.

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Production build:

```bash
npm run build
npm start
```

## Routes

| Route | Page |
| --- | --- |
| `/` | All papers, one reading path, oldest sent-date first |
| `/papers/01-word2vec` | Efficient Estimation of Word Representations in Vector Space (2013) |
| `/papers/02-glove` | GloVe: Global Vectors for Word Representation (2014) |
| `/papers/03-seq2seq` | Sequence to Sequence Learning with Neural Networks (2014) |
| `/papers/04-bahdanau-attention` | Neural Machine Translation by Jointly Learning to Align and Translate (2014) |
| `/papers/05-transformer` | Attention Is All You Need (2017) |
| `/papers/06-bert` | BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding (2018) |
| `/papers/07-gpt2` | Language Models are Unsupervised Multitask Learners (2019) |
| `/papers/08-gpt3` | Language Models are Few-Shot Learners (2020) |
| `/papers/09-scaling-laws` | Scaling Laws for Neural Language Models (2020) |
| `/papers/10-instructgpt` | Training language models to follow instructions with human feedback (2022) |
| `/papers/11-chinchilla` | Training Compute-Optimal Large Language Models (2022) |
| `/papers/12-lora` | LoRA: Low-Rank Adaptation of Large Language Models (2021) |
| `/papers/13-dpo` | Direct Preference Optimization: Your Language Model is Secretly a Reward Model (2023) |
| `/papers/14-chain-of-thought` | Chain-of-Thought Prompting Elicits Reasoning in Large Language Models (2022) |

Previous and next follow the sent date, oldest to newest. Unknown slugs 404.

## Adding a new paper

A paper is one folder of content plus one registration line in each of two files.

1. Pick a slug, zero-padded number plus a short name, for example `06-bert`. The URL will be `/papers/06-bert`.

2. Create `content/papers/06-bert/content.ts` and export `meta`. Copy a neighbor and edit it. The object must satisfy `PaperMeta` in `content/types.ts`:

   - `number` — next integer in the learning sequence
   - `slug` — same string as the folder name
   - `title`, `authors`, `year`, `url` — the paper itself. `url` is where the title links
   - `sent` — `YYYY-MM-DD`. The homepage and the previous/next links follow this date, oldest first
   - `hook` — one line for the homepage
   - `explanation` — an array of paragraphs. Each paragraph is an array of strings and `{ text, href }` links
   - `question` — the question for today
   - `answer` — the answer key, hidden until "Check your answer" is opened

3. Create `content/papers/06-bert/interactive.tsx`. The first line must be `"use client"`. Default-export the page component. Import UI from `grok/canvas` (mapped in `tsconfig.json` to `components/kit`). The kit currently provides `Page`, `Section`, `Text`, `Callout`, `Table`, `Steps`, `Grid`, `Segmented`, `Select`, `Button`, `Toggle`, `Input`, `LinkCards`, `Metrics`, `Equation`, `Frac`, `Pow`, `useGrokTheme`, and the React hooks `useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`, `useReducer`. `useGrokTheme()` returns a light/dark theme whose colors are CSS variables, so demos follow the site theme. If a new page imports a component that is not in that list, add it to `components/kit/index.tsx` with the same props the page already uses.

   Keep any made-up numbers labelled as toy or example data in the visible caption, the same way the current pages do.

4. Register it in two places, using the same slug:

   - `content/catalog.ts` — import `meta` and append it to the `papers` array.
   - `content/interactives.tsx` — add `"06-bert": dynamic(() => import("@/content/papers/06-bert/interactive"))`.

5. Check it with `npm run dev` at `/papers/06-bert`, then `npm run build`.

No other files need to change. The homepage, prev/next links, and static paths are generated from the catalog. A “builds on” line for the homepage timeline is optional: add the slug to `pathLinks` in `content/study.ts`. The paper still appears if that line is missing.

## Theme

Light and dark follow the system until the header toggle is used. The choice is stored in `localStorage` under `pad-theme`.
