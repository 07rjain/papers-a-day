"use client";

import { useState } from "react";
import { Page, Section, Segmented, Select, Table, Text } from "grok/canvas";
import { Scene } from "@/components/study/BlockScene";
import { QuizSync } from "@/components/study/progress";

const colors = ["#72c8fd", "#ffcd72", "#b5a0ff", "#79deaa"];
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const pipelineSteps = ["Reasoning extraction", "Answer extraction"] as const;

function Pipeline() {
  const [step, setStep] = useState<(typeof pipelineSteps)[number]>(pipelineSteps[0]);
  const [check, setCheck] = useState(false);
  const extracting = step === "Answer extraction";
  const prompt = "Q: Four boxes hold six pencils each. Seven pencils are given away. How many are left?";
  const trigger = "A: Let’s think step by step.";
  const working = "4 × 6 = 24. After giving away 7, 24 − 7 = 17.";
  const cue = check ? "Therefore, the answer (Yes or No) is" : "Therefore, the answer (arabic numerals) is";
  return (
    <Section heading="Build the second prompt" caption="Toy example with scripted completions. The blue block is the first prompt, gold is the generated working, and purple is the answer-format cue.">
      <label>
        <input type="checkbox" checked={check} onChange={(event) => setCheck(event.target.checked)} />
        {" "}Ask whether exactly 17 pencils are left
      </label>
      <Segmented options={[...pipelineSteps]} value={step} onChange={setStep} />
      <Scene blocks={colors.slice(0, 3).map((color, index) => ({
        x: (index - 1) * 1.5,
        color,
        height: index === 0 || extracting ? 0.9 : 0.07,
      }))} description={extracting
        ? "Second call input includes the original prompt, generated working, and the answer-format cue."
        : "First call input includes the question and reasoning cue."} />
      <p aria-live="polite">
        <strong>Model input</strong><br />
        <code>{check ? "Q: Four boxes hold six pencils each. Seven pencils are given away. Are exactly 17 left?" : prompt}</code><br />
        <code>{trigger}</code>
        {extracting && <><br /><code>{working}</code><br /><code>{cue}</code></>}
      </p>
      <Text>Example completion · {extracting ? (check ? "Yes" : "17") : working}</Text>
    </Section>
  );
}

const templates = [
  ["Instructive", "Let’s think step by step.", 78.7],
  ["Instructive", "First,", 77.3],
  ["Instructive", "Let’s think about this logically.", 74.5],
  ["Instructive", "Let’s solve this problem by splitting it into steps.", 72.2],
  ["Instructive", "Let’s be realistic and think step by step.", 70.8],
  ["Instructive", "Let’s think like a detective step by step.", 70.3],
  ["Instructive", "Let’s think", 57.5],
  ["Instructive", "Before we dive into the answer,", 55.7],
  ["Instructive", "The answer is after the proof.", 45.7],
  ["Misleading", "Don’t think. Just feel.", 18.8],
  ["Misleading", "Let’s think step by step but reach an incorrect answer.", 18.7],
  ["Misleading", "Let’s count the number of “a” in the question.", 16.7],
  ["Misleading", "By using the fact that the earth is round,", 9.3],
  ["Irrelevant", "By the way, I found a good restaurant nearby.", 17.5],
  ["Irrelevant", "Abrakadabra!", 15.5],
  ["Irrelevant", "It’s a beautiful day.", 13.1],
] as const;
const baseline = 17.7;

