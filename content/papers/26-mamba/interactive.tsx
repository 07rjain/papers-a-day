"use client";

import { useState } from "react";
import { Page, Section, Segmented, Text } from "grok/canvas";
import { Scene } from "@/components/study/BlockScene";
import { QuizSync } from "@/components/study/progress";

const RETAIN = "#65d8fe";
const WRITE = "#ffd17c";
const READ = "#bda6ff";
const MUTED = "#526079";

const example = {
  "Useful digit": { x: 2, delta: 1.2, b: 1, c: 1 },
  Filler: { x: 1, delta: 0.05, b: 0.1, c: 0.15 },
  "Read cue": { x: 0, delta: 0.05, b: 0, c: 1 },
};

function StateUpdate() {
  const [token, setToken] = useState<keyof typeof example>("Useful digit");
  const [old, setOld] = useState(0.8);
  const { x, delta, b, c } = example[token];
  const decay = Math.exp(-delta);
  const retained = decay * old;
  const written = (1 - decay) * b * x;
  const state = retained + written;
  const output = c * state;
  const columns = [
    { value: retained, color: RETAIN },
    { value: written, color: WRITE },
    { value: output, color: READ },
  ];
  return (
    <Section heading="Let the input change the update" caption="Toy scalar SSM with continuous A = −1 and zero-order hold discretization. The token presets stand in for learned projections.">
      <Segmented options={Object.keys(example) as (keyof typeof example)[]} value={token} onChange={setToken} />
      <p><label>Previous state {old.toFixed(2)}{" "}
        <input type="range" min={0} max={2} step={0.05} value={old} onChange={(event) => setOld(event.target.valueAsNumber)} />
      </label></p>
      <p><code>x = {x}, Δ = {delta}, B = {b}, C = {c}</code></p>
      <p><code>h = exp(−Δ) · hₚᵣₑᵥ + (1 − exp(−Δ)) · B · x</code><br /><code>y = C · h</code></p>
      <Scene blocks={columns.map(({ value, color }, index) => ({
        x: (index - 1) * 1.55, height: Math.max(0.015, value), color,
      }))} description={`Left to right: retained state (blue) ${retained.toFixed(3)}, new write (gold) ${written.toFixed(3)}, output (purple) ${output.toFixed(3)}. Updated state is ${state.toFixed(3)}.`} />
      <Text>Try Filler to keep most of the previous state with a tiny write, then select Read cue to read it out with no new write.</Text>
    </Section>
  );
}

const copyingModes = ["Keep selected tokens", "Keep last three"] as const;
const copySequence = [
  { label: "7", keep: true }, { label: "·", keep: false },
  { label: "·", keep: false }, { label: "2", keep: true },
  { label: "·", keep: false }, { label: "9", keep: true },
  { label: "·", keep: false }, { label: "Recall", keep: false },
];

function SelectiveCopying() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<(typeof copyingModes)[number]>(copyingModes[0]);
  const [shifted, setShifted] = useState(false);
  const order = shifted ? [1, 0, 2, 4, 3, 6, 5, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  const sequence = order.map((index) => copySequence[index]);
  const seen = sequence.slice(0, Math.min(step + 1, sequence.length - 1));
  const memory = mode === "Keep selected tokens" ? seen.filter(({ keep }) => keep) : seen.slice(-3);
  const recall = step === sequence.length - 1;
  return (
    <Section heading="Copy the digits amid filler" caption="Toy selective copying task. The memory rules are hand-coded. The dots represent filler and Recall requests the digits in order.">
      <Segmented options={[...copyingModes]} value={mode} onChange={setMode} />
      <p><label>
        <input type="checkbox" checked={shifted} onChange={(event) => setShifted(event.target.checked)} /> Shift the digits
      </label></p>
      <p><label>Position {step + 1} of {sequence.length}{" "}
        <input type="range" min={0} max={sequence.length - 1} value={step} onChange={(event) => setStep(event.target.valueAsNumber)} />
      </label></p>
      <p aria-label="Input sequence">
        {sequence.map(({ label }, index) => index === step
          ? <strong key={index}>[{label}]{" "}</strong>
          : <span key={index}>{label}{" "}</span>)}
      </p>
      <Scene blocks={sequence.map(({ keep }, index) => ({
        x: (index % 4 - 1.5) * 1.1,
        z: index < 4 ? -0.7 : 0.7,
        height: index === step ? 1.1 : index < step ? 0.48 : 0.08,
        color: index === sequence.length - 1 ? READ : keep ? WRITE : MUTED,
      }))} description={`Current item: ${sequence[step].label}. Gold columns mark digits, gray columns mark filler, and purple marks the recall cue.`} />
      <p aria-live="polite">{recall ? "Recalled" : "In memory"} <strong>{memory.map(({ label }) => label).join(" ") || "empty"}</strong>
        {recall && " · Target 7 2 9"}</p>
      <Text>Shift the digits and try Recall again. The positions change while the content-based rule keeps the same digits in order.</Text>
    </Section>
  );
}

