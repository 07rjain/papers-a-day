import type { PaperMeta } from "@/content/types";

export const meta: PaperMeta = {
  number: 26,
  slug: "26-mamba",
  title: "Mamba: Linear-Time Sequence Modeling with Selective State Spaces",
  authors: "Albert Gu and Tri Dao",
  year: 2023,
  url: "https://arxiv.org/abs/2312.00752",
  sent: "2026-11-27",
  hook: "Let each token decide how to update a running memory, then compute those updates with work that grows linearly with sequence length.",
  abstract: "Gu and Dao introduce a selective state space model whose dynamics depend on the input. Mamba combines this recurrence with a hardware-aware parallel scan and evaluates the architecture on language, audio, and DNA sequences.",
  video: {
    src: "/videos/26-mamba/explainer.mp4",
    poster: "/videos/26-mamba/poster.jpg",
    captions: "/videos/26-mamba/captions.vtt",
  },
  explanation: [
    ["The ", { text: "Transformer", href: "/papers/05-transformer" }, " gives each token a way to look directly at earlier tokens. The total number of query–key pairs grows quadratically with sequence length. ", { text: "Llama 2", href: "/papers/24-llama-2" }, " shares keys and values across groups of query heads in its larger models to shrink the generation cache. ", { text: "Mixtral", href: "/papers/22-mixtral" }, " routes tokens to selected feed-forward experts. Both still use attention to mix information across positions."],
    ["Mamba carries a fixed-size state forward. Imagine listening for digits in a noisy room. The model can let chatter pass and update its memory at the digits. In the selective state space layer, the current input determines the step size Δ and the write and read projections B and C. The step size changes how much the old state decays and also affects the discrete write. A token can change what gets written or change how the state is read out."],
    ["Since the update changes with the input, one fixed convolution kernel cannot describe the whole sequence. Each token defines an affine update, meaning it scales the state and then adds a contribution. A GPU can compose these updates in groups and use a parallel prefix scan to get the update through every position. Like ", { text: "FlashAttention", href: "/papers/25-flashattention" }, ", the kernel keeps large temporary results in fast on-chip SRAM. It fuses discretization, scan, and readout, and rebuilds expanded states during backpropagation. With model dimensions fixed, processing the sequence takes linear work, and autoregressive generation carries a fixed-size recurrent state per sequence."],
  ],
  question: "Design a sequence task where carrying a fixed-size summary could be harder than looking back at individual tokens. What would you vary to test that?",
  answer: "Ask the model to retrieve a randomly chosen detail from an increasingly long list of independent key–value pairs. Vary the number of pairs and measure exact retrieval accuracy. Keeping a fixed-size state makes more unrelated facts compete for the same memory.",
};
