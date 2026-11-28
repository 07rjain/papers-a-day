import type { PaperMeta } from "@/content/types";

export const meta: PaperMeta = {
  number: 27,
  slug: "27-zero-shot-cot",
  title: "Large Language Models are Zero-Shot Reasoners",
  authors: "Takeshi Kojima, Shixiang Shane Gu, Machel Reid, Yutaka Matsuo, and Yusuke Iwasawa",
  year: 2022,
  url: "https://arxiv.org/abs/2205.11916",
  sent: "2026-11-28",
  hook: "Ask a language model to think step by step, then give it its own working as context for the final answer.",
  abstract: "In this NeurIPS 2022 paper, Kojima and colleagues test whether a single instruction can elicit useful reasoning without worked examples. Across 12 benchmarks, the clearest gains appear on multi-step problems, and the gains generally grow with model scale in the families studied.",
  video: {
    src: "/videos/27-zero-shot-cot/explainer.mp4",
    poster: "/videos/27-zero-shot-cot/poster.jpg",
    captions: "/videos/27-zero-shot-cot/captions.vtt",
  },
  explanation: [
    ["In ", { text: "Chain-of-Thought Prompting (paper 14)", href: "/papers/14-chain-of-thought" }, ", the prompt teaches by example. It shows a few solved problems with their intermediate steps before presenting a new problem. Kojima and colleagues try a simpler cue with zero worked examples: “Let’s think step by step.” On a word problem, that gives the model a chance to work out the intermediate quantities before it commits to a number."],
    ["The paper uses two calls to the same model. The first continues the question and cue with a written chain of reasoning. This is ", { text: "reasoning extraction", href: "/glossary#reasoning-extraction" }, ". For ", { text: "answer extraction", href: "/glossary#answer-extraction" }, ", the second call receives the entire first prompt, the generated chain, and a cue for the required format, such as “Therefore, the answer (arabic numerals) is”. A parser turns that last completion into an answer the benchmark can score. The weights stay fixed."],
    ["A chain can contain a bad assumption or a calculation error, and the second call may carry it forward. ", { text: "Self-Consistency (paper 15)", href: "/papers/15-self-consistency" }, " addresses dependence on a single chain by sampling several and voting on their final answers. In this paper's PaLM 540B experiment, voting over 40 zero-shot chains raised GSM8K accuracy from 43.0% to 70.1%."],
  ],
  question: "How would you test whether a gain came from writing intermediate steps or from changing the format of the final answer?",
  answer: "Use the same questions, model, answer cue, and parser. Compare direct answers with answers generated after a chain of thought. Record exact-match accuracy and manually check a sample of the completions for formatting errors and reasoning errors.",
};
