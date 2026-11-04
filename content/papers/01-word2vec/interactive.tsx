"use client";

import { Page, Section, Text, Callout, Segmented, Select, Button, Table, Steps, LinkCards, Grid, useState, useMemo, useGrokTheme } from "grok/canvas";

type Word = { w: string; x: number; y: number };

const WORDS: Word[] = [
  { w: "king", x: 8, y: 7.5 },
  { w: "queen", x: 8, y: 2.5 },
  { w: "man", x: 2, y: 7.5 },
  { w: "woman", x: 2, y: 2.5 },
  { w: "prince", x: 6.3, y: 8.2 },
  { w: "princess", x: 6.3, y: 3.2 },
  { w: "boy", x: 0.8, y: 6.6 },
  { w: "girl", x: 0.8, y: 1.6 },
  { w: "dog", x: 11.5, y: 6 },
  { w: "puppy", x: 12.6, y: 7.2 },
  { w: "cat", x: 13.2, y: 4.2 },
  { w: "kitten", x: 14.3, y: 5.4 },
];

const VW = 700;
const VH = 420;
const px = (x: number) => 40 + x * (620 / 15);
const py = (y: number) => 390 - y * (350 / 10);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const find = (w: string): Word => WORDS.find((v: Word) => v.w === w) as Word;

