"use client";

import { Page, Section, Text, Callout, Segmented, Select, Button, Table, Steps, LinkCards, Grid, useState, useMemo, useGrokTheme } from "grok/canvas";

const CORPUS: string[] = [
  "ice is cold and solid",
  "steam is hot gas",
  "water can become ice or steam",
  "solid ice melts into water",
  "hot water turns into steam gas",
  "cold water freezes into solid ice",
  "the steam gas rises from hot water",
];

const TARGETS = ["ice", "steam", "water", "solid", "gas", "hot", "cold"];

type Probe = { k: string; ice: number; steam: number; note: string };
const PROBES: Probe[] = [
  { k: "solid", ice: 1.9e-4, steam: 2.2e-5, note: "Big ratio: solid goes with ice, not steam." },
  { k: "gas", ice: 6.6e-5, steam: 7.8e-4, note: "Tiny ratio: gas goes with steam, not ice." },
  { k: "water", ice: 3.0e-3, steam: 2.2e-3, note: "Ratio near 1: water relates to both, so it doesn't tell them apart." },
  { k: "fashion", ice: 1.7e-5, steam: 1.8e-5, note: "Ratio near 1: fashion relates to neither, so it's just noise." },
];

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "What does GloVe count before it starts training?",
    options: ["How often each pair of words appears near each other across the whole corpus", "How many letters each word has", "Which sentence comes next"],
    answer: 0,
    why: "GloVe first builds one big co-occurrence table for the whole corpus, then learns vectors from that table. That is the 'global' in Global Vectors.",
  },
  {
    q: "Why look at the ratio P(k | ice) / P(k | steam) instead of raw counts?",
    options: ["Ratios are faster to compute", "The ratio separates words that tell ice and steam apart from words that don't", "Raw counts are always zero"],
    answer: 1,
    why: "Raw counts are big for common words like water and the. The ratio is far from 1 only for words like solid or gas that actually distinguish ice from steam.",
  },
  {
    q: "How is GloVe different from word2vec's skip-gram?",
    options: ["GloVe does not use vectors at all", "Skip-gram learns one window at a time; GloVe learns from counts summed over the whole corpus", "GloVe only works on images"],
    answer: 1,
    why: "Skip-gram slides over text and nudges vectors window by window. GloVe gathers all the co-occurrence statistics first and fits vectors to them directly.",
  },
  {
    q: "Why does GloVe use a weighting function on the counts?",
    options: ["So rare, noisy pairs count less and very common pairs don't dominate", "To make training slower", "To remove all common words"],
    answer: 0,
    why: "Pairs seen once or twice are mostly noise, and pairs like 'the, of' are seen millions of times. The weight grows with the count but is capped, balancing both problems.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const [target, setTarget] = useState<string>("ice");
  const [win, setWin] = useState<string>("2");
  const [probe, setProbe] = useState<string>("solid");
  const [count, setCount] = useState<number>(10);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const counts = useMemo(() => {
    const n = Number(win);
    const m: Record<string, number> = {};
    CORPUS.forEach((s: string) => {
      const ws = s.split(" ");
      ws.forEach((w: string, i: number) => {
        if (w !== target) return;
        for (let j = i - n; j <= i + n; j++) {
          if (j >= 0 && j < ws.length && j !== i) {
            m[ws[j]] = (m[ws[j]] || 0) + 1;
          }
        }
      });
    });
    return Object.keys(m).map((k: string) => ({ k, c: m[k] })).sort((a: { k: string; c: number }, b: { k: string; c: number }) => b.c - a.c);
  }, [target, win]);

  const p = PROBES.find((x: Probe) => x.k === probe) as Probe;
  const ratio = p.ice / p.steam;
  const logR = Math.log10(ratio);
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];

  const weight = (x: number) => (x < 100 ? Math.pow(x / 100, 0.75) : 1);
  // Round so the server HTML and the browser agree on long decimals.
  const round = (n: number) => Math.round(n * 100) / 100;
  const curve: string[] = [];
  for (let x = 0; x <= 200; x += 2) {
    curve.push(`${40 + x * 3},${round(200 - weight(x) * 160)}`);
  }

  return (
    <Page title="GloVe, explained by playing with it" summary="The 2014 Stanford paper that builds word vectors from one big table of word counts. A follow-on to word2vec. Click around, then test yourself at the bottom.">
      <Section heading="The big idea in one line">
        <Callout>Count how often every pair of words appears together across all your text, then learn vectors whose dot products match those counts.</Callout>
        <Text>Word2vec learned by sliding a window over text and making a tiny guess each time. GloVe (Global Vectors) asks: why not count everything first? It builds one huge table saying how often word A shows up near word B anywhere in the corpus. Then it learns a vector for each word so that multiplying two words' vectors together predicts (the log of) how often they appear together. Same goal as word2vec, a map where similar words sit close, but learned from global statistics instead of one window at a time.</Text>
      </Section>

      <Section heading="Step 1: build the co-occurrence table" caption="Toy example corpus of seven made-up sentences. The real paper counted over billions of words.">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {CORPUS.map((s: string, i: number) => (
            <div key={i} style={{ fontFamily: t.font.family, fontSize: 14, color: t.text.secondary }}>
              {s.split(" ").map((w: string, j: number) => (
                <span key={j} style={{ marginRight: 6, padding: "1px 4px", borderRadius: 4, background: w === target ? yellow : "transparent", color: w === target ? "#000000" : t.text.primary }}>{w}</span>
              ))}
            </div>
          ))}
        </div>
        <Grid columns={2}>
          <Select label="Count neighbours of" options={TARGETS} value={target} onChange={(v: string) => setTarget(v)} />
          <Segmented options={[{ value: "1", label: "Window 1" }, { value: "2", label: "Window 2" }, { value: "3", label: "Window 3" }]} value={win} onChange={(v: string) => setWin(v)} />
        </Grid>
        <Table columns={["Neighbour word", `Times seen near "${target}"`]} rows={counts.map((r: { k: string; c: number }) => [r.k, String(r.c)])} />
        <Text>This is one row of GloVe's big table. Notice it's computed once over every sentence, not learned window by window. Try ice and then steam: both see water, but only one sees solid and only one sees gas.</Text>
      </Section>

      <Section heading="Step 2: ratios reveal meaning" caption="These numbers are the real ones from Table 1 of the paper, counted on a 6 billion word corpus.">
        <Text>Raw counts are messy because common words show up everywhere. The paper's key insight: compare two words, ice and steam, by asking how much more likely a probe word k is to appear near ice than near steam.</Text>
        <Segmented options={PROBES.map((x: Probe) => ({ value: x.k, label: x.k }))} value={probe} onChange={(v: string) => setProbe(v)} />
        <Table columns={["", "Value"]} rows={[
          [`P(${probe} | ice)`, p.ice.toExponential(1)],
          [`P(${probe} | steam)`, p.steam.toExponential(1)],
          ["Ratio (ice / steam)", ratio >= 1 ? ratio.toFixed(2) : ratio.toFixed(3)],
        ]} />
        <svg width="100%" viewBox="0 0 700 90" style={{ display: "block" }}>
          <rect x={0} y={0} width={700} height={90} fill={t.bg.base} />
          <line x1={50} x2={650} y1={45} y2={45} stroke={t.border.default} strokeWidth={2} />
          <line x1={350} x2={350} y1={30} y2={60} stroke={t.border.default} strokeWidth={2} />
          <text x={50} y={80} fill={t.text.tertiary} fontSize={12} fontFamily={t.font.family}>steam-ish</text>
          <text x={330} y={80} fill={t.text.tertiary} fontSize={12} fontFamily={t.font.family}>ratio 1</text>
          <text x={590} y={80} fill={t.text.tertiary} fontSize={12} fontFamily={t.font.family}>ice-ish</text>
          <circle cx={round(350 + Math.max(-1.5, Math.min(1.5, logR)) * 200)} cy={45} r={11} fill={Math.abs(logR) < 0.3 ? t.dataviz.singleSeriesRest : logR > 0 ? blue : yellow} />
          <text x={round(350 + Math.max(-1.5, Math.min(1.5, logR)) * 200 - 20)} y={22} fill={t.text.primary} fontSize={13} fontFamily={t.font.family}>{probe}</text>
        </svg>
        <Callout>{p.note}</Callout>
        <Text>So the meaning lives in the ratios. GloVe is designed so that the difference between the ice and steam vectors, combined with the vector for k, reproduces these ratios. That's why word arithmetic like king minus man plus woman works here too.</Text>
      </Section>

      <Section heading="Step 3: don't trust every count equally" caption="The paper's weighting function with its settings, a cap of 100 and a power of 3/4.">
        <Text>Drag the count. A pair seen once is probably noise, so it gets a small weight. Weight rises with the count, but it's capped at 1 so super-common pairs like "of the" don't drown everything out.</Text>
        <input type="range" min={0} max={200} value={count} onChange={(e: any) => setCount(Number(e.target.value))} style={{ width: "100%" }} />
        <svg width="100%" viewBox="0 0 700 230" style={{ display: "block" }}>
          <rect x={0} y={0} width={700} height={230} fill={t.bg.base} />
          <line x1={40} x2={640} y1={200} y2={200} stroke={t.border.default} />
          <line x1={40} x2={40} y1={30} y2={200} stroke={t.border.default} />
          <polyline points={curve.join(" ")} fill="none" stroke={blue} strokeWidth={3} />
          <circle cx={40 + count * 3} cy={round(200 - weight(count) * 160)} r={8} fill={yellow} />
          <text x={45} y={25} fill={t.text.tertiary} fontSize={12} fontFamily={t.font.family}>weight</text>
          <text x={560} y={222} fill={t.text.tertiary} fontSize={12} fontFamily={t.font.family}>times seen together</text>
          <text x={340} y={222} fill={t.text.tertiary} fontSize={12} fontFamily={t.font.family}>100 (cap)</text>
        </svg>
        <Text>{`Seen together ${count} times gives weight ${weight(count).toFixed(2)}.`}</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Steps steps={[
          { title: "Two families, combined", detail: "Older count-based methods (like LSA) used global statistics but did badly on analogies. Window-based methods like word2vec did well on analogies but ignored global counts. GloVe aims to get both." },
          { title: "A simple objective", detail: "Train vectors so that the dot product of two word vectors, plus bias terms, matches the log of how often they co-occur, weighted by the function above." },
          { title: "Strong results", detail: "On the word analogy test it reached 75% accuracy with 300-dimensional vectors trained on 42 billion words, and the authors report it beat word2vec under comparable training on analogy, word similarity and named entity recognition tasks." },
          { title: "Efficient", detail: "Training only touches the non-zero entries of the table, so cost depends on the table, not the full corpus length." },
        ]} />
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
        <Text>Then tell me in chat, in your own words, why the ratio for "water" is close to 1 and what that tells us. Explaining it yourself is the real test.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "GloVe: Global Vectors for Word Representation", site: "aclanthology.org", date: "2014", href: "https://aclanthology.org/D14-1162/" },
          { title: "Paper PDF", site: "aclanthology.org", date: "2014", href: "https://aclanthology.org/D14-1162.pdf" },
        ]} />
      </Section>
    </Page>
  );
}