function TriggerComparison() {
  const [phrase, setPhrase] = useState<string>(templates[0][1]);
  const selected = templates.findIndex(([, text]) => text === phrase);
  const accuracy = templates[selected][2];
  const gain = accuracy - baseline;
  return (
    <Section heading="Try a different reasoning cue" caption="Table 4. MultiArith accuracy with text-davinci-002. Each row is a measured prompt variant.">
      <Select label="Reasoning cue" options={templates.map(([, text]) => text)} value={phrase} onChange={setPhrase} />
      <Scene blocks={[
        { x: -1, color: colors[0], height: baseline / 50 },
        { x: 1, color: colors[1], height: accuracy / 50 },
      ]} description={`Direct zero-shot (blue) ${percent(baseline)}. Selected cue (gold) ${percent(accuracy)}, ${gain.toFixed(1)} percentage points relative to direct zero-shot.`} />
      <details>
        <summary>All 16 cues and the direct baseline</summary>
        <Table columns={["Category", "Cue", "Accuracy"]} emphasis={selected}
          rows={[...templates.map(([category, text, score]) => [category, text, percent(score)]), ["Baseline", "Direct zero-shot", percent(baseline)]]} />
      </details>
    </Section>
  );
}

const benchmarks = ["MultiArith", "GSM8K"] as const;
const models = ["text-davinci-002", "PaLM 540B"] as const;
const methods = ["Zero-shot", "Few-shot", "Zero-shot CoT", "Few-shot CoT"];
const scores = {
  "text-davinci-002": { MultiArith: [17.7, 33.8, 78.7, 93.0], GSM8K: [10.4, 15.6, 40.7, 48.7] },
  "PaLM 540B": { MultiArith: [25.5, null, 66.1, null], GSM8K: [12.5, 17.9, 43.0, 56.9] },
};

function AccuracyExplorer() {
  const [benchmark, setBenchmark] = useState<(typeof benchmarks)[number]>("MultiArith");
  const [model, setModel] = useState<(typeof models)[number]>("text-davinci-002");
  const values = scores[model][benchmark];
  return (
    <Section heading="Compare four prompting methods" caption="Table 2. Few-shot methods use worked examples for CoT and question–answer pairs for standard prompting. The text-davinci-002 comparison uses eight examples. A dash indicates that Table 2 does not report a result.">
      <Select label="Model" options={[...models]} value={model} onChange={setModel} />
      <Segmented options={[...benchmarks]} value={benchmark} onChange={setBenchmark} />
      <Scene blocks={values.map((value, index) => ({
        x: (index - 1.5) * 1.25,
        height: (value ?? 0) / 50,
        color: colors[index],
      }))} description={`${model} on ${benchmark}. Left to right: ${methods.map((method, index) => `${method} ${percent(values[index])}`).join(", ")}.`} />
      <Text>{benchmark === "GSM8K"
        ? "GSM8K contains grade-school word problems that typically require multiple steps."
        : "MultiArith focuses on arithmetic word problems that require multiple operations."}</Text>
    </Section>
  );
}

const scales = ["8B", "62B", "540B"] as const;
const scaling = { "8B": [2.1, 2.4], "62B": [7, 10.5], "540B": [12.5, 43] };

function ModelScale() {
  const [scale, setScale] = useState<(typeof scales)[number]>("8B");
  const [direct, cot] = scaling[scale];
  return (
    <Section heading="Change the model size" caption="Table 27. GSM8K accuracy across the PaLM family. Blue shows direct zero-shot and gold shows zero-shot CoT.">
      <Segmented options={[...scales]} value={scale} onChange={setScale} />
      <Scene blocks={[direct, cot].map((value, index) => ({
        x: (index * 2 - 1), height: value / 25, color: colors[index],
      }))} description={`PaLM ${scale}. Direct ${percent(direct)}. With CoT ${percent(cot)}, a gain of ${(cot - direct).toFixed(1)} percentage points.`} />
      <Table columns={["PaLM parameters", "Zero-shot", "Zero-shot CoT", "Gain (points)"]}
        emphasis={scales.indexOf(scale)}
        rows={scales.map((size) => [size, ...scaling[size].map(percent), (scaling[size][1] - scaling[size][0]).toFixed(1)])} />
    </Section>
  );
}