const SENTENCE = ["my", "little", "puppy", "loves", "to", "chase", "the", "red", "ball"];

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "Why do dog and puppy end up with similar vectors?",
    options: ["Someone labelled them as related", "They show up around the same neighbouring words", "They are spelled similarly"],
    answer: 1,
    why: "Nobody labels anything. Both words appear near words like walk, bark, cute and leash, so training pushes their vectors to similar places.",
  },
  {
    q: "In skip-gram, what does the model try to predict?",
    options: ["The middle word from its neighbours", "The neighbouring words from the middle word", "The next whole sentence"],
    answer: 1,
    why: "Skip-gram takes one word and guesses the words around it. CBOW is the reverse: it takes the neighbours and guesses the middle word.",
  },
  {
    q: "What makes king minus man plus woman land near queen?",
    options: ["The model was programmed with that rule", "The jump from man to woman is roughly the same direction as king to queen", "It is a coincidence"],
    answer: 1,
    why: "Gender ends up as a consistent direction in the space, so subtracting man and adding woman moves king along that same direction, toward queen.",
  },
  {
    q: "Why was this paper a big deal in 2013?",
    options: ["It used a huge, slow neural network", "It used very simple models that trained fast on billions of words", "It invented the transformer"],
    answer: 1,
    why: "The point was efficiency: by stripping the model down, they could train on far more text in hours, and more data gave better vectors.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const [selected, setSelected] = useState<string>("puppy");
  const [a, setA] = useState<string>("king");
  const [b, setB] = useState<string>("man");
  const [c, setC] = useState<string>("woman");
  const [center, setCenter] = useState<number>(2);
  const [win, setWin] = useState<string>("2");
  const [mode, setMode] = useState<string>("skip");
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const neighbours = useMemo(() => {
    const s = find(selected);
    return WORDS.filter((v: Word) => v.w !== selected)
      .map((v: Word) => ({ w: v.w, d: dist(s, v) }))
      .sort((p: { w: string; d: number }, q: { w: string; d: number }) => p.d - q.d)
      .slice(0, 3);
  }, [selected]);

  const analogy = useMemo(() => {
    const A = find(a);
    const B = find(b);
    const C = find(c);
    const r = { x: A.x - B.x + C.x, y: A.y - B.y + C.y };
    const best = WORDS.filter((v: Word) => v.w !== a && v.w !== b && v.w !== c)
      .map((v: Word) => ({ w: v.w, d: dist(r, v) }))
      .sort((p: { w: string; d: number }, q: { w: string; d: number }) => p.d - q.d)[0];
    return { A, B, C, r, best };
  }, [a, b, c]);

  const n = Number(win);
  const contextIdx: number[] = [];
  for (let i = center - n; i <= center + n; i++) {
    if (i >= 0 && i < SENTENCE.length && i !== center) contextIdx.push(i);
  }
  const pairRows = mode === "skip"
    ? contextIdx.map((i: number) => [SENTENCE[center], SENTENCE[i]])
    : [[contextIdx.map((i: number) => SENTENCE[i]).join(", "), SENTENCE[center]]];

  const wordOptions = WORDS.map((v: Word) => v.w);
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const nearSet = neighbours.map((p: { w: string; d: number }) => p.w);

  return (
    <Page title="Word2vec, explained by playing with it" summary="The 2013 paper that taught computers to turn words into numbers that capture meaning. Click around, then test yourself at the bottom.">
      <Section heading="The big idea in one line">
        <Callout>You can tell what a word means by the company it keeps. Words used in similar places get similar numbers.</Callout>
        <Text>Computers can't read words, only numbers. Word2vec gives every word a list of numbers, called a vector, which you can think of as a position on a map. It learns those positions just by reading lots of text and noticing which words appear near each other. Nobody tells it that dog and puppy are related; it figures that out because they show up around the same words.</Text>
      </Section>

      <Section heading="Explore the word map" caption="A toy 2D map drawn for teaching. Real word2vec vectors have about 300 dimensions.">
        <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display: "block" }}>
          <rect x={0} y={0} width={VW} height={VH} fill={t.bg.base} />
          {[0, 2, 4, 6, 8, 10].map((g: number) => (
            <line key={g} x1={40} x2={660} y1={py(g)} y2={py(g)} stroke={t.border.subtle} strokeWidth={1} />
          ))}
          {WORDS.map((v: Word) => {
            const isSel = v.w === selected;
            const isNear = nearSet.indexOf(v.w) >= 0;
            return (
              <g key={v.w} style={{ cursor: "pointer" }} onClick={() => setSelected(v.w)}>
                {isNear ? <line x1={px(find(selected).x)} y1={py(find(selected).y)} x2={px(v.x)} y2={py(v.y)} stroke={t.dataviz.other} strokeDasharray="4 4" /> : null}
                <circle cx={px(v.x)} cy={py(v.y)} r={isSel ? 9 : 7} fill={isSel ? yellow : isNear ? blue : t.dataviz.singleSeriesRest} />
                <text x={px(v.x) + 12} y={py(v.y) + 4} fill={t.text.primary} fontSize={13} fontFamily={t.font.family}>{v.w}</text>
              </g>
            );
          })}
          <text x={40} y={VH - 6} fill={t.text.tertiary} fontSize={11} fontFamily={t.font.family}>Click any word to see its nearest neighbours</text>
        </svg>
        <Text>{`Nearest to "${selected}": ${neighbours.map((p: { w: string; d: number }) => p.w).join(", ")}. Notice that royalty words cluster on one side, animals on the other, and male and female words sit at different heights.`}</Text>
      </Section>

      <Section heading="Word arithmetic" caption="Pick three words. The page computes first minus second plus third and finds the closest word.">
        <Grid columns={3}>
          <Select label="Start with" options={wordOptions} value={a} onChange={(v: string) => setA(v)} />
          <Select label="Subtract" options={wordOptions} value={b} onChange={(v: string) => setB(v)} />
          <Select label="Add" options={wordOptions} value={c} onChange={(v: string) => setC(v)} />
        </Grid>
        <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display: "block" }}>
          <rect x={0} y={0} width={VW} height={VH} fill={t.bg.base} />
          {WORDS.map((v: Word) => (
            <g key={v.w}>
              <circle cx={px(v.x)} cy={py(v.y)} r={6} fill={v.w === analogy.best.w ? yellow : [a, b, c].indexOf(v.w) >= 0 ? blue : t.dataviz.singleSeriesRest} />
              <text x={px(v.x) + 10} y={py(v.y) + 4} fill={t.text.primary} fontSize={13} fontFamily={t.font.family}>{v.w}</text>
            </g>
          ))}
          <line x1={px(analogy.B.x)} y1={py(analogy.B.y)} x2={px(analogy.A.x)} y2={py(analogy.A.y)} stroke={blue} strokeWidth={2} strokeDasharray="6 4" />
          <line x1={px(analogy.C.x)} y1={py(analogy.C.y)} x2={px(analogy.r.x)} y2={py(analogy.r.y)} stroke={yellow} strokeWidth={2} strokeDasharray="6 4" />
          <circle cx={px(analogy.r.x)} cy={py(analogy.r.y)} r={10} fill="none" stroke={yellow} strokeWidth={2} />
        </svg>
        <Text>{`${a} minus ${b} plus ${c} lands closest to "${analogy.best.w}". The two dashed lines are the same jump: whatever separates ${b} from ${a} gets applied to ${c}. Try puppy, dog, cat.`}</Text>
      </Section>

      <Section heading="How it learns: sliding a window over text">
        <Text>Click a word to make it the centre. The window decides how many neighbours on each side count as context.</Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SENTENCE.map((w: string, i: number) => {
            const isC = i === center;
            const inWin = contextIdx.indexOf(i) >= 0;
            return (
              <span key={i} onClick={() => setCenter(i)} style={{ cursor: "pointer", padding: "6px 10px", borderRadius: 8, border: `1px solid ${isC ? yellow : inWin ? blue : t.border.default}`, background: isC ? yellow : "transparent", color: isC ? "#000000" : t.text.primary, fontFamily: t.font.family, fontSize: 15 }}>{w}</span>
            );
          })}
        </div>
        <Grid columns={2} plain>
          <Segmented options={[{ value: "1", label: "Window 1" }, { value: "2", label: "Window 2" }, { value: "3", label: "Window 3" }]} value={win} onChange={(v: string) => setWin(v)} />
          <Segmented options={[{ value: "skip", label: "Skip-gram" }, { value: "cbow", label: "CBOW" }]} value={mode} onChange={(v: string) => setMode(v)} />
        </Grid>
        <Table columns={["Model sees", "Model must guess"]} rows={pairRows} />
        <Text>{mode === "skip" ? "Skip-gram: given the centre word, guess each neighbour. Every wrong guess nudges the vectors a little, and after billions of nudges, words with similar neighbours end up close together." : "CBOW (continuous bag of words): given all the neighbours together, guess the missing middle word. It is faster to train; skip-gram tends to do better on rare words."}</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Steps steps={[
          { title: "Simple beats fancy", detail: "Older neural language models had a slow hidden layer. The authors removed it, leaving two very simple models: CBOW and skip-gram." },
          { title: "So they could use far more data", detail: "Being cheap to train meant learning from about 1.6 billion words in under a day." },
          { title: "And the vectors captured meaning", detail: "They built a test of analogy questions like Athens is to Greece as Oslo is to what, and their vectors answered many of them correctly." },
        ]} />
      </Section>

      <Section heading="Check your understanding">
        {QUIZ.map((item: Q, qi: number) => (
          <Section key={qi} heading={`${qi + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((o: string, oi: number) => (
                <Button key={oi} label={o} variant={picks[qi] === oi ? "primary" : "quiet"} onClick={() => setPicks(picks.map((p: number | null, k: number) => (k === qi ? oi : p)))} />
              ))}
            </div>
            {picks[qi] === null ? null : picks[qi] === item.answer ? (
              <Callout tone="success" lead="Right.">{item.why}</Callout>
            ) : (
              <Callout tone="warning" lead="Not quite.">{item.why}</Callout>
            )}
          </Section>
        ))}
        <Text>Then tell me in chat, in your own words, why dog and puppy end up close. Explaining it yourself is the real test.</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Efficient Estimation of Word Representations in Vector Space", site: "arxiv.org", date: "2013", href: "https://arxiv.org/abs/1301.3781" },
        ]} />
      </Section>
    </Page>
  );
}
