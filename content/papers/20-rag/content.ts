import type { PaperMeta } from "@/content/types";

export const meta = {
  number: 20,
  slug: "20-rag",
  title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
  authors:
    "Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela, Facebook AI Research, University College London, and New York University",
  year: 2020,
  url: "https://arxiv.org/abs/2005.11401",
  sent: "2026-11-18",
  hook: "Look up Wikipedia passages, then write the answer. The index can be swapped without retraining.",
  explanation: [
    [
      "Today's paper is ",
      {
        text: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
        href: "https://arxiv.org/abs/2005.11401",
      },
      " by Patrick Lewis and colleagues at Facebook AI Research, University College London, and New York University (NeurIPS 2020), the paper that gave RAG its name. Big models like GPT-3 keep what they know in their weights. That memory is hard to check, hard to update, and when it runs out the model often makes something up. ReAct and Toolformer looked facts up through tools. RAG builds the lookup into the model itself.",
    ],
    [
      "It has two parts. A retriever (DPR, two BERT encoders) turns the question into a vector and finds the closest of 21 million Wikipedia passages by dot product. A generator (BART, a 400 million parameter sequence-to-sequence model) reads the question with each passage and writes the answer. Nobody labels which passage is right: RAG adds up the answer's probability over the top passages, weighted by how relevant each looks, and trains the two together on plain question and answer pairs. It set records on open-domain question answering (44.5 exact match on Natural Questions versus 34.5 for the 11 billion parameter T5) and wrote more factual Jeopardy questions than BART (42.7% versus 7.1%). When its 2018 Wikipedia index was swapped for a 2016 one, its answers about world leaders followed the index (70% correct with the matching year, 4% with the wrong one), with no retraining. The official port is in ",
      { text: "Hugging Face Transformers", href: "https://huggingface.co/docs/transformers/model_doc/rag" },
      ", the training scripts are in ",
      { text: "transformers-research-projects", href: "https://github.com/huggingface/transformers-research-projects/tree/main/rag" },
      ", and the retriever is ",
      { text: "facebookresearch/DPR", href: "https://github.com/facebookresearch/DPR" },
      ".",
    ],
  ],
  question:
    "In your own words, how does RAG combine a retriever with a generator, and why does keeping knowledge in a swappable document index, instead of only in the model's weights, help?",
  answer:
    "The retriever is DPR: a BERT query encoder plus precomputed BERT vectors for 21 million 100-word Wikipedia passages in a FAISS index. It encodes the input and fetches the top passages by largest dot product, giving each a probability p(z|x). The generator, BART-large, reads the input joined with each passage and scores the output. The passage is a hidden choice that gets summed out. RAG-Sequence uses one passage for the whole answer. RAG-Token remixes passages at every token. Training minimises the negative log probability of the answer, with no labels for which passage is right. The query encoder and BART learn. The passage index stays frozen. A swappable index helps because facts can be updated without retraining: with a December 2016 versus December 2018 index, accuracy was 70% and 68% when the index matched the year, and 12% and 4% when it did not. You can see which passages an answer came from. On Jeopardy, raters found RAG more factual 42.7% of the time and BART more factual 7.1% of the time. A smaller model plus an index beat a huge closed-book model: 626 million trainable parameters reached 44.5 exact match on Natural Questions, versus 34.5 for T5-11B. It still repeats whatever its documents say, the retriever starts from DPR trained with retrieval labels, retrieval can collapse on tasks like story generation, and BM25 beat the learned retriever on FEVER.",
} satisfies PaperMeta;