const quiz = [
  { question: "What was the MultiArith gain for text-davinci-002?", options: ["30.3 points", "61.0 points", "78.7 points"], answer: 1, explanation: "Accuracy rose from 17.7% to 78.7% (Table 2)." },
  { question: "What did standard eight-shot prompting score on GSM8K with text-davinci-002?", options: ["15.6%", "40.7%", "48.7%"], answer: 0, explanation: "Table 2 reports 15.6% for standard eight-shot. Zero-shot CoT scored 40.7% and eight-shot CoT scored 48.7%." },
  { question: "How well did “First,” work on MultiArith?", options: ["15.5%", "57.5%", "77.3%"], answer: 2, explanation: "Table 4 reports 77.3% for “First,” and 78.7% for “Let’s think step by step.”" },
  { question: "How large was the GSM8K gain from zero-shot CoT at PaLM 8B?", options: ["0.3 points", "3.5 points", "30.5 points"], answer: 0, explanation: "Table 27 reports 2.1% to 2.4% at 8B, versus 12.5% to 43.0% at 540B." },
  { question: "How many sampled paths pushed PaLM 540B to 70.1% on GSM8K?", options: ["8", "40", "62"], answer: 1, explanation: "Table 25 uses self-consistency over 40 paths. The same model scored 43.0% using one greedy chain." },
  { question: "Which result shows that CoT could also hurt accuracy?", options: ["PaLM 540B on GSM8K", "text-davinci-002 on MultiArith", "text-davinci-002 on CommonsenseQA"], answer: 2, explanation: "Using task-format answer cues, CommonsenseQA fell from 68.8% to 64.6% (Table 1)." },
];
const answers = quiz.map(({ answer }) => answer);

function Quiz() {
  const [picks, setPicks] = useState<(number | null)[]>(() => quiz.map(() => null));
  return (
    <Section heading="Quick quiz">
      <QuizSync slug="27-zero-shot-cot" picks={picks} answers={answers} />
      {quiz.map((item, index) => (
        <Section key={item.question} heading={`${index + 1}. ${item.question}`}>
          <Segmented options={item.options}
            value={item.options[picks[index] ?? -1] ?? ""}
            onChange={(choice) => setPicks((previous) => previous.map((pick, i) => i === index ? item.options.indexOf(choice) : pick))} />
          <div aria-live="polite">
            {picks[index] !== null && <Text>{picks[index] === item.answer ? "Correct. " : `Answer · ${item.options[item.answer]}. `}{item.explanation}</Text>}
          </div>
        </Section>
      ))}
    </Section>
  );
}

export default function ZeroShotCoTInteractive() {
  return (
    <Page title="Explore zero-shot chain of thought">
      <Pipeline />
      <TriggerComparison />
      <AccuracyExplorer />
      <ModelScale />
      <Section heading="What the paper actually claimed">
        <Text>On text-davinci-002, multi-step arithmetic saw large gains (Table 2). MultiArith went from 17.7% to 78.7% and GSM8K went from 10.4% to 40.7%. PaLM 540B went from 25.5% to 66.1% on MultiArith and from 12.5% to 43.0% on GSM8K. Voting across 40 paths with PaLM 540B raised those CoT scores to 89.0% and 70.1% (Table 25).</Text>
        <Text>The results depend on the benchmark and answer cue. With task-specific answer formats, AddSub fell from 72.2% to 69.6% and CommonsenseQA fell from 68.8% to 64.6%. On StrategyQA, the headline 12.7% to 54.8% turns into 54.3% to 52.3% when the generic answer cue is used (Table 1). Accuracy measures whether the extracted answer matches the expected one. The study also gives examples of chains with flawed intermediate steps (Table 3 and Appendix B).</Text>
        <Text>Figure 3 and Appendix E show larger gains as models get larger in the GPT-3 and PaLM comparisons. The PaLM series keeps the benchmark and model family fixed. The InstructGPT series also varies model versions, so the comparison leaves room for differences in training as well as scale.</Text>
        <p><a href="https://arxiv.org/pdf/2205.11916">Read the paper and its tables (PDF)</a></p>
      </Section>
      <Quiz />
    </Page>
  );
}
