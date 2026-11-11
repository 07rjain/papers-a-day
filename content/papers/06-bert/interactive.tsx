"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, useState, useGrokTheme } from "grok/canvas";
import { MaskGame } from "@/components/viz/MaskGame";

// Demo 1: toy guesses for a masked word (hand-made numbers, not from a trained model).
type Ex = { left: string; right: string; leftOnly: [string, number][]; both: [string, number][]; answer: string };
const EXAMPLES: Record<string, Ex> = {
  milk: {
    left: "The man went to the", right: "to buy milk.", answer: "store",
    leftOnly: [["park", 0.28], ["store", 0.2], ["beach", 0.18], ["doctor", 0.18], ["bank", 0.16]],
    both: [["store", 0.78], ["market", 0.14], ["shop", 0.05], ["park", 0.02], ["bank", 0.01]],
  },
  dog: {
    left: "She took her dog to the", right: "for a checkup.", answer: "vet",
    leftOnly: [["park", 0.42], ["beach", 0.2], ["vet", 0.16], ["groomer", 0.12], ["lake", 0.1]],
    both: [["vet", 0.84], ["clinic", 0.09], ["doctor", 0.04], ["groomer", 0.02], ["park", 0.01]],
  },
  bank: {
    left: "He sat on the river", right: "and watched the fish.", answer: "bank",
    leftOnly: [["boat", 0.3], ["bank", 0.24], ["rock", 0.2], ["bed", 0.14], ["dock", 0.12]],
    both: [["bank", 0.81], ["rock", 0.1], ["dock", 0.06], ["boat", 0.02], ["bed", 0.01]],
  },
};

// Demo 2: BERT's masking recipe on a toy sentence.
const TOKENS: string[] = ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog", "near", "the", "old", "barn", "every", "single", "morning", "before", "sunrise", "while", "farmers"];
const RANDOM_WORDS: string[] = ["apple", "blue", "ran", "piano", "seven", "cloud", "under", "green"];
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Slot = { orig: string; shown: string; kind: "keep" | "mask" | "random" | "same" };
function maskSentence(seed: number): Slot[] {
  const r = rng(seed * 7919 + 13);
  return TOKENS.map((w: string) => {
    if (r() >= 0.15) return { orig: w, shown: w, kind: "keep" };
    const u = r();
    if (u < 0.8) return { orig: w, shown: "[MASK]", kind: "mask" };
    if (u < 0.9) return { orig: w, shown: RANDOM_WORDS[Math.floor(r() * RANDOM_WORDS.length)], kind: "random" };
    return { orig: w, shown: w, kind: "same" };
  });
}

