"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, useState, useGrokTheme } from "grok/canvas";

// Demo 1: zero-shot prompting formats from the paper (toy continuations).
type PromptDemo = {
  label: string;
  task: string;
  prompt: string;
  continuation: string;
  note: string;
};
const PROMPTS: Record<string, PromptDemo> = {
  qa: {
    label: "Reading / QA (CoQA-style)",
    task: "Answer a question from a short passage",
    prompt: "The Amazon rainforest produces about 20% of the world's oxygen.\nQ: How much of the world's oxygen does the Amazon produce?\nA:",
    continuation: " about 20%",
    note: "Paper format: document + question + \"A:\". On CoQA, GPT-2 got 55 F1 with no training examples.",
  },
  translate: {
    label: "Translation",
    task: "English → French from in-context examples",
    prompt: "english: How are you?\nfrench: Comment allez-vous?\nenglish: Where is the library?\nfrench:",
    continuation: " Où est la bibliothèque?",
    note: "Paper format: a few english = french (or english:/french:) pairs, then a new english line. Toy continuation shown here.",
  },
  summarize: {
    label: "Summarization",
    task: "Condensing with a TL;DR cue",
    prompt: "Article: OpenAI trained a large language model on text from the web and found it could do many tasks just by reading a short prompt.\nTL;DR:",
    continuation: " A big language model learns many tasks from prompts alone.",
    note: "Paper cue: append \"TL;DR:\" after the document. The paper called summarization only rudimentary.",
  },
  reading: {
    label: "LAMBADA-style",
    task: "Guess the final word from a long context",
    prompt: "Alice carefully put the keys on the kitchen table before leaving. Hours later she returned, looked around, and finally remembered the keys were on the",
    continuation: " table",
    note: "LAMBADA needs the whole passage to guess the last word. Real GPT-2 accuracies: 45.99% → 55.48% → 60.12% → 63.24% as size grows.",
  },
};

// Demo 2: real paper numbers for scale.
type ModelSize = {
  key: string;
  name: string;
  params: string;
  paramsM: number;
  layers: string;
  dmodel: string;
  lambadaAcc: number;
};
const MODELS: ModelSize[] = [
  { key: "117", name: "Small", params: "117M", paramsM: 117, layers: "12", dmodel: "768", lambadaAcc: 45.99 },
  { key: "345", name: "Medium", params: "345M", paramsM: 345, layers: "24", dmodel: "1024", lambadaAcc: 55.48 },
  { key: "762", name: "Large", params: "762M", paramsM: 762, layers: "36", dmodel: "1280", lambadaAcc: 60.12 },
  { key: "1542", name: "GPT-2", params: "1.5B (1542M)", paramsM: 1542, layers: "48", dmodel: "1600", lambadaAcc: 63.24 },
];
const COQA_GPT2 = 55; // paper reports 55 F1 zero-shot for the 1.5B model

