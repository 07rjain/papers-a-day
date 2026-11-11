export const keyIdeas: Record<string, string[]> = {
  "01-word2vec": [
    "A word’s vector is learned from the words that appear near it.",
    "Similar contexts push vectors together, with no one labelling the pairs.",
    "Some relationships show up as directions, which is why analogies can look like arithmetic.",
  ],
  "02-glove": [
    "Count co-occurrences over the whole corpus first, then fit vectors to those counts.",
    "Ratios, not raw counts, separate words that distinguish two meanings.",
    "A ratio near 1 means the probe word does not tell the two targets apart.",
  ],
  "03-seq2seq": [
    "An encoder reads the input into one fixed-size vector.",
    "A decoder writes the output one word at a time, and the two sequences can differ in length.",
    "That single vector is a bottleneck, especially for long sentences.",
  ],
  "04-bahdanau-attention": [
    "Each output word gets its own weighted mix of the input vectors.",
    "The weights are positive and sum to 1, so the model can look at more than one input word.",
    "Long sentences no longer have to fit through one fixed summary.",
  ],
  "05-transformer": [
    "Self-attention compares a query with every key, then mixes the values.",
    "The whole sentence is processed at once, so distant words can connect directly.",
    "Position has to be added, because attention itself does not know order.",
  ],
  "06-bert": [
    "BERT keeps the Transformer encoder, so each word can see both sides.",
    "Masking hides the word being predicted, or the task would be trivial.",
    "The same pretrained model is later fine-tuned for each task.",
  ],
  "07-gpt2": [
    "GPT-2 is a decoder: it predicts the next word from the left context only.",
    "A diverse corpus contains demonstrations of many tasks, so a prompt can continue one of them.",
    "Zero-shot skill rose smoothly as the model got bigger.",
  ],
  "08-gpt3": [
    "Few-shot learning puts examples in the prompt and leaves the weights frozen.",
    "Bigger models make more use of those in-context examples.",
    "This is not the same as fine-tuning, which updates the weights.",
  ],
  "09-scaling-laws": [
    "Loss falls as a power law in model size, data, and compute when the others are not the limit.",
    "Network shape matters much less than scale.",
    "Kaplan’s fit spends most of a larger budget on a bigger model.",
  ],
  "10-instructgpt": [
    "Next-word training is a different goal from following instructions.",
    "A reward model learns from rankings, then scores new answers during PPO.",
    "The KL penalty keeps the policy from gaming that imperfect reward model.",
  ],
  "11-chinchilla": [
    "For a fixed compute budget, model size and data should grow together.",
    "About 20 tokens per parameter was the practical rule in this paper.",
    "A smaller, better-trained model is also cheaper to run afterwards.",
  ],
  "12-lora": [
    "The useful weight change can have a very low rank.",
    "Only B and A are trained; the pretrained matrix stays frozen.",
    "B·A can be added into the original matrix, so inference does not get an extra layer.",
  ],
  "13-dpo": [
    "The best policy for the KL-constrained RLHF objective has a closed form, so the reward can be read off the policy.",
    "DPO trains on preference pairs with one classification loss: no reward model, no PPO, and no sampling during training.",
    "β is the leash. A small β lets the model drift further from the reference; a large β keeps it close.",
  ],
};