// Demo 3: how one pre-trained BERT is reused for different tasks.
type Task = { input: string; head: string; example: string; out: string };
const TASKS: Record<string, Task> = {
  sentiment: {
    input: "[CLS] this movie was a total delight [SEP]",
    head: "Read the final vector of [CLS] and add one small layer that picks a label.",
    example: "One sentence in, one label out (like the SST-2 task in GLUE).",
    out: "positive",
  },
  pair: {
    input: "[CLS] a man is playing guitar [SEP] someone is making music [SEP]",
    head: "Same [CLS] trick, but two sentences go in, separated by [SEP], with segment A/B embeddings.",
    example: "Does sentence B follow from sentence A? (like MultiNLI)",
    out: "entailment",
  },
  qa: {
    input: "[CLS] where do pandas live ? [SEP] giant pandas live in the mountains of central china . [SEP]",
    head: "Learn a start vector and an end vector; every passage token scores how likely it is to be the answer's start or end.",
    example: "Find the answer span inside the passage (SQuAD).",
    out: "\"the mountains of central china\"",
  },
};

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "Which half of the Transformer does BERT use?",
    options: ["Only the encoder", "Only the decoder", "Both, like the translation model"],
    answer: 0,
    why: "BERT is a stack of Transformer encoder layers. With no decoder mask, every word can attend to words on both sides, which is what 'bidirectional' means here.",
  },
  {
    q: "Why can't you just train a bidirectional model to predict the next word?",
    options: ["It would be too slow", "If every word can see both sides, it can see the word it's supposed to predict, so the task becomes trivial", "Next-word prediction only works for French"],
    answer: 1,
    why: "In a deep bidirectional model, information about each word leaks to every position, so the model could just copy the answer. Hiding words with [MASK] and asking for them back fixes that.",
  },
  {
    q: "BERT picks 15% of tokens to predict. What happens to those chosen tokens?",
    options: ["All are replaced with [MASK]", "80% become [MASK], 10% become a random word, 10% stay the same", "They are deleted"],
    answer: 1,
    why: "[MASK] never appears when you fine-tune or use the model, so always masking would create a mismatch. Mixing in random and unchanged words forces BERT to keep a good representation of every token.",
  },
  {
    q: "What is Next Sentence Prediction (NSP)?",
    options: ["Generating the next sentence word by word", "Given sentences A and B, guessing whether B really came right after A (50% of the time it did)", "Translating sentence A into sentence B"],
    answer: 1,
    why: "It's a yes/no task meant to teach relationships between sentences, which helps tasks like question answering and inference. In the paper's ablation, removing it hurt QNLI, MNLI and SQuAD.",
  },
  {
    q: "What does 'fine-tuning' mean in BERT?",
    options: ["Training a new model from scratch for each task", "Freezing BERT and only using its word vectors", "Starting from the pre-trained BERT, adding a tiny output layer, and training everything a bit more on the task's labeled data"],
    answer: 2,
    why: "The expensive part (pre-training on billions of words) happens once. Each task then needs only a small added layer and a short training run, about an hour on one Cloud TPU for most tasks, according to the paper.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const purple = t.dataviz.categorical[2] || blue;

  const [ex, setEx] = useState<string>("milk");
  const [mode, setMode] = useState<string>("left");
  const e = EXAMPLES[ex];
  const guesses = mode === "left" ? e.leftOnly : e.both;

  const [seed, setSeed] = useState<number>(1);
  const slots = maskSentence(seed);
  const chosen = slots.filter((s: Slot) => s.kind !== "keep").length;

  const [task, setTask] = useState<string>("sentiment");
  const tk = TASKS[task];

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const bars = (vals: [string, number][], hi: string, h: number) => (
    <svg width="100%" viewBox={`0 0 700 ${h}`} style={{ display: "block" }}>
      <rect x={0} y={0} width={700} height={h} fill={t.bg.base} />
      {vals.map((p: [string, number], j: number) => {
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

  const chip = (s: Slot, i: number) => {
    const bg = s.kind === "keep" ? t.bg.subtle : s.kind === "mask" ? yellow : s.kind === "random" ? purple : blue;
    const fg = s.kind === "keep" ? t.text.primary : t.text.onColor;
    return (
      <span key={i} style={{ display: "inline-block", padding: "4px 8px", margin: 3, borderRadius: 6, background: bg, color: fg, fontFamily: t.font.mono, fontSize: 13 }}>
        {s.shown}
      </span>
    );
  };

  return (
    <Page title="BERT, explained by playing with it" summary="Daily paper #6: Devlin, Chang, Lee and Toutanova (2018), 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding'. Yesterday's Transformer had an encoder and a decoder. BERT keeps only the encoder, trains it on a fill-in-the-blank game over billions of words, and then reuses that one model for almost any language task.">
      <Section heading="The big idea in one line">
        <Callout>Pre-train one Transformer encoder by hiding words and making it guess them from both sides, then fine-tune that same model for each task.</Callout>
        <Text>Before BERT, language models mostly read left to right: predict the next word from the words before it. That's natural for writing text, but for understanding a sentence you want to use the words after a gap too. "The man went to the ___" is a guess; "The man went to the ___ to buy milk" is obvious.</Text>
        <Text>The catch is that if every word can see both sides, a model trained to predict words can simply peek at the answer. BERT's fix is the masked language model: hide about 15% of the words, then ask the model to recover them using everything around them. It also plays a second game, next sentence prediction: given two sentences, did the second really come after the first?</Text>
        <Text>After this pre-training on BooksCorpus and English Wikipedia (about 3.3 billion words), the same network is fine-tuned for each task by adding one small output layer. That single recipe set new records on 11 language tasks.</Text>
      </Section>

      <Section heading="Demo 1: one side vs both sides" caption="Toy example. The guesses and percentages are hand-made to illustrate the idea; they are not from a trained model.">
        <Segmented options={[{ value: "milk", label: "…buy milk" }, { value: "dog", label: "…a checkup" }, { value: "bank", label: "…the fish" }]} value={ex} onChange={(v: string) => setEx(v)} />
        <Segmented options={[{ value: "left", label: "Left context only (GPT-style)" }, { value: "both", label: "Both sides (BERT)" }]} value={mode} onChange={(v: string) => setMode(v)} />
        <Callout tone="info">{mode === "left" ? `${e.left} [MASK] …` : `${e.left} [MASK] ${e.right}`}</Callout>
        {bars(guesses, e.answer, 200)}
        <Text>{mode === "left" ? `Seeing only the left side, the right answer "${e.answer}" is just one guess among many.` : `With the words after the gap, "${e.answer}" wins clearly. That extra context is what BERT's bidirectional attention gives every word, in every layer.`}</Text>
        <Text>The "river bank" example is a nice one: the word bank is ambiguous, and in word2vec or GloVe it would get one fixed vector. In BERT, each word's vector is built from its whole sentence, so "river bank" and "bank account" end up with different vectors.</Text>
      </Section>

      <Section heading="Demo 2: BERT's masking recipe" caption="Toy sentence and simulated random choices, following the paper's exact percentages.">
        <Text>Each time BERT sees a sentence, it picks about 15% of the tokens to predict. Of those picked tokens, 80% are replaced with [MASK], 10% with a random word, and 10% are left unchanged. Press the button to draw a new random batch.</Text>
        <Button label="Mask a new batch" variant="primary" onClick={() => setSeed(seed + 1)} />
        <div style={{ lineHeight: 2.2 }}>{slots.map((s: Slot, i: number) => chip(s, i))}</div>
        <Table columns={["Colour", "What happened", "Must BERT predict the original?"]} rows={[
          ["yellow", "replaced with [MASK]", "yes"],
          ["purple", "swapped for a random word", "yes"],
          ["blue", "chosen but left unchanged", "yes"],
          ["grey", "not chosen", "no"],
        ]} />
        <Callout>{`This draw picked ${chosen} of ${TOKENS.length} tokens. Targets: ${slots.filter((s: Slot) => s.kind !== "keep").map((s: Slot) => `${s.shown} → ${s.orig}`).join(", ") || "none this time (it happens with short sentences)"}`}</Callout>
        <Text>Why not always use [MASK]? Because [MASK] never shows up when BERT is fine-tuned or used later. The random and unchanged cases mean BERT can't tell which words are "safe", so it has to build a good representation of every word, including ones that look normal.</Text>
      </Section>

      <Section heading="Demo 3: one model, many tasks" caption="Simplified from the paper's Figure 4. Example sentences are made up.">
        <Segmented options={[{ value: "sentiment", label: "Single sentence" }, { value: "pair", label: "Sentence pair" }, { value: "qa", label: "Question answering" }]} value={task} onChange={(v: string) => setTask(v)} />
        <Table columns={["", ""]} rows={[
          ["Task", tk.example],
          ["What goes in", tk.input],
          ["What gets added on top", tk.head],
          ["Output", tk.out],
        ]} />
        <Text>[CLS] is a special first token whose final vector acts as a summary of the whole input, and [SEP] marks where a sentence ends. During fine-tuning, every BERT weight gets nudged a little, but almost nothing new is added. That's the shift BERT popularised: pre-train once at great cost, then adapt cheaply to many tasks.</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Table columns={["Model", "Layers", "Hidden size", "Attention heads", "Parameters"]} rows={[
          ["BERT-Base", "12", "768", "12", "110M"],
          ["BERT-Large", "24", "1024", "16", "340M"],
        ]} />
        <Table columns={["Benchmark", "BERT-Large result", "Gain over previous best"]} rows={[
          ["GLUE score (9 understanding tasks)", "80.5", "+7.7 points"],
          ["MultiNLI accuracy", "86.7%", "+4.6 points"],
          ["SQuAD v1.1 test F1", "93.2", "+1.5 points"],
          ["SQuAD v2.0 test F1", "83.1", "+5.1 points"],
        ]} />
        <Steps steps={[
          { title: "Bidirectional beats left-to-right", detail: "In ablations, a left-to-right model of the same size did clearly worse, especially on SQuAD question answering." },
          { title: "Next sentence prediction helped (in their setup)", detail: "Removing NSP hurt QNLI, MNLI and SQuAD. Later work like RoBERTa questioned this, which is a good reminder that ablations depend on the setup." },
          { title: "Bigger kept helping", detail: "Larger models improved accuracy on every dataset they tried, even small ones with a few thousand labeled examples." },
          { title: "Cheap to fine-tune", detail: "Most tasks fine-tune in at most an hour on one Cloud TPU, starting from the same pre-trained model." },
        ]} />
        <Callout tone="info" lead="Where this leads.">BERT took the encoder half of the Transformer. GPT-2 and GPT-3 take the decoder half with its mask and just predict the next word, at huge scale. That's coming up next.</Callout>
      </Section>

      <Section heading="Play: fill the blank" caption="Toy answer lists, not BERT's output.">
        <MaskGame />
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
        <Text>In your own words, why BERT hides words with [MASK] instead of just predicting the next word like a normal language model.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding", site: "arxiv.org", date: "2018", href: "https://arxiv.org/abs/1810.04805" },
          { title: "Paper PDF", site: "arxiv.org", date: "2018", href: "https://arxiv.org/pdf/1810.04805" },
        ]} />
      </Section>
    </Page>
  );
}
