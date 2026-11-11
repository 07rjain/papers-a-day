"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, useState, useMemo, useGrokTheme } from "grok/canvas";

type Pair = { src: string[]; tgt: string[] };
const PAIRS: Pair[] = [
  { src: ["I", "love", "cats"], tgt: ["j'", "aime", "les", "chats"] },
  { src: ["the", "cat", "is", "black"], tgt: ["le", "chat", "est", "noir"] },
  { src: ["where", "is", "the", "station", "?"], tgt: ["où", "est", "la", "gare", "?"] },
];

function toyVec(words: string[]): number[] {
  const v: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  words.forEach((w: string, i: number) => {
    for (let k = 0; k < v.length; k++) {
      const code = w.charCodeAt(k % w.length) || 1;
      v[k] = Math.tanh(0.6 * v[k] + Math.sin(code * (k + 1) + i) * 0.9);
    }
  });
  return v;
}

type Hyp = { seq: string[]; p: number };
const TREE: Record<string, Record<string, number>> = {
  "": { le: 0.5, un: 0.4, la: 0.1 },
  le: { chat: 0.3, gros: 0.3, petit: 0.4 },
  un: { chat: 0.9, chien: 0.1 },
  la: { chatte: 1.0 },
};

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "What does the encoder hand to the decoder?",
    options: ["The full list of input words", "One fixed-size vector summarizing the whole sentence", "Word2vec embeddings of the French words"],
    answer: 1,
    why: "The encoder's final hidden state is a single fixed-length vector, and it's the only thing the decoder gets about the input. Remember this: it's exactly the bottleneck the next paper (attention) fixes.",
  },
  {
    q: "Why was seq2seq a big deal compared with an ordinary neural network?",
    options: ["It needed no training data", "Input and output can have different lengths that aren't known in advance", "It didn't use vectors at all"],
    answer: 1,
    why: "Ordinary networks of the time needed fixed-size inputs and outputs. Seq2seq reads any length and writes any length.",
  },
  {
    q: "How does the decoder know when to stop writing?",
    options: ["After exactly 20 words", "When the input runs out", "When it produces the special <EOS> token"],
    answer: 2,
    why: "Every training sentence ends with <EOS> (end of sentence), so the model learns to output it when the translation is finished.",
  },
  {
    q: "Why did reversing the source sentence help?",
    options: ["It shrinks the average distance between matching words", "It puts the first source words right next to the first target words, giving training short, easy links", "French is read backwards"],
    answer: 1,
    why: "The average distance stays the same. But the early words land close to their translations, and those short-range links make the learning problem much easier to get started on.",
  },
  {
    q: "What was the headline result?",
    options: ["A pure neural system (34.8 BLEU) beat a phrase-based statistical baseline (33.3) on English to French", "It beat every system in the world by 10 points", "It trained on a laptop in an hour"],
    answer: 0,
    why: "It was the first time a pure neural translator clearly beat a strong phrase-based baseline at large scale. It still trailed the best WMT'14 system (37.0); reranking that baseline's guesses got it to 36.5.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const purple = t.dataviz.categorical[2] || blue;

  // Demo 1
  const [pairIdx, setPairIdx] = useState<string>("0");
  const [step, setStep] = useState<number>(0);
  const pair = PAIRS[Number(pairIdx)];
  const srcTokens = [...pair.src, "<EOS>"];
  const tgtTokens = [...pair.tgt, "<EOS>"];
  const total = srcTokens.length + tgtTokens.length;
  const encRead = Math.min(step, srcTokens.length);
  const decOut = Math.max(0, step - srcTokens.length);
  const vec = toyVec(srcTokens.slice(0, encRead));
  let phase = "Press Next step to start reading.";
  if (step > 0 && encRead < srcTokens.length) phase = `The encoder reads "${srcTokens[encRead - 1]}" and updates its memory.`;
  else if (step > 0 && decOut === 0) phase = "The encoder has read <EOS>. The whole sentence is now squeezed into ONE vector. The decoder starts from it.";
  else if (decOut > 0 && decOut < tgtTokens.length) phase = `The decoder writes "${tgtTokens[decOut - 1]}", then feeds that word back in to choose the next one.`;
  else if (decOut >= tgtTokens.length) phase = "The decoder wrote <EOS>, so it stops. Done!";

  // Demo 2
  const [n, setN] = useState<number>(6);
  const [order, setOrder] = useState<string>("normal");
  const src = Array.from({ length: n }, (_: unknown, i: number) => `a${i + 1}`);
  const fed = order === "reversed" ? [...src].reverse() : src;
  const gaps = src.map((w: string, i: number) => n + i - fed.indexOf(w));
  const avgGap = gaps.reduce((a: number, b: number) => a + b, 0) / n;

  // Demo 3
  const [beam, setBeam] = useState<string>("1");
  const beamRun = useMemo(() => {
    const B = Number(beam);
    let kept: Hyp[] = [{ seq: [], p: 1 }];
    const log: { all: Hyp[]; kept: Hyp[] }[] = [];
    for (let s = 0; s < 2; s++) {
      const cand: Hyp[] = [];
      kept.forEach((h: Hyp) => {
        const opts = TREE[h.seq.join(" ")] || {};
        Object.keys(opts).forEach((w: string) => cand.push({ seq: [...h.seq, w], p: h.p * opts[w] }));
      });
      cand.sort((a: Hyp, b: Hyp) => b.p - a.p);
      kept = cand.slice(0, B);
      log.push({ all: cand, kept });
    }
    return { log, best: kept[0] };
  }, [beam]);

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const tok = (label: string, on: boolean, color: string, key: number) => (
    <span key={key} style={{ display: "inline-block", padding: "4px 9px", margin: 3, borderRadius: 6, fontFamily: t.font.family, fontSize: 14, background: on ? color : t.bg.base, color: on ? "#000000" : t.text.tertiary, border: `1px solid ${t.border.default}` }}>{label}</span>
  );

  return (
    <Page title="Seq2seq, explained by playing with it" summary="Daily paper #3: Sutskever, Vinyals and Le (Google, 2014). After learning vectors for words with word2vec and GloVe, this is how a network turns a whole sentence into another sentence. Click around, then test yourself at the bottom.">
      <Section heading="The big idea in one line">
        <Callout>One network reads a sentence into a single vector; a second network writes a new sentence out of that vector, one word at a time.</Callout>
        <Text>word2vec and GloVe gave us a vector for each word. But translation is sentence in, sentence out, and the two sentences can have different lengths. Ordinary neural networks of the time needed a fixed-size input and a fixed-size output, so they couldn't do this directly.</Text>
        <Text>Seq2seq uses two LSTMs. An LSTM (Long Short-Term Memory) is a network that reads things one step at a time while keeping a running memory. The encoder reads the English word by word and ends up with one memory vector. The decoder starts from that vector and writes French one word at a time, each time looking at what it already wrote, until it outputs a special end token, {"<EOS>"}. The input words go in as learned word vectors, just like the ones you met in word2vec.</Text>
      </Section>

      <Section heading="Demo 1: read everything, squeeze it into one vector, then write" caption="Toy example. The bars are made-up numbers standing in for the encoder's memory (the real model used 8,000 numbers), and the translations are hand-written, not model output.">
        <Segmented options={PAIRS.map((q: Pair, i: number) => ({ value: String(i), label: q.src.join(" ") }))} value={pairIdx} onChange={(v: string) => { setPairIdx(v); setStep(0); }} />
        <Text>Encoder (reads English):</Text>
        <div>{srcTokens.map((w: string, i: number) => tok(w, i < encRead, blue, i))}</div>
        <svg width="100%" viewBox="0 0 700 90" style={{ display: "block" }}>
          <rect x={0} y={0} width={700} height={90} fill={t.bg.base} />
          <text x={10} y={50} fill={t.text.secondary} fontSize={13} fontFamily={t.font.family}>memory vector</text>
          {vec.map((x: number, i: number) => (
            <rect key={i} x={140 + i * 36} y={80 - (4 + Math.abs(x) * 66)} width={26} height={4 + Math.abs(x) * 66} rx={3} fill={x >= 0 ? purple : yellow} />
          ))}
        </svg>
        <Text>Decoder (writes French):</Text>
        <div>{tgtTokens.map((w: string, i: number) => tok(i < decOut ? w : "?", i < decOut, yellow, i))}</div>
        <Callout>{phase}</Callout>
        <div style={{ display: "flex", gap: 8 }}>
          <Button label="Next step" variant="primary" onClick={() => setStep(Math.min(total, step + 1))} />
          <Button label="Reset" variant="quiet" onClick={() => setStep(0)} />
        </div>
        <Text>Notice the English and French sentences have different lengths. That's the whole point. Also notice the decoder never sees the English words directly, only that one vector.</Text>
      </Section>

      <Section heading="Demo 2: the weird trick that worked, reversing the input" caption="Toy setup: pretend source word a1 translates to b1, a2 to b2, and so on, in the same order.">
        <Text>Count how many steps pass between the model reading a word and writing its translation. Change the sentence length and flip the order.</Text>
        <input type="range" min={3} max={12} value={n} onChange={(e: any) => setN(Number(e.target.value))} style={{ width: "100%" }} />
        <Segmented options={[{ value: "normal", label: "Normal order" }, { value: "reversed", label: "Reversed source" }]} value={order} onChange={(v: string) => setOrder(v)} />
        <div>
          {fed.map((w: string, i: number) => tok(w, true, blue, i))}
          <span style={{ margin: "0 8px", color: t.text.secondary }}>then</span>
          {src.map((w: string, i: number) => tok(w.replace("a", "b"), true, yellow, 100 + i))}
        </div>
        <Table columns={["Word pair", "Steps between reading and writing"]} rows={src.map((w: string, i: number) => [`${w} to ${w.replace("a", "b")}`, String(gaps[i])])} />
        <Callout>{`Sentence length ${n}: the average gap is ${avgGap.toFixed(1)} steps in both orders, but the first word's gap is ${gaps[0]} steps in this order.`}</Callout>
        <Text>Reversing doesn't change the average distance, but it puts the first few words right next to their translations. Those short links give training an easy foothold. In the paper this one change raised a single model's BLEU score (a standard translation-quality score, higher is better) from 25.9 to 30.6.</Text>
      </Section>

      <Section heading="Demo 3: choosing words, greedy vs beam search" caption="The probabilities here are made-up example numbers.">
        <Text>At each step the decoder gives a probability to every possible next word. Beam size 1 (greedy) keeps only the single best partial sentence. A bigger beam keeps a few alive and picks the best complete one at the end.</Text>
        <Segmented options={[{ value: "1", label: "Beam 1" }, { value: "2", label: "Beam 2" }, { value: "3", label: "Beam 3" }]} value={beam} onChange={(v: string) => setBeam(v)} />
        {beamRun.log.map((s: { all: Hyp[]; kept: Hyp[] }, i: number) => (
          <div key={i}>
            <Text>{`Step ${i + 1} candidates (highlighted ones are kept):`}</Text>
            <div>{s.all.map((h: Hyp, j: number) => tok(`${h.seq.join(" ")} (${h.p.toFixed(2)})`, s.kept.indexOf(h) >= 0, blue, j))}</div>
          </div>
        ))}
        <Callout>{`Final pick: "${beamRun.best.seq.join(" ")}" with probability ${beamRun.best.p.toFixed(2)}.`}</Callout>
        <Text>With beam 1 you grab "le" (0.5) first and end up at 0.20. With beam 2 you keep "un" alive and find "un chat" at 0.36. The paper found beam 1 already worked well and beam 2 gave most of the benefit.</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Steps steps={[
          { title: "Beat a classic translation system", detail: "On WMT'14 English to French, an ensemble of 5 deep LSTMs scored 34.8 BLEU, versus 33.3 for a phrase-based statistical baseline. The authors say it's the first time a pure neural system beat such a baseline by a sizeable margin on a large task." },
          { title: "Even better as a reranker", detail: "Using the LSTM to rescore the baseline's 1000 best guesses gave 36.5 BLEU, close to the best published result then (37.0)." },
          { title: "Reversal trick", detail: "Reversing the source sentence cut test perplexity from 5.8 to 4.7 and raised a single model's BLEU from 25.9 to 30.6." },
          { title: "Long sentences and meaningful vectors", detail: "It handled long sentences surprisingly well, and its sentence vectors grouped by meaning: sensitive to word order, fairly unaffected by active vs passive voice." },
          { title: "Big for 2014", detail: "4 layers of 1,000 cells each, 384M parameters, an 80,000 word output vocabulary (unknown words became UNK), and about ten days of training on 8 GPUs." },
        ]} />
        <Callout tone="warning" lead="The catch to remember.">Everything about the input has to fit through one fixed-size vector. The next paper on this path, Bahdanau's attention, lets the decoder look back at every input word instead.</Callout>
      </Section>

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
        <Text>In your own words, why squeezing the whole sentence into one vector could be a problem for long sentences. Explaining it yourself is the real test.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Sequence to Sequence Learning with Neural Networks", site: "arxiv.org", date: "2014", href: "https://arxiv.org/abs/1409.3215" },
          { title: "Paper PDF", site: "arxiv.org", date: "2014", href: "https://arxiv.org/pdf/1409.3215" },
        ]} />
      </Section>
    </Page>
  );
}
