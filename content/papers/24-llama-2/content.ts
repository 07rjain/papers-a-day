import type { PaperMeta } from "@/content/types";

const video = {
  src: "/videos/24-llama-2/explainer.mp4",
  poster: "/videos/24-llama-2/poster.jpg",
  captions: "/videos/24-llama-2/captions.vtt",
};

export const meta: PaperMeta = {
  number: 24,
  slug: "24-llama-2",
  title: "Llama 2: Open Foundation and Fine-Tuned Chat Models",
  authors: "Touvron et al., Meta AI",
  year: 2023,
  url: "https://arxiv.org/abs/2307.09288",
  sent: "2026-11-25",
  hook: "Llama 2 turns a next-token predictor into a chat assistant using demonstrations, separate feedback on helpfulness and safety, and practice following instructions across turns.",
  abstract: "The paper introduces pretrained Llama 2 models and their dialogue-tuned Llama 2-Chat counterparts, and evaluates their helpfulness and safety.",
  video,
  explanation: [
    ["The base model practices predicting the next piece of text. Llama 2 used 2 trillion tokens of pretraining data and a 4,096-token context window. ", { text: "Chinchilla", href: "/papers/11-chinchilla" }, " explains why the amount of training data matters alongside model size. The 34B and 70B variants use grouped-query attention, which lets several query heads share cached keys and values during generation."],
    ["To teach the model how to answer, Meta first used examples of good replies. Then people compared pairs of replies. Like ", { text: "InstructGPT", href: "/papers/10-instructgpt" }, ", Llama 2 learns reward models from human preferences. Its helpfulness and safety scores come from separate models. ", { text: "Constitutional AI", href: "/papers/21-constitutional-ai" }, " took a different approach to safety feedback, using written principles to guide AI preference judgments."],
    ["The team repeatedly generated candidate replies, scored them, and improved the assistant. Rejection sampling makes a new training set from selected high-scoring answers. Proximal Policy Optimization (PPO) uses reward to adjust the chances of generating answers. Ghost Attention adds practice following an instruction supplied once at the start of a conversation."],
  ],
  question: "How would you design an evaluation that distinguishes better safety from a model that simply refuses more often?",
  answer: "Include both genuinely unsafe requests and harmless requests that sound similar. Measure unsafe compliance and false refusals separately, and check whether safe replies still give useful answers. Include multi-turn cases to see whether behavior changes over a conversation.",
};
