"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, Metrics, useState, useGrokTheme } from "grok/canvas";
import { QuizSync } from "@/components/study/progress";

// All formulas and constants below are the paper's own fitted values (Kaplan et al., 2020).
// L(N) = (Nc / N)^aN, aN = 0.076, Nc = 8.8e13 non-embedding params (eq. 1.1)
const A_N = 0.076;
const N_C = 8.8e13;
const lossN = (n: number) => Math.pow(N_C / n, A_N);

// L(N, D) fit from Table 2: aN 0.076, aD 0.103, Nc 6.4e13, Dc 1.8e13 (eq. 1.5)
const T2 = { aN: 0.076, aD: 0.103, Nc: 6.4e13, Dc: 1.8e13 };
const lossND = (n: number, d: number) => Math.pow(Math.pow(T2.Nc / n, T2.aN / T2.aD) + T2.Dc / d, T2.aD);
const lossNinf = (n: number) => Math.pow(T2.Nc / n, T2.aN);

const fmt = (x: number) => {
  if (x >= 1e12) return `${(x / 1e12).toFixed(x >= 1e13 ? 0 : 1)}T`;
  if (x >= 1e9) return `${(x / 1e9).toFixed(x >= 1e10 ? 0 : 1)}B`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(x >= 1e7 ? 0 : 1)}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(0)}K`;
  return x.toFixed(x < 10 ? 2 : 0);
};

const N_OPTIONS = [1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
const COMPUTE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const D_OPTIONS = [2.2e7, 2.2e8, 2.2e9, 2.2e10];
const N_OVERFIT = [1e7, 1e8, 1e9];

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "What does a \"power law\" between loss and model size mean here?",
    options: [
      "Loss drops by the same fraction every time you multiply model size by the same factor",
      "Loss drops by a fixed amount for every extra parameter you add",
      "Loss stops improving after 1 billion parameters",
    ],
    answer: 0,
    why: "L(N) = (Nc/N)^0.076. Every doubling of N multiplies the loss by about 2^-0.076 = 0.95, so about 5% lower, whether you go from 1M to 2M or 1B to 2B. On a log-log plot that is a straight line.",
  },
  {
    q: "According to the paper, what matters most for performance?",
    options: [
      "The exact shape: depth vs width, number of attention heads",
      "Scale: parameters N, data D and compute C",
      "The learning-rate schedule",
    ],
    answer: 1,
    why: "Performance depends strongly on scale and only weakly on shape. A 6-layer model with width 4288 got within 3% of the 48-layer GPT-2 shape with the same parameter count. Learning-rate schedule mattered little as long as it had warmup and decay.",
  },
  {
    q: "You get 10x more compute. Where should most of it go, per this paper?",
    options: [
      "Training the same model for 10x more steps",
      "Collecting 10x more data",
      "Making the model bigger (about 5x), with only a modest increase in data",
    ],
    answer: 2,
    why: "Optimal model size grows as C^0.73, so about 5x per 10x of compute, while the data processed grows only about 2x. Serial steps barely grow (C^0.03). Big models are more sample-efficient, so you train a big model and stop well before it converges.",
  },
  {
    q: "What happens if you keep growing the model but hold the dataset fixed?",
    options: [
      "Loss keeps falling on the same straight line forever",
      "You hit diminishing returns and start overfitting",
      "Loss immediately gets worse",
    ],
    answer: 1,
    why: "L(N, D) flattens out when D is the bottleneck. The paper says the penalty depends on N^0.74 / D, so every 8x bigger model needs roughly 5x more data to avoid it.",
  },
  {
    q: "Why is this paper a big deal for GPT-3, which you read yesterday?",
    options: [
      "It proved GPT-3 would be sentient",
      "Its smooth, predictable curves gave a reason to bet on a 175B model before training it",
      "It introduced the Transformer architecture",
    ],
    answer: 1,
    why: "Kaplan et al. came out in January 2020 from OpenAI, several months before GPT-3. If loss falls predictably with scale and big models are more sample-efficient, building a much bigger model is a calculated bet rather than a leap of faith.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const green = t.dataviz.categorical[3] || t.dataviz.categorical[0];

  const [nIdx, setNIdx] = useState<string>("3");
  const n = N_OPTIONS[Number(nIdx)];

  const [cExp, setCExp] = useState<string>("3");
  const m = Number(cExp);

  const [dIdx, setDIdx] = useState<string>("3");
  const [noIdx, setNoIdx] = useState<string>("2");
  const d = D_OPTIONS[Number(dIdx)];
  const nO = N_OVERFIT[Number(noIdx)];

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  // Plot of L(N) on log-x axis
  const lawPlot = () => {
    const W = 700, H = 240, padL = 48, padR = 16, padT = 16, padB = 36;
    const xs = N_OPTIONS.map((v: number) => Math.log10(v));
    const xMin = 6, xMax = 12;
    const yMax = 4.2, yMin = 1.4;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const px = (lx: number) => r2(padL + ((lx - xMin) / (xMax - xMin)) * (W - padL - padR));
    const py = (y: number) => r2(padT + ((yMax - y) / (yMax - yMin)) * (H - padT - padB));
    const pts: string[] = [];
    for (let lx = xMin; lx <= xMax + 1e-9; lx += 0.1) pts.push(`${px(lx)},${py(lossN(Math.pow(10, lx)))}`);
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <rect x={0} y={0} width={W} height={H} fill={t.bg.base} />
        <polyline points={pts.join(" ")} fill="none" stroke={blue} strokeWidth={2.5} />
        {xs.map((lx: number, i: number) => {
          const sel = i === Number(nIdx);
          return (
            <g key={i} onClick={() => setNIdx(String(i))} style={{ cursor: "pointer" }}>
              <circle cx={px(lx)} cy={py(lossN(N_OPTIONS[i]))} r={sel ? 7 : 4} fill={sel ? yellow : blue} />
              <text x={px(lx)} y={H - 14} textAnchor="middle" fill={sel ? t.text.primary : t.text.secondary} fontSize={11} fontFamily={t.font.family}>{fmt(N_OPTIONS[i])}</text>
              {sel ? <text x={px(lx)} y={py(lossN(N_OPTIONS[i])) - 12} textAnchor="middle" fill={t.text.primary} fontSize={11} fontFamily={t.font.family}>{lossN(N_OPTIONS[i]).toFixed(2)}</text> : null}
            </g>
          );
        })}
        <text x={8} y={padT + 8} fill={t.text.secondary} fontSize={11} fontFamily={t.font.family}>loss</text>
        <text x={W - padR} y={H - 2} textAnchor="end" fill={t.text.secondary} fontSize={11} fontFamily={t.font.family}>parameters (log scale)</text>
      </svg>
    );
  };

  // Allocation bars for a 10^m compute increase
  const nMul = Math.pow(10, 0.73 * m);
  const bMul = Math.pow(10, 0.24 * m);
  const sMul = Math.pow(10, 0.03 * m);
  const allocBars = () => {
    const W = 700, H = 170;
    const rows = [
      { label: "Model size N  (C^0.73)", v: 0.73 * m, mul: nMul, color: blue },
      { label: "Batch size B  (C^0.24)", v: 0.24 * m, mul: bMul, color: green },
      { label: "Serial steps S  (C^0.03)", v: 0.03 * m, mul: sMul, color: yellow },
    ];
    const maxV = 0.73 * 9;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <rect x={0} y={0} width={W} height={H} fill={t.bg.base} />
        {rows.map((r, i: number) => {
          const w = Math.round(Math.max(3, (r.v / maxV) * 420) * 100) / 100;
          const y = 18 + i * 50;
          return (
            <g key={i}>
              <text x={8} y={y + 18} fill={t.text.secondary} fontSize={12} fontFamily={t.font.family}>{r.label}</text>
              <rect x={200} y={y + 4} width={w} height={22} rx={4} fill={r.color} />
              <text x={208 + w} y={y + 20} fill={t.text.primary} fontSize={12} fontFamily={t.font.family}>{`about ${fmt(r.mul)}x`}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  const lnd = lossND(nO, d);
  const linf = lossNinf(nO);
  const penalty = (lnd / linf - 1) * 100;

  return (
    <Page title="Scaling Laws, explained by playing with them" summary="Daily paper #9: Kaplan et al. (OpenAI, 2020), 'Scaling Laws for Neural Language Models'. GPT-2 and GPT-3 showed bigger is better. This paper measured exactly how much better: loss falls along smooth, predictable power laws in model size, data and compute, and it tells you how to split a compute budget between them.">
      <Section heading="The big idea in one line">
        <Callout>A language model's loss falls along a smooth, predictable straight line (on a log-log plot) as you scale up parameters, data and compute, so you can forecast how good a bigger model will be before you build it.</Callout>
        <Text>In the last two papers, GPT-2 and GPT-3 kept getting better as they got bigger. Kaplan and colleagues at OpenAI asked the obvious next question: exactly how much better, and what should you make bigger? They trained hundreds of decoder Transformers on WebText2, from 768 to 1.5 billion non-embedding parameters, on 22 million to 23 billion tokens, and measured the test loss (how surprised the model is by the next token, in nats; lower is better).</Text>
        <Text>The answer is surprisingly tidy. Loss is a power law in each of three things: model size N, dataset size D, and training compute C, as long as the other two are not the bottleneck. The shape of the network (deep and thin versus shallow and wide) barely matters. And bigger models learn more from each example, so with a fixed budget you should train a very big model and stop early.</Text>
      </Section>

      <Section heading="Demo 1: the power law in model size" caption="Curve computed from the paper's fitted formula L(N) = (8.8e13 / N)^0.076. Points beyond 1.5B parameters are the formula's extrapolation, not measured runs.">
        <Text>Pick a model size, or click a dot. Notice the curve keeps bending down at the same steady rate: each 10x bigger model has about 16% lower loss, and each doubling about 5% lower.</Text>
        <Segmented
          options={N_OPTIONS.map((v: number, i: number) => ({ value: String(i), label: fmt(v) }))}
          value={nIdx}
          onChange={(v: string) => setNIdx(v)}
        />
        <label>
          Model size along the fitted curve
          <input type="range" min={0} max={6} step={1} value={nIdx} onChange={(event) => setNIdx(event.target.value)} />
        </label>
        {lawPlot()}
        <Table columns={["", "Selected model"]} rows={[
          ["Non-embedding parameters N", fmt(n)],
          ["Predicted loss L(N)", `${lossN(n).toFixed(3)} nats per token`],
          ["Loss if you double it", `${lossN(2 * n).toFixed(3)} (x${(lossN(2 * n) / lossN(n)).toFixed(3)})`],
          ["Loss if you make it 10x bigger", `${lossN(10 * n).toFixed(3)} (x${(lossN(10 * n) / lossN(n)).toFixed(3)})`],
          ["Inside the paper's measured range?", n <= 1.5e9 ? "Yes (768 params to 1.5B)" : "No, extrapolated"],
        ]} />
        <Callout tone="info" lead="Why it's called a power law.">Loss is proportional to 1 / N^0.076. Multiplying N by any factor always multiplies the loss by the same amount, so it never suddenly stops improving, but each step costs 10x more than the last.</Callout>
      </Section>

      <Section heading="Demo 2: how to spend more compute" caption="Exponents are the paper's empirical compute-efficient fits: N grows as C^0.73, batch size as C^0.24, serial steps as C^0.03.">
        <Text>Say your compute budget grows by the factor below. The paper's fits say how that growth should be split between a bigger model, bigger batches (more data per step), and more training steps. Data processed is batch times steps.</Text>
        <Segmented
          options={COMPUTE_STEPS.map((k: number) => ({ value: String(k), label: `10^${k}x` }))}
          value={cExp}
          onChange={(v: string) => setCExp(v)}
        />
        {allocBars()}
        <Metrics metrics={[
          { value: `${fmt(nMul)}x`, label: "Bigger model", detail: "most of the budget" },
          { value: `${fmt(bMul * sMul)}x`, label: "More data processed", detail: "batch x steps" },
          { value: `${fmt(sMul)}x`, label: "More serial steps", detail: "barely changes" },
        ]} />
        <Callout tone="info" lead="The surprising part.">At a billion-fold more compute, the model should grow by millions of times, but the number of training steps less than doubles. Big models are so sample-efficient that the best use of compute is a huge model trained well short of convergence.</Callout>
      </Section>

      <Section heading="Demo 3: when data runs out" caption="Computed from the paper's L(N, D) fit in Table 2 (aN 0.076, aD 0.103, Nc 6.4e13, Dc 1.8e13). Dataset sizes are fractions of WebText2's ~22B tokens.">
        <Text>Pick a model size and how much data it gets. The penalty is how much worse the loss is than if the same model had unlimited data. A bigger model needs more data before it stops overfitting.</Text>
        <Segmented
          options={N_OVERFIT.map((v: number, i: number) => ({ value: String(i), label: `${fmt(v)} params` }))}
          value={noIdx}
          onChange={(v: string) => setNoIdx(v)}
        />
        <Segmented
          options={D_OPTIONS.map((v: number, i: number) => ({ value: String(i), label: `${fmt(v)} tokens` }))}
          value={dIdx}
          onChange={(v: string) => setDIdx(v)}
        />
        <Table columns={["", "Value"]} rows={[
          ["Loss with this much data", lnd.toFixed(3)],
          ["Loss with unlimited data", linf.toFixed(3)],
          ["Overfitting penalty", `${penalty.toFixed(1)}%`],
          ["Data the paper says you need (D about 5000 x N^0.74)", `${fmt(5e3 * Math.pow(nO, 0.74))} tokens`],
        ]} />
        {penalty > 5 ? (
          <Callout tone="warning" lead="Data-limited.">This model is big enough that the dataset is now the bottleneck. Making it bigger without more data gives diminishing returns.</Callout>
        ) : (
          <Callout tone="success" lead="Enough data.">The penalty is small, so this model is still mostly limited by its size, not its data.</Callout>
        )}
      </Section>

      <Section heading="What the paper actually claimed">
        <Table columns={["Claim", "Number / detail"]} rows={[
          ["Loss vs model size", "L(N) = (Nc/N)^0.076, Nc about 8.8e13 non-embedding params"],
          ["Loss vs data", "L(D) = (Dc/D)^0.095, Dc about 5.4e13 tokens (large model, early stopping)"],
          ["Loss vs compute", "L(Cmin) = (Cc/Cmin)^0.050, holding across eight orders of magnitude of compute"],
          ["Shape barely matters", "Aspect ratio can vary 40x with only a few percent change in loss"],
          ["Overfitting rule", "Penalty depends on N^0.74 / D: 8x bigger model needs about 5x more data"],
          ["Compute-optimal split", "N grows as C^0.73, batch as C^0.24, steps as C^0.03"],
          ["Sample efficiency", "Larger models reach the same loss with fewer steps and fewer tokens"],
          ["Transfer", "Loss on other text (books, Wikipedia, Common Crawl) tracks WebText2 loss with a roughly constant offset"],
          ["Caveat", "No theory yet; trends must flatten eventually, and the authors estimate a breakdown somewhere near 1e12 params and 1e12 tokens"],
        ]} />
        <Steps steps={[
          { title: "Measure many models", detail: "Hundreds of Transformer LMs across sizes, datasets, shapes and batch sizes, all on WebText2." },
          { title: "Fit straight lines on log-log plots", detail: "Loss follows power laws in N, D and C when the other two are not limiting." },
          { title: "Combine them", detail: "One equation L(N, D) predicts overfitting; another L(N, S) predicts learning curves." },
          { title: "Derive a recipe", detail: "For a fixed budget, grow the model fastest, the data slowly, and stop before convergence." },
        ]} />
        <Callout tone="info" lead="A later twist.">In 2022 DeepMind's Chinchilla paper revisited this and found models should get much more data than Kaplan suggested (roughly equal growth of N and D). The power-law idea held up; the exact split changed. That could be a future paper.</Callout>
      </Section>

      <QuizSync slug="09-scaling-laws" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>In your own words: if someone gave you 10x more compute to train a language model, how would this paper tell you to spend it, and why?</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Scaling Laws for Neural Language Models (arXiv abs)", site: "arxiv.org", date: "2020", href: "https://arxiv.org/abs/2001.08361" },
          { title: "Scaling Laws for Neural Language Models (PDF)", site: "arxiv.org", date: "2020", href: "https://arxiv.org/pdf/2001.08361" },
        ]} />
      </Section>
    </Page>
  );
}
