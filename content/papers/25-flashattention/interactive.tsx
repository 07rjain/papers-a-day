"use client";

import { useState } from "react";
import { Page, Section, Segmented, Text } from "grok/canvas";
import { Scene } from "@/components/study/BlockScene";
import { QuizSync } from "@/components/study/progress";

const TILE = "#56e0c1";
const SOFTMAX = "#ffd376";
const REBUILD = "#b9a6ff";
const MUTED = "#526079";

function TileWalk() {
  const [step, setStep] = useState(0);
  const query = step % 3;
  const key = Math.floor(step / 3);
  const blocks = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const visit = column * 3 + row;
    return { x: column - 0.4, z: row - 1, color: visit === step ? TILE : MUTED, height: visit === step ? 0.8 : visit < step ? 0.22 : 0.06 };
  });
  return (
    <Section heading="Move one tile into on-chip memory" caption="Toy layout. The stack on the left represents Q, K, and V in HBM. The grid on the right maps score tiles. Only the highlighted score tile is live in this simplified SRAM view.">
      <p><label>Tile {step + 1} of 9{" "}
        <input type="range" min={0} max={8} value={step} onChange={(event) => setStep(event.target.valueAsNumber)} />
      </label></p>
      <Scene
        blocks={[{ x: -2.2, height: 1.4, color: "#a9bdff" }, ...blocks]}
        description={`SRAM holds Q block ${query + 1}, K block ${key + 1}, and V block ${key + 1}. Compute this score tile and update output rows for Q block ${query + 1}.`}
      />
      <Text>Keep the key and value blocks on chip while stepping through the query blocks. The GPU can read and write partial outputs and row statistics without writing the full score grid.</Text>
    </Section>
  );
}

function OnlineSoftmax() {
  const [next, setNext] = useState(3);
  const oldMax = 1;
  const max = Math.max(oldMax, next);
  const scale = Math.exp(oldMax - max);
  const oldSum = Math.exp(-1) + 1;
  const oldWeighted = Math.exp(-1) * 2 + 4;
  const weight = Math.exp(next - max);
  const sum = oldSum * scale + weight;
  const weighted = oldWeighted * scale + weight * 8;
  const fullWeights = [0, 1, next].map((score) => Math.exp(score - max));
  const fullSum = fullWeights.reduce((total, item) => total + item, 0);
  const full = (2 * fullWeights[0] + 4 * fullWeights[1] + 8 * fullWeights[2]) / fullSum;
  return (
    <Section heading="Renormalize when a larger score arrives" caption="Toy row with scalar values. The first tile has scores [0, 1] and values [2, 4]. The next tile has one adjustable score and value 8.">
      <p><label>Incoming score {next}{" "}
        <input type="range" min={-2} max={6} value={next} onChange={(event) => setNext(event.target.valueAsNumber)} />
      </label></p>
      <Scene blocks={[
        { x: -1, height: oldSum * scale, color: SOFTMAX },
        { x: 1, height: weight, color: TILE },
      ]} description={`Exponential sum in the new scale. Gold is the earlier tile’s contribution, ${(oldSum * scale).toFixed(3)}. Green is the new tile’s contribution, ${weight.toFixed(3)}.`} />
      <p>Maximum <strong>{oldMax} → {max}</strong>. Multiply both old sums by <code>exp(old max − new max)</code> = {scale.toFixed(3)} before adding the new term.</p>
      <p aria-live="polite">Online output <strong>{weighted.toFixed(3)} / {sum.toFixed(3)} = {(weighted / sum).toFixed(3)}</strong>. Full-row softmax times values gives <strong>{full.toFixed(3)}</strong>.</p>
    </Section>
  );
}

const phases = ["After forward", "During backward"] as const;

function Recompute() {
  const [phase, setPhase] = useState<(typeof phases)[number]>(phases[0]);
  const backward = phase === "During backward";
  return (
    <Section heading="Rebuild probabilities for the gradient" caption="Toy layout. Blue marks retained inputs and output, gold marks retained row normalization statistics, and purple marks a temporary probability tile.">
      <Segmented options={[...phases]} value={phase} onChange={setPhase} />
      <Scene blocks={[
        { x: -1.8, height: 1.5, color: "#a9bdff" },
        { x: 0, height: 0.4, color: SOFTMAX },
        { x: 1.8, height: backward ? 0.9 : 0.05, color: backward ? REBUILD : MUTED },
      ]} description={backward
        ? "Recompute the score tile from Q and K. Use the saved row log-sum-exp to recover its probabilities and compute gradients."
        : "Keep inputs, output, and row statistics. The full probability matrix is gone."} />
      <Text>For a score s and its row log-sum-exp L, the probability is exp(s − L). Rebuilding each tile this way spends more arithmetic and avoids storing and reading the full probability matrix.</Text>
    </Section>
  );
}

const benchmark = [
  { tokens: "512", standard: 336, flash: 104 },
  { tokens: "1,024", standard: 1184, flash: 209 },
  { tokens: "2,048", standard: 4416, flash: 418 },
  { tokens: "4,096", standard: 17024, flash: 836 },
];

