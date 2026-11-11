"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, useState, useMemo, useGrokTheme } from "grok/canvas";
import { AttentionBars3D } from "@/components/viz/AttentionBars3D";
import { QuizSync } from "@/components/study/progress";

const SRC: string[] = ["the", "European", "Economic", "Area"];
const TGT: string[] = ["la", "zone", "économique", "européenne"];
// Toy alignment scores (e_ij), hand-written to mimic Figure 3(a) of the paper. Rows = French word being written, columns = English words.
const SCORES: number[][] = [
  [3.0, 0.4, 0.2, 1.6],
  [0.2, 0.3, 0.6, 3.2],
  [0.1, 0.5, 3.1, 0.6],
  [0.2, 3.3, 0.7, 0.4],
];

function softmax(xs: number[], sharp: number): number[] {
  const m = Math.max(...xs.map((x: number) => x * sharp));
  const ex = xs.map((x: number) => Math.exp(x * sharp - m));
  const s = ex.reduce((a: number, b: number) => a + b, 0);
  return ex.map((e: number) => e / s);
}

// Toy 3-number "annotation" vectors for each English word (made up).
const ANN: number[][] = [
  [0.9, 0.1, 0.0],
  [0.1, 0.8, 0.3],
  [0.2, 0.3, 0.9],
  [0.7, 0.6, 0.6],
];

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "What problem with seq2seq was this paper trying to fix?",
    options: ["It was too slow to train", "It had to squeeze the whole source sentence into one fixed-length vector", "It couldn't output French"],
    answer: 1,
    why: "The authors call the single fixed-length vector a bottleneck. Long sentences have more information than fits comfortably, so quality dropped as sentences got longer.",
  },
  {
    q: "What does the decoder get at each step instead of one fixed summary?",
    options: ["A fresh context vector: a weighted mix of all the encoder's per-word vectors", "The raw English text", "The same vector every step, just bigger"],
    answer: 0,
    why: "Each output word gets its own context vector c_i, built as a weighted sum of the annotations h_j. The weights change every step depending on what the decoder is about to write.",
  },
  {
    q: "Why are the attention weights passed through a softmax?",
    options: ["To make them positive and add up to 1, like a probability split", "To make the network deeper", "To remove unknown words"],
    answer: 0,
    why: "Softmax turns raw match scores into weights between 0 and 1 that sum to 1, so the context is an average over source words with the best matches counting the most.",
  },
  {
    q: "Why use a bidirectional encoder (one RNN reading forward, one backward)?",
    options: ["It's twice as fast", "So each word's vector summarizes the words both before and after it", "So it can read French too"],
    answer: 1,
    why: "The annotation for each word glues together a forward and a backward state, so it carries context from both sides with a focus on the words around it.",
  },
  {
    q: "What happened on long sentences in the paper's experiments?",
    options: ["Both models collapsed equally", "The plain encoder-decoder dropped sharply, while RNNsearch-50 showed no drop even at 50+ words", "Attention only helped short sentences"],
    answer: 1,
    why: "Figure 2 of the paper shows RNNencdec falling off as length grows, while RNNsearch-50 stays steady. That's direct evidence the bottleneck was the problem.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const purple = t.dataviz.categorical[2] || blue;

  // Demo 1
  const [row, setRow] = useState<string>("1");
  const [sharp, setSharp] = useState<number>(10);
  const sharpness = sharp / 10;
  const ri = Number(row);
  const weights = softmax(SCORES[ri], sharpness);
  const context = [0, 1, 2].map((k: number) => weights.reduce((acc: number, w: number, j: number) => acc + w * ANN[j][k], 0));
  const top = weights.indexOf(Math.max(...weights));

  // Demo 2: drag the scores yourself
  const [mine, setMine] = useState<number[]>([1, 1, 1, 1]);
  const mineW = softmax(mine, 1);

  // Demo 3: heatmap
  const [showMap, setShowMap] = useState<string>("attn");
  const matrix = useMemo(() => SCORES.map((r: number[]) => softmax(r, 1)), []);

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const tok = (label: string, on: boolean, color: string, key: number) => (
    <span key={key} style={{ display: "inline-block", padding: "4px 9px", margin: 3, borderRadius: 6, fontFamily: t.font.family, fontSize: 14, background: on ? color : t.bg.base, color: on ? "#000000" : t.text.secondary, border: `1px solid ${t.border.default}` }}>{label}</span>
  );

  return (
    <Page title="Attention, explained by playing with it" summary="Daily paper #4: Bahdanau, Cho and Bengio (2014), 'Neural Machine Translation by Jointly Learning to Align and Translate'. Yesterday's seq2seq squeezed a whole sentence into one vector. This paper lets the decoder look back at every input word, and that idea, attention, is the seed of the Transformer.">
      <Section heading="The big idea in one line">
        <Callout>Instead of remembering the whole sentence in one vector, the translator glances back at the input words that matter for the word it's writing right now.</Callout>
        <Text>In seq2seq, the encoder read English and handed the decoder a single memory vector. Every detail of a 40-word sentence had to fit in there, and translations of long sentences fell apart.</Text>
        <Text>Bahdanau's fix: keep one vector per input word (the paper calls these annotations). Each time the decoder is about to write a French word, a small network scores how well each English word matches what it needs right now. Those scores become weights that add up to 1, and the decoder gets a weighted mix of the word vectors, called the context vector. A new mix is made for every output word. That weighting is attention.</Text>
      </Section>

      <Section heading="Demo 1: where is the decoder looking?" caption="Toy example. The scores and the 3-number word vectors are hand-made to mimic the paper's Figure 3(a), not taken from the real model (which used 2,000 numbers per word).">
        <Text>English "the European Economic Area" becomes French "la zone économique européenne". Notice the word order flips. Pick which French word is being written and watch the attention weights.</Text>
        <Segmented options={TGT.map((w: string, i: number) => ({ value: String(i), label: `writing "${w}"` }))} value={row} onChange={(v: string) => setRow(v)} />
        <svg width="100%" viewBox="0 0 700 180" style={{ display: "block" }}>
          <rect x={0} y={0} width={700} height={180} fill={t.bg.base} />
          {SRC.map((w: string, j: number) => (
            <g key={j}>
              <rect x={40 + j * 165} y={140 - weights[j] * 120} width={120} height={Math.max(2, weights[j] * 120)} rx={4} fill={j === top ? yellow : blue} />
              <text x={100 + j * 165} y={132 - weights[j] * 120} textAnchor="middle" fill={t.text.primary} fontSize={13} fontFamily={t.font.family}>{(weights[j] * 100).toFixed(0) + "%"}</text>
              <text x={100 + j * 165} y={165} textAnchor="middle" fill={t.text.secondary} fontSize={14} fontFamily={t.font.family}>{w}</text>
            </g>
          ))}
        </svg>
        <Text>{`Sharpness of focus: ${sharpness.toFixed(1)}x (this just scales the scores before softmax, to show soft vs nearly hard attention)`}</Text>
        <input type="range" min={1} max={30} value={sharp} onChange={(e: any) => setSharp(Number(e.target.value))} style={{ width: "100%" }} />
        <Callout>{`To write "${TGT[ri]}", the decoder puts ${(weights[top] * 100).toFixed(0)}% of its attention on "${SRC[top]}". Its context vector is the weighted mix [${context.map((x: number) => x.toFixed(2)).join(", ")}].`}</Callout>
        <Text>Try "la": it mostly looks at "the" but also peeks at "Area". That matters because French needs to know the noun's gender to pick le or la. The paper makes exactly this point about "the man" becoming "l' homme". Soft attention can look at two words at once; a hard one-to-one alignment can't.</Text>
      </Section>

      <Section heading="Demo 2: you be the alignment model" caption="Toy example. Drag raw match scores and see softmax turn them into weights.">
        <Text>The alignment network outputs one raw score per English word. Softmax makes them all positive and forces them to sum to 1. Push one score up and watch it steal attention from the others.</Text>
        {SRC.map((w: string, j: number) => (
          <div key={j} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 90, fontFamily: t.font.family, color: t.text.primary }}>{w}</span>
            <input type="range" min={-30} max={50} value={Math.round(mine[j] * 10)} onChange={(e: any) => setMine(mine.map((x: number, k: number) => (k === j ? Number(e.target.value) / 10 : x)))} style={{ flex: 1 }} />
            <span style={{ width: 150, fontFamily: t.font.family, color: t.text.secondary }}>{`score ${mine[j].toFixed(1)} → ${(mineW[j] * 100).toFixed(0)}%`}</span>
          </div>
        ))}
        <Callout>{`Weights add up to ${(mineW.reduce((a: number, b: number) => a + b, 0) * 100).toFixed(0)}%. Equal scores give equal attention; a score just 2 points higher already grabs most of it.`}</Callout>
        <Button label="Reset scores" variant="quiet" onClick={() => setMine([1, 1, 1, 1])} />
      </Section>

      <Section heading="Demo 3: the whole alignment picture" caption="Toy heatmap built from the same made-up scores as Demo 1. The paper's Figure 3 shows real ones from the trained model.">
        <Segmented options={[{ value: "attn", label: "Attention (soft)" }, { value: "seq", label: "Seq2seq (one vector)" }]} value={showMap} onChange={(v: string) => setShowMap(v)} />
        <svg width="100%" viewBox="0 0 700 300" style={{ display: "block" }}>
          <rect x={0} y={0} width={700} height={300} fill={t.bg.base} />
          {SRC.map((w: string, j: number) => (
            <text key={"s" + j} x={200 + j * 120} y={24} textAnchor="middle" fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>{w}</text>
          ))}
          {TGT.map((w: string, i: number) => (
            <g key={"r" + i}>
              <text x={130} y={70 + i * 60} textAnchor="end" fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>{w}</text>
              {SRC.map((_: string, j: number) => {
                const a = showMap === "attn" ? matrix[i][j] : 0.25;
                return <rect key={j} x={145 + j * 120} y={40 + i * 60} width={110} height={52} rx={4} fill={purple} fillOpacity={0.08 + a * 0.92} />;
              })}
            </g>
          ))}
        </svg>
        <Text>{showMap === "attn" ? "Bright cells show where each French word looked. The bright path jumps: zone looks at Area, then the model walks back to Economic and European, just as the paper describes." : "Seq2seq has no per-word view at all: every French word is written from the same single summary, so this picture is flat. There's nothing to inspect."}</Text>
        <Text>A nice side effect: attention weights are something you can look at, so you can see what the model was focusing on.</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Table columns={["Model (English to French, WMT'14)", "BLEU, all sentences", "BLEU, no unknown words"]} rows={[
          ["RNNencdec-30 (plain seq2seq style)", "13.93", "24.19"],
          ["RNNsearch-30 (attention)", "21.50", "31.44"],
          ["RNNencdec-50", "17.82", "26.71"],
          ["RNNsearch-50", "26.75", "34.16"],
          ["RNNsearch-50, trained longer", "28.45", "36.15"],
          ["Moses (classic phrase-based system)", "33.30", "35.63"],
        ]} />
        <Steps steps={[
          { title: "Attention beat the plain encoder-decoder everywhere", detail: "Same data, same training. The -30 and -50 mean trained on sentences up to 30 or 50 words. Even RNNsearch-30 beat RNNencdec-50." },
          { title: "Caught up with the classic system", detail: "On sentences with no unknown words, attention matched or beat Moses, even though Moses also used an extra 418M words of monolingual text." },
          { title: "No collapse on long sentences", detail: "The plain model dropped sharply as sentences got longer; RNNsearch-50 showed no deterioration even at 50+ words." },
          { title: "Alignments make sense", detail: "The learned weights mostly follow the diagonal but correctly handle reordering, like adjective-noun order flipping between English and French." },
          { title: "Honest limits", detail: "Scoring every source word for every output word costs more on long inputs, and rare or unknown words remained a challenge." },
        ]} />
        <Callout tone="info" lead="Where this leads.">This paper bolted attention onto an RNN. A few papers later, "Attention Is All You Need" throws the RNN away and builds the whole model from attention.</Callout>
      </Section>

      <Section heading="Play: attention as 3D bars" caption="Same toy scores as Demo 1, drawn as bars you can switch.">
        <AttentionBars3D />
      </Section>

      <QuizSync slug="04-bahdanau-attention" picks={picks} answers={QUIZ.map((item) => item.answer)} />
      <Section heading="Check your understanding">
        {QUIZ.map((item: Q, qi: number) => (
          <Section key={qi} heading={`${qi + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((o: string, oi: number) => (
                <Button key={oi} label={o} variant={picks[qi] === oi ? "primary" : "quiet"} onClick={() => setPicks(picks.map((x: number | null, k: number) => (k === qi ? oi : x)))} />
              ))}
            </div>
            {picks[qi] === null ? null : picks[qi] === item.answer ? (
              <Callout tone="success" lead="Right.">{item.why}</Callout>
            ) : (
              <Callout tone="warning" lead="Not quite.">{item.why}</Callout>
            )}
          </Section>
        ))}
        <Text>In your own words, how the context vector here differs from the single vector in seq2seq, and why that helps on long sentences.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Neural Machine Translation by Jointly Learning to Align and Translate", site: "arxiv.org", date: "2014", href: "https://arxiv.org/abs/1409.0473" },
          { title: "Paper PDF", site: "arxiv.org", date: "2014", href: "https://arxiv.org/pdf/1409.0473" },
        ]} />
      </Section>
    </Page>
  );
}
