"use client";

import { useMemo, useState } from "react";
import { Page, Section, Segmented, Text, Toggle } from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { Scene } from "@/components/study/BlockScene";

const MODEL = "#a9bdff";
const HELP = "#66e5be";
const SAFE = "#ffba72";
const MUTED = "#526079";

const stages = ["Demonstrate", "Score", "Select", "Update"] as const;
const stageCopy = {
  Demonstrate: "Supervised fine-tuning copies human-written example replies.",
  Score: "People compare replies. Separate reward models learn to predict helpfulness and safety preferences.",
  Select: "Rejection sampling generates multiple replies, ranks them by reward, and trains on the winners.",
  Update: "PPO uses reward to adjust the model, with a penalty for drifting from the reference. New model versions can generate replies for the next round of comparisons.",
};

function TrainingLoop() {
  const [stage, setStage] = useState<(typeof stages)[number]>("Demonstrate");
  const blocks = useMemo(() => stages.map((label, index) => ({
    x: (index - 1.5) * 1.35,
    height: label === stage ? 1.75 : 0.4,
    color: label === stage ? MODEL : MUTED,
  })), [stage]);
  return (
    <Section heading="Step through one training cycle" caption="The toy blocks mark the active stage. The paper describes successive versions RLHF-V1 through V5.">
      <Segmented options={[...stages]} value={stage} onChange={setStage} />
      <Scene blocks={blocks} description={stageCopy[stage]} />
      <Text>Meta ran rejection sampling on 70B and used the selected replies to fine-tune the smaller models. Through V4, Meta used rejection sampling. After V4, it applied PPO to the rejection-sampling checkpoint before sampling again.</Text>
    </Section>
  );
}

function RewardRouting() {
  const [safetyPrompt, setSafetyPrompt] = useState(false);
  const [score, setScore] = useState(0.65);
  const useSafety = safetyPrompt || score < 0.15;
  const blocks = useMemo(() => [
    { x: -1, height: 1.8, color: HELP },
    { x: 1, height: Math.max(0.04, score * 2), color: SAFE },
  ], [score]);
  return (
    <Section heading="Choose which reward drives the update" caption="The bars use toy scores. The routing rule and 0.15 safety cutoff come from §3.2.3.">
      <Toggle label="Treat as a safety prompt" value={safetyPrompt} onChange={setSafetyPrompt} />
      <p>
        <label>
          Toy safety score {score.toFixed(2)}{" "}
          <input type="range" min={0} max={1} step={0.01} value={score} onChange={(event) => setScore(event.target.valueAsNumber)} />
        </label>
      </p>
      <Scene
        blocks={blocks}
        description={`Green helpfulness 0.90. Orange safety ${score.toFixed(2)}. Routed reward uses ${useSafety ? "safety" : "helpfulness"}.`}
      />
      <Text>A reply can score well for usefulness while being unsafe. The safety model takes over for safety prompts or when the safety score dips below 0.15.</Text>
    </Section>
  );
}

function GhostAttention() {
  const phases = ["Generate practice replies", "Fine-tune on the final reply"] as const;
  const [phase, setPhase] = useState<(typeof phases)[number]>(phases[0]);
  const generating = phase === phases[0];
  const blocks = useMemo(() => [0, 1, 2].flatMap((turn) => {
    const x = (turn - 1) * 1.7;
    return [
      { x, z: -0.6, height: generating || turn === 0 ? 1.3 : 0.08, color: generating || turn === 0 ? MODEL : MUTED },
      { x, z: 0.6, height: 0.58, color: !generating && turn === 2 ? HELP : MUTED },
    ];
  }), [generating]);
  return (
    <Section heading="Move the system instruction to the first turn" caption="Toy dialogue. The back row shows where “Answer in French” appears. The front row shows the assistant replies.">
      <Segmented options={[...phases]} value={phase} onChange={setPhase} />
      <Scene blocks={blocks} description={generating
        ? "Generation shows the instruction on all three turns so every practice reply can follow it."
        : "Fine-tuning keeps the instruction on turn one. Only the final reply, shown in green, contributes to the loss."}
      />
      <ol>
        <li>How do I say hello? <strong>Bonjour.</strong></li>
        <li>And thank you? <strong>Merci.</strong></li>
        <li>What about goodbye? <strong>Au revoir.</strong></li>
      </ol>
    </Section>
  );
}

const quiz = [
  { question: "How many tokens went into pretraining?", options: ["4,096", "2 trillion", "27,540"], answer: 1, explanation: "The corpus had 2 trillion tokens. The context window holds 4,096 at a time." },
  { question: "What did the 27,540 annotations teach?", options: ["What good assistant replies look like", "How to share key and value heads", "How to measure violation rate"], answer: 0, explanation: "They were supervised fine-tuning demonstrations." },
  { question: "When does the paper’s reward rule use safety?", options: ["Only when both scores are tied", "On every reply", "On safety prompts or when the safety score is below 0.15"], answer: 2, explanation: "The rule uses the helpfulness score in the remaining cases." },
  { question: "Which method trains on the best-scored sampled replies?", options: ["Rejection sampling", "Grouped-query attention", "Pretraining"], answer: 0, explanation: "Rejection sampling selects winners from a batch of answers and fine-tunes on those replies." },
  { question: "Where is the system instruction kept during Ghost Attention fine-tuning?", options: ["On every turn", "Only on the first turn", "Only on the last turn"], answer: 1, explanation: "The first turn keeps the instruction. The final reply supplies the training target." },
  { question: "What is a false refusal?", options: ["A high score from the safety model", "An answer to a dangerous request", "A refusal of a harmless request"], answer: 2, explanation: "A safe request can still be refused when it resembles risky requests in the training data." },
];
const answers = quiz.map(({ answer }) => answer);

function Quiz() {
  const [picks, setPicks] = useState<(number | null)[]>(() => quiz.map(() => null));
  return (
    <Section heading="Quick quiz">
      <QuizSync slug="24-llama-2" picks={picks} answers={answers} />
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

export default function Llama2Interactive() {
  return (
    <Page title="Explore Llama 2">
      <TrainingLoop />
      <RewardRouting />
      <GhostAttention />
      <Section heading="What the paper actually claimed">
        <ul>
          <li><strong>Pretraining (Table 1).</strong> 2 trillion tokens and 4k context across model sizes. The 34B and 70B models used grouped-query attention.</li>
          <li><strong>Chat tuning (§3).</strong> The team collected 27,540 supervised annotations and iterated from RLHF-V1 to V5. The Ghost Attention evaluation reported instruction consistency for 20+ turns up to the context limit.</li>
          <li><strong>Safety (§4).</strong> Human safety evaluation used 1,351 single-turn prompts and 623 multi-turn prompts. Figure 17 reports low violation rates across chat sizes on that set. In a separate experiment even with 100% safety data in the mix, false refusals were about 0.05% on the helpfulness set and more frequent on borderline requests.</li>
          <li><strong>Release (§1 and model card).</strong> The authors released pretrained and chat weights at 7B, 13B, and 70B for research and commercial use under the Llama 2 Community License. The 34B results appear in the paper.</li>
        </ul>
        <p><a href="https://arxiv.org/pdf/2307.09288">Read the paper (PDF)</a></p>
      </Section>
      <Quiz />
    </Page>
  );
}