function CostGrowth() {
  const [power, setPower] = useState(3);
  const tokens = 2 ** power;
  const pairs = tokens * (tokens + 1) / 2;
  const stages = power * 2;
  return (
    <Section heading="Double the sequence length" caption="Toy operation counts at fixed model dimensions. One unit per token update or allowed attention pair. The units illustrate growth and do not predict runtime.">
      <p><label>Sequence length {tokens}{" "}
        <input type="range" min={1} max={12} value={power} onChange={(event) => setPower(event.target.valueAsNumber)} />
      </label></p>
      <Scene blocks={[
        { x: -1, height: Math.log2(tokens) / 10, color: RETAIN },
        { x: 1, height: Math.log2(pairs) / 10, color: READ },
      ]} description={`Log₂ height scale. Blue: ${tokens.toLocaleString("en-US")} token updates. Purple: ${pairs.toLocaleString("en-US")} causal query–key pairs.`} />
      <Text>A work-efficient tree scan has linear total work and logarithmic depth. A binary up-and-down scan at this length has {stages} tree levels across the two passes. Dense causal attention has L(L + 1)/2 pairs, including the diagonal.</Text>
    </Section>
  );
}

const quiz = [
  { question: "Which quantities depend on the input?", options: ["A alone", "Δ, B, and C", "The state size"], answer: 1, explanation: "The token sets the discretization step and the write and read projections. The underlying continuous A is learned and shared across positions." },
  { question: "What does a tiny Δ do in the decay example?", options: ["Preserves most of the old state", "Erases the old state", "Doubles the state size"], answer: 0, explanation: "With A = −1, the retention factor exp(−Δ) approaches one as Δ approaches zero." },
  { question: "What makes a parallel prefix scan possible?", options: ["Updates are interchangeable", "All tokens use identical coefficients", "Update composition is associative"], answer: 2, explanation: "Adjacent maps can be grouped in different ways while preserving their chronological order." },
  { question: "Where do the fused kernel’s expanded states live during the scan?", options: ["Fast on-chip memory", "CPU memory", "A full array in HBM"], answer: 0, explanation: "Keeping chunk intermediates on chip avoids writing the expanded state at every position to GPU main memory." },
  { question: "What does Mamba carry from one generated token to the next?", options: ["A full attention matrix", "A fixed-size recurrent state", "Every preceding key and value"], answer: 1, explanation: "The state is updated in place, so its size per sequence is independent of context length." },
  { question: "What did Mamba score on the synthetic selective copying task?", options: ["18.3%", "56.4%", "99.8%"], answer: 2, explanation: "Table 1 reports 99.8% for the Mamba block with the selective S6 layer." },
];
const answers = quiz.map(({ answer }) => answer);

function Quiz() {
  const [picks, setPicks] = useState<(number | null)[]>(() => quiz.map(() => null));
  return (
    <Section heading="Quick quiz">
      <QuizSync slug="26-mamba" picks={picks} answers={answers} />
      {quiz.map((item, index) => (
        <Section key={item.question} heading={`${index + 1}. ${item.question}`}>
          <Segmented
            options={item.options}
            value={item.options[picks[index] ?? -1] ?? ""}
            onChange={(choice) => setPicks((previous) => previous.map((pick, i) => i === index ? item.options.indexOf(choice) : pick))}
          />
          <div aria-live="polite">
            {picks[index] !== null && <Text>{picks[index] === item.answer ? "Correct. " : `Answer · ${item.options[item.answer]}. `}{item.explanation}</Text>}
          </div>
        </Section>
      ))}
    </Section>
  );
}

export default function MambaInteractive() {
  return (
    <Page title="Explore Mamba">
      <StateUpdate />
      <SelectiveCopying />
      <CostGrowth />
      <Section heading="What the paper actually claimed">
        <ul>
          <li><strong>Selective copying (Table 1).</strong> On this synthetic task, the Mamba block scored 99.8% with the selective S6 layer and 56.4% with the fixed S4 layer.</li>
          <li><strong>Induction heads (§4.1.2, Tables 2 and 11).</strong> The authors trained the two-layer model at length 256 and report that it solved the synthetic task at length 1,048,576. This task tests recalling a token after seeing its preceding cue again.</li>
          <li><strong>Language modeling (Table 3).</strong> Mamba-2.8B had 4.23 Pile perplexity and 63.3% average accuracy across seven zero-shot tasks. Pythia-2.8B had 6.73 and 59.1%. Lower perplexity means the model assigned higher probability to the observed text.</li>
          <li><strong>Speed (§4.5, Figure 8).</strong> The authors report 4–5× generation throughput relative to a similar-size Transformer in their A100 benchmark, which used a 2,048-token prompt, generated 128 tokens, and varied batch size. The selective scan kernel was 20–40× as fast as their standard PyTorch scan and crossed FlashAttention-2 beyond roughly 2K tokens in their kernel benchmark.</li>
        </ul>
        <p><a href="https://arxiv.org/pdf/2312.00752">Read the paper (PDF)</a></p>
      </Section>
      <Quiz />
    </Page>
  );
}
