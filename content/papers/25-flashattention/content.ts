import type { PaperMeta } from "@/content/types";

export const meta: PaperMeta = {
  number: 25,
  slug: "25-flashattention",
  title: "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness",
  authors: "Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, and Christopher Ré",
  year: 2022,
  url: "https://arxiv.org/abs/2205.14135",
  sent: "2026-11-26",
  hook: "Compute exact attention in small tiles on the GPU so the full score and probability matrices never have to be stored in main memory.",
  abstract: "Dao and colleagues introduce an IO-aware implementation of exact attention that reduces transfers between GPU memory and on-chip SRAM. They analyze its memory traffic, benchmark training speed and memory use, and extend it to block-sparse attention for longer sequences.",
  video: {
    src: "/videos/25-flashattention/explainer.mp4",
    poster: "/videos/25-flashattention/poster.jpg",
    captions: "/videos/25-flashattention/captions.vtt",
  },
  explanation: [
    ["In the ", { text: "Transformer", href: "/papers/05-transformer" }, ", each query scores keys and then mixes their values using softmax weights. With N tokens, ordinary dense attention can write N² scores and N² probabilities to GPU main memory. Doubling the context quadruples the number of pairs. ", { text: "GPT-2", href: "/papers/07-gpt2" }, " and ", { text: "GPT-3", href: "/papers/08-gpt3" }, " use causal attention, which excludes future tokens but still has quadratic pairwise work."],
    ["FlashAttention brings a small group of keys and values into fast on-chip memory and works through query blocks. Each query keeps a running maximum and two sums. If a later tile raises the maximum, the kernel rescales the earlier sums before adding the new contributions. That recovers the same mathematical output as a full softmax. For backpropagation, it rebuilds probability tiles from the original inputs and saved row statistics. This trades extra arithmetic for fewer slow memory transfers."],
    [{ text: "Scaling laws", href: "/papers/09-scaling-laws" }, " ask what a larger training budget can buy. FlashAttention changes what a GPU can do with that budget, especially as sequences get longer. ", { text: "LoRA", href: "/papers/12-lora" }, " saves memory on trainable weights and optimizer state. FlashAttention saves memory on attention intermediates, so training can use both. In the ", { text: "Llama 2", href: "/papers/24-llama-2" }, " and ", { text: "Mixtral", href: "/papers/22-mixtral" }, " era, training stacks can use FlashAttention alongside grouped-query attention and mixtures of experts. Grouped queries share keys and values, and expert routing changes the feed-forward layers. FlashAttention changes how attention itself runs."],
  ],
  question: "On a GPU with twice the on-chip memory but the same main-memory bandwidth, how might you change the tiles, and what would you measure to see whether it helped?",
  answer: "Try holding a larger key/value block on chip so each query block is revisited fewer times. Measure HBM traffic and elapsed time, and check whether larger tiles reduce how many thread blocks can run concurrently. The best size balances those effects.",
};
