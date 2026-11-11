"use client";

import { Page, Section, Text, Callout, Segmented, Button, Table, Steps, LinkCards, Metrics, useState, useGrokTheme } from "grok/canvas";
import { PromptBuilder } from "@/components/viz/PromptBuilder";
import { QuizSync } from "@/components/study/progress";

// Demo 1: zero vs one vs few-shot on a toy symbol-cleaning + translation task.
type ShotMode = "zero" | "one" | "few";
type ShotDemo = {
  label: string;
  prompt: string;
  continuation: string;
  note: string;
};

const SYMBOL_DEMOS: Record<ShotMode, ShotDemo> = {
  zero: {
    label: "Zero-shot (instruction only)",
    prompt: "Remove the symbols from this word:\nw^o&r%d\nAnswer:",
    continuation: " word",
    note: "Zero-shot: only an instruction, no examples. The model has to invent the pattern from the words alone. Toy continuation shown here — not a real GPT-3 output.",
  },
  one: {
    label: "One-shot (1 demo)",
    prompt: "Remove the symbols from this word:\nl@mp → lamp\nw^o&r%d →",
    continuation: " word",
    note: "One-shot: a single worked example sits in the prompt. Same frozen weights — only the text in the context changed. Toy continuation.",
  },
  few: {
    label: "Few-shot (3 demos)",
    prompt: "Remove the symbols from this word:\nl@mp → lamp\nc*a#t → cat\nb!oo$k → book\nw^o&r%d →",
    continuation: " word",
    note: "Few-shot: several demos in the prompt. The paper calls this in-context learning — the model picks up the task inside one forward pass, with no gradient update. Toy continuation.",
  },
};

const TRANSLATE_DEMOS: Record<ShotMode, ShotDemo> = {
  zero: {
    label: "Zero-shot translation",
    prompt: "Translate English to French:\nWhere is the library?\nFrench:",
    continuation: " Où est la bibliothèque?",
    note: "Instruction only. GPT-3 often manages this from pretraining alone, but the paper shows demos help a lot as models get bigger. Toy continuation.",
  },
  one: {
    label: "One-shot translation",
    prompt: "Translate English to French:\nHow are you? → Comment allez-vous?\nWhere is the library? →",
    continuation: " Où est la bibliothèque?",
    note: "One demo sets the format. Still no weight updates — just more text in the 2048-token context window. Toy continuation.",
  },
  few: {
    label: "Few-shot translation",
    prompt: "Translate English to French:\nHow are you? → Comment allez-vous?\nGood morning. → Bonjour.\nThank you. → Merci.\nWhere is the library? →",
    continuation: " Où est la bibliothèque?",
    note: "A handful of pairs in the prompt. On many NLP tasks in the paper, few-shot closed most of the gap to fine-tuned systems. Toy continuation.",
  },
};

// Demo 2: real paper numbers — scale + in-context learning curves.
type ModelRow = {
  key: string;
  name: string;
  params: string;
  paramsB: number;
  triviaZero: number;
  triviaOne: number;
  triviaFew: number;
};
// Approximate mid-size curves shaped like the paper's figures; 175B numbers are exact from the paper.
const MODELS: ModelRow[] = [
  { key: "125M", name: "125M", params: "125M", paramsB: 0.125, triviaZero: 19.0, triviaOne: 22.0, triviaFew: 26.0 },
  { key: "1.3B", name: "1.3B", params: "1.3B", paramsB: 1.3, triviaZero: 35.0, triviaOne: 40.0, triviaFew: 48.0 },
  { key: "13B", name: "13B", params: "13B", paramsB: 13, triviaZero: 52.0, triviaOne: 58.0, triviaFew: 66.0 },
  { key: "175B", name: "175B", params: "175B", paramsB: 175, triviaZero: 64.3, triviaOne: 68.0, triviaFew: 71.2 },
];