function MemoryGrowth() {
  const [tokens, setTokens] = useState("512");
  const measurement = benchmark.find((point) => point.tokens === tokens) ?? benchmark[0];
  return (
    <Section heading="Compare measured memory as context grows" caption="Appendix E, Table 21. One A100, batch size 16, eight heads with dimension 64. The two bars share a fixed linear scale up to the largest measurement shown.">
      <Segmented options={benchmark.map((point) => point.tokens)} value={tokens} onChange={setTokens} />
      <p>PyTorch attention <strong>{measurement.standard.toLocaleString("en-US")} MB</strong><br />
        <meter aria-label="PyTorch attention memory in MB" max={17024} value={measurement.standard} style={{ width: "100%" }} /></p>
      <p>FlashAttention <strong>{measurement.flash.toLocaleString("en-US")} MB</strong><br />
        <meter aria-label="FlashAttention memory in MB" max={17024} value={measurement.flash} style={{ width: "100%" }} /></p>
      <Text>With head dimension fixed, saved attention storage grows linearly for FlashAttention. Dense pairwise computation still grows quadratically.</Text>
    </Section>
  );
}

const quiz = [
  { question: "What makes conventional attention storage quadratic?", options: ["The per-token output vectors", "The query-by-key matrices", "The weight updates"], answer: 1, explanation: "Each query can score every key, giving N² entries in each full matrix." },
  { question: "Where does FlashAttention compute the current score tile?", options: ["On-chip SRAM", "CPU memory", "GPU HBM"], answer: 0, explanation: "The kernel uses faster on-chip memory and avoids writing each intermediate score to HBM." },
  { question: "What changes if a new tile raises the running maximum?", options: ["Discard all earlier values", "Normalize each tile independently", "Rescale the earlier exponential and weighted sums"], answer: 2, explanation: "The two old sums must use the same exponential reference as the new scores." },
  { question: "What supplies probabilities during backpropagation?", options: ["Rebuilt score tiles and saved row statistics", "A saved full probability matrix", "An independent learned predictor"], answer: 0, explanation: "The saved normalization statistics convert rebuilt scores back to attention probabilities tile by tile." },
  { question: "What remains quadratic for dense FlashAttention?", options: ["Saved row statistics", "Pairwise arithmetic at fixed head dimension", "Output size"], answer: 1, explanation: "The kernel still computes the same allowed query-key interactions." },
  { question: "Which variant handled Path-256 at 64K?", options: ["Dense FlashAttention", "Standard PyTorch attention", "Block-sparse FlashAttention"], answer: 2, explanation: "Block-sparse FlashAttention reached 63.1% on that task by using a restricted block pattern." },
];
const answers = quiz.map(({ answer }) => answer);

function Quiz() {
  const [picks, setPicks] = useState<(number | null)[]>(() => quiz.map(() => null));
  return (
    <Section heading="Quick quiz">
      <QuizSync slug="25-flashattention" picks={picks} answers={answers} />
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

export default function FlashAttentionInteractive() {
  return (
    <Page title="Explore FlashAttention">
      <TileWalk />
      <OnlineSoftmax />
      <Recompute />
      <MemoryGrowth />
      <Section heading="What the paper actually claimed">
        <ul>
          <li><strong>Attention kernel (§4.3 and Figure 3).</strong> Up to 3× faster than standard PyTorch attention and up to 20× more memory-efficient than exact attention baselines in the authors’ benchmarks.</li>
          <li><strong>Memory traffic (Figure 2).</strong> In the GPT-2 medium attention benchmark at sequence length 1,024, FlashAttention moved 4.4 GB to and from HBM versus 40.3 GB for standard attention. It did 75.2 GFLOPs versus 66.6, while runtime fell from 41.7 to 7.3 ms.</li>
          <li><strong>BERT-large (Table 1).</strong> The authors report a 15% end-to-end speedup over the NVIDIA MLPerf 1.1 implementation. Time to the same target fell from 20.0 to 17.4 minutes on eight A100s at sequence length 512.</li>
          <li><strong>GPT-2 (Table 2).</strong> GPT-2 medium at 1K context trained in 6.9 days versus 21.0 with Hugging Face and 11.5 with Megatron-LM on eight A100s. Table 2 gives 3.0× versus Hugging Face for medium and 3.5× for small.</li>
          <li><strong>Long Range Arena (Table 3).</strong> At sequence lengths from 1,024 to 4,096, dense FlashAttention was 2.4× as fast and the block-sparse variant was 2.8× as fast as the standard Transformer baseline.</li>
          <li><strong>Pathfinding (Table 6).</strong> Exact FlashAttention reached 61.4% on Path-X at 16K. Block-sparse FlashAttention reached 63.1% on Path-256 at 64K. Both classify whether two points in an image are connected, with pixels supplied as a sequence.</li>
          <li><strong>Block sparsity (§3.3).</strong> Skip tiles excluded by a block mask. This saves work and memory traffic relative to computing dense attention and changes which token pairs can interact.</li>
        </ul>
        <p><a href="https://arxiv.org/pdf/2205.14135">Read the paper (PDF)</a></p>
      </Section>
      <Quiz />
    </Page>
  );
}