/** What each paper takes from the one before it on the reading path. The first paper starts the path. */
export const pathLinks: { slug: string; buildsOn: string | null }[] = [
  { slug: "01-word2vec", buildsOn: null },
  { slug: "02-glove", buildsOn: "word2vec’s nearby-word vectors, using counts from the whole corpus" },
  { slug: "03-seq2seq", buildsOn: "the idea that a meaning can be a vector, now for a whole sentence" },
  { slug: "04-bahdanau-attention", buildsOn: "seq2seq’s one fixed vector, which long sentences outgrow" },
  { slug: "05-transformer", buildsOn: "Bahdanau attention, and drops the recurrent network" },
  { slug: "06-bert", buildsOn: "the Transformer encoder, trained by filling in missing words" },
  { slug: "07-gpt2", buildsOn: "the Transformer decoder, trained only to predict the next word" },
  { slug: "08-gpt3", buildsOn: "GPT-2’s prompt-only tasks, with examples written into the prompt" },
  { slug: "09-scaling-laws", buildsOn: "the jump in size from GPT-2 to GPT-3" },
  { slug: "10-instructgpt", buildsOn: "GPT-3, which still just guesses the next word" },
  { slug: "11-chinchilla", buildsOn: "Kaplan’s rule for spending a larger compute budget" },
  { slug: "12-lora", buildsOn: "full-model fine-tuning, the step InstructGPT uses" },
  { slug: "13-dpo", buildsOn: "InstructGPT (paper 10): the separate reward model and the PPO loop" },
];

export const glossary: { id: string; term: string; definition: string }[] = [
  { id: "embedding", term: "Embedding", definition: "A list of numbers that stands for a word or sentence, so similar meanings can sit near each other." },
  { id: "attention", term: "Attention", definition: "A weighted average over other vectors. The weights say how much each one matters for the current step, and they sum to 1." },
  { id: "softmax", term: "Softmax", definition: "Turns a list of scores into positive weights that add up to 1." },
  { id: "encoder", term: "Encoder", definition: "The part of a model that reads the input and builds a representation of it." },
  { id: "decoder", term: "Decoder", definition: "The part that writes the output one step at a time, often while looking back at the input." },
  { id: "token", term: "Token", definition: "A piece of text the model treats as one step, often a word or a part of a word." },
  { id: "fine-tuning", term: "Fine-tuning", definition: "More training of an existing model on a narrower task, which updates its weights." },
  { id: "rank", term: "Rank", definition: "How many independent directions a matrix can use. A low-rank update is built from only a few of them." },
  { id: "rlhf", term: "RLHF", definition: "Reinforcement learning from human feedback: people rank answers, a reward model learns those rankings, and the language model is trained to score well without drifting too far." },
  { id: "loss", term: "Loss", definition: "A number the training procedure tries to make smaller. For language models it is often how surprised the model is by the next token." },
  { id: "preference-pair", term: "Preference pair", definition: "Two answers to the same prompt, with a label for which one is better: the chosen answer y_w and the rejected answer y_l." },
  { id: "reference-model", term: "Reference model", definition: "A frozen copy of the model from before preference training, usually the supervised fine-tune. DPO measures the new model against it." },
  { id: "implicit-reward", term: "Implicit reward", definition: "A score read off the policy itself: β times the log of the new model's probability of an answer, divided by the reference model's probability." },
  { id: "beta", term: "Beta (β)", definition: "The KL strength in DPO and RLHF. A small β lets the model move further from the reference to satisfy preferences. A large β keeps it close, and it also scales the implicit reward." },
  { id: "bradley-terry", term: "Bradley-Terry model", definition: "A model of pairwise preferences: the chance that one answer is preferred is a sigmoid of the difference between the two answers' rewards." },
  { id: "kl-divergence", term: "KL divergence", definition: "A measure of how far one probability distribution has moved from another. In DPO it is how far the new policy has drifted from the reference." },
  { id: "partition-function", term: "Partition function", definition: "Z(x), the normalizer that makes the optimal policy's probabilities add up to 1 for a prompt. In DPO it cancels, because both answers share the same prompt." },
  { id: "ppo", term: "PPO", definition: "Proximal Policy Optimization, the reinforcement-learning algorithm InstructGPT uses to chase scores from a reward model. DPO does not run it." },
  { id: "win-rate", term: "Win rate", definition: "The share of comparisons in which one system's answer is judged better, by a person or by a model used as a judge." },
  { id: "reward-over-optimization", term: "Reward over-optimization", definition: "When a model keeps chasing an imperfect reward until answers look good to the scorer and worse to people. DPO's weighting fades the push once a pair is already clearly ranked." },
];