const EXACT_175B = {
  trivia: { zero: 64.3, one: 68.0, few: 71.2 },
  coqa: { zero: 81.5, one: 84.0, few: 85.0 },
  lambada: { zero: 76.2, few: 86.4 },
  superGlue: { few32: 71.8, bertLarge: 69.0 },
};

// Demo 3: toy arithmetic / novel word — on-the-fly skills.
type SkillDemo = {
  label: string;
  prompt: string;
  continuation: string;
  note: string;
};
const SKILLS: Record<string, SkillDemo> = {
  arith: {
    label: "2-digit addition (toy)",
    prompt: "Q: What is 17 plus 24?\nA: 41\nQ: What is 38 plus 19?\nA: 57\nQ: What is 46 plus 27?\nA:",
    continuation: " 73",
    note: "Paper shows GPT-3 picking up arithmetic from a few in-context examples. This continuation is hand-made (toy), not a logged model sample.",
  },
  novel: {
    label: "Novel word in a sentence (toy)",
    prompt: "A \"gigamix\" is a drink that blends coffee and mango juice.\nSentence: After the long hike I poured myself a cold",
    continuation: " gigamix",
    note: "The paper's \"novel word\" tasks ask the model to use a made-up word correctly after one definition. Toy continuation — labeled so you don't confuse it with a real sample.",
  },
};

type Q = { q: string; options: string[]; answer: number; why: string };
const QUIZ: Q[] = [
  {
    q: "What is \"few-shot\" / in-context learning in this paper?",
    options: [
      "Fine-tuning the model on a few thousand labeled examples",
      "Putting a few demos in the prompt and leaving the weights frozen",
      "Training a brand-new small model for each task",
    ],
    answer: 1,
    why: "Few-shot means K demos (and maybe an instruction) go in the context window. The 175B weights do not change — the model continues by next-token prediction. Fine-tuning is the opposite: it updates weights on a task dataset.",
  },
  {
    q: "How big is the largest GPT-3, and how many tokens was it trained on?",
    options: ["1.5B params, 40GB of WebText", "175 billion parameters, about 300 billion tokens", "340M params, Wikipedia only"],
    answer: 1,
    why: "GPT-3 175B is roughly 10× larger than prior dense LMs. It was trained for ~300B tokens on a mix of filtered Common Crawl (~60%), WebText2 (~22%), Books1/2 and Wikipedia. Context window: 2048 tokens.",
  },
  {
    q: "What happens to the gap between zero-shot and few-shot as models get bigger?",
    options: [
      "The gap shrinks — bigger models ignore demos",
      "The gap stays flat",
      "The gap often grows — bigger models use in-context demos more efficiently",
    ],
    answer: 2,
    why: "The paper's main meta-learning story: steeper in-context learning curves at larger scale. On TriviaQA, 175B goes 64.3% zero → 68.0% one → 71.2% few-shot. Small models gain much less from the same demos.",
  },
  {
    q: "On SuperGLUE with 32 few-shot examples, how did GPT-3 175B compare to fine-tuned BERT-Large?",
    options: ["Much worse (~40 vs 69)", "About 71.8 vs BERT-Large's fine-tuned 69.0", "Perfect 100 on every task"],
    answer: 1,
    why: "Few-shot GPT-3 175B scored 71.8 on SuperGLUE with only 32 examples in context, slightly above BERT-Large fine-tuned on the full sets (69.0). Still behind the best fine-tuned SOTA overall, and it struggled on some NLI / reading tasks.",
  },
  {
    q: "How well could humans spot GPT-3 175B news articles?",
    options: ["Nearly always (~95%)", "About 52% — roughly chance", "Never, 0%"],
    answer: 1,
    why: "Human evaluators were only ~52% accurate at telling GPT-3 175B news from real articles — basically coin-flip. That was one of the paper's more unsettling generation results.",
  },
];

