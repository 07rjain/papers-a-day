import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 22,
  slug: "22-mixtral",
  title: "Mixtral of Experts",
  authors:
    "Albert Q. Jiang, Alexandre Sablayrolles, Antoine Roux, Arthur Mensch, and colleagues through William El Sayed, Mistral AI",
  year: 2024,
  url: "https://arxiv.org/abs/2401.04088",
  sent: "2026-11-21",
  hook: "Eight feed-forward experts per layer, but each token uses only two. 47B parameters stored, about 13B used.",
  explanation: [
    [
      "Today's paper is ",
      { text: "Mixtral of Experts", href: "https://arxiv.org/abs/2401.04088" },
      " by Albert Jiang and colleagues at Mistral AI (2024). In a Transformer block, attention lets tokens look at each other, then a feed-forward network processes each token on its own. Most of a model's parameters sit in those feed-forward networks, and in a normal dense model every token goes through all of them. The scaling-laws lesson, that bigger is better, comes with a bill: a bigger model makes every token more expensive.",
    ],
    [
      "Mixtral keeps attention but swaps each layer's one feed-forward network for eight of them, the experts, plus a tiny router that scores them for each token. Only the top two run, blended by the router's softmax weights, and a different pair can be picked for every token at every one of the 32 layers. The model stores 47 billion parameters but each token uses about 13 billion, so it computes like a 13 billion parameter model while holding far more knowledge. It matched or beat Llama 2 70B, which uses about five times more active parameters, on nearly every benchmark, by a lot on maths and code, and it matched GPT-3.5. The chat version, supervised fine-tuning plus DPO, topped the open-weights models in human rankings. The surprise is that the experts did not become a maths expert or a biology expert. They split the work by syntax, such as Python's self, indentation, and punctuation. All 47 billion parameters still have to fit in memory, and the paper says almost nothing about how the model was trained. Code and Apache 2.0 weights are at ",
      { text: "mistral-src", href: "https://github.com/mistralai/mistral-src" },
      ".",
    ],
  ],
  question:
    "In your own words, starting from the Transformer's feed-forward block, what does Mixtral change, and why can a model with 47 billion parameters run at roughly the cost of a 13 billion parameter one while still beating a 70 billion parameter dense model?",
  answer:
    "Each layer's single feed-forward network is replaced by eight expert feed-forward networks plus a linear router. For each token at each layer, the router scores all eight, keeps the top two, and a softmax over those two gives gates that sum to 1. The output is the weighted sum of those two experts. The other six are never computed. Attention, embeddings, and the router are shared, so the total is about 47 billion parameters rather than eight copies of a 7 billion parameter model, and the active count per token is about 13 billion. Compute follows the active count, which is about five times smaller than Llama 2 70B. Capacity follows the stored count, and because different tokens and layers pick different pairs, all 47 billion get used across a text. Against Llama 2 70B, Table 2 reports MMLU 70.6 versus 69.9, GSM8K 74.4 versus 69.6, HumanEval 40.2 versus 29.3, and MATH 28.4 versus 13.8. It matches GPT-3.5 on the Table 3 suite. The instruct model, supervised fine-tuning plus DPO, scores 8.30 on MT-Bench. Routing tracks syntax and position, not topic. Memory still scales with 47 billion parameters, and the paper gives almost no training details.",
} satisfies PaperMeta;