// Demo 3: BERT vs GPT-2 on the milk sentence.
type SideGuess = [string, number];
const GPT_GUESSES: SideGuess[] = [["park", 0.28], ["store", 0.2], ["beach", 0.18], ["doctor", 0.18], ["bank", 0.16]];
const BERT_GUESSES: SideGuess[] = [["store", 0.78], ["market", 0.14], ["shop", 0.05], ["park", 0.02], ["bank", 0.01]];

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "Which half of the Transformer does GPT-2 use?",
    options: ["Only the encoder (like BERT)", "Only the decoder, predicting the next word left to right", "Both encoder and decoder for translation"],
    answer: 1,
    why: "GPT-2 is a Transformer decoder language model: it reads left to right and predicts the next word. BERT uses the encoder and fills in masked words from both sides.",
  },
  {
    q: "What is \"zero-shot\" in this paper?",
    options: [
      "Training on zero words",
      "Doing a downstream task with no task-specific training or architecture change, just a natural-language prompt",
      "Using a model with zero layers",
    ],
    answer: 1,
    why: "Zero-shot here means: same next-word model, no fine-tuning, no new heads. You condition it with a prompt like \"TL;DR:\" or a few translation examples, and it continues in that pattern.",
  },
  {
    q: "Where did WebText come from?",
    options: [
      "Only Wikipedia",
      "Books scanned from libraries",
      "About 8 million web pages linked from Reddit posts with at least 3 karma (~40GB)",
    ],
    answer: 2,
    why: "They scraped outbound links from Reddit with ≥3 karma as a quality filter, then cleaned the pages. Roughly 8M documents / 40GB of text.",
  },
  {
    q: "What happens to zero-shot performance as the model gets bigger?",
    options: [
      "It stays flat after 117M",
      "It gets worse because bigger models overfit",
      "It improves in a smooth, roughly log-linear way across many tasks",
    ],
    answer: 2,
    why: "The paper's plots show capacity is essential: LAMBADA accuracy climbs 45.99 → 55.48 → 60.12 → 63.24 from 117M to 1.5B, and similar trends show up on other tasks.",
  },
  {
    q: "On CoQA question answering, how did GPT-2 (1.5B) do without using the 127k training examples?",
    options: ["Near chance (~10 F1)", "About 55 F1, matching or beating 3 of 4 supervised baselines", "Perfect 100 F1"],
    answer: 1,
    why: "55 F1 zero-shot, without the supervised training set. That was the striking result: a pure language model starting to act like a multitask learner from prompts alone.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];

  const [task, setTask] = useState<string>("qa");
  const demo = PROMPTS[task];

  const [size, setSize] = useState<string>("1542");
  const model = MODELS.find((m: ModelSize) => m.key === size) as ModelSize;

  const [side, setSide] = useState<string>("gpt");
  const guesses = side === "gpt" ? GPT_GUESSES : BERT_GUESSES;
  const answer = "store";

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const bars = (vals: SideGuess[], hi: string, h: number) => (
    <svg width="100%" viewBox={`0 0 700 ${h}`} style={{ display: "block" }}>
      <rect x={0} y={0} width={700} height={h} fill={t.bg.base} />
      {vals.map((p: SideGuess, j: number) => {
        const bw = 700 / vals.length;
        const bh = p[1] * (h - 60);
        const barH = Math.round(Math.max(2, bh) * 100) / 100;
        const barY = Math.round((h - 30 - bh) * 100) / 100;
        const labelY = Math.round((h - 36 - bh) * 100) / 100;
        return (
          <g key={j}>
            <rect x={j * bw + 8} y={barY} width={bw - 16} height={barH} rx={4} fill={p[0] === hi ? yellow : blue} />
            <text x={j * bw + bw / 2} y={labelY} textAnchor="middle" fill={t.text.primary} fontSize={12} fontFamily={t.font.family}>{(p[1] * 100).toFixed(0) + "%"}</text>
            <text x={j * bw + bw / 2} y={h - 10} textAnchor="middle" fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>{p[0]}</text>
          </g>
        );
      })}
    </svg>
  );

  const scaleBars = () => {
    const h = 220;
    const maxAcc = 70;
    return (
      <svg width="100%" viewBox={`0 0 700 ${h}`} style={{ display: "block" }}>
        <rect x={0} y={0} width={700} height={h} fill={t.bg.base} />
        {MODELS.map((m: ModelSize, j: number) => {
          const bw = 700 / MODELS.length;
          const bh = (m.lambadaAcc / maxAcc) * (h - 70);
          const barH = Math.round(Math.max(2, bh) * 100) / 100;
          const barY = Math.round((h - 40 - bh) * 100) / 100;
          const labelY = Math.round((h - 46 - bh) * 100) / 100;
          const selected = m.key === size;
          return (
            <g key={j} onClick={() => setSize(m.key)} style={{ cursor: "pointer" }}>
              <rect x={j * bw + 16} y={barY} width={bw - 32} height={barH} rx={4} fill={selected ? yellow : blue} />
              <text x={j * bw + bw / 2} y={labelY} textAnchor="middle" fill={t.text.primary} fontSize={12} fontFamily={t.font.family}>{m.lambadaAcc.toFixed(1) + "%"}</text>
              <text x={j * bw + bw / 2} y={h - 18} textAnchor="middle" fill={t.text.secondary} fontSize={12} fontFamily={t.font.family}>{m.params}</text>
              <text x={j * bw + bw / 2} y={h - 4} textAnchor="middle" fill={t.text.secondary} fontSize={11} fontFamily={t.font.family}>{m.name}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <Page title="GPT-2, explained by playing with it" summary="Daily paper #7: Radford, Wu, Child, Luan, Amodei and Sutskever (OpenAI, 2019), 'Language Models are Unsupervised Multitask Learners'. Yesterday's BERT was a bidirectional encoder that fills in blanks, then fine-tunes. GPT-2 is a big Transformer decoder that only predicts the next word — and at enough scale, that alone starts to look like many tasks.">
      <Section heading="The big idea in one line">
        <Callout>Train a big left-to-right language model on diverse web text, and it begins to do downstream tasks from a natural-language prompt alone — no fine-tuning, no new architecture.</Callout>
        <Text>Yesterday BERT used the Transformer's encoder and learned by guessing hidden words from both sides, then fine-tuned for each task. GPT-2 takes the other half: the decoder, with its causal mask, so each word can only see the words before it. The training objective is the oldest one in the book — predict the next word.</Text>
        <Text>The twist is scale plus a messy, diverse dataset called WebText (about 8 million pages / 40GB scraped from Reddit outbound links with at least 3 karma). Inside that text are questions and answers, translations, summaries with "TL;DR", and more. So when you feed the model a prompt that looks like one of those patterns, continuing the text often means doing the task.</Text>
        <Text>They trained four sizes — 117M, 345M, 762M, and 1.5 billion parameters — and zero-shot skill rose smoothly with size. Bigger really was better.</Text>
      </Section>

      <Section heading="Demo 1: zero-shot prompting" caption="Toy examples. Prompts follow the paper's formats; the continuations are hand-made illustrations, not model outputs.">
        <Segmented
          options={[
            { value: "qa", label: "QA" },
            { value: "translate", label: "Translate" },
            { value: "summarize", label: "Summarize" },
            { value: "reading", label: "LAMBADA" },
          ]}
          value={task}
          onChange={(v: string) => setTask(v)}
        />
        <Callout tone="info" lead={demo.label}>{demo.task}</Callout>
        <Table columns={["", ""]} rows={[
          ["Prompt the model sees", demo.prompt],
          ["Toy continuation", demo.continuation],
        ]} />
        <Text>{demo.note}</Text>
        <Text>Nothing about the network changes between tasks. Same weights, same next-word head. The "task" lives in the prompt text, the way a human might write an example before asking for another.</Text>
      </Section>

      <Section heading="Demo 2: scale matters" caption="LAMBADA accuracies are real numbers from the paper (Table 3). CoQA 55 F1 is the paper's zero-shot result for the 1.5B model.">
        <Text>Pick a model size. Watch LAMBADA accuracy climb. The paper saw this log-linear trend on many zero-shot tasks: small models barely beat trivial baselines; GPT-2 starts to show real skill.</Text>
        <Segmented
          options={MODELS.map((m: ModelSize) => ({ value: m.key, label: m.params }))}
          value={size}
          onChange={(v: string) => setSize(v)}
        />
        {scaleBars()}
        <Table columns={["", "Selected model"]} rows={[
          ["Name", `${model.name} (${model.params})`],
          ["Layers × width", `${model.layers} layers, d_model ${model.dmodel}`],
          ["LAMBADA accuracy (real, paper Table 3)", `${model.lambadaAcc}%`],
          ["CoQA F1 for GPT-2 1.5B (paper)", size === "1542" ? `${COQA_GPT2} (zero-shot)` : "reported for 1.5B only (55)"],
        ]} />
        <Callout tone="info" lead="Capacity is essential.">On several tasks the smallest models sit near trivial baselines. The jump to 1.5B is where zero-shot starts to look like a multitask learner.</Callout>
      </Section>

      <Section heading="Demo 3: BERT vs GPT-2 on the same blank" caption="Toy guesses, hand-made to show the contrast. Not from trained models.">
        <Text>Sentence: "The man went to the ___ to buy milk." BERT can see both sides of the blank. GPT-2, predicting left to right, only sees "The man went to the" when it has to pick the next word.</Text>
        <Segmented
          options={[
            { value: "gpt", label: "GPT-2 (left only)" },
            { value: "bert", label: "BERT (both sides)" },
          ]}
          value={side}
          onChange={(v: string) => setSide(v)}
        />
        <Callout tone="info">{side === "gpt" ? "The man went to the [next]  …(right side hidden from GPT-2)" : "The man went to the [MASK] to buy milk."}</Callout>
        {bars(guesses, answer, 200)}
        <Text>{side === "gpt"
          ? "With only the left side, \"store\" is one plausible place among many. GPT-2 is built for generation: it writes forward, one token at a time."
          : "With \"to buy milk\" visible, \"store\" wins clearly. That is BERT's bidirectional strength — great for understanding, less natural for free-form writing."}</Text>
        <Text>Architecture reminder (light): GPT-2 also moved LayerNorm to the input of each block (pre-norm) and scaled residual weights, which helped train deeper stacks. The conceptual story for beginners is still: decoder LM + scale + diverse data → zero-shot tasks.</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Table columns={["Model", "Parameters", "Layers", "d_model"]} rows={[
          ["GPT-2 Small", "117M", "12", "768"],
          ["GPT-2 Medium", "345M", "24", "1024"],
          ["GPT-2 Large", "762M", "36", "1280"],
          ["GPT-2", "1.5B (1542M)", "48", "1600"],
        ]} />
        <Table columns={["Claim", "Number / detail"]} rows={[
          ["Training data", "WebText ≈ 8M docs / 40GB; byte-level BPE vocab 50,257; context 1024"],
          ["Language modeling", "SOTA zero-shot on 7 of 8 LM datasets"],
          ["CoQA (QA)", "55 F1 zero-shot, matching/exceeding 3 of 4 supervised baselines, no use of 127k train examples"],
          ["Winograd schemas", "~70.7%"],
          ["LAMBADA acc (117→1.5B)", "45.99 → 55.48 → 60.12 → 63.24"],
          ["Summarization", "Only rudimentary with the TL;DR: cue"],
        ]} />
        <Steps steps={[
          { title: "One objective, many tasks", detail: "Next-word prediction on diverse text is enough for the model to start answering questions, translating, and reading, when the prompt looks like those tasks." },
          { title: "Zero-shot, not fine-tuned", detail: "No task-specific heads and no labeled fine-tuning for these results — just conditioning on text." },
          { title: "Scale is not optional", detail: "Performance improves smoothly with size; the paper argues capacity is a main ingredient of the unsupervised multitask effect." },
          { title: "Still limited", detail: "Summarization stayed weak, and many tasks were still far from supervised SOTA. GPT-2 is the start of the \"prompting\" era, not the end." },
        ]} />
        <Callout tone="info" lead="Where this leads.">BERT showed pre-train then fine-tune with the encoder. GPT-2 showed that a big decoder LM can do tasks from prompts alone. GPT-3 pushes that idea further with even more scale and few-shot examples in the prompt.</Callout>
      </Section>

      <Section heading="Check your understanding">
        {QUIZ.map((item: Q, k: number) => (
          <Section key={k} heading={`${k + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((o: string, oi: number) => (
                <Button key={oi} label={o} variant={picks[k] === oi ? "primary" : "quiet"} onClick={() => setPicks(picks.map((x: number | null, z: number) => (z === k ? oi : x)))} />
              ))}
            </div>
            {picks[k] === null ? null : picks[k] === item.answer ? (
              <Callout tone="success" lead="Right.">{item.why}</Callout>
            ) : (
              <Callout tone="warning" lead="Not quite.">{item.why}</Callout>
            )}
          </Section>
        ))}
        <Text>In your own words, why a model trained only to predict the next word can start answering questions or summarizing just from a prompt, and why making the model bigger helps.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Language Models are Unsupervised Multitask Learners (PDF)", site: "cdn.openai.com", date: "2019", href: "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf" },
          { title: "Better Language Models and Their Implications (OpenAI blog)", site: "openai.com", date: "2019", href: "https://openai.com/index/better-language-models/" },
        ]} />
      </Section>
    </Page>
  );
}