export default function App() {
  const t = useGrokTheme();
  const blue = t.dataviz.categorical[0];
  const yellow = t.dataviz.categorical[1];
  const green = t.dataviz.categorical[3] || t.dataviz.categorical[0];

  const [taskKind, setTaskKind] = useState<string>("symbol");
  const [shot, setShot] = useState<string>("few");
  const demos = taskKind === "symbol" ? SYMBOL_DEMOS : TRANSLATE_DEMOS;
  const demo = demos[shot as ShotMode];

  const [size, setSize] = useState<string>("175B");
  const model = MODELS.find((m: ModelRow) => m.key === size) as ModelRow;

  const [skill, setSkill] = useState<string>("arith");
  const skillDemo = SKILLS[skill];

  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));

  const scaleBars = () => {
    const h = 240;
    const maxAcc = 80;
    const series = [
      { key: "zero", label: "zero", color: blue, get: (m: ModelRow) => m.triviaZero },
      { key: "one", label: "one", color: green, get: (m: ModelRow) => m.triviaOne },
      { key: "few", label: "few", color: yellow, get: (m: ModelRow) => m.triviaFew },
    ];
    const groupW = 700 / MODELS.length;
    return (
      <svg width="100%" viewBox={`0 0 700 ${h}`} style={{ display: "block" }}>
        <rect x={0} y={0} width={700} height={h} fill={t.bg.base} />
        {MODELS.map((m: ModelRow, j: number) => {
          const selected = m.key === size;
          return (
            <g key={j} onClick={() => setSize(m.key)} style={{ cursor: "pointer" }}>
              {series.map((s, si: number) => {
                const barW = (groupW - 24) / 3;
                const bh = (s.get(m) / maxAcc) * (h - 70);
                const barH = Math.round(Math.max(2, bh) * 100) / 100;
                const barY = Math.round((h - 40 - bh) * 100) / 100;
                const labelY = Math.round((h - 46 - bh) * 100) / 100;
                const x = Math.round((j * groupW + 12 + si * barW) * 100) / 100;
                const width = Math.round((barW - 4) * 100) / 100;
                return (
                  <g key={s.key}>
                    <rect x={x} y={barY} width={width} height={barH} rx={3} fill={s.color} opacity={selected ? 1 : 0.55} />
                    {selected ? (
                      <text x={Math.round((x + width / 2) * 100) / 100} y={labelY} textAnchor="middle" fill={t.text.primary} fontSize={10} fontFamily={t.font.family}>{s.get(m).toFixed(1)}</text>
                    ) : null}
                  </g>
                );
              })}
              <text x={j * groupW + groupW / 2} y={h - 18} textAnchor="middle" fill={t.text.secondary} fontSize={12} fontFamily={t.font.family}>{m.params}</text>
              <text x={j * groupW + groupW / 2} y={h - 4} textAnchor="middle" fill={selected ? t.text.primary : t.text.secondary} fontSize={11} fontFamily={t.font.family}>{selected ? "← selected" : ""}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <Page title="GPT-3, explained by playing with it" summary="Daily paper #8: Brown et al. (OpenAI, 2020), 'Language Models are Few-Shot Learners'. Yesterday GPT-2 showed zero-shot tasks from prompts. GPT-3 scales the same decoder LM idea to 175B parameters and shows that putting a few examples in the prompt — few-shot / in-context learning — often works nearly as well as fine-tuning, without changing any weights.">
      <Section heading="The big idea in one line">
        <Callout>Scale a decoder language model to 175 billion parameters, and a few examples pasted into the prompt (few-shot / in-context learning) often rival fine-tuning — with no gradient updates.</Callout>
        <Text>Yesterday GPT-2 showed that a big left-to-right Transformer can do tasks from a natural-language prompt alone (zero-shot). GPT-3 keeps the same recipe — an autoregressive Transformer LM, now alternating dense and locally banded sparse attention — and turns the dial way up: eight sizes from 125M to 175B, trained for about 300 billion tokens.</Text>
        <Text>The new systematic result is about how many examples you paste into the prompt. Zero-shot = instruction only. One-shot = one demo. Few-shot = K demos (typically 10–100) in the 2048-token context. The weights stay frozen. The paper treats in-context learning as an "inner loop" that happens inside the forward pass at inference time — a kind of meta-learning baked into next-token prediction.</Text>
      </Section>

      <Section heading="Demo 1: zero vs one vs few-shot" caption="Toy prompts and hand-made continuations. Formats follow the paper's idea; outputs are labeled toy so you don't treat them as real GPT-3 samples.">
        <Segmented
          options={[
            { value: "symbol", label: "Clean symbols" },
            { value: "translate", label: "EN → FR" },
          ]}
          value={taskKind}
          onChange={(v: string) => setTaskKind(v)}
        />
        <Segmented
          options={[
            { value: "zero", label: "Zero-shot" },
            { value: "one", label: "One-shot" },
            { value: "few", label: "Few-shot" },
          ]}
          value={shot}
          onChange={(v: string) => setShot(v)}
        />
        <Callout tone="info" lead={demo.label}>{shot === "zero" ? "Instruction only — no demos in the prompt." : shot === "one" ? "One worked example sits above the query." : "Several demos sit in context. Weights still frozen."}</Callout>
        <Table columns={["", ""]} rows={[
          ["Prompt the model sees", demo.prompt],
          ["Toy continuation", demo.continuation],
        ]} />
        <Text>{demo.note}</Text>
        <Text>Nothing about the network changes between zero, one, and few-shot. Same 175B weights, same next-word head. Only the text in the context window changes — that is the whole trick.</Text>
      </Section>

      <Section heading="Demo 2: scale + in-context learning" caption="175B TriviaQA / CoQA / LAMBADA / SuperGLUE numbers are real from the paper. Mid-size TriviaQA bars are approximate curves shaped like the paper's figures, to show the widening few-shot gap.">
        <Text>Pick a model size. Blue = zero-shot, green = one-shot, yellow = few-shot (TriviaQA-style accuracy). Watch the gap between zero and few grow as the model gets bigger — that is the paper's meta-learning story.</Text>
        <Segmented
          options={MODELS.map((m: ModelRow) => ({ value: m.key, label: m.params }))}
          value={size}
          onChange={(v: string) => setSize(v)}
        />
        {scaleBars()}
        <Text>Legend: blue = zero-shot, green = one-shot, yellow = few-shot (click a size group to select it).</Text>
        <Table columns={["", "Selected model"]} rows={[
          ["Size", model.params],
          ["TriviaQA zero / one / few", `${model.triviaZero}% / ${model.triviaOne}% / ${model.triviaFew}%${size === "175B" ? " (exact, paper)" : " (approx. mid-size curve)"}`],
          ["CoQA F1 (175B exact)", size === "175B" ? `zero ${EXACT_175B.coqa.zero} / one ${EXACT_175B.coqa.one} / few ${EXACT_175B.coqa.few}` : "reported for 175B: 81.5 / 84.0 / 85.0"],
          ["LAMBADA (175B exact)", size === "175B" ? `zero ${EXACT_175B.lambada.zero}% → few ${EXACT_175B.lambada.few}%` : "reported for 175B: 76.2% → 86.4%"],
          ["SuperGLUE few-shot 32 ex. vs BERT-Large FT", size === "175B" ? `${EXACT_175B.superGlue.few32} vs ${EXACT_175B.superGlue.bertLarge}` : "175B: 71.8 vs BERT-Large 69.0"],
        ]} />
        <Metrics metrics={[
          { value: "71.2%", label: "TriviaQA few-shot", detail: "175B, paper" },
          { value: "86.4%", label: "LAMBADA few-shot", detail: "vs 76.2% zero" },
          { value: "71.8", label: "SuperGLUE (32 ex.)", detail: "vs BERT-L FT 69.0" },
        ]} />
        <Callout tone="info" lead="Bigger models learn from demos better.">Small models barely move when you add examples. At 175B the few-shot lift is large and, on SuperGLUE with only 32 in-context examples, GPT-3 even edges past a fully fine-tuned BERT-Large.</Callout>
      </Section>

      <Section heading="Demo 3: on-the-fly skills" caption="Toy prompts inspired by the paper's arithmetic and novel-word evaluations. Continuations are hand-made illustrations.">
        <Segmented
          options={[
            { value: "arith", label: "Arithmetic" },
            { value: "novel", label: "Novel word" },
          ]}
          value={skill}
          onChange={(v: string) => setSkill(v)}
        />
        <Callout tone="info" lead={skillDemo.label}>Weights frozen — the skill is supposed to appear from the demos / definition in the prompt.</Callout>
        <Table columns={["", ""]} rows={[
          ["Prompt the model sees", skillDemo.prompt],
          ["Toy continuation", skillDemo.continuation],
        ]} />
        <Text>{skillDemo.note}</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Table columns={["Model size (Table 2.1)", "Parameters"]} rows={[
          ["GPT-3 Small → XL family", "125M, 350M, 760M, 1.3B, 2.7B, 6.7B, 13B"],
          ["GPT-3", "175B"],
        ]} />
        <Table columns={["Claim", "Number / detail"]} rows={[
          ["Architecture", "Autoregressive Transformer LM (like GPT-2); alternating dense + locally banded sparse attention"],
          ["Training", "~300B tokens; filtered Common Crawl ~60%, WebText2 ~22%, Books1/2, Wikipedia; context 2048"],
          ["Eval settings", "Zero / one / few-shot — no weight updates for reported results"],
          ["TriviaQA (175B)", "few 71.2% / one 68.0% / zero 64.3%"],
          ["CoQA F1 (175B)", "few 85.0 / one 84.0 / zero 81.5"],
          ["LAMBADA (175B)", "few 86.4% vs zero 76.2%"],
          ["SuperGLUE", "few-shot 71.8 with 32 examples vs BERT-Large fine-tuned 69.0"],
          ["News generation", "Humans ~52% accurate at spotting GPT-3 175B articles (~chance)"],
          ["Limits", "Still struggles on some NLI / reading-comprehension style tasks; not uniformly SOTA vs fine-tuning"],
        ]} />
        <Steps steps={[
          { title: "Same objective, bigger scale", detail: "Next-token prediction on a diverse mix, pushed to 175B params and 300B tokens." },
          { title: "In-context learning is the product", detail: "Zero / one / few-shot evaluation with frozen weights. Demos in the prompt are the adaptation step." },
          { title: "Scale steepens the in-context curve", detail: "Larger models gain more from the same few demos — the paper's central empirical claim." },
          { title: "Still not magic everywhere", detail: "Competitive with fine-tuning on many tasks, weak on some reasoning / NLI benchmarks, and fluent enough at news that humans can't reliably tell." },
        ]} />
        <Callout tone="info" lead="Where this leads.">GPT-2 opened the prompting era. GPT-3 made few-shot prompting a serious alternative to fine-tuning. Later work (InstructGPT, ChatGPT) adds alignment on top of this base.</Callout>
      </Section>

      <Section heading="Play: build a few-shot prompt" caption="Toy prompt text. No model is called.">
        <PromptBuilder />
      </Section>

      <QuizSync slug="08-gpt3" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>In your own words, what is the difference between fine-tuning and few-shot (in-context) learning in this paper, and why might a bigger model be better at learning from just a few examples in the prompt?</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Language Models are Few-Shot Learners (arXiv abs)", site: "arxiv.org", date: "2020", href: "https://arxiv.org/abs/2005.14165" },
          { title: "Language Models are Few-Shot Learners (PDF)", site: "arxiv.org", date: "2020", href: "https://arxiv.org/pdf/2005.14165" },
        ]} />
      </Section>
    </Page>
  );
}
